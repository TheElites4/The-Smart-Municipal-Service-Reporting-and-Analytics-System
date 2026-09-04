ALTER TABLE app_users ADD COLUMN IF NOT EXISTS external_ref TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS app_users_external_ref_idx ON app_users (external_ref) WHERE external_ref IS NOT NULL;
