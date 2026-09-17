INSERT INTO app_users (full_name, email, password_hash, role, municipality, department)
VALUES
  ('Operations Staff', 'staff@example.gov.za', crypt('ChangeMeStaff!2026', gen_salt('bf')), 'staff', 'City of Johannesburg', 'Roads and Infrastructure'),
  ('System Administrator', 'admin@example.gov.za', crypt('ChangeMeAdmin!2026', gen_salt('bf')), 'admin', 'City of Johannesburg', 'Municipal Operations')
ON CONFLICT (email) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  password_hash = EXCLUDED.password_hash,
  role = EXCLUDED.role,
  municipality = EXCLUDED.municipality,
  department = EXCLUDED.department,
  is_active = TRUE,
  updated_at = now();

SELECT email, role, is_active FROM app_users WHERE email IN ('admin@example.gov.za', 'staff@example.gov.za');
