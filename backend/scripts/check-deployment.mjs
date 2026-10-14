const errors = [];

if (process.env.NODE_ENV === 'production'
    && (!process.env.AUTH_SECRET || /replace-with|change-me/i.test(process.env.AUTH_SECRET))) {
  errors.push('AUTH_SECRET must be a long, unique production secret.');
}
if (!process.env.GMAIL_USER || /your-account|replace-with|placeholder/i.test(process.env.GMAIL_USER)) {
  errors.push('GMAIL_USER must be set to the Gmail or Workspace sender address.');
}
for (const name of ['GMAIL_CLIENT_ID', 'GMAIL_CLIENT_SECRET', 'GMAIL_REFRESH_TOKEN']) {
  if (!process.env[name] || /replace-with|placeholder/i.test(process.env[name])) {
    errors.push(`${name} must be set to the Google OAuth credential value.`);
  }
}

if (errors.length) {
  console.error('Deployment configuration is incomplete:');
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log('Staff/admin email OTP MFA configuration is present.');
}
