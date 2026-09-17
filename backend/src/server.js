import http from 'node:http';
import { URL } from 'node:url';
import crypto from 'node:crypto';
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const port = Number(process.env.PORT || 8787);
const realtimeClients = new Set();
const allowedOrigins = new Set((process.env.ALLOWED_ORIGINS || '*').split(',').map((origin) => origin.trim()));
if (process.env.NODE_ENV === 'production' && (!process.env.AUTH_SECRET || process.env.AUTH_SECRET === 'development-only-change-this-secret')) {
  throw new Error('AUTH_SECRET must be configured in production');
}
const corsHeaders = (req) => {
  const origin = req.headers.origin;
  return { 'access-control-allow-origin': allowedOrigins.has('*') || allowedOrigins.has(origin) ? (origin || '*') : 'null', 'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS', 'access-control-allow-headers': 'Content-Type, Authorization', 'vary': 'Origin' };
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
const authSecret = process.env.AUTH_SECRET || 'development-only-change-this-secret';
const tokenTtlSeconds = 8 * 60 * 60;
const signToken = (payload) => {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', authSecret).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
};
const verifyToken = (token) => {
  try {
    const [encoded, signature] = String(token || '').split('.');
    const expected = crypto.createHmac('sha256', authSecret).update(encoded).digest('base64url');
    if (!encoded || !signature || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    return payload.exp > Math.floor(Date.now() / 1000) ? payload : null;
  } catch {
    return null;
  }
};
const bearer = (req, url) => req.headers.authorization?.replace(/^Bearer\s+/i, '') || url.searchParams.get('token');
const requireRole = (req, url, roles) => {
  const user = verifyToken(bearer(req, url));
  return user && roles.includes(user.role) ? user : null;
};
const hashPassword = (password, salt = crypto.randomBytes(16).toString('hex')) => `${salt}:${crypto.scryptSync(password, salt, 64).toString('hex')}`;
const reverseGeocode = async (latitude, longitude) => {
  const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}`, { headers: { 'user-agent': 'MzansiConnect/1.0 contact@example.gov.za', accept: 'application/json' } });
  if (!response.ok) return null;
  const place = await response.json();
  return place.address?.suburb || place.address?.city_district || place.address?.city || place.address?.town || null;
};
const eskomStatus = async (latitude, longitude) => {
  const token = process.env.ESKOM_SE_PUSH_TOKEN;
  if (!token) return null;
  const areaText = await reverseGeocode(latitude, longitude);
  if (!areaText) return null;
  const search = await fetch(`https://developer.sepush.co.za/business/2.0/areasearch?text=${encodeURIComponent(areaText)}`, { headers: { Token: token, accept: 'application/json' } });
  if (!search.ok) return null;
  const areas = await search.json();
  const area = areas.areas?.[0];
  if (!area?.id) return null;
  const statusResponse = await fetch(`https://developer.sepush.co.za/business/2.0/status?id=${encodeURIComponent(area.id)}`, { headers: { Token: token, accept: 'application/json' } });
  if (!statusResponse.ok) return null;
  const status = await statusResponse.json();
  const now = Date.now();
  const active = (status.events || []).find((event) => new Date(event.start).getTime() <= now && new Date(event.end).getTime() >= now);
  const stageMatch = String(active?.note || active?.info || '').match(/stage\s*(\d+)/i);
  return { current: Boolean(active), stage: stageMatch ? Number(stageMatch[1]) : null, areas: [area.name], updatedAt: new Date().toISOString(), source: 'EskomSePush' };
};
const broadcast = (event, payload) => {
  const message = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const client of realtimeClients) {
    if (client.citizenId === payload.citizen_id || client.user?.role === 'admin' || client.user?.municipality === payload.municipality) client.res.write(message);
  }
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
    if (req.method === 'GET' && url.pathname === '/api/location/status') {
      const latitude = url.searchParams.get('latitude');
      const longitude = url.searchParams.get('longitude');
      if (!latitude || !longitude) return json(res, 400, { error: 'latitude and longitude are required' }, req);
      const status = await eskomStatus(latitude, longitude);
      if (!status) return json(res, 503, { error: 'Live EskomSePush status unavailable for this location' }, req);
      return json(res, 200, status, req);
    }
    if (req.method === 'POST' && url.pathname === '/api/auth/login') {
      const input = await body(req);
      if (!hasFields(input, ['email', 'password'])) return json(res, 400, { error: 'email and password are required' }, req);
      const result = await query('SELECT id, full_name, email, role, municipality, department FROM app_users WHERE lower(email) = lower($1) AND password_hash = crypt($2, password_hash) AND is_active = true LIMIT 1', [input.email, input.password]);
      const account = result.rows[0];
      if (!account) return json(res, 401, { error: 'Invalid email or password' }, req);
      const token = signToken({ sub: account.id, role: account.role, email: account.email, exp: Math.floor(Date.now() / 1000) + tokenTtlSeconds });
      await query('UPDATE app_users SET last_seen_at = now() WHERE id = $1', [account.id]);
      return json(res, 200, { token, expiresIn: tokenTtlSeconds, user: { id: account.id, fullName: account.full_name, email: account.email, role: account.role, municipality: account.municipality, department: account.department } }, req);
    }
    if (req.method === 'GET' && url.pathname === '/api/events') {
      const user = requireRole(req, url, ['staff', 'admin']);
      const citizenId = url.searchParams.get('citizenId');
      if (!user && !citizenId) return json(res, 401, { error: 'Authentication or citizenId required' }, req);
      if (user?.role === 'staff' && !user.municipality) return json(res, 403, { error: 'Staff account has no municipality scope' }, req);
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive', ...corsHeaders(req) });
      res.write(`event: connected\ndata: ${JSON.stringify({ at: new Date().toISOString() })}\n\n`);
      realtimeClients.add({ res, user, citizenId });
      const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 20000);
      req.on('close', () => { clearInterval(heartbeat); for (const client of realtimeClients) if (client.res === res) realtimeClients.delete(client); });
      return;
    }
    if (req.method === 'GET' && url.pathname === '/api/dashboard') {
      const user = requireRole(req, url, ['staff', 'admin']);
      if (!user) return json(res, 401, { error: 'Authentication required' }, req);
      if (user.role === 'staff' && url.searchParams.get('municipality') && url.searchParams.get('municipality') !== user.municipality) return json(res, 403, { error: 'Municipality access denied' }, req);
      return json(res, 200, await dashboardData(user.role === 'staff' ? user.municipality : url.searchParams.get('municipality')), req);
    }

    if (req.method === 'POST' && url.pathname === '/api/users/citizen') {
      const input = await body(req);
      if (!hasFields(input, ['fullName', 'email'])) return json(res, 400, { error: 'fullName and email are required' }, req);
      const result = await query(`INSERT INTO app_users (full_name, email, phone, external_ref, role) VALUES ($1, $2, $3, $4, 'citizen') ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name, phone = EXCLUDED.phone, external_ref = COALESCE(EXCLUDED.external_ref, app_users.external_ref), updated_at = now() RETURNING id, full_name, email, phone, external_ref, role`, [input.fullName, input.email, input.phone || null, input.externalRef || null]);
      return json(res, 201, result.rows[0], req);
    }

    if (req.method === 'POST' && url.pathname === '/api/users/anonymous') {
      const input = await body(req);
      const externalRef = typeof input.externalRef === 'string' && input.externalRef.trim() ? input.externalRef.trim() : crypto.randomUUID();
      const result = await query(`INSERT INTO app_users (full_name, email, external_ref, role) VALUES ('Anonymous Citizen', $1, $2, 'citizen') ON CONFLICT (external_ref) DO UPDATE SET updated_at = now() RETURNING id, external_ref, role`, [`anonymous-${externalRef}@local.invalid`, externalRef]);
      return json(res, 201, result.rows[0], req);
    }

    if (req.method === 'POST' && url.pathname === '/api/staff') {
      const admin = requireRole(req, url, ['admin']);
      if (!admin) return json(res, 403, { error: 'Administrator access required' }, req);
      const input = await body(req);
      if (!hasFields(input, ['fullName', 'email', 'password', 'municipality'])) return json(res, 400, { error: 'fullName, email, password, and municipality are required' }, req);
      if (input.password.length < 12) return json(res, 400, { error: 'Staff password must be at least 12 characters' }, req);
      const result = await query(`INSERT INTO app_users (full_name, email, password_hash, role, municipality, department) VALUES ($1, $2, crypt($3, gen_salt('bf')), 'staff', $4, $5) RETURNING id, full_name, email, role, municipality, department`, [input.fullName, input.email, input.password, input.municipality, input.department || null]);
      return json(res, 201, result.rows[0], req);
    }

    if (req.method === 'POST' && url.pathname === '/api/mobile/reports') {
      const input = await body(req);
      if (!hasFields(input, ['externalRef', 'municipality', 'category', 'description', 'location'])) return json(res, 400, { error: 'externalRef, municipality, category, description, and location are required' }, req);
      const citizen = await query(`INSERT INTO app_users (full_name, email, external_ref, role) VALUES ('Anonymous Citizen', $1, $2, 'citizen') ON CONFLICT (external_ref) DO UPDATE SET updated_at = now() RETURNING id`, [`anonymous-${input.externalRef}@local.invalid`, input.externalRef]);
      const result = await query(`INSERT INTO service_reports (public_reference, citizen_id, municipality, category, description, location_text, urgency, sla_due_at) VALUES ('MZ-${Date.now()}', $1, $2, $3, $4, $5, $6, now() + interval '48 hours') RETURNING *`, [citizen.rows[0].id, input.municipality, input.category, input.description, input.location, input.urgency || 'medium']);
      broadcast('report.created', result.rows[0]);
      return json(res, 201, result.rows[0], req);
    }

    if (req.method === 'GET' && url.pathname === '/api/reports') {
      if (!url.searchParams.get('citizenId')) return json(res, 400, { error: 'citizenId is required' }, req);
      const result = await query('SELECT * FROM service_reports WHERE citizen_id = $1 ORDER BY created_at DESC', [url.searchParams.get('citizenId')]);
      return json(res, 200, result.rows, req);
    }

    const reportEvents = url.pathname.match(/^\/api\/reports\/([^/]+)\/events$/);
    if (req.method === 'GET' && reportEvents) {
      const result = await query('SELECT id, from_status, to_status, changed_by, note, created_at FROM report_status_events WHERE report_id = $1 ORDER BY created_at ASC', [reportEvents[1]]);
      return json(res, 200, result.rows, req);
    }

    if (req.method === 'GET' && url.pathname === '/api/leaderboard') {
      const result = await query(`SELECT u.id, u.full_name AS name, count(r.id)::int AS reports, (count(r.id) * 10)::int AS points FROM app_users u LEFT JOIN service_reports r ON r.citizen_id = u.id WHERE u.role = 'citizen' GROUP BY u.id, u.full_name ORDER BY points DESC, reports DESC, u.full_name ASC LIMIT 20`);
      return json(res, 200, result.rows.map((row, index) => ({ ...row, rank: index + 1 })), req);
    }

    if (req.method === 'POST' && url.pathname === '/api/reports') {
      const input = await body(req);
      if (!hasFields(input, ['citizenId', 'municipality', 'category', 'description', 'location'])) return json(res, 400, { error: 'citizenId, municipality, category, description, and location are required' }, req);
      const citizen = await query('SELECT id FROM app_users WHERE id = $1 AND role = $2', [input.citizenId, 'citizen']);
      if (!citizen.rows[0]) return json(res, 404, { error: 'Citizen identity not found' }, req);
      const result = await query(`INSERT INTO service_reports (public_reference, citizen_id, municipality, category, description, location_text, latitude, longitude, urgency, sla_due_at) VALUES ('MZ-${Date.now()}', $1, $2, $3, $4, $5, $6, $7, $8, now() + interval '48 hours') RETURNING *`, [input.citizenId, input.municipality, input.category, input.description, input.location, input.latitude || null, input.longitude || null, input.urgency || 'medium']);
      broadcast('report.created', result.rows[0]);
      return json(res, 201, result.rows[0], req);
    }

    const assignment = url.pathname.match(/^\/api\/reports\/([^/]+)\/assign$/);
    if (req.method === 'POST' && assignment) {
      const user = requireRole(req, url, ['admin']);
      if (!user) return json(res, 403, { error: 'Administrator access required' }, req);
      const input = await body(req);
      if (!hasFields(input, ['staffId'])) return json(res, 400, { error: 'staffId is required' }, req);
      await query('INSERT INTO report_assignments (report_id, staff_id, assigned_by) VALUES ($1, $2, $3) ON CONFLICT (report_id) DO UPDATE SET staff_id = EXCLUDED.staff_id, assigned_by = EXCLUDED.assigned_by, assigned_at = now()', [assignment[1], input.staffId, user.sub]);
      const result = await query("UPDATE service_reports SET status = 'assigned' WHERE id = $1 RETURNING *", [assignment[1]]);
      if (!result.rows[0]) return json(res, 404, { error: 'Report not found' }, req);
      broadcast('report.updated', result.rows[0]);
      return json(res, 200, result.rows[0], req);
    }

    const status = url.pathname.match(/^\/api\/reports\/([^/]+)\/status$/);
    if (req.method === 'PATCH' && status) {
      const user = requireRole(req, url, ['staff', 'admin']);
      if (!user) return json(res, 403, { error: 'Staff access required' }, req);
      const input = await body(req);
      if (!validStatuses.has(input.status)) return json(res, 400, { error: 'Invalid report status' }, req);
      const previous = await query('SELECT status FROM service_reports WHERE id = $1', [status[1]]);
      const result = await query("UPDATE service_reports SET status = $2, resolved_at = CASE WHEN $2 IN ('resolved','closed') THEN now() ELSE NULL END WHERE id = $1 AND ($3 = 'admin' OR municipality = $4) RETURNING *", [status[1], input.status, user.role, user.municipality || '']);
      if (!result.rows[0]) return json(res, 404, { error: 'Report not found' }, req);
      await query('INSERT INTO report_status_events (report_id, from_status, to_status, changed_by, note) VALUES ($1, $2, $3, $4, $5)', [status[1], previous.rows[0]?.status || null, input.status, user.sub, input.note || null]);
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
