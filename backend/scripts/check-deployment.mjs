const isPlaceholder = (value) => !value || /replace-with|example\.gov|change-me|localhost/i.test(value);
const errors = [];

if (process.env.NODE_ENV === 'production' && isPlaceholder(process.env.AUTH_SECRET)) {
  errors.push('AUTH_SECRET must be a long, unique production secret.');
}
const hasEmail = !isPlaceholder(process.env.RESEND_API_KEY) && !isPlaceholder(process.env.MFA_EMAIL_FROM);
const hasSms = !isPlaceholder(process.env.TWILIO_ACCOUNT_SID)
  && !isPlaceholder(process.env.TWILIO_AUTH_TOKEN)
  && /^\+[1-9]\d{7,14}$/.test(process.env.TWILIO_FROM_NUMBER || '');
if (!hasEmail && !hasSms) errors.push('Configure Resend (RESEND_API_KEY + verified MFA_EMAIL_FROM) or Twilio (SID + auth token + E.164 sender number).');
if (hasEmail && !/\S+@\S+/.test(process.env.MFA_EMAIL_FROM)) errors.push('MFA_EMAIL_FROM must contain a valid sender address.');
if (hasEmail && process.env.MFA_EMAIL_FROM.includes('onboarding@resend.dev')) console.warn('Warning: onboarding@resend.dev is a Resend testing sender and may only deliver to the email address associated with your Resend account.');
if (hasSms && !/^\+[1-9]\d{7,14}$/.test(process.env.TWILIO_FROM_NUMBER)) errors.push('TWILIO_FROM_NUMBER must be an E.164 number.');

if (errors.length) {
  console.error('Deployment configuration is incomplete:');
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`MFA configuration is present (${hasEmail ? 'Resend email' : ''}${hasEmail && hasSms ? ' + ' : ''}${hasSms ? 'Twilio SMS' : ''}).`);
  console.log('Provider credentials were not printed. Verify delivery with a real staff/admin contact after starting the backend.');
}
