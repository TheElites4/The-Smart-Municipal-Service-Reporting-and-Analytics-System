// Shared QA: log in and wait for the dashboard to fully render.
export default async function run(page, ui) {
  const email = process.env.QA_EMAIL;
  const password = process.env.QA_PASSWORD;
  const shellId = process.env.QA_SHELL_ID || 'app-shell';
  const waitId = process.env.QA_WAIT_ID || 'overview';

  await page.fill('#login-email', email);
  await page.fill('#login-password', password);
  await page.click('#login-form button[type=submit]');
  await page.waitForFunction((id) => {
    const shell = document.getElementById(id);
    return shell && !shell.hidden;
  }, shellId, { timeout: 15000 }).catch(() => { });
  await page.waitForFunction((id) => document.getElementById(id).children.length > 0, waitId, { timeout: 15000 }).catch(() => { });
  await page.waitForTimeout(600);

  return await page.evaluate((id) => ({
    shellHidden: document.getElementById(id).hidden,
    authError: document.getElementById('auth-error')?.textContent || '',
    health: document.getElementById('health')?.textContent || '',
    liveStatus: document.getElementById('live-status')?.textContent || '',
    bodyChars: document.body.innerText.length,
  }), shellId);
}
