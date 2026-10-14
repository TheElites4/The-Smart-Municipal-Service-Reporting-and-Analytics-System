import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import http from 'node:http';
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
const resetEmail = `email-reset-staff-${testId}@local.invalid`;
const adminEmail = `email-mfa-admin-${testId}@local.invalid`;
const failedEmail = `email-mfa-failed-${testId}@local.invalid`;
const password = `email-mfa-test-${randomUUID()}`;
const accounts = await database.query(
  `INSERT INTO app_users (full_name, email, role, password_hash)
   VALUES ('Email MFA Staff Test', $1, 'staff', crypt($5, gen_salt('bf'))),
          ('Email Reset Staff Test', $2, 'staff', crypt($5, gen_salt('bf'))),
          ('Email MFA Admin Test', $3, 'admin', crypt($5, gen_salt('bf'))),
          ('Email MFA Failure Test', $4, 'staff', crypt($5, gen_salt('bf')))
   RETURNING id, email, role`,
  [staffEmail, resetEmail, adminEmail, failedEmail, password],
);

const collectBody = async (request) => {
  let raw = '';
  for await (const chunk of request) raw += chunk;
  return raw;
};

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
let rejectNextGmailSend = false;
let mockOAuthScope = 'https://www.googleapis.com/auth/gmail.send';
const gmailApiMock = http.createServer(async (request, response) => {
  const requestBody = await collectBody(request);
  if (request.method === 'POST' && request.url === '/token') {
    const tokenRequest = new URLSearchParams(requestBody);
    assert.equal(tokenRequest.get('client_id'), 'test-client-id');
    assert.equal(tokenRequest.get('client_secret'), 'test-client-secret');
    assert.equal(tokenRequest.get('refresh_token'), 'test-refresh-token');
    assert.equal(tokenRequest.get('grant_type'), 'refresh_token');
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({
      access_token: 'test-access-token',
      expires_in: 1,
      scope: mockOAuthScope,
    }));
    return;
  }
  if (request.method === 'POST' && request.url === '/gmail/v1/users/me/messages/send') {
    assert.equal(request.headers.authorization, 'Bearer test-access-token');
    if (rejectNextGmailSend) {
      rejectNextGmailSend = false;
      response.writeHead(403, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: 'test Gmail API failure' }));
      return;
    }
    const { raw } = JSON.parse(requestBody);
    const message = Buffer.from(raw, 'base64url').toString('utf8');
    const [, encodedBody = ''] = message.split(/\r?\n\r?\n/);
    const text = Buffer.from(encodedBody.replace(/\s/g, ''), 'base64').toString('utf8');
    const recipient = message.match(/^To:\s*(.+)$/mi)?.[1];
    emails.push({ recipient, message, text });
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ id: randomUUID(), threadId: randomUUID() }));
    return;
  }
  response.writeHead(404, { 'content-type': 'application/json' });
  response.end(JSON.stringify({ error: 'not found' }));
});
await new Promise((resolve, reject) => {
  gmailApiMock.once('error', reject);
  gmailApiMock.listen(0, '127.0.0.1', resolve);
});
const gmailMockUrl = `http://127.0.0.1:${gmailApiMock.address().port}`;
const apiPort = await findFreePort();
const apiUrl = new URL(`http://127.0.0.1:${apiPort}`);
const apiProcess = spawn(process.execPath, [
  '--import', './test/helpers/mock-gmail-api-fetch.mjs',
  'src/server.js',
], {
  cwd: backendDirectory,
  env: {
    ...process.env,
    DATABASE_URL: databaseUrl,
    AUTH_SECRET: authSecret,
    PORT: String(apiPort),
    GMAIL_USER: 'sender@local.invalid',
    GMAIL_CLIENT_ID: 'test-client-id',
    GMAIL_CLIENT_SECRET: 'test-client-secret',
    GMAIL_REFRESH_TOKEN: 'test-refresh-token',
    GMAIL_API_MOCK_URL: gmailMockUrl,
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
  await new Promise((resolve, reject) => gmailApiMock.close((error) => error ? reject(error) : resolve()));
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
  const emailMessage = emails.findLast((message) => message.recipient?.toLowerCase() === email.toLowerCase());
  assert.ok(emailMessage, 'the Gmail API should deliver a login code to the account email');
  assert.match(emailMessage.message, /^Subject: Your MzansiConnect sign-in verification code$/mi);
  const code = emailMessage.text.match(/verification code is:\s*(\d{6})/i)?.[1];
  assert.ok(code, 'the email should contain a 6-digit login code');
  return { mfaToken: result.mfaToken, code };
};

const requestPasswordResetCode = async (email) => {
  const response = await post('/api/auth/password/reset/request', { email });
  const result = await response.json();
  assert.equal(response.status, 200, result.error || `Unexpected HTTP ${response.status}`);
  assert.match(result.message, /If an active staff or administrator account matches that email/);
  const emailMessage = emails.findLast((message) => message.recipient?.toLowerCase() === email.toLowerCase());
  assert.ok(emailMessage, 'the Gmail API should deliver a password reset code to the account email');
  assert.match(emailMessage.message, /^Subject: Your MzansiConnect password reset verification code$/mi);
  const code = emailMessage.text.match(/password reset verification code is:\s*(\d{6})/i)?.[1];
  assert.ok(code, 'the password reset email should contain a 6-digit verification code');
  return code;
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

test('staff and admin passwords can only be reset using the emailed one-time code', async () => {
  const resetCode = await requestPasswordResetCode(resetEmail);
  const newPassword = `email-reset-test-${randomUUID()}`;
  const wrongCode = resetCode === '000000' ? '000001' : '000000';
  const rejected = await post('/api/auth/password/reset/confirm', {
    email: resetEmail,
    code: wrongCode,
    password: newPassword,
    confirmPassword: newPassword,
  });
  assert.equal(rejected.status, 401);

  const invalidPassword = await post('/api/auth/password/reset/confirm', {
    email: resetEmail,
    code: resetCode,
    password: 'short',
    confirmPassword: 'short',
  });
  assert.equal(invalidPassword.status, 400);

  const mismatch = await post('/api/auth/password/reset/confirm', {
    email: resetEmail,
    code: resetCode,
    password: newPassword,
    confirmPassword: `different-${randomUUID()}`,
  });
  assert.equal(mismatch.status, 400);

  const confirmed = await post('/api/auth/password/reset/confirm', {
    email: resetEmail,
    code: resetCode,
    password: newPassword,
    confirmPassword: newPassword,
  });
  const result = await confirmed.json();
  assert.equal(confirmed.status, 200, result.error || `Unexpected HTTP ${confirmed.status}`);
  assert.equal(result.passwordUpdated, true);

  const stored = await database.query(
    'SELECT password_hash = crypt($1, password_hash) AS password_matches FROM app_users WHERE email = $2',
    [newPassword, resetEmail],
  );
  assert.equal(stored.rows[0].password_matches, true);

  const replayPassword = `another-reset-test-${randomUUID()}`;
  const replay = await post('/api/auth/password/reset/confirm', {
    email: resetEmail,
    code: resetCode,
    password: replayPassword,
    confirmPassword: replayPassword,
  });
  assert.equal(replay.status, 401, 'a reset code must not be reusable');

  const login = await post('/api/auth/login', { email: resetEmail, password: newPassword });
  const loginResult = await login.json();
  assert.equal(login.status, 200, loginResult.error || `Unexpected HTTP ${login.status}`);
  assert.equal(loginResult.mfaRequired, 'email-otp', 'the new password must work for dashboard sign-in');
});

test('password reset requests do not disclose unknown accounts', async () => {
  const emailsBefore = emails.length;
  const response = await post('/api/auth/password/reset/request', {
    email: `unknown-reset-${randomUUID()}@local.invalid`,
  });
  const result = await response.json();

  assert.equal(response.status, 200);
  assert.match(result.message, /If an active staff or administrator account matches that email/);
  assert.equal(emails.length, emailsBefore, 'unknown accounts must not receive email');
});

test('admin email OTP is also required before issuing a dashboard session', async () => {
  const { mfaToken, code } = await requestLoginCode(adminEmail);
  const verified = await post('/api/auth/email/verify', { mfaToken, code });
  const result = await verified.json();
  assert.equal(verified.status, 200, result.error || `Unexpected HTTP ${verified.status}`);
  assert.equal(result.user.role, 'admin');
  assert.equal(typeof result.token, 'string');
});

test('Gmail API delivery failures do not create a usable email OTP challenge', async () => {
  mockOAuthScope = 'https://www.googleapis.com/auth/gmail.readonly';
  const scopeResponse = await post('/api/auth/login', { email: failedEmail, password });
  const scopeResult = await scopeResponse.json();

  assert.equal(scopeResponse.status, 503);
  assert.match(scopeResult.error, /missing the required https:\/\/www\.googleapis\.com\/auth\/gmail\.send permission/);
  assert.equal(scopeResult.mfaRequired, undefined);
  assert.equal(scopeResult.token, undefined);

  mockOAuthScope = 'https://www.googleapis.com/auth/gmail.send';
  rejectNextGmailSend = true;
  const response = await post('/api/auth/login', { email: failedEmail, password });
  const result = await response.json();

  assert.equal(response.status, 503);
  assert.match(result.error, /Gmail message send failed with HTTP 403/);
  assert.equal(result.mfaRequired, undefined);
  assert.equal(result.token, undefined);
  const failedAccount = accounts.rows.find((account) => account.email === failedEmail);
  const challenges = await database.query(
    `SELECT challenge_id FROM auth_mfa_challenges
      WHERE user_id = $1 AND delivery_method = 'email'`,
    [failedAccount.id],
  );
  assert.equal(challenges.rowCount, 0);
});
