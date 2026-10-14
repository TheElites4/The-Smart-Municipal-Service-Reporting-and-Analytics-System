const originalFetch = globalThis.fetch;
const mockBaseUrl = process.env.GMAIL_API_MOCK_URL;
if (!mockBaseUrl) throw new Error('GMAIL_API_MOCK_URL must point to the test-only Gmail API mock.');

globalThis.fetch = (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input.url);
  if (url.origin === 'https://oauth2.googleapis.com') {
    return originalFetch(new URL('/token', mockBaseUrl), init);
  }
  if (url.origin === 'https://gmail.googleapis.com') {
    return originalFetch(new URL(url.pathname, mockBaseUrl), init);
  }
  return originalFetch(input, init);
};
