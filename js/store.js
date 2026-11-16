/* IndexedDB storage, settings, PIN vault and offline tile cache. */

import { deriveKey, randomSalt, makeVerifier, checkVerifier, encryptJSON, decryptJSON } from './lib/crypto.js';

const DB_NAME = 'farol';
const DB_VERSION = 1;

export const STORES = {
  kv: 'kv',
  waypoints: 'waypoints',
  trails: 'trails',
  notes: 'notes',
  checklists: 'checklists',
  resources: 'resources',
  contacts: 'contacts',
  logs: 'logs',
  comms: 'comms',
  tiles: 'tiles',
};

export const DEFAULT_SETTINGS = {
  theme: 'dark',
  font: 'normal',
  reduceMotion: false,
  tts: true,
  declination: 0,
  pinEnabled: false,
  activeTrail: null,
  lastRegion: null,
  showBreadcrumbs: true,
  onboarded: false,
  metronomeBpm: 110,
};

let dbPromise = null;
let settingsCache = null;

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const [name] of Object.entries(STORES)) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: name === 'kv' || name === 'tiles' ? 'key' : 'id' });
        }
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Banco de dados bloqueado por outra aba.'));
  });
  return dbPromise;
}

async function tx(storeName, mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    let result;
    try {
      result = fn(store);
    } catch (error) {
      reject(error);
      return;
    }
    transaction.oncomplete = () => resolve(result instanceof IDBRequest ? result.result : result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export async function getAll(storeName) {
  const db = await openDb();
  const transaction = db.transaction(storeName, 'readonly');
  const request = transaction.objectStore(storeName).getAll();
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function getOne(storeName, key) {
  const db = await openDb();
  const transaction = db.transaction(storeName, 'readonly');
  const request = transaction.objectStore(storeName).get(key);
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function putOne(storeName, value) {
  return tx(storeName, 'readwrite', (store) => store.put(value));
}

export function deleteOne(storeName, key) {
  return tx(storeName, 'readwrite', (store) => store.delete(key));
}

export async function clearStore(storeName) {
  return tx(storeName, 'readwrite', (store) => store.clear());
}

export function uid(prefix = 'id') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/* ---------- key/value ---------- */
export async function kvGet(key, fallback = null) {
  try {
    const row = await getOne('kv', key);
    return row ? row.value : fallback;
  } catch {
    return fallback;
  }
}

export function kvSet(key, value) {
  return putOne('kv', { key, value });
}

/* ---------- settings ---------- */
export async function getSettings() {
  if (settingsCache) return settingsCache;
  const stored = await kvGet('settings', {});
  settingsCache = { ...DEFAULT_SETTINGS, ...(stored || {}) };
  return settingsCache;
}

export async function saveSettings(patch) {
  const current = await getSettings();
  settingsCache = { ...current, ...patch };
  await kvSet('settings', settingsCache);
  window.dispatchEvent(new CustomEvent('farol:settings', { detail: settingsCache }));
  return settingsCache;
}

/* ---------- storage persistence ---------- */
export async function requestPersistence() {
  try {
    if (!navigator.storage?.persist) {
      return { supported: false, persisted: false };
    }
    const persisted = await navigator.storage.persisted();
    if (persisted) return { supported: true, persisted: true };
    const granted = await navigator.storage.persist();
    return { supported: true, persisted: granted };
  } catch {
    return { supported: false, persisted: false };
  }
}

export async function storageInfo() {
  const info = { supported: Boolean(navigator.storage?.estimate), usage: 0, quota: 0, persisted: false };
  try {
    if (navigator.storage?.estimate) {
      const est = await navigator.storage.estimate();
      info.usage = est.usage || 0;
      info.quota = est.quota || 0;
    }
    info.persisted = Boolean(await navigator.storage?.persisted?.());
  } catch { /* ignore */ }
  return info;
}

/* ---------- offline tiles ---------- */
export async function putTile(key, blob) {
  return putOne('tiles', { key, blob, at: Date.now() });
}

export async function getTile(key) {
  try {
    const row = await getOne('tiles', key);
    return row?.blob || null;
  } catch {
    return null;
  }
}

/* ---------- PIN vault (contacts + notes encrypted at rest) ---------- */

const VAULT_STORES = ['contacts', 'notes'];
let vaultKey = null;

export async function getPinRecord() {
  return kvGet('pin', null);
}

export function vaultUnlocked() {
  return Boolean(vaultKey);
}

export function lockVault() {
  vaultKey = null;
}

export async function setPin(pin) {
  const salt = randomSalt();
  const key = await deriveKey(pin, salt);
  const verifier = await makeVerifier(key);
  for (const name of VAULT_STORES) {
    const rows = await getAll(name);
    for (const row of rows) {
      if (row.enc) continue;
      const { id, ...rest } = row;
      await putOne(name, { id, enc: await encryptJSON(key, rest) });
    }
  }
  await kvSet('pin', { salt, verifier, iterations: 210000, createdAt: Date.now() });
  await saveSettings({ pinEnabled: true });
  vaultKey = key;
  return true;
}

export async function unlockWithPin(pin) {
  const record = await getPinRecord();
  if (!record) return true;
  try {
    const key = await deriveKey(pin, record.salt);
    if (!(await checkVerifier(key, record.verifier))) return false;
    vaultKey = key;
    return true;
  } catch {
    return false;
  }
}

export async function removePin(pin) {
  if (!(await unlockWithPin(pin))) return false;
  for (const name of VAULT_STORES) {
    const rows = await getAll(name);
    for (const row of rows) {
      if (!row.enc) continue;
      try {
        const value = await decryptJSON(vaultKey, row.enc);
        await putOne(name, { id: row.id, ...value });
      } catch { /* leave unreadable rows untouched */ }
    }
  }
  await kvSet('pin', null);
  await saveSettings({ pinEnabled: false });
  vaultKey = null;
  return true;
}

export async function secureList(storeName) {
  const rows = await getAll(storeName);
  const list = [];
  for (const row of rows) {
    if (!row.enc) {
      list.push(row);
      continue;
    }
    if (!vaultKey) continue;
    try {
      list.push({ id: row.id, ...(await decryptJSON(vaultKey, row.enc)) });
    } catch { /* skip unreadable record */ }
  }
  return list;
}

export async function securePut(storeName, value) {
  if (!vaultKey) return putOne(storeName, value);
  const { id, ...rest } = value;
  return putOne(storeName, { id, enc: await encryptJSON(vaultKey, rest) });
}
