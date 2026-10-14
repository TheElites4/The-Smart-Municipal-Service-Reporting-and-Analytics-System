(() => {
  const script = document.currentScript;
  const api = script?.dataset.api;
  const role = script?.dataset.role;
  if (!api || !['admin', 'staff'].includes(role)) {
    throw new Error('Dashboard password reset is missing its API or dashboard role.');
  }
  const homeUrl = window.MZANSI_HOME_URL ||
    (['localhost', '127.0.0.1'].includes(location.hostname)
      ? 'http://localhost:5173/'
      : `${location.origin}/`);
  const returnHome = () => location.assign(homeUrl);

  const authScreen = document.getElementById('auth-screen');
  const loginForm = document.getElementById('login-form');
  if (!authScreen || !loginForm) throw new Error('Dashboard sign-in form is unavailable.');

  const resetScreen = document.createElement('section');
  resetScreen.className = 'auth-screen';
  resetScreen.id = 'password-reset-screen';
  resetScreen.hidden = true;
  resetScreen.innerHTML = `
    <div class="auth-card">
      <img class="brand-mark" src="../Citizen%20Portal%20Mobile%20App/src/imports/WhatsApp_Image_2026-05-11_at_23.03.44.jpeg" alt="MzansiReport">
      <span class="eyebrow">MZANSICONNECT / PASSWORD RECOVERY</span>
      <h1>Reset your password</h1>
      <p>We’ll email a one-time verification code to your ${role} account.</p>
      <form id="password-reset-request">
        <label>Email<input name="email" type="email" autocomplete="username" required></label>
        <button type="submit">Send verification code</button>
        <p class="auth-error" id="password-reset-request-error" role="alert"></p>
      </form>
      <form id="password-reset-confirm" hidden>
        <input name="email" type="hidden">
        <label>6-digit email code<input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required></label>
        <label>New password<input name="password" type="password" autocomplete="new-password" minlength="12" required></label>
        <label>Confirm new password<input name="confirmPassword" type="password" autocomplete="new-password" minlength="12" required></label>
        <button type="submit">Verify code and reset password</button>
        <p class="auth-error" id="password-reset-confirm-error" role="alert"></p>
        <p class="mfa-hint password-reset-message" id="password-reset-status" role="status" aria-live="polite"></p>
      </form>
      <p class="mfa-hint"><button type="button" id="password-reset-back" class="link-button">Back to sign in</button></p>
    </div>`;
  authScreen.after(resetScreen);

  const requestForm = resetScreen.querySelector('#password-reset-request');
  const confirmForm = resetScreen.querySelector('#password-reset-confirm');
  const requestError = resetScreen.querySelector('#password-reset-request-error');
  const confirmError = resetScreen.querySelector('#password-reset-confirm-error');
  const status = resetScreen.querySelector('#password-reset-status');
  const backButton = resetScreen.querySelector('#password-reset-back');
  const forgotButton = document.createElement('button');
  forgotButton.type = 'button';
  forgotButton.className = 'link-button';
  forgotButton.textContent = 'Forgot password?';
  const forgotHint = document.createElement('p');
  forgotHint.className = 'mfa-hint';
  forgotHint.append(forgotButton);
  loginForm.append(forgotHint);
  const homeHint = document.createElement('p');
  homeHint.className = 'mfa-hint';
  const homeButton = document.createElement('button');
  homeButton.type = 'button';
  homeButton.className = 'link-button';
  homeButton.textContent = 'Back to homepage';
  homeButton.addEventListener('click', returnHome);
  homeHint.append(homeButton);
  loginForm.append(homeHint);

  const dashboardHeader = document.querySelector('#app-shell header');
  if (dashboardHeader) {
    const logoutButton = document.createElement('button');
    logoutButton.type = 'button';
    logoutButton.className = 'dashboard-logout';
    logoutButton.textContent = 'Log out';
    logoutButton.addEventListener('click', () => {
      localStorage.removeItem(role === 'admin' ? 'mzansiAdminToken' : 'mzansiStaffToken');
      returnHome();
    });
    dashboardHeader.append(logoutButton);
  }

  const showLogin = () => {
    resetScreen.hidden = true;
    authScreen.hidden = false;
    loginForm.hidden = false;
    requestForm.hidden = false;
    confirmForm.hidden = true;
    requestForm.reset();
    confirmForm.reset();
    requestError.textContent = '';
    confirmError.textContent = '';
    status.textContent = '';
    backButton.textContent = 'Back to sign in';
  };

  forgotButton.addEventListener('click', () => {
    authScreen.hidden = true;
    resetScreen.hidden = false;
    requestForm.hidden = false;
    confirmForm.hidden = true;
    requestError.textContent = '';
    status.textContent = '';
    requestForm.elements.email.value = document.getElementById('login-email').value;
    requestForm.elements.email.focus();
  });
  backButton.addEventListener('click', showLogin);

  requestForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = requestForm.querySelector('button[type="submit"]');
    requestError.textContent = '';
    button.disabled = true;
    try {
      const response = await fetch(`${api}/api/auth/password/reset/request`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: requestForm.elements.email.value.trim() }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `Could not request a code (HTTP ${response.status}).`);
      confirmForm.elements.email.value = requestForm.elements.email.value.trim();
      confirmForm.elements.code.value = '';
      requestForm.hidden = true;
      confirmForm.hidden = false;
      status.textContent = result.message;
      confirmForm.elements.code.focus();
    } catch (error) {
      requestError.textContent = error instanceof Error ? error.message : 'Could not request a password reset code.';
    } finally {
      button.disabled = false;
    }
  });

  confirmForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = confirmForm.querySelector('button[type="submit"]');
    confirmError.textContent = '';
    status.textContent = '';
    if (confirmForm.elements.password.value !== confirmForm.elements.confirmPassword.value) {
      confirmError.textContent = 'The new password and confirmation do not match.';
      confirmForm.elements.confirmPassword.focus();
      return;
    }
    button.disabled = true;
    try {
      const response = await fetch(`${api}/api/auth/password/reset/confirm`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: confirmForm.elements.email.value,
          code: confirmForm.elements.code.value.trim(),
          password: confirmForm.elements.password.value,
          confirmPassword: confirmForm.elements.confirmPassword.value,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `Could not reset the password (HTTP ${response.status}).`);
      const email = confirmForm.elements.email.value;
      showLogin();
      document.getElementById('login-email').value = email;
      document.getElementById('login-password').value = '';
      document.getElementById('auth-error').textContent = 'Your password has been reset. Sign in with your new password.';
      document.getElementById('login-password').focus();
    } catch (error) {
      confirmError.textContent = error instanceof Error ? error.message : 'Could not reset the password.';
    } finally {
      button.disabled = false;
    }
  });
})();
