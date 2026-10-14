import http from 'node:http';
import { URL } from 'node:url';
import crypto from 'node:crypto';
import pg from 'pg';
import nodemailer from 'nodemailer';
import { totp } from './totp.js';

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

// Staff/admin second factor is a short-lived code delivered to the account email.
const emailOtpTtlMinutes = 5;
const emailOtpMaxAttempts = 5;
const emailOtpCooldownSeconds = 60;
const emailOtpHash = (code) => crypto.createHmac('sha256', authSecret).update(code).digest('hex');

const getSmtpSettings = () => {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT || 465);
  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_APP_PASSWORD;
  const normalizedPassword = password?.replace(/\s/g, '');
  const from = process.env.SMTP_FROM || user;
  if (!user || !normalizedPassword || !from || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw Object.assign(new Error('Email verification is not configured. Set SMTP_USER and SMTP_APP_PASSWORD in the API environment.'), { statusCode: 503 });
  }
  return {
    host,
    port,
    user,
    password: normalizedPassword,
    from: from.includes('<') ? from : `MzansiConnect <${from}>`,
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE.toLowerCase() === 'true' : port === 465,
  };
};

const sendLoginCode = async ({ to, fullName, code }, settings) => {
  const transporter = nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.secure,
    auth: { user: settings.user, pass: settings.password },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
  try {
    await transporter.sendMail({
      from: settings.from,
      to,
      subject: 'Your MzansiConnect sign-in code',
      text: [
        `Hello ${fullName || 'there'},`,
        '',
        `Your MzansiConnect dashboard verification code is: ${code}`,
        `It expires in ${emailOtpTtlMinutes} minutes and can only be used once.`,
        '',
        'If you did not try to sign in, you can ignore this email.',
      ].join('\n'),
    });
  } finally {
    transporter.close();
  }
};

const createEmailOtpChallenge = async (account) => {
  const smtpSettings = getSmtpSettings();
  const code = String(crypto.randomInt(100000, 1000000));
  const challengeId = crypto.randomUUID();
  const client = await pool.connect();
  let transactionStarted = false;
  try {
    await client.query('BEGIN');
    transactionStarted = true;
    const active = await client.query('SELECT id FROM app_users WHERE id = $1 AND is_active = true FOR UPDATE', [account.id]);
    if (!active.rows[0]) {
      throw Object.assign(new Error('Account is not authorised for dashboard access.'), { statusCode: 401 });
    }
    const cooldown = await client.query(
      `SELECT created_at FROM auth_mfa_challenges
        WHERE user_id = $1 AND delivery_method = 'email'
          AND created_at > now() - ($2::double precision * interval '1 second')
        ORDER BY created_at DESC LIMIT 1`,
      [account.id, emailOtpCooldownSeconds]
    );
    if (cooldown.rows[0]) {
      throw Object.assign(new Error('A sign-in code was sent recently. Check your email before requesting another.'), { statusCode: 429 });
    }
    await client.query(
      `UPDATE auth_mfa_challenges
          SET consumed_at = now()
        WHERE user_id = $1 AND delivery_method = 'email' AND consumed_at IS NULL`,
      [account.id]
    );
    await client.query(
      `INSERT INTO auth_mfa_challenges
         (challenge_id, user_id, code_hash, delivery_method, expires_at)
       VALUES ($1, $2, $3, 'email', now() + ($4::double precision * interval '1 minute'))`,
      [challengeId, account.id, emailOtpHash(code), emailOtpTtlMinutes]
    );
    await client.query('COMMIT');
    transactionStarted = false;
  } catch (error) {
    if (transactionStarted) await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  try {
    await sendLoginCode({ to: account.email, fullName: account.full_name, code }, smtpSettings);
  } catch (error) {
    await query('DELETE FROM auth_mfa_challenges WHERE challenge_id = $1', [challengeId]);
    if (error.statusCode) throw error;
    console.error(`Dashboard login code email could not be sent (${error.name || 'Error'})`);
    throw Object.assign(new Error('Unable to send a sign-in code. Check the SMTP settings and try again.'), { statusCode: 503 });
  }

  return signToken({
    sub: account.id,
    role: account.role,
    email: account.email,
    purpose: 'email-otp-mfa',
    challengeId,
    exp: Math.floor(Date.now() / 1000) + emailOtpTtlMinutes * 60,
  });
};

/**
 * Send the post-enrollment notification. This is a NOTIFICATION, never a code:
 * it tells the account owner that an authenticator was just added, so a silent
 * enrollment cannot go unnoticed. Delivery failures are logged, not fatal, so a
 * mail outage can never block a legitimate user from enrolling.
 */
const sendMfaEnrollmentNotice = async ({ to, fullName }) => {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MFA_EMAIL_FROM;
  if (!apiKey || !from) {
    console.warn('MFA enrollment notice skipped: RESEND_API_KEY or MFA_EMAIL_FROM is not configured');
    return { sent: false };
  }
  const when = new Date().toISOString();
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [to],
        subject: 'MzansiConnect: authenticator app added to your account',
        text: [
          `Hello ${fullName || 'there'},`,
          '',
          'An authenticator app (TOTP) was just enabled on your MzansiConnect dashboard account at ' + when + '.',
          'From now on you will be asked for a 6-digit code from that app when you sign in.',
          '',
          'If this was you, no action is needed.',
          'If this was NOT you, reset your password and contact your administrator immediately.',
        ].join('\n'),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      console.error(`MFA enrollment notice failed (HTTP ${response.status})`);
      return { sent: false };
    }
    return { sent: true };
  } catch (error) {
    console.error(`MFA enrollment notice could not be delivered (${error.name || 'Error'})`);
    return { sent: false };
  }
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
    // The report row uses snake_case `citizen_id`; also accept `citizenId` so the
    // same helper works for payloads shaped either way.
    const ownerId = payload.citizen_id ?? payload.citizenId;
    const isOwner = Boolean(client.citizenId) && ownerId != null && String(client.citizenId) === String(ownerId);
    const role = client.user?.role;
    const isAdmin = role === 'admin';
    // Staff see every report in their municipality the moment it is submitted.
    // A staff account with no municipality scope sees everything (unscoped
    // reviewer); a scoped account sees a report when it carries no municipality
    // or when the two match after normalisation. Municipality spelling
    // differences must never drop a live event.
    let staffCanSee = false;
    if (role === 'staff') {
      const staffScope = normaliseMunicipality(client.user?.municipality);
      staffCanSee = !staffScope || !payloadMunicipality || staffScope === payloadMunicipality;
    }
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
    query(`SELECT r.id, r.public_reference, r.category, r.description, r.location_text, r.urgency, r.status, r.created_at, r.sla_due_at, EXISTS (SELECT 1 FROM report_photos p WHERE p.report_id = r.id) AS has_photo, u.full_name AS citizen_name, a.staff_id, su.full_name AS staff_name FROM service_reports r JOIN app_users u ON u.id = r.citizen_id LEFT JOIN report_assignments a ON a.report_id = r.id LEFT JOIN app_users su ON su.id = a.staff_id ${filter} ORDER BY CASE r.urgency WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END, r.created_at DESC LIMIT 100`, values),
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
    if (req.method === 'GET' && url.pathname === '/') {
      return json(res, 200, { service: 'MzansiConnect API', health: '/health' }, req);
    }
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
      // Staff/admin accounts must prove mailbox access before receiving a session token.
      if (account.role === 'staff' || account.role === 'admin') {
        const mfaToken = await createEmailOtpChallenge(account);
        return json(res, 200, {
          mfaRequired: 'email-otp',
          mfaToken,
          user: { email: account.email, role: account.role },
        }, req);
      }
      const token = signToken({ sub: account.id, role: account.role, email: account.email, municipality: account.municipality, exp: Math.floor(Date.now() / 1000) + tokenTtlSeconds });
      await query('UPDATE app_users SET last_seen_at = now() WHERE id = $1', [account.id]);
      return json(res, 200, { token, expiresIn: tokenTtlSeconds, user: { id: account.id, fullName: account.full_name, email: account.email, role: account.role, municipality: account.municipality, department: account.department } }, req);
    }

    if (req.method === 'POST' && url.pathname === '/api/auth/email/verify') {
      const input = await body(req);
      if (typeof input.mfaToken !== 'string' || !hasFields(input, ['code'])) {
        return json(res, 400, { error: 'mfaToken and code are required' }, req);
      }
      if (!/^\d{6}$/.test(input.code.trim())) {
        return json(res, 400, { error: 'Enter the 6-digit code from your email.' }, req);
      }
      const challenge = verifyToken(input.mfaToken);
      if (!challenge || challenge.purpose !== 'email-otp-mfa' ||
          typeof challenge.sub !== 'string' ||
          typeof challenge.challengeId !== 'string' ||
          !['staff', 'admin'].includes(challenge.role)) {
        return json(res, 401, { error: 'Password verification has expired or is invalid. Sign in again.' }, req);
      }

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const found = await client.query(
          `SELECT c.challenge_id, c.code_hash, c.attempts, u.id, u.full_name, u.email,
                  u.role, u.municipality, u.department
             FROM auth_mfa_challenges c
             JOIN app_users u ON u.id = c.user_id AND u.is_active = true
            WHERE c.challenge_id = $1 AND c.user_id = $2
              AND c.delivery_method = 'email' AND c.consumed_at IS NULL
              AND c.expires_at > now() AND c.attempts < $3
            FOR UPDATE OF c`,
          [challenge.challengeId, challenge.sub, emailOtpMaxAttempts]
        );
        const account = found.rows[0];
        if (!account || account.role !== challenge.role || account.email !== challenge.email) {
          await client.query('COMMIT');
          return json(res, 401, { error: 'That code has expired or was already used. Sign in again to request another.' }, req);
        }

        const submittedHash = Buffer.from(emailOtpHash(input.code.trim()), 'hex');
        const storedHash = Buffer.from(account.code_hash, 'hex');
        if (!crypto.timingSafeEqual(submittedHash, storedHash)) {
          const attempts = account.attempts + 1;
          await client.query(
            `UPDATE auth_mfa_challenges
                SET attempts = $2::smallint,
                    consumed_at = CASE WHEN $2::integer >= $3::integer THEN now() ELSE consumed_at END
              WHERE challenge_id = $1`,
            [challenge.challengeId, attempts, emailOtpMaxAttempts]
          );
          await client.query('COMMIT');
          return json(res, attempts >= emailOtpMaxAttempts ? 429 : 401, {
            error: attempts >= emailOtpMaxAttempts
              ? 'Too many incorrect codes. Sign in again to request a new code.'
              : 'That code is not valid. Check your email and try again.',
          }, req);
        }

        await client.query('UPDATE auth_mfa_challenges SET consumed_at = now() WHERE challenge_id = $1', [challenge.challengeId]);
        await client.query('UPDATE app_users SET last_seen_at = now() WHERE id = $1', [account.id]);
        await client.query('COMMIT');
        const token = signToken({
          sub: account.id,
          role: account.role,
          email: account.email,
          municipality: account.municipality,
          exp: Math.floor(Date.now() / 1000) + tokenTtlSeconds,
        });
        return json(res, 200, {
          token,
          expiresIn: tokenTtlSeconds,
          user: {
            id: account.id,
            fullName: account.full_name,
            email: account.email,
            role: account.role,
            municipality: account.municipality,
            department: account.department,
          },
        }, req);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }

    // --- TOTP MFA enrollment (first-time setup) -----------------------------
    // Step 1: create a temporary secret and return the QR provisioning URI.
    // The secret is stored encrypted and NOT yet active (totp_enabled_at stays
    // NULL) until the user proves their app generates matching codes.
    if (req.method === 'POST' && url.pathname === '/api/auth/totp/enroll') {
      const input = await body(req);
      if (typeof input.mfaToken !== 'string' || !input.mfaToken) return json(res, 400, { error: 'mfaToken is required' }, req);
      const challenge = verifyToken(input.mfaToken);
      if (!challenge || challenge.purpose !== 'totp-mfa' ||
          typeof challenge.sub !== 'string' ||
          !['staff', 'admin'].includes(challenge.role)) {
        return json(res, 401, { error: 'Password verification has expired or is invalid. Sign in again.' }, req);
      }
      const result = await query('SELECT id, full_name, email, role FROM app_users WHERE id = $1 AND is_active = true LIMIT 1', [challenge.sub]);
      const account = result.rows[0];
      if (!account || account.role !== challenge.role) return json(res, 403, { error: 'Account is not authorised for dashboard access' }, req);

      const secret = totp.generateSecret();
      await query('UPDATE app_users SET totp_secret = $1, totp_enabled_at = NULL, totp_last_used_step = NULL, updated_at = now() WHERE id = $2',
        [totp.encryptSecret(secret), account.id]);
      return json(res, 200, {
        otpauthUri: totp.buildProvisioningUri({ secret, accountName: account.email }),
        // Shown under the QR as a manual-entry fallback when a camera is unavailable.
        secret,
        digits: totp.DIGITS,
        period: totp.PERIOD_SECONDS,
      }, req);
    }

    // Step 2: confirm the user's authenticator produces valid codes, then activate.
    if (req.method === 'POST' && url.pathname === '/api/auth/totp/activate') {
      const input = await body(req);
      if (typeof input.mfaToken !== 'string' || !hasFields(input, ['code'])) {
        return json(res, 400, { error: 'mfaToken and code are required' }, req);
      }
      const challenge = verifyToken(input.mfaToken);
      if (!challenge || challenge.purpose !== 'totp-mfa' ||
          typeof challenge.sub !== 'string' ||
          !['staff', 'admin'].includes(challenge.role)) {
        return json(res, 401, { error: 'Password verification has expired or is invalid. Sign in again.' }, req);
      }
      const result = await query('SELECT id, full_name, email, role, municipality, department, totp_secret, totp_enabled_at FROM app_users WHERE id = $1 AND is_active = true LIMIT 1', [challenge.sub]);
      const account = result.rows[0];
      if (!account || account.role !== challenge.role) return json(res, 403, { error: 'Account is not authorised for dashboard access' }, req);
      if (account.totp_enabled_at) return json(res, 409, { error: 'An authenticator is already active on this account.' }, req);
      if (!account.totp_secret) return json(res, 400, { error: 'Start enrollment before confirming a code.' }, req);

      const check = totp.verifyCode(account.totp_secret, input.code);
      if (!check.valid) return json(res, 401, { error: 'That code is not valid. Check your authenticator and try again.' }, req);

      const recoveryCodes = totp.generateRecoveryCodes();
      await query('UPDATE app_users SET totp_enabled_at = now(), totp_last_used_step = $1, updated_at = now() WHERE id = $2',
        [check.step, account.id]);
      for (const code of recoveryCodes) {
        await query('INSERT INTO auth_totp_recovery_codes (user_id, code_hash) VALUES ($1, $2)',
          [account.id, totp.hashRecoveryCode(code)]);
      }
      // Notify the owner out-of-band. Not a code - just a tamper signal.
      await sendMfaEnrollmentNotice({ to: account.email, fullName: account.full_name });

      const token = signToken({ sub: account.id, role: account.role, email: account.email, municipality: account.municipality, exp: Math.floor(Date.now() / 1000) + tokenTtlSeconds });
      await query('UPDATE app_users SET last_seen_at = now() WHERE id = $1', [account.id]);
      return json(res, 200, {
        token,
        expiresIn: tokenTtlSeconds,
        recoveryCodes,
        user: { id: account.id, fullName: account.full_name, email: account.email, role: account.role, municipality: account.municipality, department: account.department },
      }, req);
    }

    // Returning-user verification: exchange a password challenge + valid code
    // (or a single-use recovery code) for a dashboard session token.
    if (req.method === 'POST' && url.pathname === '/api/auth/totp/verify') {
      const input = await body(req);
      if (typeof input.mfaToken !== 'string' || !hasFields(input, ['code'])) {
        return json(res, 400, { error: 'mfaToken and code are required' }, req);
      }
      const challenge = verifyToken(input.mfaToken);
      if (!challenge || challenge.purpose !== 'totp-mfa' ||
          typeof challenge.sub !== 'string' ||
          !['staff', 'admin'].includes(challenge.role)) {
        return json(res, 401, { error: 'Password verification has expired or is invalid. Sign in again.' }, req);
      }
      const result = await query('SELECT id, full_name, email, role, municipality, department, totp_secret, totp_enabled_at, totp_last_used_step FROM app_users WHERE id = $1 AND is_active = true LIMIT 1', [challenge.sub]);
      const account = result.rows[0];
      if (!account || account.role !== challenge.role) return json(res, 403, { error: 'Account is not authorised for dashboard access' }, req);
      if (!account.totp_enabled_at || !account.totp_secret) {
        return json(res, 409, { error: 'No authenticator is enrolled on this account yet.' }, req);
      }

      const submitted = String(input.code).trim();
      const check = totp.verifyCode(account.totp_secret, submitted, account.totp_last_used_step);
      let usedRecoveryCode = false;
      if (!check.valid) {
        // Fall back to a single-use recovery code so a lost phone is recoverable.
        const recovery = await query(
          'SELECT id FROM auth_totp_recovery_codes WHERE user_id = $1 AND code_hash = $2 AND consumed_at IS NULL LIMIT 1',
          [account.id, totp.hashRecoveryCode(submitted)]
        );
        if (recovery.rows[0]) {
          await query('UPDATE auth_totp_recovery_codes SET consumed_at = now() WHERE id = $1', [recovery.rows[0].id]);
          usedRecoveryCode = true;
        } else {
          return json(res, 401, { error: 'That code is not valid. Check your authenticator and try again.' }, req);
        }
      }
      // Record the consumed step so the same 6-digit code cannot be replayed.
      if (!usedRecoveryCode) {
        await query('UPDATE app_users SET totp_last_used_step = $1 WHERE id = $2', [check.step, account.id]);
      }

      const token = signToken({ sub: account.id, role: account.role, email: account.email, municipality: account.municipality, exp: Math.floor(Date.now() / 1000) + tokenTtlSeconds });
      await query('UPDATE app_users SET last_seen_at = now() WHERE id = $1', [account.id]);
      return json(res, 200, {
        token,
        expiresIn: tokenTtlSeconds,
        usedRecoveryCode,
        user: { id: account.id, fullName: account.full_name, email: account.email, role: account.role, municipality: account.municipality, department: account.department },
      }, req);
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
      broadcast('report.created', { ...saved, has_photo: !!photoBytes });
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
      const result = await query("UPDATE service_reports SET status = $2::report_status, resolved_at = CASE WHEN $2::report_status IN ('resolved','closed') THEN now() ELSE NULL END WHERE id = $1 AND ($3 = 'admin' OR normalise_municipality(municipality) = normalise_municipality($4)) RETURNING *", [status[1], input.status, user.role, user.municipality || '']);
      if (!result.rows[0]) return json(res, 404, { error: 'Report not found' }, req);
      await query('INSERT INTO report_status_events (report_id, from_status, to_status, changed_by, note) VALUES ($1, $2, $3, $4, $5)', [status[1], previous.rows[0]?.status || null, input.status, user.sub, input.note || null]);
      broadcast('report.updated', result.rows[0]);
      return json(res, 200, result.rows[0], req);
    }

    return json(res, 404, { error: 'Not found' }, req);
  } catch (error) {
    if (!error.statusCode || error.statusCode >= 500) console.error(error);
    return json(res, error.statusCode || 500, { error: error.statusCode ? error.message : 'Request failed' }, req);
  }
});

// Bind to all interfaces so the Android emulator (10.0.2.2) and physical
// devices on the LAN can reach the API, not just localhost.
server.listen(port, '0.0.0.0', () => console.log(`MzansiConnect API listening on http://0.0.0.0:${port} (localhost, 10.0.2.2, and LAN IP all reachable)`));
