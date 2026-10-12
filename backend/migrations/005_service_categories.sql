CREATE TABLE IF NOT EXISTS service_categories (
  name TEXT PRIMARY KEY,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO service_categories (name) VALUES
  ('Water & Sanitation'),
  ('Electricity'),
  ('Roads & Potholes'),
  ('Street Lighting'),
  ('Waste Management'),
  ('Parks & Recreation'),
  ('Other')
ON CONFLICT (name) DO NOTHING;