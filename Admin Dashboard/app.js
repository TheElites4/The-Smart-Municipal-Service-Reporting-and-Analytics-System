const API = localStorage.getItem('mzansiApiUrl') || 'http://localhost:8787';
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
staffForm.innerHTML = '<h2>Add staff member</h2><p>Create an operations login saved securely in PostgreSQL. Staff can then sign in to the Staff Operations dashboard.</p><input name="fullName" placeholder="Full name" required><input name="email" type="email" placeholder="Email" required><input name="phone" type="tel" placeholder="Phone in international format, e.g. +27821234567"><input name="password" type="password" minlength="12" placeholder="Temporary password (12+ characters)" required><select name="municipality" required><option value="">Loading municipalities…</option></select><input name="department" placeholder="Department (optional)"><button type="submit">Create staff account</button><span class="staff-form-message"></span>';
document.querySelector('#app-shell main')?.prepend(staffForm);
const municipalitySelect = staffForm.querySelector('select[name="municipality"]');
fetch(`${API}/api/options`).then((response) => response.ok ? response.json() : Promise.reject())
  .then((options) => {
    municipalitySelect.innerHTML = '<option value="">Choose municipality</option>' + options.municipalities.map((name) => `<option value="${esc(name)}">${esc(name)}</option>`).join('');
  })
  .catch(() => { municipalitySelect.innerHTML = '<option value="">Municipality list unavailable</option>'; municipalitySelect.disabled = true; });

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
  try {
    const response = await fetch(`${API}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: $('login-email').value, password: $('login-password').value }) });
    const result = await response.json();
    if (!response.ok || result.user?.role !== 'admin') { $('auth-error').textContent = response.ok ? 'This account is not authorised for administration.' : (result.error || 'Sign in failed.'); return; }
    await completeLogin(result);
  } catch {
    $('auth-error').textContent = 'Could not reach the sign-in service.';
  }
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
    if (!response.ok) throw new Error('unavailable');
    const status = await response.json();
    const stage = Number(status.stage) || 0;
    const areas = Array.isArray(status.areas) && status.areas.length ? ` · ${status.areas.join(', ')}` : '';
    detail.textContent = status.current && stage > 0
      ? `Stage ${stage} active${areas}`
      : `No active load shedding${areas}`;
    $('loadshedding').classList.toggle('active', Boolean(status.current && stage > 0));
    source.textContent = status.source ? `${status.source}${status.updatedAt ? ` · ${new Date(status.updatedAt).toLocaleTimeString()}` : ''}` : '';
  } catch {
    detail.textContent = 'Live provider unavailable';
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
if (localStorage.getItem(TOKEN_KEY)) { $('auth-screen').hidden = true; $('app-shell').hidden = false; load().then(connectLive).catch(showLogin); loadLoadShedding(); }
// Refresh the live load-shedding provider periodically, like the Android banner.
setInterval(() => { if (localStorage.getItem(TOKEN_KEY) && !document.hidden) loadLoadShedding(); }, 60000);
