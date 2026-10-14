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
  'Report status integration tests only run against a local API.');
assert.ok(databaseUrl, 'Set DATABASE_URL or configure backend/.env before running the tests.');
assert.ok(['localhost', '127.0.0.1', '::1'].includes(new URL(databaseUrl).hostname),
  'Report status integration tests only run against a local database.');
assert.ok(authSecret, 'Set AUTH_SECRET or configure backend/.env before running the tests.');
const health = await fetch(new URL('/health', apiUrl), { signal: AbortSignal.timeout(10_000) });
assert.equal(health.status, 200, 'Start the local API before running the report status integration test.');

const { Client } = pg;
const database = new Client({ connectionString: databaseUrl });
await database.connect();

const testId = randomUUID();
const municipality = `Report Status Test ${testId}`;
const staffEmail = `report-status-staff-${testId}@local.invalid`;
const citizenEmail = `report-status-citizen-${testId}@local.invalid`;
const staff = await database.query(
  `INSERT INTO app_users (full_name, email, role, municipality)
   VALUES ('Report Status API Test Staff', $1, 'staff', $2)
   RETURNING id`,
  [staffEmail, municipality],
);
const citizen = await database.query(
  `INSERT INTO app_users (full_name, email, role)
   VALUES ('Report Status API Test Citizen', $1, 'citizen')
   RETURNING id`,
  [citizenEmail],
);
const report = await database.query(
  `INSERT INTO service_reports
     (public_reference, citizen_id, municipality, category, description, location_text)
   VALUES ($1, $2, $3, 'Other', 'Status API integration test', 'Test location')
   RETURNING id`,
  [`MZ-STATUS-TEST-${testId}`, citizen.rows[0].id, municipality],
);
const payload = Buffer.from(JSON.stringify({
  sub: staff.rows[0].id,
  role: 'staff',
  email: staffEmail,
  municipality,
  exp: Math.floor(Date.now() / 1000) + 60,
})).toString('base64url');
const signature = createHmac('sha256', authSecret).update(payload).digest('base64url');
const staffToken = `${payload}.${signature}`;

test('staff can update a report status and the API writes the audit event', async () => {
  try {
    const response = await fetch(new URL(`/api/reports/${report.rows[0].id}/status`, apiUrl), {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${staffToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ status: 'in_progress' }),
      signal: AbortSignal.timeout(10_000),
    });
    const result = await response.json();

    assert.equal(response.status, 200, result.error || `Unexpected HTTP ${response.status}`);
    assert.equal(result.status, 'in_progress');

    const events = await database.query(
      'SELECT from_status::text, to_status::text FROM report_status_events WHERE report_id = $1',
      [report.rows[0].id],
    );
    assert.deepEqual(events.rows, [{ from_status: 'submitted', to_status: 'in_progress' }]);
  } finally {
    await database.query('DELETE FROM service_reports WHERE id = $1', [report.rows[0].id]);
    await database.query('DELETE FROM app_users WHERE id = ANY($1::uuid[])', [
      [staff.rows[0].id, citizen.rows[0].id],
    ]);
    await database.end();
  }
});
