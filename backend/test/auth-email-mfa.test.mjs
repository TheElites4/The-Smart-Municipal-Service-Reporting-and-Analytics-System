import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const backendDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envText = await readFile(path.join(backendDirectory, '.env'), 'utf8').catch(() => '');
const fileEnv = Object.fromEntries(envText.split(/\r?\n/).flatMap((line) => {
  const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
  return match ? [[match[1], match[2].replace(/^(['"])(.*)\1$/, '$2')]] : [];
}));
const databaseUrl = process.env.DATABASE_URL || fileEnv.DATABASE_URL;
const authSecret = process.env.AUTH_SECRET || fileEnv.AUTH_SECRET;
assert.ok(databaseUrl, 'Set DATABASE_URL or configure backend/.env before running the email MFA test.');
assert.ok(['localhost', '127.0.0.1', '::1'].includes(new URL(databaseUrl).hostname),
  'Email MFA integration tests only run against a local database.');
assert.ok(authSecret, 'Set AUTH_SECRET or configure backend/.env before running the email MFA test.');

const { Client } = pg;
const database = new Client({ connectionString: databaseUrl });
await database.connect();
const testId = randomUUID();
const staffEmail = `email-mfa-staff-${testId}@local.invalid`;
const adminEmail = `email-mfa-admin-${testId}@local.invalid`;
const password = `email-mfa-test-${randomUUID()}`;
const accounts = await database.query(
  `INSERT INTO app_users (full_name, email, role, password_hash)
   VALUES ('Email MFA Staff Test', $1, 'staff', crypt($3, gen_salt('bf'))),
          ('Email MFA Admin Test', $2, 'admin', crypt($3, gen_salt('bf')))
   RETURNING id, email, role`,
  [staffEmail, adminEmail, password],
);

const findFreePort = async () => {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
};

const emails = [];
const smtpServer = net.createServer((socket) => {
  socket.setEncoding('utf8');
  socket.write('220 localhost test SMTP\r\n');
  let buffer = '';
  let dataMode = false;
  let authMode = '';
  let message = '';
  socket.on('data', (chunk) => {
    buffer += chunk;
    while (buffer.includes('\r\n')) {
      const split = buffer.indexOf('\r\n');
      const line = buffer.slice(0, split);
      buffer = buffer.slice(split + 2);
      if (dataMode) {
        if (line === '.') {
          dataMode = false;
          emails.push(message);
          message = '';
          socket.write('250 2.0.0 queued\r\n');
        } else {
          message += `${line}\n`;
        }
      } else if (authMode === 'username') {
        authMode = 'password';
        socket.write('334 UGFzc3dvcmQ6\r\n');
      } else if (authMode === 'password') {
        authMode = '';
        socket.write('235 2.7.0 authenticated\r\n');
      } else if (/^EHLO\b/i.test(line)) {
        socket.write('250-localhost\r\n250-AUTH LOGIN PLAIN\r\n250 SIZE 10485760\r\n');
      } else if (/^HELO\b/i.test(line)) {
        socket.write('250 localhost\r\n');
      } else if (/^AUTH PLAIN(?:\s|$)/i.test(line)) {
        socket.write('235 2.7.0 authenticated\r\n');
      } else if (/^AUTH LOGIN/i.test(line)) {
        authMode = 'username';
        socket.write('334 VXNlcm5hbWU6\r\n');
      } else if (/^(MAIL FROM|RCPT TO)\b/i.test(line)) {
        socket.write('250 2.1.0 accepted\r\n');
      } else if (/^DATA$/i.test(line)) {
        dataMode = true;
        socket.write('354 end with <CRLF>.<CRLF>\r\n');
      } else if (/^QUIT$/i.test(line)) {
        socket.write('221 2.0.0 bye\r\n');
        socket.end();
      } else {
        socket.write('250 2.0.0 ok\r\n');
      }
    }
  });
});
await new Promise((resolve, reject) => {
  smtpServer.once('error', reject);
  smtpServer.listen(0, '127.0.0.1', resolve);
});
const smtpPort = smtpServer.address().port;
const apiPort = await findFreePort();
const apiUrl = new URL(`http://127.0.0.1:${apiPort}`);
const apiProcess = spawn(process.execPath, ['src/server.js'], {
  cwd: backendDirectory,
  env: {
    ...process.env,
    DATABASE_URL: databaseUrl,
    AUTH_SECRET: authSecret,
    PORT: String(apiPort),
    SMTP_HOST: '127.0.0.1',
    SMTP_PORT: String(smtpPort),
    SMTP_SECURE: 'false',
    SMTP_USER: 'sender@local.invalid',
    SMTP_APP_PASSWORD: 'test-only-password',
    SMTP_FROM: 'MzansiConnect <sender@local.invalid>',
  },
  stdio: 'inherit',
});

const waitForApi = async () => {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (apiProcess.exitCode !== null) throw new Error(`Test API exited with code ${apiProcess.exitCode}.`);
    try {
      const response = await fetch(new URL('/health', apiUrl), { signal: AbortSignal.timeout(500) });
      if (response.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error('Timed out starting the test API.');
};

after(async () => {
  apiProcess.kill();
  await new Promise((resolve) => {
    if (apiProcess.exitCode !== null) return resolve();
    apiProcess.once('exit', resolve);
    setTimeout(resolve, 3000);
  });
  await new Promise((resolve, reject) => smtpServer.close((error) => error ? reject(error) : resolve()));
  await database.query('DELETE FROM app_users WHERE id = ANY($1::uuid[])', [accounts.rows.map((account) => account.id)]);
  await database.end();
});
await waitForApi();

const post = (route, body) => fetch(new URL(route, apiUrl), {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
  signal: AbortSignal.timeout(10_000),
});

const requestLoginCode = async (email) => {
  const response = await post('/api/auth/login', { email, password });
  const result = await response.json();
  assert.equal(response.status, 200, result.error || `Unexpected HTTP ${response.status}`);
  assert.equal(result.mfaRequired, 'email-otp');
  assert.equal('token' in result, false, 'a dashboard token must not be issued before email verification');
  assert.equal(result.user.email, email);
  const challenge = JSON.parse(Buffer.from(result.mfaToken.split('.')[0], 'base64url').toString());
  assert.equal(challenge.purpose, 'email-otp-mfa');
  assert.ok(challenge.challengeId);
  const emailMessage = emails.findLast((message) => message.toLowerCase().includes(email.toLowerCase()));
  assert.ok(emailMessage, 'the API should deliver a login code to the account email');
  const code = emailMessage.match(/verification code is:\s*(\d{6})/i)?.[1];
  assert.ok(code, 'the email should contain a 6-digit login code');
  return { mfaToken: result.mfaToken, code };
};

test('staff email OTP is sent, required, single-use, and exchanged for a session', async () => {
  const { mfaToken, code } = await requestLoginCode(staffEmail);
  const emailsSent = emails.length;
  const throttled = await post('/api/auth/login', { email: staffEmail, password });
  assert.equal(throttled.status, 429, 'repeated code requests must respect the cooldown');
  assert.equal(emails.length, emailsSent, 'the cooldown must prevent an additional email');

  const wrongCode = code === '000000' ? '000001' : '000000';
  const wrong = await post('/api/auth/email/verify', { mfaToken, code: wrongCode });
  assert.equal(wrong.status, 401);

  const verified = await post('/api/auth/email/verify', { mfaToken, code });
  const result = await verified.json();
  assert.equal(verified.status, 200, result.error || `Unexpected HTTP ${verified.status}`);
  assert.equal(result.user.role, 'staff');
  assert.equal(typeof result.token, 'string');

  const replay = await post('/api/auth/email/verify', { mfaToken, code });
  assert.equal(replay.status, 401, 'a consumed email code must not be reusable');
});

test('admin email OTP is also required before issuing a dashboard session', async () => {
  const { mfaToken, code } = await requestLoginCode(adminEmail);
  const verified = await post('/api/auth/email/verify', { mfaToken, code });
  const result = await verified.json();
  assert.equal(verified.status, 200, result.error || `Unexpected HTTP ${verified.status}`);
  assert.equal(result.user.role, 'admin');
  assert.equal(typeof result.token, 'string');
});
