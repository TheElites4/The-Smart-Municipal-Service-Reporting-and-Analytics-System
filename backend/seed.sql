INSERT INTO app_users (full_name, email, role, municipality, department)
VALUES
  ('Operations Staff', 'staff@example.gov.za', 'staff', 'City of Johannesburg', 'Roads and Infrastructure'),
  ('System Administrator', 'admin@example.gov.za', 'admin', 'City of Johannesburg', 'Municipal Operations')
ON CONFLICT (email) DO NOTHING;
