const API = localStorage.getItem('mzansiApiUrl') || 'http://localhost:8787';
const $ = (id) => document.getElementById(id);
const tokenKey = 'mzansiStaffToken';
let liveConnection;
const authHeaders = (json = false) => ({ ...(json ? { 'content-type': 'application/json' } : {}), authorization: `Bearer ${localStorage.getItem(tokenKey) || ''}` });
const logout = () => { localStorage.removeItem(tokenKey); if (liveConnection) liveConnection.close(); $('app-shell').hidden = true; $('auth-screen').hidden = false; };
async function login(event) {
  event.preventDefault();
  const response = await fetch(`${API}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: $('login-email').value, password: $('login-password').value }) });
  const result = await response.json();
  if (!response.ok || result.user?.role !== 'staff') { $('auth-error').textContent = response.ok ? 'This account is not authorised for staff operations.' : (result.error || 'Sign in failed.'); return; }
  localStorage.setItem(tokenKey, result.token); $('auth-screen').hidden = true; $('app-shell').hidden = false; await load(); connectLive();
}
async function load() {
  const municipality = $('municipality').value.trim();
  const response = await fetch(`${API}/api/dashboard${municipality ? `?municipality=${encodeURIComponent(municipality)}` : ''}`, { headers: authHeaders() });
  if (response.status === 401 || response.status === 403) return logout();
  if (!response.ok) throw new Error('Dashboard data unavailable');
  const data = await response.json();
  $('metrics').innerHTML = [['total','Total reports'],['unassigned','Needs review'],['in_progress','In progress'],['resolved','Resolved']].map(([key,label]) => `<div class="metric"><strong>${data.summary[key] || 0}</strong><span>${label}</span></div>`).join('');
  $('updated').textContent = `Live queue · ${new Date().toLocaleTimeString()}`;
  const jobs = data.reports.filter((report) => !['resolved','closed'].includes(report.status));
  $('queue').innerHTML = '';
  if (!jobs.length) { $('queue').innerHTML = '<div class="empty">No open jobs in this queue.</div>'; return; }
  jobs.forEach((report) => {
    const node = $('job-template').content.cloneNode(true); const job = node.querySelector('.job');
    job.querySelector('.reference').textContent = report.public_reference; job.querySelector('.category').textContent = report.category;
    job.querySelector('.description').textContent = report.description; job.querySelector('.location').textContent = `Location: ${report.location_text}`; job.querySelector('.citizen').textContent = `Citizen: ${report.citizen_name || 'Unknown'}`;
    job.querySelector('.urgency').textContent = report.urgency; job.querySelector('.status').value = report.status;
    job.querySelector('.save').onclick = async () => { const response = await fetch(`${API}/api/reports/${report.id}/status`, { method:'PATCH', headers:authHeaders(true), body:JSON.stringify({ status: job.querySelector('.status').value }) }); if (response.status === 401 || response.status === 403) return logout(); await load(); };
    $('queue').appendChild(node);
  });
}
$('login-form').addEventListener('submit', login);
$('refresh').onclick = () => load().catch(showError); $('municipality').onchange = () => load().catch(showError); function showError() { $('queue').innerHTML = '<div class="empty">Live queue unavailable. Check the API connection.</div>'; }
function connectLive() {
  if (!window.EventSource || !localStorage.getItem(tokenKey)) return;
  liveConnection = new EventSource(`${API}/api/events?token=${encodeURIComponent(localStorage.getItem(tokenKey))}`);
  liveConnection.onopen = () => { $('live-status').textContent = 'Live updates on'; };
  ['report.created', 'report.updated'].forEach((eventName) => liveConnection.addEventListener(eventName, () => load().catch(showError)));
  liveConnection.onerror = () => { $('live-status').textContent = 'Reconnecting'; liveConnection.close(); setTimeout(connectLive, 5000); };
}
if (localStorage.getItem(tokenKey)) { $('auth-screen').hidden = true; $('app-shell').hidden = false; load().then(connectLive).catch(showError); }
