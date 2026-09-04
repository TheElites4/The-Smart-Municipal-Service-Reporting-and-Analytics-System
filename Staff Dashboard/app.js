const API = localStorage.getItem('mzansiApiUrl') || 'http://localhost:8787';
const $ = (id) => document.getElementById(id);
const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
let liveConnection;
async function load() {
  const municipality = $('municipality').value.trim();
  const response = await fetch(`${API}/api/dashboard${municipality ? `?municipality=${encodeURIComponent(municipality)}` : ''}`);
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
    job.querySelector('.save').onclick = async () => { await fetch(`${API}/api/reports/${report.id}/status`, { method:'PATCH', headers:{'content-type':'application/json'}, body:JSON.stringify({ status: job.querySelector('.status').value }) }); await load(); };
    $('queue').appendChild(node);
  });
}
$('refresh').onclick = () => load().catch(showError); $('municipality').onchange = () => load().catch(showError); function showError() { $('queue').innerHTML = '<div class="empty">Connect the API and refresh to load the live queue.</div>'; } load().catch(showError);
function connectLive() {
  if (!window.EventSource) return;
  liveConnection = new EventSource(`${API}/api/events`);
  liveConnection.onopen = () => { $('live-status').textContent = 'Live updates on'; };
  ['report.created', 'report.updated'].forEach((eventName) => liveConnection.addEventListener(eventName, () => load().catch(showError)));
  liveConnection.onerror = () => { $('live-status').textContent = 'Reconnecting'; liveConnection.close(); setTimeout(connectLive, 5000); };
}
connectLive();
