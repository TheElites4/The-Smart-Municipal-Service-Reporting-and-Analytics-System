import crypto from 'node:crypto';

/**
 * TOTP (RFC 6238) multi-factor authentication for the staff/admin dashboards.
 *
 * This is a self-contained implementation built only on node:crypto so the API
 * keeps a single runtime dependency (pg). It generates the shared secret, builds
 * the otpauth:// provisioning URI that Google Authenticator scans, encrypts the
 * secret at rest with AES-256-GCM, and verifies submitted codes with a small
 * clock-drift window.
 *
 * Security properties:
 *  - Secrets are encrypted at rest; the key comes from TOTP_ENCRYPTION_KEY and
 *    is never written to the database.
 *  - Code comparison is constant-time to avoid leaking a code via timing.
 *  - A used time-step is recorded so a code cannot be replayed inside its
 *    30-second window.
 */

const DIGITS = 6;
const PERIOD_SECONDS = 30;
// Accept the previous, current, and next step so a slightly-skewed phone clock
// still works. Three steps is the common industry tolerance.
const DRIFT_STEPS = 1;
const RECOVERY_CODE_COUNT = 10;

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** Encrypt/decrypt key. Must be present in production; falls back for local dev. */
const encryptionKey = () => {
  const configured = process.env.TOTP_ENCRYPTION_KEY;
  if (configured && configured.trim()) {
    // Accept a 64-char hex key or any passphrase, normalised to 32 bytes.
    const trimmed = configured.trim();
    return /^[0-9a-f]{64}$/i.test(trimmed)
      ? Buffer.from(trimmed, 'hex')
      : crypto.createHash('sha256').update(trimmed).digest();
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('TOTP_ENCRYPTION_KEY must be configured in production');
  }
  // Local development only: derive a stable key from AUTH_SECRET so restarts
  // do not invalidate already-enrolled authenticators.
  return crypto.createHash('sha256')
    .update(`totp-dev-key:${process.env.AUTH_SECRET || 'development-only-change-this-secret'}`)
    .digest();
};

/** RFC 4648 base32 (no padding) - the encoding Google Authenticator expects. */
const base32Encode = (buffer) => {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
};

const base32Decode = (input) => {
  const clean = String(input || '').toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const bytes = [];
  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) continue;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
};

/** A fresh 160-bit secret, matching the RFC 4226 recommendation. */
const generateSecret = () => base32Encode(crypto.randomBytes(20));

/** HOTP (RFC 4226): HMAC-SHA1 counter -> truncated decimal code. */
const hotp = (secretBuffer, counter) => {
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const digest = crypto.createHmac('sha1', secretBuffer).update(counterBuffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return String(binary % 10 ** DIGITS).padStart(DIGITS, '0');
};

const currentStep = (atMillis = Date.now()) => Math.floor(atMillis / 1000 / PERIOD_SECONDS);

/** The 6-digit code for a given time step. Used by tests and enrollment confirm. */
const generateCode = (secret, step = currentStep()) => hotp(base32Decode(secret), step);

/** The otpauth:// URI Google Authenticator scans from the QR code. */
const buildProvisioningUri = ({ secret, accountName, issuer = 'MzansiConnect' }) => {
  const label = encodeURIComponent(`${issuer}:${accountName}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: String(DIGITS),
    period: String(PERIOD_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
};

/** AES-256-GCM encrypt, returned as base64url `iv:tag:ciphertext`. */
const encryptSecret = (secret) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ciphertext].map((part) => part.toString('base64url')).join(':');
};

const decryptSecret = (payload) => {
  const [ivPart, tagPart, dataPart] = String(payload || '').split(':');
  if (!ivPart || !tagPart || !dataPart) throw new Error('Malformed TOTP secret payload');
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivPart, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(dataPart, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
};

/**
 * Verify a submitted code against an encrypted secret.
 *
 * Returns `{ valid, step }`. `step` is the matched time step so the caller can
 * persist it and reject replays. `lastUsedStep` is the highest step already
 * consumed for this account; any match at or below it is refused.
 */
const verifyCode = (encryptedSecret, submittedCode, lastUsedStep = null) => {
  const code = String(submittedCode || '').replace(/\s+/g, '');
  if (!/^\d{6}$/.test(code)) return { valid: false, step: null };
  let secret;
  try {
    secret = decryptSecret(encryptedSecret);
  } catch {
    return { valid: false, step: null };
  }
  const secretBuffer = base32Decode(secret);
  const baseStep = currentStep();
  for (let offset = -DRIFT_STEPS; offset <= DRIFT_STEPS; offset += 1) {
    const step = baseStep + offset;
    if (lastUsedStep !== null && step <= Number(lastUsedStep)) continue;
    const expected = hotp(secretBuffer, step);
    const expectedBuffer = Buffer.from(expected);
    const actualBuffer = Buffer.from(code);
    if (expectedBuffer.length === actualBuffer.length &&
      crypto.timingSafeEqual(expectedBuffer, actualBuffer)) {
      return { valid: true, step };
    }
  }
  return { valid: false, step: null };
};

/** Human-friendly single-use recovery codes, e.g. `4F2K-9QRT`. */
const generateRecoveryCodes = (count = RECOVERY_CODE_COUNT) => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const codes = [];
  for (let i = 0; i < count; i += 1) {
    let code = '';
    const bytes = crypto.randomBytes(8);
    for (let j = 0; j < 8; j += 1) code += alphabet[bytes[j] % alphabet.length];
    codes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
  }
  return codes;
};

const hashRecoveryCode = (code) => crypto.createHash('sha256')
  .update(String(code).toUpperCase().replace(/[^A-Z0-9]/g, ''))
  .digest('hex');

export const totp = {
  DIGITS,
  PERIOD_SECONDS,
  DRIFT_STEPS,
  generateSecret,
  generateCode,
  generateRecoveryCodes,
  hashRecoveryCode,
  buildProvisioningUri,
  encryptSecret,
  decryptSecret,
  verifyCode,
  currentStep,
};