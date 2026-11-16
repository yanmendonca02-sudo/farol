/* Web Crypto helpers for the optional PIN vault (AES-GCM + PBKDF2). */

const ITERATIONS = 210000;
const enc = new TextEncoder();
const dec = new TextDecoder();

function toB64(bytes) {
  let bin = '';
  const arr = new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i += 1) bin += String.fromCharCode(arr[i]);
  return btoa(bin);
}

function fromB64(text) {
  const bin = atob(text);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

export function randomBytes(length = 16) {
  return crypto.getRandomValues(new Uint8Array(length));
}

export function randomSalt() {
  return toB64(randomBytes(16));
}

export async function deriveKey(pin, saltB64) {
  if (!crypto.subtle) throw new Error('Web Crypto indisponível neste navegador.');
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: fromB64(saltB64), iterations: ITERATIONS, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptJSON(key, value) {
  const iv = randomBytes(12);
  const data = enc.encode(JSON.stringify(value));
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
  return { v: 1, iv: toB64(iv), data: toB64(cipher) };
}

export async function decryptJSON(key, payload) {
  const iv = fromB64(payload.iv);
  const data = fromB64(payload.data);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
  return JSON.parse(dec.decode(plain));
}

export async function makeVerifier(key) {
  return encryptJSON(key, { ok: 'farol', at: Date.now() });
}

export async function checkVerifier(key, payload) {
  try {
    const value = await decryptJSON(key, payload);
    return value?.ok === 'farol';
  } catch {
    return false;
  }
}

export { ITERATIONS };
