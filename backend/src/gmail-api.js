const oauthTokenUrl = 'https://oauth2.googleapis.com/token';
const gmailSendUrl = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';
const gmailSendScope = 'https://www.googleapis.com/auth/gmail.send';
let cachedAccessToken;
let cachedAccessTokenExpiresAt = 0;

export class GmailApiError extends Error {
  constructor(message, upstreamStatus) {
    super(message);
    this.name = 'GmailApiError';
    this.statusCode = 503;
    this.upstreamStatus = upstreamStatus;
  }
}

export const getGmailSettings = (env = process.env) => {
  const user = env.GMAIL_USER;
  const clientId = env.GMAIL_CLIENT_ID;
  const clientSecret = env.GMAIL_CLIENT_SECRET;
  const refreshToken = env.GMAIL_REFRESH_TOKEN;
  if (!user || !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(user) ||
      !clientId || !clientSecret || !refreshToken) {
    throw Object.assign(new Error(
      'Email verification is not configured. Set GMAIL_USER, GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, and GMAIL_REFRESH_TOKEN in the API environment.'
    ), { statusCode: 503 });
  }
  return { user, clientId, clientSecret, refreshToken };
};

const responseJson = async (response, action) => {
  if (!response.ok) {
    throw new GmailApiError(`${action} failed with HTTP ${response.status}.`, response.status);
  }
  try {
    return await response.json();
  } catch {
    throw new GmailApiError(`${action} returned an invalid response.`, response.status);
  }
};

const getAccessToken = async (settings, fetchImpl) => {
  if (cachedAccessToken && cachedAccessTokenExpiresAt > Date.now() + 60_000) return cachedAccessToken;
  let response;
  try {
    response = await fetchImpl(oauthTokenUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: settings.clientId,
        client_secret: settings.clientSecret,
        refresh_token: settings.refreshToken,
        grant_type: 'refresh_token',
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new GmailApiError('Google OAuth token service could not be reached.');
  }
  const token = await responseJson(response, 'Google OAuth token request');
  if (typeof token.access_token !== 'string' || !token.access_token ||
      typeof token.expires_in !== 'number' || token.expires_in <= 0 ||
      (token.scope && !token.scope.split(/\s+/).includes(gmailSendScope))) {
    throw new GmailApiError('Google OAuth returned no usable Gmail send access token.');
  }
  cachedAccessToken = token.access_token;
  cachedAccessTokenExpiresAt = Date.now() + token.expires_in * 1000;
  return cachedAccessToken;
};

const makeRawMessage = ({ to, fullName, code }, from) => {
  if (!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(to)) {
    throw new GmailApiError('The account email address is not valid.');
  }
  const greeting = String(fullName || 'there').replace(/[\r\n]+/g, ' ').trim() || 'there';
  const text = [
    `Hello ${greeting},`,
    '',
    `Your MzansiConnect dashboard verification code is: ${code}`,
    'It expires in 5 minutes and can only be used once.',
    '',
    'If you did not try to sign in, you can ignore this email.',
  ].join('\n');
  const encodedBody = Buffer.from(text, 'utf8').toString('base64').match(/.{1,76}/g).join('\r\n');
  const message = [
    `From: MzansiConnect <${from}>`,
    `To: ${to}`,
    'Subject: Your MzansiConnect sign-in code',
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    encodedBody,
  ].join('\r\n');
  return Buffer.from(message, 'utf8').toString('base64url');
};

export const sendGmailLoginCode = async ({ to, fullName, code }, settings, fetchImpl = fetch) => {
  const accessToken = await getAccessToken(settings, fetchImpl);
  const raw = makeRawMessage({ to, fullName, code }, settings.user);
  let response;
  try {
    response = await fetchImpl(gmailSendUrl, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ raw }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new GmailApiError('Gmail API could not be reached.');
  }
  await responseJson(response, 'Gmail message send');
};
