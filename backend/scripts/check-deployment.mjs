const errors = [];

if (process.env.NODE_ENV === 'production'
    && (!process.env.AUTH_SECRET || /replace-with|change-me/i.test(process.env.AUTH_SECRET))) {
  errors.push('AUTH_SECRET must be a long, unique production secret.');
}
if (!process.env.SMTP_USER || /your-account|replace-with|placeholder/i.test(process.env.SMTP_USER)) {
  errors.push('SMTP_USER must be set to the Gmail or Workspace sender address.');
}
if (!process.env.SMTP_APP_PASSWORD || /your-google|replace-with|placeholder/i.test(process.env.SMTP_APP_PASSWORD)) {
  errors.push('SMTP_APP_PASSWORD must be set to a Gmail App Password, not your account password.');
}

if (errors.length) {
  console.error('Deployment configuration is incomplete:');
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log('Staff/admin email OTP MFA configuration is present.');
}
