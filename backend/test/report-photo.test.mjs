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
const authSecret = process.env.AUTH_SECRET || fileEnv.AUTH_SECRET || 'development-only-change-this-secret';
const externalRef = `report-photo-test-${randomUUID()}`;
const adminEmail = `${externalRef}@local.invalid`;
const staffEmail = `${externalRef}-staff@local.invalid`;
const photoBytes = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jNioAAAAASUVORK5CYII=',
  'base64',
);

assert.ok(['localhost', '127.0.0.1', '::1'].includes(apiUrl.hostname),
  'Report photo integration tests only run against a local API.');
assert.ok(databaseUrl, 'Set DATABASE_URL or configure backend/.env before running the tests.');
assert.ok(['localhost', '127.0.0.1', '::1'].includes(new URL(databaseUrl).hostname),
  'Report photo integration tests only run against a local database.');
const health = await fetch(new URL('/health', apiUrl), { signal: AbortSignal.timeout(10_000) });
assert.equal(health.status, 200, 'Start the local API before running the report photo integration test.');

const { Client } = pg;
const database = new Client({ connectionString: databaseUrl });
await database.connect();

let citizenId;
let adminId;
let staffId;
let reportId;

const signDashboardToken = (id, role, municipality) => {
  const payload = Buffer.from(JSON.stringify({
    sub: id,
    role,
    ...(municipality ? { municipality } : {}),
    exp: Math.floor(Date.now() / 1000) + 60,
  })).toString('base64url');
  const signature = createHmac('sha256', authSecret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
};

test('citizen report photo is stored and immediately available to authorized dashboards', async () => {
  try {
    const optionsResponse = await fetch(new URL('/api/options', apiUrl));
    assert.equal(optionsResponse.status, 200);
    const options = await optionsResponse.json();
    const municipality = options.municipalities[0];

    const reportResponse = await fetch(new URL('/api/reports', apiUrl), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        externalRef,
        municipality,
        category: 'Other',
        description: 'Automated evidence photo upload test',
        location: 'Integration test location',
        photo: { contentType: 'image/png', base64: photoBytes.toString('base64') },
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const report = await reportResponse.json();
    assert.equal(reportResponse.status, 201, report.error || 'Photo report was not saved.');
    assert.equal(report.has_photo, true);
    reportId = report.id;

    const citizen = await database.query(
      'SELECT id FROM app_users WHERE external_ref = $1',
      [externalRef],
    );
    citizenId = citizen.rows[0]?.id;
    assert.ok(citizenId, 'The test citizen identity should be persisted.');

    const storedPhoto = await database.query(
      'SELECT content_type, data FROM report_photos WHERE report_id = $1',
      [reportId],
    );
    assert.equal(storedPhoto.rows[0]?.content_type, 'image/png');
    assert.deepEqual(storedPhoto.rows[0]?.data, photoBytes, 'Image bytes should be stored unchanged in PostgreSQL.');

    const citizenReportsResponse = await fetch(
      new URL(`/api/reports?externalRef=${encodeURIComponent(externalRef)}`, apiUrl),
    );
    const citizenReports = await citizenReportsResponse.json();
    assert.equal(citizenReports.find((item) => item.id === reportId)?.has_photo, true);

    const citizenPhotoResponse = await fetch(
      new URL(`/api/reports/${reportId}/photo?externalRef=${encodeURIComponent(externalRef)}`, apiUrl),
    );
    assert.equal(citizenPhotoResponse.status, 200);
    assert.equal(citizenPhotoResponse.headers.get('content-type'), 'image/png');
    assert.deepEqual(Buffer.from(await citizenPhotoResponse.arrayBuffer()), photoBytes);

    const admin = await database.query(
      `INSERT INTO app_users (full_name, email, role)
       VALUES ('Report Photo Integration Test', $1, 'admin')
       RETURNING id`,
      [adminEmail],
    );
    adminId = admin.rows[0].id;
    const adminToken = signDashboardToken(adminId, 'admin');

    const dashboardResponse = await fetch(new URL('/api/dashboard', apiUrl), {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(dashboardResponse.status, 200);
    const dashboard = await dashboardResponse.json();
    assert.equal(dashboard.reports.find((item) => item.id === reportId)?.has_photo, true);

    const dashboardPhotoResponse = await fetch(new URL(`/api/reports/${reportId}/photo`, apiUrl), {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(dashboardPhotoResponse.status, 200);
    assert.deepEqual(Buffer.from(await dashboardPhotoResponse.arrayBuffer()), photoBytes);

    const staff = await database.query(
      `INSERT INTO app_users (full_name, email, role, municipality)
       VALUES ('Report Photo Integration Test', $1, 'staff', $2)
       RETURNING id`,
      [staffEmail, municipality],
    );
    staffId = staff.rows[0].id;
    const staffToken = signDashboardToken(staffId, 'staff', municipality);
    const staffDashboardResponse = await fetch(new URL('/api/dashboard', apiUrl), {
      headers: { authorization: `Bearer ${staffToken}` },
    });
    assert.equal(staffDashboardResponse.status, 200);
    const staffDashboard = await staffDashboardResponse.json();
    assert.equal(staffDashboard.reports.find((item) => item.id === reportId)?.has_photo, true);

    const staffPhotoResponse = await fetch(new URL(`/api/reports/${reportId}/photo`, apiUrl), {
      headers: { authorization: `Bearer ${staffToken}` },
    });
    assert.equal(staffPhotoResponse.status, 200);
    assert.deepEqual(Buffer.from(await staffPhotoResponse.arrayBuffer()), photoBytes);
  } finally {
    if (reportId) await database.query('DELETE FROM service_reports WHERE id = $1', [reportId]);
    if (citizenId) await database.query('DELETE FROM app_users WHERE id = $1', [citizenId]);
    if (adminId) await database.query('DELETE FROM app_users WHERE id = $1', [adminId]);
    if (staffId) await database.query('DELETE FROM app_users WHERE id = $1', [staffId]);
  }
});

test.after(async () => {
  await database.end();
});
