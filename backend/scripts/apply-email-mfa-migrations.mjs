import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('Set DATABASE_URL to the existing PostgreSQL database before applying email MFA migrations');

const backendDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const migrationFiles = [
  'migrations/004_mfa_challenges.sql',
  'migrations/008_email_password_reset.sql',
];
const client = new pg.Client({ connectionString: databaseUrl });
let inTransaction = false;

await client.connect();
try {
  await client.query('BEGIN');
  inTransaction = true;
  await client.query('SELECT pg_advisory_xact_lock($1::bigint)', ['83420917232']);

  const existingSchema = await client.query("SELECT to_regclass('public.app_users') AS table_name");
  if (!existingSchema.rows[0].table_name) {
    throw new Error('Database does not contain app_users; refusing to apply migrations to an uninitialized database');
  }

  for (const file of migrationFiles) {
    const sql = await readFile(path.join(backendDirectory, file), 'utf8');
    await client.query(sql);
  }

  await client.query('COMMIT');
  inTransaction = false;
  console.log('Applied email MFA migrations 004 and 008 successfully. The operation is safe to repeat.');
} catch (error) {
  if (inTransaction) await client.query('ROLLBACK');
  throw error;
} finally {
  await client.end();
}
