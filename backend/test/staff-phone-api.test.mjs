import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
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
const authSecret = process.env.AUTH_SECRET || fileEnv.AUTH_SECRET;

assert.ok(['localhost', '127.0.0.1', '::1'].includes(apiUrl.hostname),
  'Staff phone integration tests only run against a local API.');
assert.ok(databaseUrl, 'Set DATABASE_URL or configure backend/.env before running the tests.');
assert.ok(['localhost', '127.0.0.1', '::1'].includes(new URL(databaseUrl).hostname),
  'Staff phone integration tests only run against a local database.');
assert.ok(authSecret, 'Set AUTH_SECRET or configure backend/.env before running the tests.');
const health = await fetch(new URL('/health', apiUrl), { signal: AbortSignal.timeout(10_000) });
assert.equal(health.status, 200, 'Start the local API before running the staff phone integration test.');

const { Client } = pg;
const database = new Client({ connectionString: databaseUrl });
await database.connect();

const testId = randomUUID();
const staffEmail = `staff-phone-test-${testId}@local.invalid`;
const citizenEmail = `staff-phone-test-citizen-${testId}@local.invalid`;
const staff = await database.query(
  `INSERT INTO app_users (full_name, email, role, phone)
   VALUES ('Staff Phone API Test', $1, 'staff', NULL)
   RETURNING id`,
  [staffEmail],
);
await database.query(
  `INSERT INTO app_users (full_name, email, role)
   VALUES ('Staff Phone API Test Citizen', $1, 'citizen')`,
  [citizenEmail],
);

const payload = Buffer.from(JSON.stringify({
  sub: randomUUID(),
  role: 'admin',
  email: 'local-staff-phone-test-admin',
  exp: Math.floor(Date.now() / 1000) + 60,
})).toString('base64url');
const signature = createHmac('sha256', authSecret).update(payload).digest('base64url');
const adminToken = `${payload}.${signature}`;
const requestUpdate = (body, token = adminToken) => fetch(new URL('/api/staff/phone', apiUrl), {
  method: 'PATCH',
  headers: {
    ...(token ? { authorization: `Bearer ${token}` } : {}),
    'content-type': 'application/json',
  },
  body: JSON.stringify(body),
  signal: AbortSignal.timeout(10_000),
});

test('staff phone update is admin-only, validates E.164, and updates staff accounts only', async () => {
  try {
    const unauthorized = await requestUpdate({ email: staffEmail, phone: '+27821234567' }, '');
    assert.equal(unauthorized.status, 403);

    const invalidPhone = await requestUpdate({ email: staffEmail, phone: '0821234567' });
    assert.equal(invalidPhone.status, 400);

    const update = await requestUpdate({ email: staffEmail, phone: ' +27821234567 ' });
    assert.equal(update.status, 200);
    const updatedAccount = await update.json();
    assert.equal(updatedAccount.id, staff.rows[0].id);
    assert.equal(updatedAccount.email, staffEmail);
    assert.equal(updatedAccount.phone, '+27821234567');
    assert.equal(updatedAccount.phoneUpdated, true);

    const citizenUpdate = await requestUpdate({ email: citizenEmail, phone: '+27821234567' });
    assert.equal(citizenUpdate.status, 404);

    const missingStaff = await requestUpdate({
      email: `missing-${testId}@local.invalid`,
      phone: '+27821234567',
    });
    assert.equal(missingStaff.status, 404);
  } finally {
    await database.query('DELETE FROM app_users WHERE id = ANY($1::uuid[])', [[
      staff.rows[0].id,
      (await database.query('SELECT id FROM app_users WHERE email = $1', [citizenEmail])).rows[0]?.id,
    ].filter(Boolean)]);
    await database.end();
  }
});
