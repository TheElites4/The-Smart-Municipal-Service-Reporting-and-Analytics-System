import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('Set DATABASE_URL to an empty PostgreSQL database before setup');

const backendDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const setupFiles = [
  'schema.sql',
  'migrations/002_external_ref.sql',
  'migrations/003_normalise_municipality.sql',
  'migrations/004_mfa_challenges.sql',
  'migrations/005_service_categories.sql',
  'migrations/006_municipalities_and_photos.sql',
];
const client = new pg.Client({ connectionString: databaseUrl });
const lockId = '83420917231';
let inTransaction = false;

await client.connect();
try {
  await client.query('SELECT pg_advisory_lock($1::bigint)', [lockId]);
  const existingSchema = await client.query("SELECT to_regclass('public.app_users') AS table_name");
  if (existingSchema.rows[0].table_name) {
    throw new Error('Database already contains app_users; refusing to initialize it again');
  }

  await client.query('BEGIN');
  inTransaction = true;
  for (const file of setupFiles) {
    const sql = await readFile(path.join(backendDirectory, file), 'utf8');
    await client.query(sql);
  }
  await client.query('COMMIT');
  inTransaction = false;
  console.log(`Initialized an empty PostgreSQL database with ${setupFiles.length} schema files.`);
} catch (error) {
  if (inTransaction) await client.query('ROLLBACK');
  throw error;
} finally {
  await client.query('SELECT pg_advisory_unlock($1::bigint)', [lockId]);
  await client.end();
}
