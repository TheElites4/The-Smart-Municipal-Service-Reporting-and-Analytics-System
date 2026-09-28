const API = localStorage.getItem('mzansiApiUrl') || 'http://localhost:8787';
const $ = (id) => document.getElementById(id);
const tokenKey = 'mzansiStaffToken';
let liveConnection;
let latestReports = [];
const authHeaders = (json = false) => ({ ...(json ? { 'content-type': 'application/json' } : {}), authorization: `Bearer ${localStorage.getItem(tokenKey) || ''}` });
const logout = () => { localStorage.removeItem(tokenKey); if (liveConnection) liveConnection.close(); $('app-shell').hidden = true; $('auth-screen').hidden = false; };

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
    if (!response.ok || result.user?.role !== 'staff') { $('auth-error').textContent = response.ok ? 'This account is not authorised for staff operations.' : (result.error || 'Sign in failed.'); return; }
    localStorage.setItem(tokenKey, result.token); $('auth-screen').hidden = true; $('app-shell').hidden = false; await load(); connectLive();
    toast(`Signed in as ${result.user.fullName || 'staff'}`);
  } catch {
    $('auth-error').textContent = 'Network error — is the API running?';
  } finally {
    button.disabled = false;
  }
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
  const municipality = $('municipality').value.trim();
  const response = await fetch(`${API}/api/dashboard${municipality ? `?municipality=${encodeURIComponent(municipality)}` : ''}`, { headers: authHeaders() });
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

$('login-form').addEventListener('submit', login);
$('refresh').onclick = () => { const button = $('refresh'); button.disabled = true; load().then(() => toast('Queue refreshed')).catch(showError).finally(() => { button.disabled = false; }); };
$('municipality').onchange = () => load().catch(showError);
$('queue-search').oninput = renderQueue;
function showError() { $('queue').innerHTML = '<div class="empty">Live queue unavailable. Check the API connection.</div>'; }

function connectLive() {
  if (!window.EventSource || !localStorage.getItem(tokenKey)) return;
  liveConnection = new EventSource(`${API}/api/events?token=${encodeURIComponent(localStorage.getItem(tokenKey))}`);
  liveConnection.onopen = () => { $('live-status').textContent = 'Live updates on'; };
  ['report.created', 'report.updated'].forEach((eventName) => liveConnection.addEventListener(eventName, () => load().catch(showError)));
  liveConnection.onerror = () => { $('live-status').textContent = 'Reconnecting'; liveConnection.close(); setTimeout(connectLive, 5000); };
}
if (localStorage.getItem(tokenKey)) { $('auth-screen').hidden = true; $('app-shell').hidden = false; load().then(connectLive).catch(showError); }