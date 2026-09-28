const API = localStorage.getItem('mzansiApiUrl') || 'http://localhost:8787';
const TOKEN_KEY = 'mzansiAdminToken';
const $ = (id) => document.getElementById(id);
let liveConnection;
const authHeaders = (json = false) => ({ ...(json ? { 'content-type': 'application/json' } : {}), authorization: `Bearer ${localStorage.getItem(TOKEN_KEY) || ''}` });
const showLogin = () => { localStorage.removeItem(TOKEN_KEY); if (liveConnection) liveConnection.close(); $('app-shell').hidden = true; $('auth-screen').hidden = false; };
const staffForm = document.createElement('form');
staffForm.className = 'panel staff-form';
staffForm.innerHTML = '<h2>Add staff member</h2><p>Create an operations login saved securely in PostgreSQL. Staff can then sign in to the Staff Operations dashboard.</p><input name="fullName" placeholder="Full name" required><input name="email" type="email" placeholder="Email" required><input name="password" type="password" minlength="12" placeholder="Temporary password (12+ characters)" required><input name="municipality" placeholder="Municipality" required><input name="department" placeholder="Department (optional)"><button type="submit">Create staff account</button><span class="staff-form-message"></span>';
document.querySelector('#app-shell main')?.prepend(staffForm);

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
  const response = await fetch(`${API}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: $('login-email').value, password: $('login-password').value }) });
  const result = await response.json();
  if (!response.ok || result.user?.role !== 'admin') { $('auth-error').textContent = response.ok ? 'This account is not authorised for administration.' : (result.error || 'Sign in failed.'); return; }
  localStorage.setItem(TOKEN_KEY, result.token);
  $('auth-screen').hidden = true;
  $('app-shell').hidden = false;
  await load();
  connectLive();
}

const esc = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
async function load() {
  const response = await fetch(`${API}/api/dashboard`, { headers: authHeaders() });
  if (response.status === 401 || response.status === 403) return showLogin();
  if (!response.ok) throw new Error('Dashboard unavailable');
  $('health').textContent = 'Online';
  const data = await response.json();
  $('overview').innerHTML = [
    ['total', 'All reports', 'grid', 'tone-total'],
    ['unassigned', 'Needs review', 'eye', 'tone-review'],
    ['in_progress', 'Active jobs', 'bolt', 'tone-active'],
    ['resolved', 'Resolved / closed', 'check', 'tone-resolved'],
  ].map(([key, label, icon, tone]) => `<div class="stat ${tone}"><span class="stat-icon">${icons[icon]}</span><strong>${data.summary[key] || 0}</strong><span>${label}</span></div>`).join('');
  $('staff').innerHTML = data.staff.length ? data.staff.map((person) => { const loadValue = Math.min(100, (person.open_jobs || 0) * 12); const hot = (person.open_jobs || 0) >= 5; return `<div class="person"><span class="avatar">${esc(initials(person.full_name))}</span><div class="person-body"><div class="person-top"><div><h3>${esc(person.full_name)}</h3><small>${esc(person.department || 'Municipal services')} · ${esc(person.municipality || 'Unassigned')}</small></div><span class="badge ${person.is_active ? '' : 'off'}">${person.is_active ? 'Active' : 'Inactive'}</span></div><small>${person.open_jobs || 0} open assignments · last seen ${person.last_seen_at ? new Date(person.last_seen_at).toLocaleString() : 'never'}</small><div class="bar ${hot ? 'hot' : ''}"><b style="width:${loadValue}%"></b></div></div></div>`; }).join('') : `<div class="empty-state">${icons.inbox}<div>No staff records found.</div></div>`;
  $('reports').innerHTML = data.reports.slice(0, 8).map((report) => `<div class="report"><div class="report-top"><div><span class="report-ref"><span class="dot"></span><span class="reference">${esc(report.public_reference)}</span></span><h3>${esc(report.category)}</h3></div><span class="priority ${esc(String(report.urgency).toLowerCase())}">${esc(report.urgency)}</span></div><p>${esc(report.description)}</p><div class="report-meta"><span class="chip">${esc(report.location_text)}</span><span class="chip">${esc(report.status.replaceAll('_', ' '))}</span></div></div>`).join('') || `<div class="empty-state">${icons.inbox}<div>No reports found.</div></div>`;
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
if (localStorage.getItem(TOKEN_KEY)) { $('auth-screen').hidden = true; $('app-shell').hidden = false; load().then(connectLive).catch(showLogin); }
