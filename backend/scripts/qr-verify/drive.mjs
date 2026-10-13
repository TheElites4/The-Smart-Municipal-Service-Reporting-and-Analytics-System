// Drives the QR verification page with several realistic otpauth URIs and saves
// a screenshot of each, so decode.py can confirm the encoder round-trips them.
import { chromium } from 'patchright';
import { writeFileSync } from 'node:fs';

const base = 'http://127.0.0.1:8791/backend/scripts/qr-verify/index.html';
const cases = [
  ['short', 'otpauth://totp/MzansiConnect:admin@example.com?secret=JBSWY3DPEHPK3PXP&issuer=MzansiConnect&algorithm=SHA1&digits=6&period=30'],
  // A realistic enrolled secret (32-char base32) with a municipal email address.
  ['realistic', 'otpauth://totp/MzansiConnect:thabo.mokoena%40solplaatje.gov.za?secret=JBSWY3DPEHPK3PXPGEZDGNBVGY3TQOJQ&issuer=MzansiConnect&algorithm=SHA1&digits=6&period=30'],
  // A long, fully-qualified address to push the encoder into its multi-block path.
  ['long', 'otpauth://totp/MzansiConnect:nomsa.dlamini%40city-of-cape-town-metropolitan-municipality.gov.za?secret=JBSWY3DPEHPK3PXPGEZDGNBVGY3TQOJQGEZDGNBV&issuer=MzansiConnect&algorithm=SHA1&digits=6&period=30'],
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 400, height: 400 } });
const results = [];
for (const [name, uri] of cases) {
  await page.goto(`${base}?uri=${encodeURIComponent(uri)}`);
  await page.waitForSelector('canvas');
  const buffer = await page.locator('canvas').screenshot();
  const file = `backend/scripts/qr-verify/qr-${name}.png`;
  writeFileSync(file, buffer);
  results.push({ name, uriLength: uri.length, file });
}
await browser.close();
console.log(JSON.stringify(results, null, 2));