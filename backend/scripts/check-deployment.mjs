const errors = [];

if (process.env.NODE_ENV === 'production'
    && (!process.env.AUTH_SECRET || /replace-with|change-me/i.test(process.env.AUTH_SECRET))) {
  errors.push('AUTH_SECRET must be a long, unique production secret.');
}
const provider = String(process.env.MFA_PROVIDER || 'firebase').toLowerCase();
const firebaseProjectId = process.env.FIREBASE_PROJECT_ID || '';
if (provider !== 'firebase') errors.push('MFA_PROVIDER must be firebase; staff/admin dashboard MFA requires Firebase email-link authentication.');
if (!firebaseProjectId) errors.push('FIREBASE_PROJECT_ID is required (e.g. mzansireport-e01b4).');
if (firebaseProjectId && !/^[a-z0-9-]{4,}$/i.test(firebaseProjectId)) errors.push('FIREBASE_PROJECT_ID does not look like a Firebase project id.');

if (errors.length) {
  console.error('Deployment configuration is incomplete:');
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Staff/admin MFA configuration is present (Firebase email-link auth, project ${firebaseProjectId}).`);
  console.log('Ensure a Firebase Web app is configured in firebase-config.js and Phone sign-in is enabled in the console.');
}
