import http from 'node:http';
import { URL } from 'node:url';
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const port = Number(process.env.PORT || 8787);
const realtimeClients = new Set();
const allowedOrigins = new Set((process.env.ALLOWED_ORIGINS || '*').split(',').map((origin) => origin.trim()));
const corsHeaders = (req) => {
  const origin = req.headers.origin;
  return { 'access-control-allow-origin': allowedOrigins.has('*') || allowedOrigins.has(origin) ? (origin || '*') : 'null', 'vary': 'Origin' };
};

const json = (res, status, body, req) => {
  res.writeHead(status, { 'content-type': 'application/json', ...corsHeaders(req || { headers: {} }) });
  res.end(JSON.stringify(body));
};
const body = async (req) => {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    const error = new Error('Invalid JSON');
    error.statusCode = 400;
    throw error;
  }
};
const query = (text, values = []) => pool.query(text, values);
const hasFields = (input, fields) => fields.every((field) => typeof input[field] === 'string' && input[field].trim());
const validStatuses = new Set(['submitted', 'under_review', 'assigned', 'in_progress', 'resolved', 'closed', 'rejected']);
const broadcast = (event, payload) => {
  const message = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const client of realtimeClients) client.write(message);
};

async function dashboardData(municipality) {
  const filter = municipality ? 'WHERE r.municipality = $1' : '';
  const values = municipality ? [municipality] : [];
  const [summary, queue, staff] = await Promise.all([
    query(`SELECT count(*)::int AS total, count(*) FILTER (WHERE status IN ('submitted','under_review'))::int AS unassigned, count(*) FILTER (WHERE status = 'in_progress')::int AS in_progress, count(*) FILTER (WHERE status IN ('resolved','closed'))::int AS resolved FROM service_reports r ${filter}`, values),
    query(`SELECT r.id, r.public_reference, r.category, r.description, r.location_text, r.urgency, r.status, r.created_at, r.sla_due_at, u.full_name AS citizen_name, a.staff_id, su.full_name AS staff_name FROM service_reports r JOIN app_users u ON u.id = r.citizen_id LEFT JOIN report_assignments a ON a.report_id = r.id LEFT JOIN app_users su ON su.id = a.staff_id ${filter} ORDER BY CASE r.urgency WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END, r.created_at DESC LIMIT 100`, values),
    query(`SELECT u.id, u.full_name, u.department, u.municipality, u.is_active, u.last_seen_at, count(a.report_id)::int AS open_jobs FROM app_users u LEFT JOIN report_assignments a ON a.staff_id = u.id LEFT JOIN service_reports r ON r.id = a.report_id AND r.status NOT IN ('resolved','closed') WHERE u.role = 'staff' ${municipality ? 'AND u.municipality = $1' : ''} GROUP BY u.id ORDER BY open_jobs DESC`, values)
  ]);
  return { summary: summary.rows[0], reports: queue.rows, staff: staff.rows };
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (req.method === 'OPTIONS') return json(res, 204, {}, req);
    if (req.method === 'GET' && url.pathname === '/health') {
      try {
        await query('SELECT 1');
        return json(res, 200, { ok: true, database: 'connected' }, req);
      } catch {
        return json(res, 503, { ok: false, database: 'unavailable' }, req);
      }
    }
    if (req.method === 'GET' && url.pathname === '/api/events') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive', ...corsHeaders(req) });
      res.write(`event: connected\ndata: ${JSON.stringify({ at: new Date().toISOString() })}\n\n`);
      realtimeClients.add(res);
      const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 20000);
      req.on('close', () => { clearInterval(heartbeat); realtimeClients.delete(res); });
      return;
    }
    if (req.method === 'GET' && url.pathname === '/api/dashboard') return json(res, 200, await dashboardData(url.searchParams.get('municipality')), req);

    if (req.method === 'POST' && url.pathname === '/api/users/citizen') {
      const input = await body(req);
      if (!hasFields(input, ['fullName', 'email'])) return json(res, 400, { error: 'fullName and email are required' }, req);
      const result = await query(`INSERT INTO app_users (full_name, email, phone, external_ref, role) VALUES ($1, $2, $3, $4, 'citizen') ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name, phone = EXCLUDED.phone, external_ref = COALESCE(EXCLUDED.external_ref, app_users.external_ref), updated_at = now() RETURNING id, full_name, email, phone, external_ref, role`, [input.fullName, input.email, input.phone || null, input.externalRef || null]);
      return json(res, 201, result.rows[0], req);
    }

    if (req.method === 'POST' && url.pathname === '/api/mobile/reports') {
      const input = await body(req);
      if (!hasFields(input, ['externalRef', 'municipality', 'category', 'description', 'location'])) return json(res, 400, { error: 'externalRef, municipality, category, description, and location are required' }, req);
      const citizen = await query('SELECT id FROM app_users WHERE external_ref = $1', [input.externalRef]);
      if (!citizen.rows[0]) return json(res, 404, { error: 'Android user is not registered with the shared API' }, req);
      const result = await query(`INSERT INTO service_reports (public_reference, citizen_id, municipality, category, description, location_text, urgency, sla_due_at) VALUES ('MZ-${Date.now()}', $1, $2, $3, $4, $5, $6, now() + interval '48 hours') RETURNING *`, [citizen.rows[0].id, input.municipality, input.category, input.description, input.location, input.urgency || 'medium']);
      broadcast('report.created', result.rows[0]);
      return json(res, 201, result.rows[0], req);
    }

    if (req.method === 'GET' && url.pathname === '/api/reports') {
      if (!url.searchParams.get('citizenId')) return json(res, 400, { error: 'citizenId is required' }, req);
      const result = await query('SELECT * FROM service_reports WHERE citizen_id = $1 ORDER BY created_at DESC', [url.searchParams.get('citizenId')]);
      return json(res, 200, result.rows, req);
    }

    if (req.method === 'POST' && url.pathname === '/api/reports') {
      const input = await body(req);
      if (!hasFields(input, ['citizenId', 'municipality', 'category', 'description', 'location'])) return json(res, 400, { error: 'citizenId, municipality, category, description, and location are required' }, req);
      const result = await query(`INSERT INTO service_reports (public_reference, citizen_id, municipality, category, description, location_text, latitude, longitude, urgency, sla_due_at) VALUES ('MZ-${Date.now()}', $1, $2, $3, $4, $5, $6, $7, $8, now() + interval '48 hours') RETURNING *`, [input.citizenId, input.municipality, input.category, input.description, input.location, input.latitude || null, input.longitude || null, input.urgency || 'medium']);
      broadcast('report.created', result.rows[0]);
      return json(res, 201, result.rows[0], req);
    }

    const assignment = url.pathname.match(/^\/api\/reports\/([^/]+)\/assign$/);
    if (req.method === 'POST' && assignment) {
      const input = await body(req);
      if (!hasFields(input, ['staffId'])) return json(res, 400, { error: 'staffId is required' }, req);
      await query('INSERT INTO report_assignments (report_id, staff_id, assigned_by) VALUES ($1, $2, $3) ON CONFLICT (report_id) DO UPDATE SET staff_id = EXCLUDED.staff_id, assigned_by = EXCLUDED.assigned_by, assigned_at = now()', [assignment[1], input.staffId, input.assignedBy || null]);
      const result = await query("UPDATE service_reports SET status = 'assigned' WHERE id = $1 RETURNING *", [assignment[1]]);
      if (!result.rows[0]) return json(res, 404, { error: 'Report not found' }, req);
      broadcast('report.updated', result.rows[0]);
      return json(res, 200, result.rows[0], req);
    }

    const status = url.pathname.match(/^\/api\/reports\/([^/]+)\/status$/);
    if (req.method === 'PATCH' && status) {
      const input = await body(req);
      if (!validStatuses.has(input.status)) return json(res, 400, { error: 'Invalid report status' }, req);
      const previous = await query('SELECT status FROM service_reports WHERE id = $1', [status[1]]);
      const result = await query("UPDATE service_reports SET status = $2, resolved_at = CASE WHEN $2 IN ('resolved','closed') THEN now() ELSE NULL END WHERE id = $1 RETURNING *", [status[1], input.status]);
      if (!result.rows[0]) return json(res, 404, { error: 'Report not found' }, req);
      await query('INSERT INTO report_status_events (report_id, from_status, to_status, changed_by, note) VALUES ($1, $2, $3, $4, $5)', [status[1], previous.rows[0]?.status || null, input.status, input.changedBy || null, input.note || null]);
      broadcast('report.updated', result.rows[0]);
      return json(res, 200, result.rows[0], req);
    }

    return json(res, 404, { error: 'Not found' }, req);
  } catch (error) {
    console.error(error);
    return json(res, error.statusCode || 500, { error: error.statusCode ? error.message : 'Request failed' }, req);
  }
});

server.listen(port, () => console.log(`MzansiConnect API listening on http://localhost:${port}`));
