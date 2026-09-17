const API = localStorage.getItem('mzansiApiUrl') || 'http://localhost:8787';
const TOKEN_KEY = 'mzansiAdminToken';
const $ = (id) => document.getElementById(id);
let liveConnection;
const authHeaders = (json = false) => ({ ...(json ? { 'content-type': 'application/json' } : {}), authorization: `Bearer ${localStorage.getItem(TOKEN_KEY) || ''}` });
const showLogin = () => { localStorage.removeItem(TOKEN_KEY); if (liveConnection) liveConnection.close(); $('app-shell').hidden = true; $('auth-screen').hidden = false; };
const staffForm = document.createElement('form');
staffForm.className = 'panel staff-form';
staffForm.innerHTML = '<h2>Add staff member</h2><p>Create an operations login saved securely in PostgreSQL.</p><input name="fullName" placeholder="Full name" required><input name="email" type="email" placeholder="Email" required><input name="password" type="password" minlength="12" placeholder="Temporary password (12+ characters)" required><input name="municipality" placeholder="Municipality" required><input name="department" placeholder="Department"><button type="submit">Create staff account</button><span class="staff-form-message"></span>';
document.querySelector('#app-shell main')?.prepend(staffForm);

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
  $('overview').innerHTML = [['total', 'All reports'], ['unassigned', 'Needs review'], ['in_progress', 'Active jobs'], ['resolved', 'Resolved / closed']].map(([key, label]) => `<div class="stat"><strong>${data.summary[key] || 0}</strong><span>${label}</span></div>`).join('');
  $('staff').innerHTML = data.staff.length ? data.staff.map((person) => { const loadValue = Math.min(100, (person.open_jobs || 0) * 12); return `<div class="person"><div class="person-top"><div><h3>${esc(person.full_name)}</h3><small>${esc(person.department || 'Municipal services')} · ${esc(person.municipality || 'Unassigned')}</small></div><span class="badge ${person.is_active ? '' : 'off'}">${person.is_active ? 'Active' : 'Inactive'}</span></div><small>${person.open_jobs || 0} open assignments · last seen ${person.last_seen_at ? new Date(person.last_seen_at).toLocaleString() : 'never'}</small><div class="bar"><b style="width:${loadValue}%"></b></div></div>`; }).join('') : '<p>No staff records found.</p>';
  $('reports').innerHTML = data.reports.slice(0, 8).map((report) => `<div class="report"><div class="report-top"><h3>${esc(report.public_reference)} · ${esc(report.category)}</h3><span class="priority">${esc(report.urgency)}</span></div><p>${esc(report.description)}</p><small>${esc(report.location_text)} · ${esc(report.status.replaceAll('_', ' '))}</small></div>`).join('') || '<p>No reports found.</p>';
}

function connectLive() {
  if (!window.EventSource || !localStorage.getItem(TOKEN_KEY)) return;
  liveConnection = new EventSource(`${API}/api/events?token=${encodeURIComponent(localStorage.getItem(TOKEN_KEY))}`);
  liveConnection.onopen = () => { $('health').textContent = 'Live'; };
  ['report.created', 'report.updated'].forEach((eventName) => liveConnection.addEventListener(eventName, () => load().catch(() => {})));
  liveConnection.onerror = () => { $('health').textContent = 'Reconnecting'; liveConnection.close(); setTimeout(connectLive, 5000); };
}

$('login-form').addEventListener('submit', login);
staffForm.addEventListener('submit', async (event) => { event.preventDefault(); const data = Object.fromEntries(new FormData(staffForm)); const response = await fetch(`${API}/api/staff`, { method: 'POST', headers: authHeaders(true), body: JSON.stringify(data) }); const result = await response.json(); const message = staffForm.querySelector('.staff-form-message'); message.textContent = response.ok ? `Created ${result.email}` : (result.error || 'Unable to create staff account'); if (response.ok) { staffForm.reset(); load().catch(() => {}); } });
$('refresh').onclick = () => load().catch(() => { $('health').textContent = 'Offline'; });
if (localStorage.getItem(TOKEN_KEY)) { $('auth-screen').hidden = true; $('app-shell').hidden = false; load().then(connectLive).catch(showLogin); }
