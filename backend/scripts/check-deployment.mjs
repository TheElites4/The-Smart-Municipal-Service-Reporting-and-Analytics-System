const errors = [];

if (process.env.NODE_ENV === 'production'
    && (!process.env.AUTH_SECRET || /replace-with|change-me/i.test(process.env.AUTH_SECRET))) {
  errors.push('AUTH_SECRET must be a long, unique production secret.');
}
const provider = String(process.env.MFA_PROVIDER || 'totp').toLowerCase();
const totpKey = process.env.TOTP_ENCRYPTION_KEY || '';
if (provider !== 'totp') errors.push('MFA_PROVIDER must be totp; staff/admin dashboard MFA uses Google Authenticator.');
if (!totpKey) errors.push('TOTP_ENCRYPTION_KEY is required so TOTP secrets can be encrypted at rest.');
if (totpKey && !/^[0-9a-f]{64}$/i.test(totpKey) && totpKey.length < 32) errors.push('TOTP_ENCRYPTION_KEY should be a 64-char hex string or at least 32 characters.');

if (errors.length) {
  console.error('Deployment configuration is incomplete:');
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log('Staff/admin MFA configuration is present (TOTP via Google Authenticator).');
  console.log('Staff and admins enroll by scanning a QR code on first sign-in.');
}
