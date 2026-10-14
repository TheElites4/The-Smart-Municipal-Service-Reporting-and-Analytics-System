const API = localStorage.getItem('mzansiApiUrl') || (['localhost', '127.0.0.1'].includes(location.hostname) ? 'http://localhost:8787' : window.MZANSI_API_URL || 'http://localhost:8787');
const $ = (id) => document.getElementById(id);
const tokenKey = 'mzansiStaffToken';
let liveConnection;
let latestReports = [];
let pollTimer; // fallback refresh so new citizen reports appear even if the live stream drops
const reportPhotoUrls = new Map();
const loginForm = $('login-form');
if ($('mfa-hint')) $('mfa-hint').textContent = 'Enter the one-time code we sent to your email.';
if ($('mfa-code')) $('mfa-code').closest('label').firstChild.textContent = 'Email verification code';
if ($('mfa-enroll')) $('mfa-enroll').remove();
if ($('mfa-recovery')) $('mfa-recovery').remove();
const authHeaders = (json = false) => ({ ...(json ? { 'content-type': 'application/json' } : {}), authorization: `Bearer ${localStorage.getItem(tokenKey) || ''}` });
const logout = () => { localStorage.removeItem(tokenKey); if (liveConnection) liveConnection.close(); $('app-shell').hidden = true; $('auth-screen').hidden = false; loginForm.hidden = false; };

function retainReportPhotoUrls(reportIds) {
  const keep = new Set(reportIds.map(String));
  for (const [id, url] of reportPhotoUrls) {
    if (!keep.has(id)) {
      URL.revokeObjectURL(url);
      reportPhotoUrls.delete(id);
    }
  }
}

async function loadReportPhoto(image, status, reportId) {
  const id = String(reportId);
  const cached = reportPhotoUrls.get(id);
  if (cached) {
    image.src = cached;
    image.hidden = false;
    status.hidden = true;
    return;
  }
  try {
    const response = await fetch(`${API}/api/reports/${encodeURIComponent(id)}/photo`, { headers: authHeaders() });
    if (response.status === 401) {
      logout();
      return;
    }
    if (!response.ok) throw new Error(`Photo unavailable (HTTP ${response.status}).`);
    const blob = await response.blob();
    if (!blob.type.startsWith('image/')) throw new Error('The API returned an invalid photo.');
    if (!image.isConnected) return;
    const objectUrl = URL.createObjectURL(blob);
    reportPhotoUrls.set(id, objectUrl);
    image.src = objectUrl;
    image.hidden = false;
    status.hidden = true;
  } catch (error) {
    if (image.isConnected) status.textContent = error instanceof Error ? error.message : 'Photo unavailable.';
  }
}

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
    if (response.ok && result.mfaRequired === 'email-otp') {
      beginEmailMfa(result);
      return;
    }
    if (!response.ok || result.user?.role !== 'staff') { $('auth-error').textContent = response.ok ? 'This account is not authorised for staff operations.' : (result.error || 'Sign in failed.'); return; }
    completeLogin(result);
  } catch (error) {
    $('auth-error').textContent = error instanceof TypeError
      ? 'Network error — is the API running?'
      : (error?.message || 'Could not complete two-factor verification.');
  } finally {
    button.disabled = false;
  }
}

// Password is factor one; the emailed one-time code is factor two.
let pendingMfaToken;
let pendingMfaEmail;

function beginEmailMfa(result) {
  pendingMfaToken = result.mfaToken;
  pendingMfaEmail = result.user?.email || '';
  loginForm.hidden = true;
  $('mfa-form').hidden = false;
  $('mfa-error').textContent = '';
  $('mfa-hint').textContent = `We sent a 6-digit sign-in code to ${pendingMfaEmail || 'your email address'}.`;
  $('mfa-code').value = '';
  $('mfa-code').focus();
}

async function submitEmailCode() {
  const code = $('mfa-code').value.replace(/\s+/g, '');
  if (!/^\d{6}$/.test(code)) {
    $('mfa-error').textContent = 'Enter the 6-digit code sent to your email.';
    return;
  }
  const submit = $('mfa-submit');
  submit.disabled = true;
  $('mfa-error').textContent = '';
  try {
    const response = await fetch(`${API}/api/auth/email/verify`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mfaToken: pendingMfaToken, code }),
    });
    const result = await response.json();
    if (!response.ok || result.user?.role !== 'staff') {
      $('mfa-error').textContent = result.error || 'That code was not accepted.';
      return;
    }
    pendingMfaToken = null;
    completeLogin(result);
  } catch (error) {
    $('mfa-error').textContent = error?.message || 'Could not complete two-factor verification.';
  } finally {
    submit.disabled = false;
  }
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
  retainReportPhotoUrls(filtered.filter((report) => report.has_photo).map((report) => report.id));
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
    if (report.has_photo) {
      const figure = document.createElement('figure');
      figure.className = 'report-photo';
      figure.innerHTML = '<img alt="Evidence photo submitted with this report" hidden><figcaption>Loading evidence photo…</figcaption>';
      job.querySelector('.description').after(figure);
      loadReportPhoto(figure.querySelector('img'), figure.querySelector('figcaption'), report.id);
    }
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
  // Submit on the button and on Enter inside the code field.
  $('mfa-submit').addEventListener('click', submitEmailCode);
  $('mfa-code').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') { event.preventDefault(); submitEmailCode(); }
  });
  $('mfa-back').addEventListener('click', () => {
    pendingMfaToken = null;
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

if (localStorage.getItem(tokenKey)) {
  $('auth-screen').hidden = true;
  $('app-shell').hidden = false;
  load().then(connectLive).catch(showError);
  loadLoadShedding();
}
startPolling();