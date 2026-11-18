import { createPublicKey, verify } from 'node:crypto';

// Verify Google ID tokens using Google's public JWKS, not untrusted decoded claims.
const JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
let cachedKeys = null;
let keysExpireAt = 0;
async function googleKeys() {
  if (cachedKeys && Date.now() < keysExpireAt) return cachedKeys;
  const response = await fetch(JWKS_URL, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error('Google signing keys unavailable.');
  const payload = await response.json();
  if (!Array.isArray(payload.keys)) throw new Error('Invalid Google signing keys.');
  const cacheControl = response.headers.get('cache-control') || '';
  const maxAge = Math.min(Number(cacheControl.match(/max-age=(\d+)/)?.[1] || 300), 3600);
  cachedKeys = payload.keys;
  keysExpireAt = Date.now() + maxAge * 1000;
  return cachedKeys;
}
const decode = (value) => JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
export async function verifyGoogleIdToken(token, clientId) {
  if (!clientId || typeof token !== 'string' || token.length > 8192) throw new Error('Google login unavailable.');
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid Google credential.');
  let header, claims;
  try { header = decode(parts[0]); claims = decode(parts[1]); }
  catch { throw new Error('Invalid Google credential.'); }
  if (header.alg !== 'RS256' || typeof header.kid !== 'string') throw new Error('Invalid Google credential.');
  const keys = await googleKeys();
  const jwk = keys.find((key) => key.kid === header.kid && key.kty === 'RSA' && key.use === 'sig');
  if (!jwk) throw new Error('Unrecognized Google signing key.');
  let valid = false;
  try {
    valid = verify('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`), createPublicKey({ key: jwk, format: 'jwk' }), Buffer.from(parts[2], 'base64url'));
  } catch { /* invalid signature */ }
  const now = Math.floor(Date.now() / 1000);
  if (!valid || !['accounts.google.com', 'https://accounts.google.com'].includes(claims.iss) ||
      claims.aud !== clientId || typeof claims.sub !== 'string' || !/^\d{5,32}$/.test(claims.sub) ||
      typeof claims.exp !== 'number' || claims.exp <= now ||
      typeof claims.iat !== 'number' || claims.iat > now + 60 ||
      claims.email_verified !== true || typeof claims.email !== 'string' || !claims.email.includes('@')) {
    throw new Error('Invalid or expired Google credential.');
  }
  if (typeof claims.nonce !== 'string' || claims.nonce.length < 32 || claims.nonce.length > 200)
    throw new Error('Google credential is missing a valid one-time nonce.');
  return { sub: claims.sub, email: claims.email.toLowerCase(), name: String(claims.name || claims.email.split('@')[0]).slice(0, 100), nonce: claims.nonce };
}
