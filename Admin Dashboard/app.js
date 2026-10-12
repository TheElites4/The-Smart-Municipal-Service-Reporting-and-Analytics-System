const API = localStorage.getItem('mzansiApiUrl') || (['localhost', '127.0.0.1'].includes(location.hostname) ? 'http://localhost:8787' : window.MZANSI_API_URL || 'http://localhost:8787');
const TOKEN_KEY = 'mzansiAdminToken';
const $ = (id) => document.getElementById(id);
let liveConnection;
const authHeaders = (json = false) => ({ ...(json ? { 'content-type': 'application/json' } : {}), authorization: `Bearer ${localStorage.getItem(TOKEN_KEY) || ''}` });
const analyticsPanel = document.createElement('section');
analyticsPanel.className = 'panel analytics-panel';
analyticsPanel.innerHTML = '<div class="panel-title"><div><h2>Operational analytics</h2><p>Aggregated from service reports in PostgreSQL.</p></div></div><div id="analytics-content" class="analytics-grid"><p>Loading database analytics…</p></div>';
$('overview').after(analyticsPanel);
const loginForm = $('login-form');
const showLogin = () => { localStorage.removeItem(TOKEN_KEY); if (liveConnection) liveConnection.close(); $('app-shell').hidden = true; $('auth-screen').hidden = false; loginForm.hidden = false; };
const staffForm = document.createElement('form');
staffForm.className = 'panel staff-form';
staffForm.innerHTML = '<h2>Add staff member</h2><p>Create an operations login saved securely in PostgreSQL. Staff can then sign in to the Staff Operations dashboard.</p><input name="fullName" placeholder="Full name" required><input name="email" type="email" placeholder="Email" required><input name="phone" type="tel" placeholder="Phone in international format, e.g. +27821234567" pattern="[+][1-9][0-9]{7,14}" title="Enter a phone number in international E.164 format." required><input name="password" type="password" minlength="12" placeholder="Temporary password (12+ characters)" required><select name="municipality" required><option value="">Loading municipalities…</option></select><input name="department" placeholder="Department (optional)"><button type="submit">Create staff account</button><span class="staff-form-message"></span>';
document.querySelector('#app-shell main')?.prepend(staffForm);
const municipalitySelect = staffForm.querySelector('select[name="municipality"]');
fetch(`${API}/api/options`).then((response) => response.ok ? response.json() : Promise.reject())
  .then((options) => {
    municipalitySelect.innerHTML = '<option value="">Choose municipality</option>' + [...new Set(options.municipalities)].map((name) => `<option value="${esc(name)}">${esc(name)}</option>`).join('');
  })
  .catch(() => { municipalitySelect.innerHTML = '<option value="">Municipality list unavailable</option>'; municipalitySelect.disabled = true; });

const staffPhoneForm = document.createElement('form');
staffPhoneForm.className = 'panel staff-form';
staffPhoneForm.innerHTML = '<h2>Update a staff phone number</h2><p>Update the staff member’s operational contact number. Use international E.164 format.</p><input name="email" type="email" autocomplete="off" placeholder="Staff account email" required><input name="phone" type="tel" autocomplete="tel" placeholder="New phone, e.g. +27821234567" pattern="[+][1-9][0-9]{7,14}" title="Enter a phone number in international E.164 format." required><button type="submit">Update staff phone</button><span class="staff-form-message" role="status" aria-live="polite"></span>';
document.querySelector('#app-shell main')?.prepend(staffPhoneForm);
staffPhoneForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(staffPhoneForm));
  const message = staffPhoneForm.querySelector('.staff-form-message');
  message.classList.remove('err');
  const submit = staffPhoneForm.querySelector('button[type=submit]');
  submit.disabled = true;
  try {
    const response = await fetch(`${API}/api/staff/phone`, {
      method: 'PATCH',
      headers: authHeaders(true),
      body: JSON.stringify(data),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Unable to update staff phone');
    message.textContent = `Staff phone number updated for ${result.email}.`;
    toast(`Staff phone number updated for ${result.email}`);
    staffPhoneForm.reset();
  } catch (error) {
    message.classList.add('err');
    message.textContent = error instanceof Error ? error.message : 'Unable to update staff phone';
    toast(message.textContent, true);
  } finally {
    submit.disabled = false;
  }
});

// Password reset. There is no self-service reset, so an admin sets a new password here.
// Without it a forgotten or mistyped password leaves the account permanently locked out.
const resetForm = document.createElement('form');
resetForm.className = 'panel staff-form';
resetForm.innerHTML = '<h2>Reset a password</h2><p>Set a new password for any staff or admin account. Use this when someone forgets theirs.</p><input name="email" type="email" placeholder="Account email" required><input name="password" type="password" minlength="12" placeholder="New password (12+ characters)" required><button type="submit">Reset password</button><span class="staff-form-message"></span>';
document.querySelector('#app-shell main')?.prepend(resetForm);
resetForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(resetForm));
  const message = resetForm.querySelector('.staff-form-message');
  message.classList.remove('err');
  const submit = resetForm.querySelector('button[type=submit]');
  submit.disabled = true;
  try {
    const response = await fetch(`${API}/api/users/${encodeURIComponent(data.email)}/password`, { method: 'PATCH', headers: authHeaders(true), body: JSON.stringify({ password: data.password }) });
    const result = await response.json();
    if (response.ok) {
      message.textContent = `Password updated for ${result.email}`;
      toast(`Password updated for ${result.email}`);
      resetForm.reset();
    } else {
      message.classList.add('err');
      message.textContent = result.error || 'Unable to reset password';
      toast(result.error || 'Unable to reset password', true);
    }
  } catch {
    message.classList.add('err');
    message.textContent = 'Network error — is the API running?';
  } finally {
    submit.disabled = false;
  }
});

// Lightweight toast helper for user feedback.
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

// Inline SVG icon set (no external dependencies).
const icons = {
  grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
  eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>',
  bolt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="m20 6-11 11-5-5"/></svg>',
  refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>',
  inbox: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z"/></svg>',
};

const initials = (name = '') => name.trim().split(/\s+/).slice(0, 2).map((part) => part[0] || '').join('').toUpperCase() || '?';

async function login(event) {
  event.preventDefault();
  $('auth-error').textContent = '';
  let response;
  try {
    response = await fetch(`${API}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: $('login-email').value, password: $('login-password').value }),
    });
  } catch {
    $('auth-error').textContent = 'Unable to connect to the API. Check that the backend is running and try again.';
    return;
  }

  let result;
  try {
    result = await response.json();
  } catch {
    $('auth-error').textContent = `The sign-in service returned an invalid response (HTTP ${response.status}).`;
    return;
  }

  // The password is the first factor; an email link proves inbox access.
  if (response.ok && result.mfaRequired === 'firebase-email') {
    try {
      await beginFirebaseEmailMfa(result.user.email, result.mfaToken, $('login-form'));
    } catch {
      $('auth-error').textContent = 'Could not start email verification. Check Firebase email-link sign-in settings and try again.';
    }
    return;
  }
  if (!response.ok || result.user?.role !== 'admin') {
    $('auth-error').textContent = response.ok
      ? 'This account is not authorised for administration.'
      : (result.error || `Sign in failed (HTTP ${response.status}).`);
    return;
  }

  try {
    await completeLogin(result);
  } catch {
    localStorage.removeItem(TOKEN_KEY);
    $('app-shell').hidden = true;
    $('auth-screen').hidden = false;
    loginForm.hidden = false;
    $('auth-error').textContent = 'Sign-in was accepted, but the admin dashboard could not load. Check the API and try again.';
  }
}

// --- Firebase email-link MFA (second factor) -------------------------------
let firebaseAuth;
let pendingMfaEmail;
let pendingMfaToken;
const pendingEmailKey = `${TOKEN_KEY}:pendingEmail`;
const pendingMfaTokenKey = `${TOKEN_KEY}:pendingMfaToken`;

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
    if (!response.ok || result.user?.role !== 'admin') {
      $('mfa-error').textContent = result.error || 'Email verification failed.';
      return;
    }
    sessionStorage.removeItem(pendingEmailKey);
    sessionStorage.removeItem(pendingMfaTokenKey);
    pendingMfaToken = null;
    await firebaseAuth.signOut();
    history.replaceState({}, document.title, `${location.pathname}${location.hash}`);
    await completeLogin(result);
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

async function completeLogin(result) {
  localStorage.setItem(TOKEN_KEY, result.token);
  $('auth-screen').hidden = true;
  $('app-shell').hidden = false;
  await load();
  connectLive();
  loadLoadShedding();
}

const esc = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
function renderAnalytics(data) {
  const renderBreakdown = (title, rows, valueKey = 'count') => {
    const maximum = Math.max(1, ...rows.map((row) => Number(row[valueKey]) || 0));
    return `<section class="analytics-group"><h3>${esc(title)}</h3>${rows.length ? rows.map((row) => `<div class="analytics-row"><span>${esc(row.label)}</span><strong>${Number(row[valueKey]) || 0}</strong><div class="analytics-bar"><i style="width:${Math.round((Number(row[valueKey]) || 0) / maximum * 100)}%"></i></div></div>`).join('') : '<p>No database records yet.</p>'}</section>`;
  };
  const monthly = data.monthly.map((row) => ({ ...row, label: new Date(`${row.label}-01T00:00:00`).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) }));
  $('analytics-content').innerHTML = [
    renderBreakdown('By category', data.categories),
    renderBreakdown('By status', data.statuses),
    renderBreakdown('By municipality', data.municipalities),
    renderBreakdown('12-month trend · reports', monthly, 'reports'),
  ].join('');
}
async function load() {
  const response = await fetch(`${API}/api/dashboard`, { headers: authHeaders() });
  if (response.status === 401 || response.status === 403) return showLogin();
  if (!response.ok) throw new Error('Dashboard unavailable');
  $('health').textContent = 'Online';
  const data = await response.json();
  try {
    const analyticsResponse = await fetch(`${API}/api/admin/analytics`, { headers: authHeaders() });
    if (!analyticsResponse.ok) throw new Error('Analytics unavailable');
    renderAnalytics(await analyticsResponse.json());
  } catch {
    $('analytics-content').textContent = 'Database analytics unavailable.';
  }
  $('overview').innerHTML = [
    ['total', 'All reports', 'grid', 'tone-total'],
    ['unassigned', 'Needs review', 'eye', 'tone-review'],
    ['in_progress', 'Active jobs', 'bolt', 'tone-active'],
    ['resolved', 'Resolved / closed', 'check', 'tone-resolved'],
  ].map(([key, label, icon, tone]) => `<div class="stat ${tone}"><span class="stat-icon">${icons[icon]}</span><strong>${data.summary[key] || 0}</strong><span>${label}</span></div>`).join('');
  $('staff').innerHTML = data.staff.length ? data.staff.map((person) => { const loadValue = Math.min(100, (person.open_jobs || 0) * 12); const hot = (person.open_jobs || 0) >= 5; return `<div class="person"><span class="avatar">${esc(initials(person.full_name))}</span><div class="person-body"><div class="person-top"><div><h3>${esc(person.full_name)}</h3><small>${esc(person.department || 'Municipal services')} · ${esc(person.municipality || 'Unassigned')}</small></div><span class="badge ${person.is_active ? '' : 'off'}">${person.is_active ? 'Active' : 'Inactive'}</span></div><small>${person.open_jobs || 0} open assignments · last seen ${person.last_seen_at ? new Date(person.last_seen_at).toLocaleString() : 'never'}</small><div class="bar ${hot ? 'hot' : ''}"><b style="width:${loadValue}%"></b></div></div></div>`; }).join('') : `<div class="empty-state">${icons.inbox}<div>No staff records found.</div></div>`;
  $('reports').innerHTML = data.reports.slice(0, 8).map((report) => `<div class="report"><div class="report-top"><div><span class="report-ref"><span class="dot"></span><span class="reference">${esc(report.public_reference)}</span></span><h3>${esc(report.category)}</h3></div><span class="priority ${esc(String(report.urgency).toLowerCase())}">${esc(report.urgency)}</span></div><p>${esc(report.description)}</p><div class="report-meta"><span class="chip">${esc(report.location_text)}</span><span class="chip">${esc(report.status.replaceAll('_', ' '))}</span></div></div>`).join('') || `<div class="empty-state">${icons.inbox}<div>No reports found.</div></div>`;
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

function connectLive() {
  if (!window.EventSource || !localStorage.getItem(TOKEN_KEY)) return;
  liveConnection = new EventSource(`${API}/api/events?token=${encodeURIComponent(localStorage.getItem(TOKEN_KEY))}`);
  liveConnection.onopen = () => { $('health').textContent = 'Live'; };
  ['report.created', 'report.updated'].forEach((eventName) => liveConnection.addEventListener(eventName, () => load().catch(() => {})));
  liveConnection.onerror = () => { $('health').textContent = 'Reconnecting'; liveConnection.close(); setTimeout(connectLive, 5000); };
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
      return;
    }
    sendFirebaseEmailLink();
  });
  $('mfa-back').addEventListener('click', () => {
    sessionStorage.removeItem(pendingEmailKey);
    pendingMfaEmail = null;
    $('mfa-form').hidden = true;
    $('login-form').hidden = false;
    $('mfa-error').textContent = '';
  });
}
staffForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(staffForm));
  const message = staffForm.querySelector('.staff-form-message');
  message.classList.remove('err');
  const submit = staffForm.querySelector('button[type=submit]');
  submit.disabled = true;
  try {
    const response = await fetch(`${API}/api/staff`, { method: 'POST', headers: authHeaders(true), body: JSON.stringify(data) });
    const result = await response.json();
    if (response.ok) {
      message.textContent = `Created ${result.email}`;
      toast(`Staff account created for ${result.email}`);
      staffForm.reset();
      load().catch(() => {});
    } else {
      message.classList.add('err');
      message.textContent = result.error || 'Unable to create staff account';
      toast(result.error || 'Unable to create staff account', true);
    }
  } catch {
    message.classList.add('err');
    message.textContent = 'Network error — is the API running?';
    toast('Network error — is the API running?', true);
  } finally {
    submit.disabled = false;
  }
});
$('refresh').onclick = () => { const button = $('refresh'); button.disabled = true; load().then(() => toast('Dashboard refreshed')).catch(() => { $('health').textContent = 'Offline'; toast('Could not reach the API', true); }).finally(() => { button.disabled = false; }); };
if (firebaseMfaAvailable() && firebase.auth().isSignInWithEmailLink(location.href)) {
  handleFirebaseEmailLink().catch((error) => { $('mfa-error').textContent = firebaseEmailError(error); });
} else if (localStorage.getItem(TOKEN_KEY)) {
  $('auth-screen').hidden = true;
  $('app-shell').hidden = false;
  load().then(connectLive).catch(showLogin);
  loadLoadShedding();
}
// Refresh the live load-shedding provider periodically, like the Android banner.
setInterval(() => { if (localStorage.getItem(TOKEN_KEY) && !document.hidden) loadLoadShedding(); }, 60000);
