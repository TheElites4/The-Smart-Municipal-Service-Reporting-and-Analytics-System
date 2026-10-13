-- TOTP-based multi-factor authentication for the staff/admin dashboards.
--
-- Replaces the Firebase email-link second factor with RFC 6238 TOTP codes that
-- the user generates in Google Authenticator (or any compatible app).
--
-- The shared secret is NEVER stored in plaintext: `totp_secret` holds an
-- AES-256-GCM ciphertext produced by the API (see totpService in server.js),
-- encoded as base64url `iv:tag:ciphertext`. A database dump alone is therefore
-- not enough to mint valid codes.
ALTER TABLE app_users
  ADD COLUMN IF NOT EXISTS totp_secret TEXT,
  ADD COLUMN IF NOT EXISTS totp_enabled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS totp_last_used_step BIGINT;

-- A user has MFA fully active only once they have confirmed a code and we have
-- stamped totp_enabled_at. The partial index keeps the "who still needs to
-- enroll" admin query cheap without indexing every citizen row.
CREATE INDEX IF NOT EXISTS users_totp_pending_idx
  ON app_users (role, created_at DESC)
  WHERE totp_enabled_at IS NULL AND role IN ('staff', 'admin');

-- Single-use recovery codes, issued at enrollment so a lost phone does not lock
-- an administrator out permanently. Only the hash is stored.
CREATE TABLE IF NOT EXISTS auth_totp_recovery_codes (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS totp_recovery_user_idx
  ON auth_totp_recovery_codes (user_id) WHERE consumed_at IS NULL;