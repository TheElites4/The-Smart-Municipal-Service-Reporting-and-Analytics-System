import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { totp } from '../src/totp.js';

const backendDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envText = await readFile(path.join(backendDirectory, '.env'), 'utf8').catch(() => '');
const fileEnv = Object.fromEntries(envText.split(/\r?\n/).flatMap((line) => {
  const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
  return match ? [[match[1], match[2].replace(/^(['"])(.*)\1$/, '$2')]] : [];
}));
const apiUrl = new URL(process.env.API_BASE_URL || 'http://127.0.0.1:8787');
const databaseUrl = process.env.DATABASE_URL || fileEnv.DATABASE_URL;
assert.ok(['localhost', '127.0.0.1', '::1'].includes(apiUrl.hostname),
  'TOTP MFA integration tests only run against a local API.');
assert.ok(databaseUrl, 'Set DATABASE_URL or configure backend/.env before running the tests.');
assert.ok(['localhost', '127.0.0.1', '::1'].includes(new URL(databaseUrl).hostname),
  'TOTP MFA integration tests only run against a local database.');
const health = await fetch(new URL('/health', apiUrl), { signal: AbortSignal.timeout(10_000) });
assert.equal(health.status, 200, 'Start the local API before running the TOTP MFA integration test.');

const { Client } = pg;
const database = new Client({ connectionString: databaseUrl });
await database.connect();

const testEmail = `totp-mfa-test-${randomUUID()}@local.invalid`;
const password = `totp-mfa-test-${randomUUID()}`;
const account = await database.query(
  `INSERT INTO app_users (full_name, email, role, password_hash)
   VALUES ('TOTP MFA API Test', $1, 'staff', crypt($2, gen_salt('bf')))
   RETURNING id`,
  [testEmail, password],
);
const accountId = account.rows[0].id;

const post = (path, payload) => fetch(new URL(path, apiUrl), {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(payload),
  signal: AbortSignal.timeout(10_000),
});

test('full TOTP lifecycle: enroll, activate, verify, and reject replays', async () => {
  try {
    // 1. Password login must return an enrollment challenge, never a token.
    const login = await post('/api/auth/login', { email: testEmail, password });
    assert.equal(login.status, 200);
    const loginResult = await login.json();
    assert.equal(loginResult.mfaRequired, 'totp-enroll');
    assert.equal('token' in loginResult, false, 'a dashboard token must not be issued before MFA');
    assert.equal(typeof loginResult.mfaToken, 'string');
    const challenge = JSON.parse(Buffer.from(loginResult.mfaToken.split('.')[0], 'base64url').toString());
    assert.equal(challenge.purpose, 'totp-mfa');
    assert.equal(challenge.sub, accountId);

    // 2. Enrollment returns a provisioning URI and a manual key.
    const enroll = await post('/api/auth/totp/enroll', { mfaToken: loginResult.mfaToken });
    assert.equal(enroll.status, 200);
    const enrollResult = await enroll.json();
    assert.ok(enrollResult.otpauthUri.startsWith('otpauth://totp/'));
    assert.equal(typeof enrollResult.secret, 'string');
    assert.ok(enrollResult.secret.length >= 16);

    // The secret must be stored encrypted, never in plaintext.
    const stored = await database.query('SELECT totp_secret, totp_enabled_at FROM app_users WHERE id = $1', [accountId]);
    assert.ok(stored.rows[0].totp_secret, 'the secret should be persisted');
    assert.notEqual(stored.rows[0].totp_secret, enrollResult.secret, 'the secret must not be stored in plaintext');
    assert.equal(stored.rows[0].totp_enabled_at, null, 'MFA must not be active until the code is confirmed');

    // 3. A wrong code must not activate MFA.
    const wrong = await post('/api/auth/totp/activate', { mfaToken: loginResult.mfaToken, code: '000000' });
    assert.equal(wrong.status, 401);

    // 4. The correct code activates MFA and returns recovery codes + a token.
    // Use the PREVIOUS step for activation: it is inside the accepted drift
    // window, and it leaves the current step unconsumed for the verify test
    // below (activation records the step it matched to block replays).
    const activateCode = totp.generateCode(enrollResult.secret, totp.currentStep() - 1);
    const activate = await post('/api/auth/totp/activate', { mfaToken: loginResult.mfaToken, code: activateCode });
    assert.equal(activate.status, 200);
    const activateResult = await activate.json();
    assert.equal(activateResult.user.role, 'staff');
    assert.equal(typeof activateResult.token, 'string');
    assert.equal(activateResult.recoveryCodes.length, 10);

    const afterActivate = await database.query('SELECT totp_enabled_at FROM app_users WHERE id = $1', [accountId]);
    assert.ok(afterActivate.rows[0].totp_enabled_at, 'MFA should be active after activation');

    // 5. A fresh login now returns the returning-user challenge.
    const relogin = await post('/api/auth/login', { email: testEmail, password });
    const reloginResult = await relogin.json();
    assert.equal(reloginResult.mfaRequired, 'totp');

    // 6. A valid code issues the dashboard token.
    const verifyCode = totp.generateCode(enrollResult.secret);
    const verify = await post('/api/auth/totp/verify', { mfaToken: reloginResult.mfaToken, code: verifyCode });
    assert.equal(verify.status, 200);
    const verifyResult = await verify.json();
    assert.equal(typeof verifyResult.token, 'string');
    assert.equal(verifyResult.user.role, 'staff');

    // 7. The same code must be refused a second time (replay protection).
    const replay = await post('/api/auth/totp/verify', { mfaToken: reloginResult.mfaToken, code: verifyCode });
    assert.equal(replay.status, 401, 'a consumed code must not verify again');

    // 8. A recovery code works once, then is burned.
    const recoveryCode = activateResult.recoveryCodes[0];
    const recovery = await post('/api/auth/totp/verify', { mfaToken: reloginResult.mfaToken, code: recoveryCode });
    assert.equal(recovery.status, 200);
    assert.equal((await recovery.json()).usedRecoveryCode, true);
    const recoveryReuse = await post('/api/auth/totp/verify', { mfaToken: reloginResult.mfaToken, code: recoveryCode });
    assert.equal(recoveryReuse.status, 401, 'a recovery code must not be reusable');

    // 9. A forged or missing challenge is refused outright.
    const forged = await post('/api/auth/totp/verify', { mfaToken: 'not-a-valid-challenge', code: verifyCode });
    assert.equal(forged.status, 401);
    assert.match((await forged.json()).error, /password verification/i);
  } finally {
    await database.query('DELETE FROM app_users WHERE id = $1', [accountId]);
  }
});

test('an admin account without enrollment is challenged to enroll, not issued a token', async () => {
  const adminEmail = `totp-admin-test-${randomUUID()}@local.invalid`;
  const adminPassword = `totp-admin-test-${randomUUID()}`;
  const created = await database.query(
    `INSERT INTO app_users (full_name, email, role, password_hash)
     VALUES ('TOTP Admin API Test', $1, 'admin', crypt($2, gen_salt('bf')))
     RETURNING id`,
    [adminEmail, adminPassword],
  );
  try {
    const response = await post('/api/auth/login', { email: adminEmail, password: adminPassword });
    const result = await response.json();
    assert.equal(result.mfaRequired, 'totp-enroll');
    assert.equal('token' in result, false);
  } finally {
    await database.query('DELETE FROM app_users WHERE id = $1', [created.rows[0].id]);
    await database.end();
  }
});