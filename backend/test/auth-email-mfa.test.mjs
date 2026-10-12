import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const backendDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envText = await readFile(path.join(backendDirectory, '.env'), 'utf8').catch(() => '');
const fileEnv = Object.fromEntries(envText.split(/\r?\n/).flatMap((line) => {
  const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
  return match ? [[match[1], match[2].replace(/^(['"])(.*)\1$/, '$2')]] : [];
}));
const apiUrl = new URL(process.env.API_BASE_URL || 'http://127.0.0.1:8787');
const databaseUrl = process.env.DATABASE_URL || fileEnv.DATABASE_URL;
assert.ok(['localhost', '127.0.0.1', '::1'].includes(apiUrl.hostname),
  'Email MFA integration tests only run against a local API.');
assert.ok(databaseUrl, 'Set DATABASE_URL or configure backend/.env before running the tests.');
assert.ok(['localhost', '127.0.0.1', '::1'].includes(new URL(databaseUrl).hostname),
  'Email MFA integration tests only run against a local database.');
const health = await fetch(new URL('/health', apiUrl), { signal: AbortSignal.timeout(10_000) });
assert.equal(health.status, 200, 'Start the local API before running the email MFA integration test.');

const { Client } = pg;
const database = new Client({ connectionString: databaseUrl });
await database.connect();
const testEmail = `email-mfa-test-${randomUUID()}@local.invalid`;
const password = `email-mfa-test-${randomUUID()}`;
const account = await database.query(
  `INSERT INTO app_users (full_name, email, role, password_hash)
   VALUES ('Email MFA API Test', $1, 'staff', crypt($2, gen_salt('bf')))
   RETURNING id`,
  [testEmail, password],
);

test('password login returns an expiring Firebase email challenge, not a dashboard token', async () => {
  try {
    const response = await fetch(new URL('/api/auth/login', apiUrl), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password }),
      signal: AbortSignal.timeout(10_000),
    });
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.mfaRequired, 'firebase-email');
    assert.equal(result.user.email, testEmail);
    assert.equal(result.user.role, 'staff');
    assert.equal(typeof result.mfaToken, 'string');
    assert.equal('token' in result, false);

    const challenge = JSON.parse(Buffer.from(result.mfaToken.split('.')[0], 'base64url').toString());
    assert.equal(challenge.sub, account.rows[0].id);
    assert.equal(challenge.email, testEmail);
    assert.equal(challenge.role, 'staff');
    assert.equal(challenge.purpose, 'firebase-email-mfa');
    assert.ok(challenge.exp > Math.floor(Date.now() / 1000));

    const missingChallenge = await fetch(new URL('/api/auth/firebase-email-verify', apiUrl), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: testEmail, idToken: 'untrusted' }),
      signal: AbortSignal.timeout(10_000),
    });
    assert.equal(missingChallenge.status, 400);

    const invalidChallenge = await fetch(new URL('/api/auth/firebase-email-verify', apiUrl), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: testEmail, idToken: 'untrusted', mfaToken: 'not-a-valid-challenge' }),
      signal: AbortSignal.timeout(10_000),
    });
    assert.equal(invalidChallenge.status, 401);
    assert.match((await invalidChallenge.json()).error, /password verification/i);
  } finally {
    await database.query('DELETE FROM app_users WHERE id = $1', [account.rows[0].id]);
    await database.end();
  }
});
