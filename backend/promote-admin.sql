-- Promote / create the Mhlengie Prince admin account.
-- Replace REPLACE_WITH_PASSWORD with a strong unique password BEFORE running.
-- Requires the app schema (schema.sql) to already be applied.

INSERT INTO app_users (
  full_name, email, password_hash, role,
  municipality, department, is_active
)
VALUES (
  'Mhlengie Prince',
  'mhlengip269@gmail.com',
  crypt('mhl3ngiprince', gen_salt('bf')),
  'admin',
  'City of Johannesburg',
  'Municipal Operations',
  TRUE
)
ON CONFLICT (email) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  password_hash = EXCLUDED.password_hash,
  role = 'admin',
  municipality = EXCLUDED.municipality,
  department = EXCLUDED.department,
  is_active = TRUE,
  updated_at = now();

SELECT email, role, is_active
FROM app_users
WHERE email = 'mhlengip269@gmail.com';
