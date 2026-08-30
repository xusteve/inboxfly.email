// 认证：PBKDF2 口令哈希 + HMAC 会话令牌（InboxFly-Open.md §9）
const enc = new TextEncoder();

export function randomHex(bytes = 16) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return [...a].map(b => b.toString(16).padStart(2, '0')).join('');
}

const b64url = buf => {
  const s = String.fromCharCode(...new Uint8Array(buf));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

async function hmacKey(secret) {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}

export async function hashPassword(password) {
  const salt = randomHex(16);
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: 100000 },
    key, 256,
  );
  return `pbkdf2$100000$${salt}$${b64url(bits)}`;
}

export async function verifyPassword(password, stored) {
  try {
    const [, iter, salt, hash] = String(stored).split('$');
    if (iter !== '100000' || !salt || !hash) return false;
    const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: 100000 },
      key, 256,
    );
    return safeEqual(b64url(bits), hash);
  } catch {
    return false;
  }
}

export async function createSessionToken(username, secret, ttlSec = 7 * 86400) {
  const payload = b64url(enc.encode(JSON.stringify({ u: username, exp: Date.now() + ttlSec * 1000 })));
  const key = await hmacKey(secret);
  const sig = b64url(await crypto.subtle.sign('HMAC', key, enc.encode(payload)));
  return `${payload}.${sig}`;
}

export async function verifySessionToken(token, secret) {
  try {
    if (!token || !secret || !token.includes('.')) return null;
    const [payload, sig] = token.split('.');
    const key = await hmacKey(secret);
    const expect = b64url(await crypto.subtle.sign('HMAC', key, enc.encode(payload)));
    if (!safeEqual(sig, expect)) return null;
    const data = JSON.parse(new TextDecoder().decode(
      Uint8Array.from(atob(payload.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)),
    ));
    if (!data.u || !data.exp || Date.now() > data.exp) return null;
    return data;
  } catch {
    return null;
  }
}

export function safeEqual(a, b) {
  const A = enc.encode(String(a));
  const B = enc.encode(String(b));
  if (A.length !== B.length) return false;
  let diff = 0;
  for (let i = 0; i < A.length; i++) diff |= A[i] ^ B[i];
  return diff === 0;
}
