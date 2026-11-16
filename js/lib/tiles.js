/* Offline raster tile downloader and storage helpers.
 * Tiles are fetched only when the user presses "Baixar", then stored as blobs
 * in IndexedDB. Nothing is requested at runtime while using the map. */

import { putTile, getTile, deleteOne, getOne, kvGet, kvSet } from '../store.js';
import { TILE_URL, BYTES_PER_TILE } from '../data/regions.js';

const REGIONS_KEY = 'map-regions';
const CONCURRENCY = 4;

export function lonToTileX(lon, z) {
  return Math.floor(((lon + 180) / 360) * 2 ** z);
}

export function latToTileY(lat, z) {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** z);
}

export function tileKey(z, x, y) {
  return `${z}/${x}/${y}`;
}

export function tileUrl(z, x, y) {
  return TILE_URL.replace('{z}', z).replace('{x}', x).replace('{y}', y);
}

export function tilesForBox(bbox, [zMin, zMax]) {
  const [west, south, east, north] = bbox;
  const keys = [];
  let byZoom = 0;
  for (let z = zMin; z <= zMax; z += 1) {
    const xMin = lonToTileX(west, z);
    const xMax = lonToTileX(east, z);
    const yMin = latToTileY(north, z);
    const yMax = latToTileY(south, z);
    for (let x = Math.min(xMin, xMax); x <= Math.max(xMin, xMax); x += 1) {
      for (let y = Math.min(yMin, yMax); y <= Math.max(yMin, yMax); y += 1) {
        keys.push(tileKey(z, x, y));
        byZoom += 1;
      }
    }
  }
  return { keys, count: byZoom };
}

export function estimateSize(count) {
  return count * BYTES_PER_TILE;
}

async function listRegions() {
  return (await kvGet(REGIONS_KEY, [])) || [];
}

async function saveRegions(regions) {
  return kvSet(REGIONS_KEY, regions);
}

export async function getRegions() {
  return listRegions();
}

export function parseTileKey(key) {
  const [z, x, y] = key.split('/').map(Number);
  return { z, x, y };
}

async function fetchTile(key, signal) {
  const { z, x, y } = parseTileKey(key);
  const existing = await getTile(key);
  if (existing) return { key, skipped: true, bytes: existing.size || 0 };
  const response = await fetch(tileUrl(z, x, y), { signal, mode: 'cors', cache: 'no-store' });
  if (!response.ok) throw new Error(`Servidor de mapa respondeu ${response.status}.`);
  const blob = await response.blob();
  if (!blob.type.startsWith('image/')) throw new Error('Resposta não é uma imagem de mapa.');
  await putTile(key, blob);
  return { key, skipped: false, bytes: blob.size };
}

export async function downloadArea({ id, name, bbox, zooms, signal, onProgress, warmup = true }) {
  if (warmup) {
    // One polite request first: if there is no connection the whole download stops early.
    const probe = await fetch(tileUrl(zooms[0], lonToTileX(bbox[0], zooms[0]), latToTileY(bbox[3], zooms[0])), { mode: 'cors', cache: 'no-store' });
    if (!probe.ok) throw new Error('Não foi possível acessar o servidor de mapas. Verifique a internet antes do apagão.');
  }

  const { keys } = tilesForBox(bbox, zooms);
  const meta = {
    id,
    name,
    bbox,
    zooms,
    planned: keys.length,
    done: 0,
    skipped: 0,
    failed: 0,
    bytes: 0,
    completed: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  let cursor = 0;
  const run = async () => {
    while (cursor < keys.length) {
      if (signal?.aborted) throw new DOMException('Download cancelado.', 'AbortError');
      const key = keys[cursor];
      cursor += 1;
      try {
        const result = await fetchTile(key, signal);
        if (result.skipped) meta.skipped += 1;
        else meta.bytes += result.bytes;
        meta.done += 1;
      } catch (error) {
        if (error?.name === 'AbortError') throw error;
        meta.failed += 1;
        meta.done += 1;
      }
      onProgress?.({ ...meta, total: keys.length });
      if (meta.done % 40 === 0) {
        meta.updatedAt = Date.now();
        await putMeta(meta);
      }
    }
  };

  await putMeta(meta);
  try {
    await Promise.all(Array.from({ length: CONCURRENCY }, run));
  } finally {
    meta.completed = meta.failed === 0 && meta.done >= keys.length;
    meta.updatedAt = Date.now();
    await putMeta(meta);
  }
  return meta;
}

async function putMeta(meta) {
  const regions = await listRegions();
  const index = regions.findIndex((item) => item.id === meta.id);
  if (index >= 0) regions[index] = meta;
  else regions.push(meta);
  await saveRegions(regions);
}

export async function deleteRegion(id) {
  const regions = await listRegions();
  const region = regions.find((item) => item.id === id);
  if (!region) return 0;
  const { keys } = tilesForBox(region.bbox, region.zooms);
  for (const key of keys) {
    try { await deleteOne('tiles', key); } catch { /* ignore */ }
  }
  await saveRegions(regions.filter((item) => item.id !== id));
  return keys.length;
}

export async function countDownloadedTiles() {
  try {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('farol');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction('tiles', 'readonly');
      const count = transaction.objectStore('tiles').count();
      count.onsuccess = () => resolve(count.result);
      count.onerror = () => reject(count.error);
    });
  } catch {
    return 0;
  }
}

export { getOne };
