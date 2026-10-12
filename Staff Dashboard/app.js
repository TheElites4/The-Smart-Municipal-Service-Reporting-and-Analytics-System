const API = localStorage.getItem('mzansiApiUrl') || (['localhost', '127.0.0.1'].includes(location.hostname) ? 'http://localhost:8787' : window.MZANSI_API_URL || 'http://localhost:8787');
const $ = (id) => document.getElementById(id);
const tokenKey = 'mzansiStaffToken';
let liveConnection;
let latestReports = [];
let pollTimer; // fallback refresh so new citizen reports appear even if the live stream drops
const loginForm = $('login-form');
const authHeaders = (json = false) => ({ ...(json ? { 'content-type': 'application/json' } : {}), authorization: `Bearer ${localStorage.getItem(tokenKey) || ''}` });
const logout = () => { localStorage.removeItem(tokenKey); if (liveConnection) liveConnection.close(); $('app-shell').hidden = true; $('auth-screen').hidden = false; loginForm.hidden = false; };

// Icons + toast helper (no external dependencies).
const icons = {
  grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
  eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>',
  bolt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="m20 6-11 11-5-5"/></svg>',
  inbox: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z"/></svg>',
};
const toastWrap = document.createElement('div');
toastWrap.className = 'toast-wrap';
document.body.appendChild(toastWrap);
function toast(message, isError = false) {
  const el = document.createElement('div');
  el.className = `toast${isError ? ' err' : ''}`;
  el.textContent = message;
  toastWrap.appendChild(el);
  setTimeout(() => el.remove(), 3600);
}

async function login(event) {
  event.preventDefault();
  const button = event.target.querySelector('button[type=submit]');
  button.disabled = true;
  try {
    const response = await fetch(`${API}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: $('login-email').value, password: $('login-password').value }) });
    const result = await response.json();
    // The password is the first factor; an email link proves inbox access.
    if (response.ok && result.mfaRequired === 'firebase-email') {
      await beginFirebaseEmailMfa(result.user.email, result.mfaToken, event.target);
      return;
    }
    if (!response.ok || result.user?.role !== 'staff') { $('auth-error').textContent = response.ok ? 'This account is not authorised for staff operations.' : (result.error || 'Sign in failed.'); return; }
    completeLogin(result);
  } catch (error) {
    $('auth-error').textContent = error instanceof TypeError
      ? 'Network error — is the API running?'
      : (error?.message || 'Could not start email verification.');
  } finally {
    button.disabled = false;
  }
}

// --- Firebase email-link MFA (second factor) -------------------------------
let firebaseAuth;
let pendingMfaEmail;
let pendingMfaToken;
const pendingEmailKey = `${tokenKey}:pendingEmail`;
const pendingMfaTokenKey = `${tokenKey}:pendingMfaToken`;

function firebaseMfaAvailable() {
  return window.MZANSI_FIREBASE_READY && window.firebase && window.MZANSI_FIREBASE_CONFIG?.projectId;
}

function firebaseEmailError(error) {
  switch (error?.code) {
    case 'auth/unauthorized-domain':
      return 'This dashboard domain is not authorized for Firebase Authentication. Add it under Firebase Authentication settings.';
    case 'auth/operation-not-allowed':
      return 'Firebase email-link sign-in is disabled. Enable Email/Password and email-link sign-in in Firebase Authentication.';
    case 'auth/too-many-requests':
      return 'Firebase temporarily limited verification emails. Wait before requesting another link.';
    case 'auth/quota-exceeded':
      return 'The Firebase email quota has been reached. Check the project limits.';
    case 'auth/invalid-action-code':
    case 'auth/expired-action-code':
      return 'This verification link has expired or was already used. Sign in again to request a new link.';
    case 'auth/invalid-email':
      return 'Firebase rejected the account email address. Check the email on the dashboard account.';
    default:
      return error?.message || 'Could not send or verify the email link.';
  }
}

async function beginFirebaseEmailMfa(email, mfaToken, loginForm) {
  if (!firebaseMfaAvailable()) {
    throw new Error('Firebase web configuration is incomplete. Check firebase-config.js.');
  }
  if (typeof mfaToken !== 'string' || !mfaToken) {
    throw new Error('Password verification expired. Sign in again to request a new email link.');
  }
  pendingMfaEmail = email;
  pendingMfaToken = mfaToken;
  if (!firebaseAuth) firebaseAuth = firebase.auth();
  sessionStorage.setItem(pendingEmailKey, email);
  sessionStorage.setItem(pendingMfaTokenKey, mfaToken);
  $('mfa-email').value = email;
  $('mfa-email').readOnly = true;
  loginForm.hidden = true;
  $('mfa-form').hidden = false;
  $('mfa-error').textContent = '';
  $('mfa-form').querySelector('.mfa-hint').textContent = `We’ll email a secure sign-in link to ${email}. Open it in this browser to finish signing in.`;
  await sendFirebaseEmailLink();
}

async function sendFirebaseEmailLink() {
  const email = pendingMfaEmail || $('mfa-email').value.trim();
  if (!email) { $('mfa-error').textContent = 'Enter the account email address.'; return; }
  if (!firebaseAuth) firebaseAuth = firebase.auth();
  const send = $('mfa-send');
  send.disabled = true;
  $('mfa-error').textContent = '';
  try {
    firebaseAuth.languageCode = 'en';
    const returnUrl = new URL(location.pathname, location.origin);
    returnUrl.searchParams.set('mfaToken', pendingMfaToken);
    await firebaseAuth.sendSignInLinkToEmail(email, {
      url: returnUrl.href,
      handleCodeInApp: true,
    });
    pendingMfaEmail = email;
    sessionStorage.setItem(pendingEmailKey, email);
    $('mfa-email').value = email;
    $('mfa-email').readOnly = true;
    send.textContent = 'Resend email link';
    $('mfa-form').querySelector('.mfa-hint').textContent = `Verification link sent to ${email}. Check your inbox and spam folder, then open it in this browser.`;
  } catch (error) {
    $('mfa-error').textContent = firebaseEmailError(error);
  } finally {
    send.disabled = false;
  }
}

async function completeFirebaseEmailLink(email) {
  if (!firebaseAuth) firebaseAuth = firebase.auth();
  const mfaToken = pendingMfaToken || getMfaTokenFromLink();
  if (!mfaToken) {
    $('mfa-error').textContent = 'Password verification expired. Go back and sign in again before opening a new email link.';
    return;
  }
  const button = $('mfa-send');
  button.disabled = true;
  $('mfa-error').textContent = '';
  try {
    const credential = await firebaseAuth.signInWithEmailLink(email, location.href);
    const idToken = await credential.user.getIdToken();
    const response = await fetch(`${API}/api/auth/firebase-email-verify`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, idToken, mfaToken }),
    });
    const result = await response.json();
    if (!response.ok || result.user?.role !== 'staff') {
      $('mfa-error').textContent = result.error || 'Email verification failed.';
      return;
    }
    sessionStorage.removeItem(pendingEmailKey);
    sessionStorage.removeItem(pendingMfaTokenKey);
    pendingMfaToken = null;
    await firebaseAuth.signOut();
    history.replaceState({}, document.title, `${location.pathname}${location.hash}`);
    completeLogin(result);
  } catch (error) {
    $('mfa-error').textContent = firebaseEmailError(error);
  } finally {
    button.disabled = false;
  }
}

function getMfaTokenFromLink() {
  try {
    const params = new URL(location.href).searchParams;
    const directToken = params.get('mfaToken');
    if (directToken) return directToken;
    const continueUrl = params.get('continueUrl');
    return continueUrl ? new URL(continueUrl).searchParams.get('mfaToken') : null;
  } catch {
    return null;
  }
}

async function handleFirebaseEmailLink() {
  if (!firebaseMfaAvailable() || !firebase.auth().isSignInWithEmailLink(location.href)) return;
  firebaseAuth = firebase.auth();
  const storedEmail = sessionStorage.getItem(pendingEmailKey);
  pendingMfaToken = sessionStorage.getItem(pendingMfaTokenKey) || getMfaTokenFromLink();
  $('login-form').hidden = true;
  $('mfa-form').hidden = false;
  $('mfa-email').value = storedEmail || '';
  $('mfa-email').readOnly = Boolean(storedEmail);
  $('mfa-form').querySelector('.mfa-hint').textContent = storedEmail
    ? 'Verifying your email sign-in link…'
    : 'Enter the same account email that received this link.';
  if (storedEmail) await completeFirebaseEmailLink(storedEmail);
}

function completeLogin(result) {
  localStorage.setItem(tokenKey, result.token);
  $('auth-screen').hidden = true;
  $('app-shell').hidden = false;
  Promise.resolve(load()).then(connectLive).catch(() => {});
  loadLoadShedding();
  toast(`Signed in as ${result.user.fullName || result.user.email || 'staff'}`);
}

const statusLabel = (status) => String(status || '').replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());

function renderQueue() {
  const term = $('queue-search').value.trim().toLowerCase();
  const jobs = latestReports.filter((report) => !['resolved', 'closed'].includes(report.status));
  const filtered = term ? jobs.filter((report) => [report.public_reference, report.category, report.description, report.location_text, report.citizen_name].join(' ').toLowerCase().includes(term)) : jobs;
  $('queue').innerHTML = '';
  if (!filtered.length) {
    $('queue').innerHTML = `<div class="empty">${icons.inbox}<div>${term ? 'No open jobs match your search.' : 'No open jobs in this queue.'}</div></div>`;
    return;
  }
  filtered.forEach((report) => {
    const node = $('job-template').content.cloneNode(true); const job = node.querySelector('.job');
    job.classList.add(`urgency-${String(report.urgency || 'medium').toLowerCase()}`);
    job.querySelector('.reference').textContent = report.public_reference; job.querySelector('.category').textContent = report.category;
    job.querySelector('.description').textContent = report.description;
    job.querySelector('.location').textContent = `📍 ${report.location_text}`;
    job.querySelector('.citizen').textContent = `Citizen: ${report.citizen_name || 'Unknown'}`;
    job.querySelector('.status-chip').textContent = statusLabel(report.status);
    const urgency = job.querySelector('.urgency');
    urgency.textContent = report.urgency; urgency.classList.add(String(report.urgency || 'medium').toLowerCase());
    job.querySelector('.status').value = report.status;
    const saveButton = job.querySelector('.save');
    saveButton.onclick = async () => {
      saveButton.disabled = true;
      try {
        const response = await fetch(`${API}/api/reports/${report.id}/status`, { method: 'PATCH', headers: authHeaders(true), body: JSON.stringify({ status: job.querySelector('.status').value }) });
        if (response.status === 401 || response.status === 403) return logout();
        if (!response.ok) { toast('Could not update report status', true); return; }
        toast(`${report.public_reference} → ${statusLabel(job.querySelector('.status').value)}`);
        await load();
      } catch {
        toast('Network error — is the API running?', true);
      } finally {
        saveButton.disabled = false;
      }
    };
    $('queue').appendChild(node);
  });
}

async function load() {
  const response = await fetch(`${API}/api/dashboard`, { headers: authHeaders() });
  if (response.status === 401 || response.status === 403) return logout();
  if (!response.ok) throw new Error('Dashboard data unavailable');
  const data = await response.json();
  $('metrics').innerHTML = [
    ['total', 'Total reports', 'grid', 'tone-total'],
    ['unassigned', 'Needs review', 'eye', 'tone-review'],
    ['in_progress', 'In progress', 'bolt', 'tone-active'],
    ['resolved', 'Resolved', 'check', 'tone-resolved'],
  ].map(([key, label, icon, tone]) => `<div class="metric ${tone}"><span class="stat-icon">${icons[icon]}</span><strong>${data.summary[key] || 0}</strong><span>${label}</span></div>`).join('');
  $('updated').textContent = `Live queue · updated ${new Date().toLocaleTimeString()}`;
  latestReports = data.reports;
  renderQueue();
}

// Live load-shedding provider, mirroring the Android dashboard banner
// (DashboardFragment.loadLoadSheddingStatus -> GET /api/location/status).
async function loadLoadShedding() {
  const detail = $('loadshedding-detail');
  const source = $('loadshedding-source');
  if (!detail) return;
  try {
    const response = await fetch(`${API}/api/location/status`);
    const status = await response.json();
    if (!response.ok) throw new Error(status.error || `Provider request failed (HTTP ${response.status}).`);
    const stage = Number(status.stage) || 0;
    const areas = Array.isArray(status.areas) && status.areas.length ? ` · ${status.areas.join(', ')}` : '';
    detail.textContent = status.current && stage > 0
      ? `Stage ${stage} active${areas}`
      : `No active load shedding${areas}`;
    $('loadshedding').classList.toggle('active', Boolean(status.current && stage > 0));
    source.textContent = status.source ? `${status.source}${status.updatedAt ? ` · ${new Date(status.updatedAt).toLocaleTimeString()}` : ''}` : '';
  } catch (error) {
    detail.textContent = error instanceof Error ? error.message : 'Live provider unavailable';
    source.textContent = '';
    $('loadshedding').classList.remove('active');
  }
}

$('login-form').addEventListener('submit', login);

if ($('mfa-form')) {
  $('mfa-send').addEventListener('click', () => {
    if (firebaseMfaAvailable() && firebase.auth().isSignInWithEmailLink(location.href)) {
      const email = $('mfa-email').value.trim();
      if (!email) {
        $('mfa-error').textContent = 'Enter the same account email that received this link.';
        return;
      }
      completeFirebaseEmailLink(email);
    } else {
      sendFirebaseEmailLink();
    }
  });
  $('mfa-back').addEventListener('click', () => {
    sessionStorage.removeItem(pendingEmailKey);
    pendingMfaEmail = null;
    $('mfa-form').hidden = true;
    $('login-form').hidden = false;
    $('mfa-error').textContent = '';
  });
}
$('refresh').onclick = () => { const button = $('refresh'); button.disabled = true; load().then(() => toast('Queue refreshed')).catch(showError).finally(() => { button.disabled = false; }); };
$('queue-search').oninput = renderQueue;
function showError() { $('queue').innerHTML = '<div class="empty">Live queue unavailable. Check the API connection.</div>'; }

function connectLive() {
  if (!window.EventSource || !localStorage.getItem(tokenKey)) return;
  liveConnection = new EventSource(`${API}/api/events?token=${encodeURIComponent(localStorage.getItem(tokenKey))}`);
  liveConnection.onopen = () => { $('live-status').textContent = 'Live updates on'; };
  ['report.created', 'report.updated'].forEach((eventName) => liveConnection.addEventListener(eventName, () => load().catch(showError)));
  liveConnection.onerror = () => { $('live-status').textContent = 'Reconnecting'; liveConnection.close(); setTimeout(connectLive, 5000); };
}

// Keep the queue in sync with citizen submissions at all times, exactly like the
// admin dashboard, even when the event stream is slow or unavailable.
function startPolling() {
  if (pollTimer) return;
  pollTimer = setInterval(() => {
    if (!localStorage.getItem(tokenKey) || document.hidden) return;
    load().catch(() => {});
    loadLoadShedding();
  }, 15000);
}

if (firebaseMfaAvailable() && firebase.auth().isSignInWithEmailLink(location.href)) {
  handleFirebaseEmailLink().catch((error) => { $('mfa-error').textContent = firebaseEmailError(error); });
} else if (localStorage.getItem(tokenKey)) {
  $('auth-screen').hidden = true;
  $('app-shell').hidden = false;
  load().then(connectLive).catch(showError);
  loadLoadShedding();
}
startPolling();