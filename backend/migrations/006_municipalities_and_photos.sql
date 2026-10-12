-- Apply after 005. Municipal names are populated by scripts/import-municipalities.mjs.
CREATE TABLE IF NOT EXISTS municipalities (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  province TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('metropolitan', 'district', 'local'))
);
CREATE INDEX IF NOT EXISTS municipalities_name_idx ON municipalities (name);

-- Guided issue labels are choices, not fabricated reports or pre-filled evidence.
CREATE TABLE IF NOT EXISTS service_issue_types (
  category TEXT NOT NULL REFERENCES service_categories(name),
  label TEXT NOT NULL,
  PRIMARY KEY (category, label)
);
INSERT INTO service_issue_types (category, label) VALUES
  ('Water & Sanitation', 'Water leak'), ('Water & Sanitation', 'No water supply'), ('Water & Sanitation', 'Blocked drain'), ('Water & Sanitation', 'Sewage overflow'),
  ('Electricity', 'Power outage'), ('Electricity', 'Exposed cable'), ('Electricity', 'Damaged transformer'),
  ('Roads & Potholes', 'Pothole'), ('Roads & Potholes', 'Damaged road surface'), ('Roads & Potholes', 'Broken traffic signal'),
  ('Street Lighting', 'Street light not working'), ('Street Lighting', 'Damaged street light'),
  ('Waste Management', 'Missed waste collection'), ('Waste Management', 'Illegal dumping'), ('Waste Management', 'Overflowing bin'),
  ('Parks & Recreation', 'Damaged playground'), ('Parks & Recreation', 'Overgrown public space'),
  ('Other', 'Other service issue')
ON CONFLICT DO NOTHING;

-- The original image is stored transactionally with the report in PostgreSQL.
-- Limit uploads at the API; do not put image bytes in report list responses.
CREATE TABLE IF NOT EXISTS report_photos (
  report_id UUID PRIMARY KEY REFERENCES service_reports(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp')),
  data BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
