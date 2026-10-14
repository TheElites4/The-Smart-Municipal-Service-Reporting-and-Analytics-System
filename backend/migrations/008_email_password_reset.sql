ALTER TABLE auth_mfa_challenges
  ADD COLUMN IF NOT EXISTS purpose TEXT NOT NULL DEFAULT 'sign-in';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'auth_mfa_challenges_purpose_check'
       AND conrelid = 'auth_mfa_challenges'::regclass
  ) THEN
    ALTER TABLE auth_mfa_challenges
      ADD CONSTRAINT auth_mfa_challenges_purpose_check
      CHECK (purpose IN ('sign-in', 'password-reset'));
  END IF;
END
$$;
