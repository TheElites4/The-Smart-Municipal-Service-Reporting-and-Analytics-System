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
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 4_100_000) {
      const error = new Error('Request too large (maximum photo size is 3 MB)');
      error.statusCode = 413;
      throw error;
    }
  }
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

/**
 * Normalise a municipality for comparison so staff and admin dashboards always
 * agree on which reports belong to them. Handles casing, surrounding whitespace,
 * repeated spaces, an optional leading "City of"/"Municipality of" prefix and an
 * optional trailing "Local/Metropolitan/District Municipality" suffix.
 */
const normaliseMunicipality = (value) => String(value ?? '')
  .trim()
  .toLowerCase()
  .replace(/^(city|municipality|metro|metropolitan municipality) of\s+/, '')
  .replace(/\s+(local|metropolitan|district)\s+municipality$/, '')
  .replace(/\s+municipality$/, '')
  .replace(/\s+/g, ' ');
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

/**
 * Firebase MFA support for the staff/admin dashboards.
 *
 * The dashboards use the Firebase Web SDK (email-link authentication) to prove
 * control of the account email. Firebase then returns a signed ID token; the
 * dashboard posts that token here and ONLY this server decides whether it is
 * genuine before issuing a dashboard session. The token is verified against
 * Google's rotating public certificates (RS256) with the project id as audience
 * and issuer, so a forged token cannot be used to sign in.
 */
const firebaseProjectId = process.env.FIREBASE_PROJECT_ID || '';
const firebaseEnabled = String(process.env.MFA_PROVIDER || 'firebase').toLowerCase() === 'firebase';
if (!firebaseEnabled) throw new Error('MFA_PROVIDER must be firebase for staff/admin dashboard sign-in');
if (process.env.NODE_ENV === 'production' && !firebaseProjectId) {
  throw new Error('FIREBASE_PROJECT_ID must be configured for staff/admin dashboard sign-in');
}
if (firebaseProjectId && !/^[a-z0-9-]{4,}$/i.test(firebaseProjectId)) {
  throw new Error('FIREBASE_PROJECT_ID does not look like a Firebase project id');
}
const firebaseCertUrl = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
const firebaseCerts = { keys: null, expiresAt: 0 };

const base64UrlToBuffer = (value) => Buffer.from(String(value).replace(/-/g, '+').replace(/_/g, '/'), 'base64');

const loadFirebaseCerts = async () => {
  if (firebaseCerts.keys && Date.now() < firebaseCerts.expiresAt) return firebaseCerts.keys;
  const response = await fetch(firebaseCertUrl);
  if (!response.ok) throw new Error('Unable to load Firebase signing certificates');
  const keys = await response.json();
  // Cache for the lifetime Google advertises; fall back to one hour.
  const cacheControl = response.headers.get('cache-control') || '';
  const maxAge = Number((cacheControl.match(/max-age=(\d+)/) || [])[1]) || 3600;
  firebaseCerts.keys = keys;
  firebaseCerts.expiresAt = Date.now() + maxAge * 1000;
  return keys;
};

const verifyFirebaseIdToken = async (idToken) => {
  if (!firebaseProjectId) throw new Error('FIREBASE_PROJECT_ID is not configured');
  const parts = String(idToken || '').split('.');
  if (parts.length !== 3) throw new Error('Malformed Firebase ID token');
  const header = JSON.parse(base64UrlToBuffer(parts[0]).toString('utf8'));
  const payload = JSON.parse(base64UrlToBuffer(parts[1]).toString('utf8'));
  if (header.alg !== 'RS256') throw new Error('Unsupported Firebase token algorithm');
  const certs = await loadFirebaseCerts();
  const pem = certs[header.kid];
  if (!pem) throw new Error('Unknown Firebase signing key');
  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(`${parts[0]}.${parts[1]}`);
  if (!verifier.verify(pem, base64UrlToBuffer(parts[2]))) throw new Error('Invalid Firebase token signature');
  const now = Math.floor(Date.now() / 1000);
  if (!payload.exp || payload.exp < now) throw new Error('Firebase token has expired');
  if (!payload.iat || payload.iat > now + 300) throw new Error('Firebase token issued in the future');
  if (payload.aud !== firebaseProjectId) throw new Error('Firebase token audience mismatch');
  if (payload.iss !== `https://securetoken.google.com/${firebaseProjectId}`) throw new Error('Firebase token issuer mismatch');
  if (process.env.FIREBASE_TENANT_ID && payload.firebase?.tenant !== process.env.FIREBASE_TENANT_ID) throw new Error('Firebase tenant mismatch');
  if (!payload.sub) throw new Error('Firebase token is missing a subject');
  return payload;
};

const reverseGeocode = async (latitude, longitude) => {
  const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}`, {
    headers: { 'user-agent': process.env.GEOCODER_USER_AGENT || 'MzansiConnect/1.0', accept: 'application/json' },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    console.error(`Reverse geocoder returned HTTP ${response.status}`);
    throw Object.assign(new Error('Location lookup is temporarily unavailable'), { statusCode: 503 });
  }
  const place = await response.json();
  const address = place.address || {};
  return address.suburb || address.city_district || address.neighbourhood || address.city || address.town || address.municipality || null;
};
const eskomStatus = async (latitude, longitude, municipality) => {
  const token = process.env.ESKOM_SE_PUSH_TOKEN;
  if (!token || /^(replace-with|your[-_ ]|placeholder)/i.test(token.trim())) {
    throw Object.assign(new Error('Live load-shedding status is not configured. Set ESKOM_SE_PUSH_TOKEN on the API service.'), { statusCode: 503 });
  }

  const areaText = municipality?.trim() || (latitude !== null && longitude !== null
    ? await reverseGeocode(latitude, longitude)
    : null);
  let statusUrl = 'https://developer.sepush.co.za/business/2.0/status';
  let areaName = 'South Africa';
  if (areaText) {
    const search = await fetch(`https://developer.sepush.co.za/business/2.0/areasearch?text=${encodeURIComponent(areaText)}`, {
      headers: { Token: token, accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!search.ok) {
      console.error(`EskomSePush area search returned HTTP ${search.status}`);
      throw Object.assign(new Error(search.status === 401 || search.status === 403
        ? 'EskomSePush rejected its API token. Check ESKOM_SE_PUSH_TOKEN.'
        : `EskomSePush area search failed (HTTP ${search.status}).`), { statusCode: 503 });
    }
    const areas = await search.json();
    const matches = Array.isArray(areas.areas) ? areas.areas : [];
    const area = matches.find((candidate) => normaliseMunicipality(candidate.name) === normaliseMunicipality(areaText)) || matches[0];
    if (!area?.id) {
      throw Object.assign(new Error(`EskomSePush has no matching area for "${areaText}".`), { statusCode: 503 });
    }
    statusUrl += `?id=${encodeURIComponent(area.id)}`;
    areaName = area.name;
  }

  const statusResponse = await fetch(statusUrl, {
    headers: { Token: token, accept: 'application/json' },
    signal: AbortSignal.timeout(10_000),
  });
  if (!statusResponse.ok) {
    console.error(`EskomSePush status returned HTTP ${statusResponse.status}`);
    throw Object.assign(new Error(statusResponse.status === 401 || statusResponse.status === 403
      ? 'EskomSePush rejected its API token. Check ESKOM_SE_PUSH_TOKEN.'
      : `EskomSePush status lookup failed (HTTP ${statusResponse.status}).`), { statusCode: 503 });
  }
  const status = await statusResponse.json();
  const now = Date.now();
  const events = Array.isArray(status.events) ? status.events : [];
  const active = events.find((event) => {
    const startsAt = Date.parse(event.start);
    const endsAt = Date.parse(event.end);
    return Number.isFinite(startsAt) && Number.isFinite(endsAt) && startsAt <= now && endsAt >= now;
  });
  const eskomStage = status.status?.eskom?.stage ?? status.stage;
  const stageText = active?.note || active?.info ||
    (typeof eskomStage === 'string' ? `Stage ${eskomStage}` : '') ||
    (typeof status.status === 'string' ? status.status : '');
  const stageMatch = String(stageText).match(/stage\s*(\d+)/i);
  const stage = stageMatch ? Number(stageMatch[1]) : Number(eskomStage) || 0;
  return { current: Boolean(active) || stage > 0, stage, areas: [areaName], updatedAt: new Date().toISOString(), source: 'EskomSePush' };
};
const broadcast = (event, payload) => {
  const message = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  const payloadMunicipality = normaliseMunicipality(payload.municipality);
  for (const client of realtimeClients) {
    const isOwner = Boolean(client.citizenId) && String(client.citizenId) === String(payload.citizen_id);
    const isAdmin = client.user?.role === 'admin';
    // Staff must always see the report the moment it is submitted, regardless of
    // how the report's municipality is spelled/normalised. Only restrict them when
    // they have a municipality scope AND the report carries a mismatching one.
    const staffScope = client.user?.role === 'staff' ? normaliseMunicipality(client.user.municipality) : '';
    const staffCanSee = Boolean(client.user) && client.user?.role !== 'staff'
      ? false
      : Boolean(client.user) && client.user?.role === 'staff'
        ? (!staffScope || !payloadMunicipality || staffScope === payloadMunicipality)
        : false;
    if (isOwner || isAdmin || staffCanSee) client.res.write(message);
  }
};

async function dashboardData(municipality) {
  // Compare municipalities case-insensitively and ignoring the optional
  // "City of"/"Municipality of"/"... Local Municipality" wording, so a staff
  // account typed as "sol plaatje municipality" still matches reports stored as
  // "Sol Plaatje Local Municipality". Without this a staff member logs in and
  // sees an empty queue even though reports for their area exist.
  const filter = municipality ? 'WHERE normalise_municipality(r.municipality) = normalise_municipality($1)' : '';
  const values = municipality ? [municipality] : [];
  const [summary, queue, staff] = await Promise.all([
    query(`SELECT count(*)::int AS total, count(*) FILTER (WHERE status IN ('submitted','under_review'))::int AS unassigned, count(*) FILTER (WHERE status = 'in_progress')::int AS in_progress, count(*) FILTER (WHERE status IN ('resolved','closed'))::int AS resolved FROM service_reports r ${filter}`, values),
    query(`SELECT r.id, r.public_reference, r.category, r.description, r.location_text, r.urgency, r.status, r.created_at, r.sla_due_at, u.full_name AS citizen_name, a.staff_id, su.full_name AS staff_name FROM service_reports r JOIN app_users u ON u.id = r.citizen_id LEFT JOIN report_assignments a ON a.report_id = r.id LEFT JOIN app_users su ON su.id = a.staff_id ${filter} ORDER BY CASE r.urgency WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END, r.created_at DESC LIMIT 100`, values),
    query(`SELECT u.id, u.full_name, u.department, u.municipality, u.is_active, u.last_seen_at, count(a.report_id)::int AS open_jobs FROM app_users u LEFT JOIN report_assignments a ON a.staff_id = u.id LEFT JOIN service_reports r ON r.id = a.report_id AND r.status NOT IN ('resolved','closed') WHERE u.role = 'staff' ${municipality ? 'AND normalise_municipality(u.municipality) = normalise_municipality($1)' : ''} GROUP BY u.id ORDER BY open_jobs DESC`, values)
  ]);
  return { summary: summary.rows[0], reports: queue.rows, staff: staff.rows };
}
async function adminAnalytics() {
  const [categories, statuses, monthly, municipalities] = await Promise.all([
    query('SELECT category AS label, count(*)::int AS count FROM service_reports GROUP BY category ORDER BY count DESC, category'),
    query('SELECT status::text AS label, count(*)::int AS count FROM service_reports GROUP BY status ORDER BY count DESC, status'),
    query("SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS label, count(*)::int AS reports, count(*) FILTER (WHERE status IN ('resolved','closed'))::int AS resolved FROM service_reports WHERE created_at >= date_trunc('month', now()) - interval '11 months' GROUP BY date_trunc('month', created_at) ORDER BY date_trunc('month', created_at)"),
    query('SELECT municipality AS label, count(*)::int AS count FROM service_reports GROUP BY municipality ORDER BY count DESC, municipality LIMIT 10')
  ]);
  return {
    categories: categories.rows,
    statuses: statuses.rows,
    monthly: monthly.rows,
    municipalities: municipalities.rows
  };
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
    if (req.method === 'GET' && url.pathname === '/api/options') {
      const [municipalities, categories, issues] = await Promise.all([
        query('SELECT name FROM municipalities ORDER BY name'),
        query('SELECT name FROM service_categories WHERE is_active = true ORDER BY name'),
        query('SELECT category, label FROM service_issue_types ORDER BY category, label')
      ]);
      return json(res, 200, { municipalities: municipalities.rows.map((row) => row.name), categories: categories.rows.map((row) => row.name), issues: issues.rows }, req);
    }
    if (req.method === 'GET' && url.pathname === '/api/location/reverse') {
      const latitude = Number(url.searchParams.get('latitude'));
      const longitude = Number(url.searchParams.get('longitude'));
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return json(res, 400, { error: 'Valid coordinates required' }, req);
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=18&lat=${latitude}&lon=${longitude}`, { headers: { 'user-agent': process.env.GEOCODER_USER_AGENT || 'MzansiConnect/1.0 (configure GEOCODER_USER_AGENT)', accept: 'application/json' } });
      if (!response.ok) return json(res, 503, { error: 'Location lookup unavailable' }, req);
      const place = await response.json();
      if (place.address?.country_code !== 'za') return json(res, 422, { error: 'Location is outside South Africa' }, req);
      const address = place.address;
      const location = [address.road || address.pedestrian || address.neighbourhood || address.suburb || address.village, address.suburb || address.village || address.town || address.city].filter((part, index, parts) => part && parts.indexOf(part) === index).join(', ') || place.display_name;
      const candidates = [address.municipality, address.city, address.county, address.state_district].filter(Boolean);
      const rows = await query('SELECT name FROM municipalities');
      const municipality = rows.rows.find((row) => candidates.some((candidate) => normaliseMunicipality(candidate) === normaliseMunicipality(row.name)))?.name || null;
      return json(res, 200, { location, municipality }, req);
    }
    if (req.method === 'GET' && url.pathname === '/api/location/status') {
      const latitude = url.searchParams.get('latitude');
      const longitude = url.searchParams.get('longitude');
      if ((latitude && !longitude) || (!latitude && longitude)) return json(res, 400, { error: 'latitude and longitude must be provided together' }, req);
      if (latitude && (!Number.isFinite(Number(latitude)) || Number(latitude) < -90 || Number(latitude) > 90)) return json(res, 400, { error: 'latitude must be between -90 and 90' }, req);
      if (longitude && (!Number.isFinite(Number(longitude)) || Number(longitude) < -180 || Number(longitude) > 180)) return json(res, 400, { error: 'longitude must be between -180 and 180' }, req);
      try {
        const status = await eskomStatus(latitude, longitude, url.searchParams.get('municipality'));
        return json(res, 200, status, req);
      } catch (error) {
        if (error.statusCode) return json(res, error.statusCode, { error: error.message }, req);
        console.error(`Load-shedding provider request failed (${error.name || 'Error'})`);
        return json(res, 503, { error: 'Live load-shedding provider is unavailable. Check API connectivity and provider configuration.' }, req);
      }
    }
    if (req.method === 'POST' && url.pathname === '/api/auth/login') {
      const input = await body(req);
      if (!hasFields(input, ['email', 'password'])) return json(res, 400, { error: 'email and password are required' }, req);
      const result = await query('SELECT id, full_name, email, role, municipality, department FROM app_users WHERE lower(email) = lower($1) AND password_hash = crypt($2, password_hash) AND is_active = true LIMIT 1', [input.email, input.password]);
      const account = result.rows[0];
      if (!account) return json(res, 401, { error: 'Invalid email or password' }, req);
      // The password is only the first factor. Staff/admin accounts must also
      // prove control of their email inbox before any dashboard token is issued.
      if (firebaseEnabled && (account.role === 'staff' || account.role === 'admin')) {
        if (!firebaseProjectId) return json(res, 503, { error: 'Firebase MFA is enabled but FIREBASE_PROJECT_ID is not configured' }, req);
        return json(res, 200, {
          mfaRequired: 'firebase-email',
          firebase: { projectId: firebaseProjectId },
          mfaToken: signToken({
            sub: account.id,
            role: account.role,
            email: account.email,
            purpose: 'firebase-email-mfa',
            exp: Math.floor(Date.now() / 1000) + 10 * 60
          }),
          user: { email: account.email, role: account.role }
        }, req);
      }
      const token = signToken({ sub: account.id, role: account.role, email: account.email, municipality: account.municipality, exp: Math.floor(Date.now() / 1000) + tokenTtlSeconds });
      await query('UPDATE app_users SET last_seen_at = now() WHERE id = $1', [account.id]);
      return json(res, 200, { token, expiresIn: tokenTtlSeconds, user: { id: account.id, fullName: account.full_name, email: account.email, role: account.role, municipality: account.municipality, department: account.department } }, req);
    }
    // Email-link MFA callback: verify the Firebase ID token and require a
    // verified Firebase email that matches the account whose password was used.
    if (req.method === 'POST' && url.pathname === '/api/auth/firebase-email-verify') {
      if (!firebaseEnabled) return json(res, 404, { error: 'Firebase MFA is not enabled' }, req);
      const input = await body(req);
      if (!hasFields(input, ['email', 'idToken', 'mfaToken'])) return json(res, 400, { error: 'email, idToken, and mfaToken are required' }, req);
      const challenge = verifyToken(input.mfaToken);
      if (!challenge || challenge.purpose !== 'firebase-email-mfa' ||
          typeof challenge.sub !== 'string' ||
          typeof challenge.email !== 'string' ||
          !['staff', 'admin'].includes(challenge.role) ||
          challenge.email.toLowerCase() !== input.email.trim().toLowerCase()) {
        return json(res, 401, { error: 'Password verification has expired or is invalid. Sign in again.' }, req);
      }
      let claims;
      try {
        claims = await verifyFirebaseIdToken(input.idToken);
      } catch (error) {
        return json(res, 401, { error: `Firebase verification failed: ${error.message}` }, req);
      }
      const result = await query('SELECT id, full_name, email, role, municipality, department FROM app_users WHERE id = $1 AND lower(email) = lower($2) AND is_active = true LIMIT 1', [challenge.sub, input.email]);
      const account = result.rows[0];
      if (!account || account.role !== challenge.role) return json(res, 403, { error: 'Account is not authorised for dashboard access' }, req);
      if (typeof claims.email !== 'string' ||
          claims.email.toLowerCase() !== account.email.toLowerCase() ||
          claims.email.toLowerCase() !== input.email.trim().toLowerCase() ||
          claims.email_verified !== true) {
        return json(res, 403, { error: 'Firebase email must be verified and match this dashboard account' }, req);
      }
      const token = signToken({ sub: account.id, role: account.role, email: account.email, municipality: account.municipality, exp: Math.floor(Date.now() / 1000) + tokenTtlSeconds });
      await query('UPDATE app_users SET last_seen_at = now() WHERE id = $1', [account.id]);
      return json(res, 200, { token, expiresIn: tokenTtlSeconds, user: { id: account.id, fullName: account.full_name, email: account.email, role: account.role, municipality: account.municipality, department: account.department } }, req);
    }
    if (req.method === 'GET' && url.pathname === '/api/events') {
      const user = requireRole(req, url, ['staff', 'admin']);
      const citizenId = url.searchParams.get('citizenId');
      if (!user && !citizenId) return json(res, 401, { error: 'Authentication or citizenId required' }, req);
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
      const requested = url.searchParams.get('municipality');
      if (user.role === 'staff' && requested && normaliseMunicipality(requested) !== normaliseMunicipality(user.municipality)) return json(res, 403, { error: 'Municipality access denied' }, req);
      return json(res, 200, await dashboardData(user.role === 'staff' ? user.municipality : requested), req);
    }
    if (req.method === 'GET' && url.pathname === '/api/admin/analytics') {
      const user = requireRole(req, url, ['admin']);
      if (!user) return json(res, 403, { error: 'Administrator access required' }, req);
      return json(res, 200, await adminAnalytics(), req);
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
      const result = await query(`INSERT INTO app_users (full_name, email, external_ref, role) VALUES ('Anonymous Citizen', $1, $2, 'citizen') ON CONFLICT (email) DO UPDATE SET external_ref = EXCLUDED.external_ref, updated_at = now() RETURNING id, external_ref, role`, [`anonymous-${externalRef}@local.invalid`, externalRef]);
      return json(res, 201, result.rows[0], req);
    }

    if (req.method === 'POST' && url.pathname === '/api/staff') {
      const admin = requireRole(req, url, ['admin']);
      if (!admin) return json(res, 403, { error: 'Administrator access required' }, req);
      const input = await body(req);
      if (!hasFields(input, ['fullName', 'email', 'password', 'municipality', 'phone'])) return json(res, 400, { error: 'fullName, email, password, municipality, and phone are required' }, req);
      if (input.password.length < 12) return json(res, 400, { error: 'Staff password must be at least 12 characters' }, req);
      if (!/^\+[1-9]\d{7,14}$/.test(input.phone.trim())) return json(res, 400, { error: 'Staff phone must be in international E.164 format, e.g. +27821234567' }, req);
      const result = await query(`INSERT INTO app_users (full_name, email, password_hash, role, municipality, department, phone) VALUES ($1, $2, crypt($3, gen_salt('bf')), 'staff', $4, $5, $6) RETURNING id, full_name, email, role, municipality, department, phone`, [input.fullName, input.email, input.password, input.municipality, input.department || null, input.phone.trim()]);
      return json(res, 201, result.rows[0], req);
    }

    if (req.method === 'PATCH' && url.pathname === '/api/staff/phone') {
      const admin = requireRole(req, url, ['admin']);
      if (!admin) return json(res, 403, { error: 'Administrator access required' }, req);
      const input = await body(req);
      if (!hasFields(input, ['email', 'phone'])) return json(res, 400, { error: 'Staff email and phone are required' }, req);
      const phone = input.phone.trim();
      if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
        return json(res, 400, { error: 'Phone must be in international E.164 format, e.g. +27821234567' }, req);
      }
      const result = await query(
        `UPDATE app_users
            SET phone = $1, updated_at = now()
          WHERE lower(email) = lower($2) AND role = 'staff'
          RETURNING id, full_name, email, phone`,
        [phone, input.email.trim()]
      );
      if (!result.rows[0]) return json(res, 404, { error: 'Staff account not found' }, req);
      return json(res, 200, { ...result.rows[0], phoneUpdated: true }, req);
    }

    // Password reset. There is no self-service reset mail, so an administrator sets a new
    // password here when someone forgets or mistypes theirs. Without this a forgotten
    // password is permanently unrecoverable and the account has to be recreated.
    const passwordReset = url.pathname.match(/^\/api\/users\/([^/]+)\/password$/);
    if (req.method === 'PATCH' && passwordReset) {
      const admin = requireRole(req, url, ['admin']);
      if (!admin) return json(res, 403, { error: 'Administrator access required' }, req);
      const input = await body(req);
      if (typeof input.password !== 'string' || input.password.length < 12) return json(res, 400, { error: 'New password must be at least 12 characters' }, req);
      // Allow lookup by id or by email so the admin UI can target either.
      const target = decodeURIComponent(passwordReset[1]);
      const isEmail = target.includes('@');
      const result = await query(`UPDATE app_users SET password_hash = crypt($1, gen_salt('bf')), updated_at = now() WHERE ${isEmail ? 'lower(email) = lower($2)' : 'id::text = $2'} RETURNING id, full_name, email, role`, [input.password, target]);
      if (!result.rows[0]) return json(res, 404, { error: 'User not found' }, req);
      return json(res, 200, { ...result.rows[0], passwordUpdated: true }, req);
    }

    if (req.method === 'GET' && url.pathname === '/api/reports') {
      const externalRef = url.searchParams.get('externalRef');
      if (!externalRef) return json(res, 400, { error: 'externalRef is required' }, req);
      const result = await query('SELECT r.*, EXISTS (SELECT 1 FROM report_photos p WHERE p.report_id = r.id) AS has_photo FROM service_reports r JOIN app_users u ON u.id = r.citizen_id WHERE u.external_ref = $1 AND u.role = \'citizen\' ORDER BY r.created_at DESC', [externalRef]);
      return json(res, 200, result.rows, req);
    }

    const reportPhoto = url.pathname.match(/^\/api\/reports\/([0-9a-f-]{36})\/photo$/);
    if (req.method === 'GET' && reportPhoto) {
      const externalRef = url.searchParams.get('externalRef');
      const user = requireRole(req, url, ['staff', 'admin']);
      if (!externalRef && !user) return json(res, 403, { error: 'Access denied' }, req);
      const result = await query('SELECT p.content_type, p.data FROM report_photos p JOIN service_reports r ON r.id = p.report_id JOIN app_users u ON u.id = r.citizen_id WHERE p.report_id = $1 AND (($2::text IS NOT NULL AND u.external_ref = $2) OR ($3::text = \'admin\') OR ($3::text = \'staff\' AND normalise_municipality(r.municipality) = normalise_municipality($4)))', [reportPhoto[1], externalRef, user?.role || '', user?.municipality || '']);
      if (!result.rows[0]) return json(res, 404, { error: 'Photo not found' }, req);
      res.writeHead(200, { 'content-type': result.rows[0].content_type, 'cache-control': 'private, no-store', ...corsHeaders(req) });
      return res.end(result.rows[0].data);
    }
    const reportEvents = url.pathname.match(/^\/api\/reports\/([^/]+)\/events$/);
    if (req.method === 'GET' && reportEvents) {
      const identifier = decodeURIComponent(reportEvents[1]);
      // Older Android clients request events by the human-readable public
      // reference (e.g. "RPT-...") instead of the database UUID. Accept either
      // so a valid request is not turned into a 500 by a uuid cast failure.
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
      if (!isUuid && !/^[A-Za-z0-9-]{1,64}$/.test(identifier)) return json(res, 400, { error: 'Invalid report reference' }, req);
      const result = await query(
        `SELECT e.id, e.from_status, e.to_status, e.changed_by, e.note, e.created_at
           FROM report_status_events e
           JOIN service_reports r ON r.id = e.report_id
          WHERE ${isUuid ? 'r.id = $1::uuid' : 'r.public_reference = $1'}
          ORDER BY e.created_at ASC`,
        [identifier]
      );
      return json(res, 200, result.rows, req);
    }

    if (req.method === 'GET' && url.pathname === '/api/leaderboard') {
      const result = await query(`SELECT u.id, u.full_name AS name, count(r.id)::int AS reports, (count(r.id) * 10)::int AS points FROM app_users u LEFT JOIN service_reports r ON r.citizen_id = u.id WHERE u.role = 'citizen' GROUP BY u.id, u.full_name ORDER BY points DESC, reports DESC, u.full_name ASC LIMIT 20`);
      return json(res, 200, result.rows.map((row, index) => ({ ...row, rank: index + 1 })), req);
    }

    if (req.method === 'POST' && url.pathname === '/api/reports') {
      const input = await body(req);
      if (!hasFields(input, ['municipality', 'category', 'description', 'location'])) return json(res, 400, { error: 'municipality, category, description, and location are required' }, req);
      const category = await query('SELECT 1 FROM service_categories WHERE name = $1 AND is_active = true', [input.category]);
      if (!category.rows[0]) return json(res, 400, { error: 'Choose a supported report category' }, req);
      if (input.issueType) {
        const issue = await query('SELECT 1 FROM service_issue_types WHERE category = $1 AND label = $2', [input.category, input.issueType]);
        if (!issue.rows[0]) return json(res, 400, { error: 'Choose an issue matching the category' }, req);
      }
      const municipality = await query('SELECT 1 FROM municipalities WHERE name = $1', [input.municipality]);
      if (!municipality.rows[0]) return json(res, 400, { error: 'Choose a supported municipality' }, req);
      const photo = input.photo;
      if (photo !== undefined && (!photo || !['image/jpeg', 'image/png', 'image/webp'].includes(photo.contentType) || typeof photo.base64 !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(photo.base64) || photo.base64.length > 4_000_000)) return json(res, 400, { error: 'Photo must be a JPEG, PNG or WebP image under 3 MB' }, req);
      const photoBytes = photo ? Buffer.from(photo.base64, 'base64') : null;
      if (photoBytes && (photoBytes.length > 3_000_000 || photoBytes.length === 0 || !(photo.contentType === 'image/jpeg' && photoBytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])) || photo.contentType === 'image/png' && photoBytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) || photo.contentType === 'image/webp' && photoBytes.toString('ascii', 0, 4) === 'RIFF' && photoBytes.toString('ascii', 8, 12) === 'WEBP'))) return json(res, 400, { error: 'Invalid photo data' }, req);
      // The Android client falls back to a null citizenId when identity resolution
      // fails offline. Resolve or mint an identity instead of rejecting the report,
      // so a citizen submission is never lost before it reaches the dashboards.
      let citizenId = input.citizenId;
      if (citizenId) {
        const citizen = await query('SELECT id FROM app_users WHERE id = $1 AND role = $2', [citizenId, 'citizen']);
        if (!citizen.rows[0]) citizenId = null;
      }
      if (!citizenId) {
        const externalRef = typeof input.externalRef === 'string' && input.externalRef.trim() ? input.externalRef.trim() : crypto.randomUUID();
        const anonymous = await query(`INSERT INTO app_users (full_name, email, external_ref, role) VALUES ('Anonymous Citizen', $1, $2, 'citizen') ON CONFLICT (external_ref) DO UPDATE SET updated_at = now() RETURNING id`, [`anonymous-${externalRef}@local.invalid`, externalRef]);
        citizenId = anonymous.rows[0].id;
      }
      const client = await pool.connect();
      let saved;
      try {
        await client.query('BEGIN');
        const result = await client.query(`INSERT INTO service_reports (public_reference, citizen_id, municipality, category, description, location_text, latitude, longitude, urgency, sla_due_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now() + interval '48 hours') RETURNING *`, [`MZ-${crypto.randomUUID()}`, citizenId, input.municipality, input.category, input.description, input.location, input.latitude ?? null, input.longitude ?? null, input.urgency || 'medium']);
        saved = result.rows[0];
        if (photoBytes) await client.query('INSERT INTO report_photos (report_id, content_type, data) VALUES ($1, $2, $3)', [saved.id, photo.contentType, photoBytes]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally { client.release(); }
      broadcast('report.created', saved);
      return json(res, 201, { ...saved, has_photo: !!photoBytes }, req);
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
      const result = await query("UPDATE service_reports SET status = $2, resolved_at = CASE WHEN $2 IN ('resolved','closed') THEN now() ELSE NULL END WHERE id = $1 AND ($3 = 'admin' OR normalise_municipality(municipality) = normalise_municipality($4)) RETURNING *", [status[1], input.status, user.role, user.municipality || '']);
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

// Bind to all interfaces so the Android emulator (10.0.2.2) and physical
// devices on the LAN can reach the API, not just localhost.
server.listen(port, '0.0.0.0', () => console.log(`MzansiConnect API listening on http://0.0.0.0:${port} (localhost, 10.0.2.2, and LAN IP all reachable)`));
