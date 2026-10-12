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
  if (!match) return [];
  const value = match[2].replace(/^(['"])(.*)\1$/, '$2');
  return [[match[1], value]];
}));
const apiUrl = new URL(process.env.API_BASE_URL || 'http://127.0.0.1:8787');
const databaseUrl = process.env.DATABASE_URL || fileEnv.DATABASE_URL;
const expectedMunicipalityCount = 257;
const runId = `municipality-test-${randomUUID()}`;
const timeLimit = 15_000;

assert.ok(['localhost', '127.0.0.1', '::1'].includes(apiUrl.hostname),
  'Municipality integration tests only run against a local API.');
assert.ok(databaseUrl, 'Set DATABASE_URL or configure backend/.env before running the tests.');
const databaseHost = new URL(databaseUrl).hostname;
assert.ok(['localhost', '127.0.0.1', '::1'].includes(databaseHost),
  'Municipality integration tests only run against a local database.');

const optionsResponse = await fetch(new URL('/api/options', apiUrl), {
  signal: AbortSignal.timeout(timeLimit),
});
assert.equal(optionsResponse.status, 200, 'The local API must return report options.');
const options = await optionsResponse.json();
assert.ok(Array.isArray(options.categories) && options.categories.includes('Other'),
  'The API must provide the default report category.');
assert.ok(Array.isArray(options.municipalities),
  'The API must provide a municipality list.');
const municipalities = options.municipalities;

const { Client } = pg;
const database = new Client({ connectionString: databaseUrl });
await database.connect();

test('GET /api/options returns all 257 municipality records', () => {
  assert.equal(municipalities.length, expectedMunicipalityCount);
  assert.ok(municipalities.every((municipality) => typeof municipality === 'string' && municipality.trim()));
});

test('The imported municipality directory has the expected province-wide coverage', async () => {
  const result = await database.query(
    'SELECT kind, count(*)::int AS count FROM municipalities GROUP BY kind ORDER BY kind',
  );
  assert.deepEqual(
    Object.fromEntries(result.rows.map(({ kind, count }) => [kind, count])),
    { district: 44, local: 205, metropolitan: 8 },
  );
});

test('POST /api/reports accepts a report for every API municipality', async (suite) => {
  for (const [index, municipality] of municipalities.entries()) {
    await suite.test(municipality, async () => {
      const externalRef = `${runId}-${String(index).padStart(3, '0')}`;
      try {
        const response = await fetch(new URL('/api/reports', apiUrl), {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          signal: AbortSignal.timeout(timeLimit),
          body: JSON.stringify({
            externalRef,
            category: 'Other',
            description: `Automated municipality integration test ${index + 1}`,
            location: 'Automated test location',
            municipality,
            urgency: 'low',
          }),
        });
        const body = await response.json();
        assert.equal(response.status, 201, body.error || `Unexpected HTTP ${response.status}`);
        assert.equal(body.municipality, municipality);
        assert.equal(body.category, 'Other');
        assert.equal(body.status, 'submitted');
      } finally {
        const citizen = await database.query(
          'SELECT id FROM app_users WHERE external_ref = $1',
          [externalRef],
        );
        if (citizen.rows[0]) {
          await database.query(
            'DELETE FROM service_reports WHERE citizen_id = $1',
            [citizen.rows[0].id],
          );
          await database.query(
            'DELETE FROM app_users WHERE id = $1 AND external_ref = $2',
            [citizen.rows[0].id, externalRef],
          );
        }
      }
    });
  }
});

test.after(async () => {
  await database.end();
});
