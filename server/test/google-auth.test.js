import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { verifyGoogleIdToken } from '../src/google-auth.js';

const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'local-test-key', use: 'sig' };
const clientId = 'test-client-id.apps.googleusercontent.com';
const now = Math.floor(Date.now() / 1000);
function makeToken(overrides = {}) {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: jwk.kid })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ iss: 'https://accounts.google.com', aud: clientId, sub: '12345678901234567890', email: 'demo@example.com', email_verified: true, nonce: 'one-time-google-nonce-value-123456789', iat: now - 30, exp: now + 300, ...overrides })).toString('base64url');
  const message = `${header}.${payload}`;
  return `${message}.${sign('RSA-SHA256', Buffer.from(message), privateKey).toString('base64url')}`;
}
test('Google token verification validates signature, audience, issuer and expiry', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ keys: [jwk] }), headers: new Headers({ 'cache-control': 'max-age=300' }) });
  try {
    const identity = await verifyGoogleIdToken(makeToken(), clientId);
    assert.equal(identity.email, 'demo@example.com');
    assert.equal(identity.nonce, 'one-time-google-nonce-value-123456789');
    await assert.rejects(verifyGoogleIdToken(makeToken({ aud: 'other-client' }), clientId));
    await assert.rejects(verifyGoogleIdToken(makeToken({ exp: now - 1 }), clientId));
    await assert.rejects(verifyGoogleIdToken(makeToken({ email_verified: false }), clientId));
    await assert.rejects(verifyGoogleIdToken(makeToken({ nonce: undefined }), clientId));
    await assert.rejects(verifyGoogleIdToken(makeToken({ iss: 'https://attacker.example' }), clientId));
    const token = makeToken();
    await assert.rejects(verifyGoogleIdToken(token.slice(0, -3) + 'abc', clientId));
  } finally { globalThis.fetch = originalFetch; }
});
