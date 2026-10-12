CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE user_role AS ENUM ('citizen', 'staff', 'admin');
CREATE TYPE report_status AS ENUM ('submitted', 'under_review', 'assigned', 'in_progress', 'resolved', 'closed', 'rejected');
CREATE TYPE urgency_level AS ENUM ('low', 'medium', 'high', 'critical');

CREATE TABLE app_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  password_hash TEXT,
  external_ref TEXT UNIQUE,
  role user_role NOT NULL DEFAULT 'citizen',
  municipality TEXT,
  department TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE service_categories (
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

CREATE TABLE service_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_reference TEXT NOT NULL UNIQUE,
  citizen_id UUID NOT NULL REFERENCES app_users(id),
  municipality TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  location_text TEXT NOT NULL,
  latitude NUMERIC(9,6),
  longitude NUMERIC(9,6),
  urgency urgency_level NOT NULL DEFAULT 'medium',
  status report_status NOT NULL DEFAULT 'submitted',
  sla_due_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE report_assignments (
  report_id UUID PRIMARY KEY REFERENCES service_reports(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES app_users(id),
  assigned_by UUID REFERENCES app_users(id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE TABLE report_status_events (
  id BIGSERIAL PRIMARY KEY,
  report_id UUID NOT NULL REFERENCES service_reports(id) ON DELETE CASCADE,
  from_status report_status,
  to_status report_status NOT NULL,
  changed_by UUID REFERENCES app_users(id),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_events (
  id BIGSERIAL PRIMARY KEY,
  actor_id UUID REFERENCES app_users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE auth_mfa_challenges (
  challenge_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  delivery_method TEXT NOT NULL CHECK (delivery_method IN ('email', 'sms')),
  attempts SMALLINT NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX service_reports_queue_idx ON service_reports (municipality, status, urgency, created_at DESC);
CREATE INDEX service_reports_citizen_idx ON service_reports (citizen_id, created_at DESC);
CREATE INDEX assignments_staff_idx ON report_assignments (staff_id, assigned_at DESC);
CREATE INDEX users_workforce_idx ON app_users (role, municipality, is_active);
CREATE INDEX auth_mfa_user_created_idx ON auth_mfa_challenges (user_id, created_at DESC);

CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER app_users_touch BEFORE UPDATE ON app_users FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER reports_touch BEFORE UPDATE ON service_reports FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
