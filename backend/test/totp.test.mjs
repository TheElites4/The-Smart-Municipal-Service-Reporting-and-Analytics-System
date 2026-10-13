import assert from 'node:assert/strict';
import test from 'node:test';
import { totp } from '../src/totp.js';

// RFC 6238 Appendix B uses the ASCII secret "12345678901234567890", which in
// base32 is GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ.
const RFC_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

test('generates RFC 6238 test-vector codes', () => {
  // The published vectors use 8 digits; our service uses 6. The low-order 6
  // digits of each published value must therefore match.
  const vectors = [
    [59, '287082'],
    [1111111109, '081804'],
    [1111111111, '050471'],
    [1234567890, '005924'],
    [2000000000, '279037'],
  ];
  for (const [seconds, expected] of vectors) {
    const step = Math.floor(seconds / 30);
    assert.equal(totp.generateCode(RFC_SECRET, step), expected,
      `TOTP at t=${seconds} should be ${expected}`);
  }
});

test('encrypts and decrypts a secret without storing plaintext', () => {
  const secret = totp.generateSecret();
  const payload = totp.encryptSecret(secret);
  assert.notEqual(payload, secret);
  assert.ok(!payload.includes(secret), 'ciphertext must not embed the secret');
  assert.equal(totp.decryptSecret(payload), secret);
});

test('verifies a freshly generated code and rejects a wrong one', () => {
  const secret = totp.generateSecret();
  const encrypted = totp.encryptSecret(secret);
  const code = totp.generateCode(secret);
  assert.equal(totp.verifyCode(encrypted, code).valid, true);
  assert.equal(totp.verifyCode(encrypted, '000000').valid, false);
  assert.equal(totp.verifyCode(encrypted, 'not-a-code').valid, false);
});

test('rejects replay of an already-consumed time step', () => {
  const secret = totp.generateSecret();
  const encrypted = totp.encryptSecret(secret);
  const code = totp.generateCode(secret);
  const first = totp.verifyCode(encrypted, code);
  assert.equal(first.valid, true);
  const replay = totp.verifyCode(encrypted, code, first.step);
  assert.equal(replay.valid, false, 'the same code must not verify twice');
});

test('accepts one step of clock drift in either direction', () => {
  const secret = totp.generateSecret();
  const encrypted = totp.encryptSecret(secret);
  const step = totp.currentStep();
  assert.equal(totp.verifyCode(encrypted, totp.generateCode(secret, step - 1)).valid, true);
  assert.equal(totp.verifyCode(encrypted, totp.generateCode(secret, step + 1)).valid, true);
  assert.equal(totp.verifyCode(encrypted, totp.generateCode(secret, step + 5)).valid, false);
});

test('builds an otpauth URI Google Authenticator can parse', () => {
  const secret = totp.generateSecret();
  const uri = totp.buildProvisioningUri({ secret, accountName: 'admin@example.com' });
  assert.ok(uri.startsWith('otpauth://totp/'));
  const parsed = new URL(uri);
  assert.equal(parsed.searchParams.get('secret'), secret);
  assert.equal(parsed.searchParams.get('issuer'), 'MzansiConnect');
  assert.equal(parsed.searchParams.get('digits'), '6');
  assert.equal(parsed.searchParams.get('period'), '30');
});

test('recovery codes are unique, well-formed, and hashed consistently', () => {
  const codes = totp.generateRecoveryCodes();
  assert.equal(codes.length, 10);
  assert.equal(new Set(codes).size, 10, 'codes must be unique');
  for (const code of codes) assert.match(code, /^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  assert.equal(totp.hashRecoveryCode('abcd-efgh'), totp.hashRecoveryCode('ABCD-EFGH'));
  assert.notEqual(totp.hashRecoveryCode('abcd-efgh'), totp.hashRecoveryCode('abcd-efgi'));
});