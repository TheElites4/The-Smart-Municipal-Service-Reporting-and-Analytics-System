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
  'Admin staff integration tests only run against a local API.');
assert.ok(databaseUrl, 'Set DATABASE_URL or configure backend/.env before running the tests.');
assert.ok(['localhost', '127.0.0.1', '::1'].includes(new URL(databaseUrl).hostname),
  'Admin staff integration tests only run against a local database.');
assert.ok(authSecret, 'Set AUTH_SECRET or configure backend/.env before running the tests.');
const health = await fetch(new URL('/health', apiUrl), { signal: AbortSignal.timeout(10_000) });
assert.equal(health.status, 200, 'Start the local API before running the admin staff integration test.');

const { Client } = pg;
const database = new Client({ connectionString: databaseUrl });
await database.connect();

const testId = randomUUID();
const email = `admin-staff-test-${testId}@local.invalid`;
const password = `admin-staff-test-${randomUUID()}`;
const payload = Buffer.from(JSON.stringify({
  sub: randomUUID(),
  role: 'admin',
  email: 'local-admin-staff-test',
  exp: Math.floor(Date.now() / 1000) + 60,
})).toString('base64url');
const signature = createHmac('sha256', authSecret).update(payload).digest('base64url');
const adminToken = `${payload}.${signature}`;
const request = (method, route, body, token = adminToken) => fetch(new URL(route, apiUrl), {
  method,
  headers: {
    ...(token ? { authorization: `Bearer ${token}` } : {}),
    ...(body ? { 'content-type': 'application/json' } : {}),
  },
  ...(body ? { body: JSON.stringify(body) } : {}),
  signal: AbortSignal.timeout(10_000),
});

test('admin can create staff and deactivate the account while preserving its history', async () => {
  let staffId;
  try {
    const unauthorizedCreate = await request('POST', '/api/staff', {
      fullName: 'Unauthorized Test',
      email,
      password,
      municipality: 'Test Municipality',
      phone: '+27821234567',
    }, '');
    assert.equal(unauthorizedCreate.status, 403);

    const invalidPhone = await request('POST', '/api/staff', {
      fullName: 'Invalid Phone Test',
      email,
      password,
      municipality: 'Test Municipality',
      phone: '0821234567',
    });
    assert.equal(invalidPhone.status, 400);

    const created = await request('POST', '/api/staff', {
      fullName: 'Admin Staff Test',
      email,
      password,
      municipality: 'Test Municipality',
      phone: '+27821234567',
    });
    const account = await created.json();
    assert.equal(created.status, 201, account.error || 'Staff account was not created.');
    assert.equal(account.email, email);
    assert.equal(account.role, 'staff');
    staffId = account.id;

    const unauthorizedDelete = await request('DELETE', `/api/staff/${staffId}`, undefined, '');
    assert.equal(unauthorizedDelete.status, 403);

    const removed = await request('DELETE', `/api/staff/${staffId}`);
    const removedAccount = await removed.json();
    assert.equal(removed.status, 200, removedAccount.error || 'Staff account was not deactivated.');
    assert.equal(removedAccount.id, staffId);
    assert.equal(removedAccount.isActive, false);

    const stored = await database.query(
      'SELECT role, is_active FROM app_users WHERE id = $1',
      [staffId],
    );
    assert.deepEqual(stored.rows[0], { role: 'staff', is_active: false });

    const inactiveLogin = await request('POST', '/api/auth/login', { email, password });
    assert.equal(inactiveLogin.status, 401);

    const repeatRemoval = await request('DELETE', `/api/staff/${staffId}`);
    assert.equal(repeatRemoval.status, 404);
  } finally {
    if (staffId) await database.query('DELETE FROM app_users WHERE id = $1', [staffId]);
    await database.end();
  }
});
