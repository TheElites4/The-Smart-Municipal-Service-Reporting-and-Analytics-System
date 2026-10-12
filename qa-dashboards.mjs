// QA: verify the live load-shedding banner renders on both dashboards after login.
export default async function run(page, ui) {
  const out = {};

  // ---- Staff dashboard ----
  await page.goto('http://localhost:8080/Staff%20Dashboard/index.html');
  await page.fill('#login-email', 'staff@example.gov.za');
  await page.fill('#login-password', 'ChangeMeStaff!2026');
  await page.click('button[type=submit]');
  await page.waitForSelector('#loadshedding-detail', { timeout: 10000 });
  // Wait for the banner text to move past its initial "Checking..." state.
  await page.waitForFunction(
    () => !document.getElementById('loadshedding-detail').textContent.includes('Checking'),
    { timeout: 10000 }
  ).catch(() => { });
  out.staff = {
    loggedIn: await page.evaluate(() => !document.getElementById('app-shell').hidden),
    banner: await page.evaluate(() => document.getElementById('loadshedding-detail').textContent),
    source: await page.evaluate(() => document.getElementById('loadshedding-source').textContent),
    metrics: await page.evaluate(() => document.getElementById('metrics').textContent.trim().slice(0, 120)),
  };

  // ---- Admin dashboard ----
  await page.goto('http://localhost:8080/Admin%20Dashboard/index.html');
  await page.fill('#login-email', 'admin@example.gov.za');
  await page.fill('#login-password', 'ChangeMeAdmin!2026');
  await page.click('button[type=submit]');
  await page.waitForSelector('#loadshedding-detail', { timeout: 10000 });
  await page.waitForFunction(
    () => !document.getElementById('loadshedding-detail').textContent.includes('Checking'),
    { timeout: 10000 }
  ).catch(() => { });
  out.admin = {
    loggedIn: await page.evaluate(() => !document.getElementById('app-shell').hidden),
    banner: await page.evaluate(() => document.getElementById('loadshedding-detail').textContent),
    source: await page.evaluate(() => document.getElementById('loadshedding-source').textContent),
  };

  return out;
}