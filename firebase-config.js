// firebase-config.js - Firebase Web SDK configuration for the MzansiConnect
// staff and admin dashboards (Firebase email-link MFA).
//
// These values are NOT secrets - the Firebase web config is designed to be
// public. Security comes from Firebase Security Rules and from the backend
// verifying the ID token server-side (see POST /api/auth/firebase-email-verify).
//
// Get the Web app values from the Firebase Console:
//   Project settings (gear) -> General -> Your apps -> Web app (</>).
// The projectId below matches google-services.json (mzansireport-e01b4).
// authDomain defaults to "<projectId>.firebaseapp.com" for that project, and
// messagingSenderId equals the project_number in google-services.json.
//
// IMPORTANT: Firebase Email/Password email-link sign-in must be ENABLED in the console
//   Build -> Authentication -> Sign-in method -> Phone  (and add a test number
//   for local development). Web MFA does not work until this is switched on.
window.MZANSI_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyC-Jm001xMqk5gUNWPRQg0uCB7XlJswcVM',
  authDomain: 'mzansireport-e01b4.firebaseapp.com',
  projectId: 'mzansireport-e01b4',
  storageBucket: 'mzansireport-e01b4.firebasestorage.app',
  messagingSenderId: '120778425755',
  appId: '1:120778425755:web:6f0869e205cf5a77c98d3e',
  measurementId: 'G-9Z2V6GXWD8',
  databaseURL: 'https://mzansireport-e01b4-default-rtdb.firebaseio.com',
};
window.MZANSI_API_URL = 'https://mzansi-connect-api.onrender.com';

const firebaseConfigComplete =
  !!window.MZANSI_FIREBASE_CONFIG.appId &&
  !String(window.MZANSI_FIREBASE_CONFIG.appId).includes('REPLACE_WITH_WEB_APP_ID');

if (firebaseConfigComplete && window.firebase &&
    !window.firebase.apps.some((app) => app.name === '[DEFAULT]')) {
  window.firebase.initializeApp(window.MZANSI_FIREBASE_CONFIG);
}

const firebaseDefaultApp = window.firebase?.apps?.find((app) => app.name === '[DEFAULT]');
window.MZANSI_FIREBASE_READY =
  firebaseConfigComplete &&
  firebaseDefaultApp?.options.projectId === window.MZANSI_FIREBASE_CONFIG.projectId;
