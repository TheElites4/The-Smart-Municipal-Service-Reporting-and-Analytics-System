CREATE TABLE IF NOT EXISTS auth_mfa_challenges (
  challenge_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  delivery_method TEXT NOT NULL CHECK (delivery_method IN ('email', 'sms')),
  attempts SMALLINT NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auth_mfa_user_created_idx ON auth_mfa_challenges (user_id, created_at DESC);