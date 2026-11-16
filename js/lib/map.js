/* Leaflet wrapper that renders only locally stored tiles. */

import { getTile } from '../store.js';

export function leafletAvailable() {
  return Boolean(window.L);
}

export function createOfflineLayer() {
  if (!leafletAvailable()) return null;
  const Offline = window.L.TileLayer.extend({
    createTile(coords, done) {
      const holder = document.createElement('div');
      holder.style.cssText =
        'width:256px;height:256px;display:grid;place-items:center;text-align:center;'
        + 'font-size:10px;color:#63727e;background:repeating-linear-gradient(45deg,#0e141b,#0e141b 8px,#121a22 8px,#121a22 16px);';
      holder.textContent = 'sem mapa';
      const key = `${coords.z}/${coords.x}/${coords.y}`;
      getTile(key).then((blob) => {
        const img = new Image();
        img.alt = '';
        img.width = 256;
        img.height = 256;
        img.style.display = 'block';
        if (blob) {
          const url = URL.createObjectURL(blob);
          img.addEventListener('load', () => { URL.revokeObjectURL(url); done(null, holder); });
          img.addEventListener('error', () => { URL.revokeObjectURL(url); done(null, holder); });
          img.src = url;
          holder.replaceChildren(img);
          return;
        }
        // Fallback: tiles pre-downloaded with tools/download-tiles.mjs and
        // cached by the service worker. Same-origin only, never a CDN.
        img.addEventListener('load', () => done(null, holder));
        img.addEventListener('error', () => {
          holder.textContent = 'sem mapa';
          done(null, holder);
        });
        img.src = `./data/tiles/${key}.png`;
        holder.replaceChildren(img);
      }).catch(() => done(null, holder));
      return holder;
    },
  });
  return new Offline({
    tileSize: 256,
    minZoom: 1,
    maxZoom: 18,
    attribution: 'Mapa &copy; colaboradores do OpenStreetMap',
  });
}

export function makeMap(element, { center = [-22.9068, -43.1729], zoom = 12 } = {}) {
  if (!leafletAvailable()) throw new Error('Biblioteca de mapa não carregada.');
  const map = window.L.map(element, {
    center,
    zoom,
    zoomControl: false,
    attributionControl: true,
    preferCanvas: true,
  });
  createOfflineLayer().addTo(map);
  window.L.control.zoom({ position: 'bottomleft' }).addTo(map);
  window.L.control.scale({ imperial: false, position: 'bottomright' }).addTo(map);
  if (map.attributionControl) {
    map.attributionControl.setPosition('topright');
    map.attributionControl.setPrefix('');
  }
  return map;
}

export function divIcon(html, className = '') {
  if (!leafletAvailable()) return null;
  return window.L.divIcon({ html, className, iconSize: [24, 24], iconAnchor: [12, 12] });
}

export function waypointIcon(glyph = '★', color = '#ffb340') {
  const html = `<div style="width:26px;height:26px;border-radius:50%;background:${color};color:#1a1206;`
    + `display:grid;place-items:center;font-size:14px;font-weight:700;border:2px solid #0a0e12;">${glyph}</div>`;
  return divIcon(html);
}
