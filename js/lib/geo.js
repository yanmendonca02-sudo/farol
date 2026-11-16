/* Geographic helpers: DMS, distance, bearing. */

const R = 6371008.8; // mean Earth radius in metres

export function toRad(deg) { return (deg * Math.PI) / 180; }
export function toDeg(rad) { return (rad * 180) / Math.PI; }

export function toDMS(value, isLat) {
  if (!Number.isFinite(value)) return '—';
  const hemisphere = isLat ? (value >= 0 ? 'N' : 'S') : (value >= 0 ? 'E' : 'W');
  const abs = Math.abs(value);
  const degrees = Math.floor(abs);
  const minutesFloat = (abs - degrees) * 60;
  const minutes = Math.floor(minutesFloat);
  const seconds = (minutesFloat - minutes) * 60;
  return `${degrees}° ${String(minutes).padStart(2, '0')}′ ${seconds.toFixed(1).replace('.', ',')}″ ${hemisphere}`;
}

export function fmtCoord(value, isLat) {
  if (!Number.isFinite(value)) return '—';
  return `${value.toFixed(6)} (${toDMS(value, isLat)})`;
}

export function haversine(a, b) {
  if (!a || !b) return NaN;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function bearing(a, b) {
  if (!a || !b) return NaN;
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLon = toRad(b.lon - a.lon);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

const POINTS = ['N', 'NNE', 'NE', 'LNE', 'L', 'LSE', 'SE', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO'];

export function compassPoint(deg) {
  if (!Number.isFinite(deg)) return '—';
  return POINTS[Math.round(((deg % 360) / 22.5)) % 16];
}

export function declinationHint() {
  return 'A bússola do celular aponta para o norte magnético. A diferença para o norte verdadeiro (declinação) varia de cerca de −20° a +5° no Brasil. Ajuste o valor em Ajustes se souber o da sua região; sem isso, use o norte magnético.';
}
