/* Offline sun and moon calculations (NOAA solar equations, mean lunar cycle).
 * Accuracy is about a minute for sunrise/sunset at mid latitudes. */

const RAD = Math.PI / 180;

function dayOfYear(date) {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  return Math.floor((date.getTime() - start) / 86400000);
}

export function sunTimes(date, lat, lon) {
  const n = dayOfYear(date);
  const gamma = ((2 * Math.PI) / 365) * (n - 1 + (12 - 12) / 24);
  const eqTime = 229.18 * (0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma)
    - 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma));
  const decl = 0.006918 - 0.399912 * Math.cos(gamma) + 0.070257 * Math.sin(gamma)
    - 0.006758 * Math.cos(2 * gamma) + 0.000907 * Math.sin(2 * gamma)
    - 0.002697 * Math.cos(3 * gamma) + 0.00148 * Math.sin(3 * gamma);

  const latRad = lat * RAD;
  const cosHa = Math.cos(90.833 * RAD) / (Math.cos(latRad) * Math.cos(decl)) - Math.tan(latRad) * Math.tan(decl);
  const solarNoonUtcMinutes = 720 - 4 * lon - eqTime;
  const base = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());

  if (cosHa > 1) return { polar: 'night', solarNoon: new Date(base + solarNoonUtcMinutes * 60000) };
  if (cosHa < -1) return { polar: 'day', solarNoon: new Date(base + solarNoonUtcMinutes * 60000) };

  const haDeg = Math.acos(cosHa) / RAD;
  const sunrise = new Date(base + (solarNoonUtcMinutes - haDeg * 4) * 60000);
  const sunset = new Date(base + (solarNoonUtcMinutes + haDeg * 4) * 60000);
  const solarNoon = new Date(base + solarNoonUtcMinutes * 60000);
  return {
    polar: null,
    sunrise,
    sunset,
    solarNoon,
    dayLength: (sunset - sunrise) / 1000,
  };
}

const SYNODIC = 29.530588853;
const KNOWN_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14);

export function moonInfo(date) {
  const days = (date.getTime() - KNOWN_NEW_MOON) / 86400000;
  let phase = (days % SYNODIC) / SYNODIC;
  if (phase < 0) phase += 1;
  const illumination = (1 - Math.cos(2 * Math.PI * phase)) / 2;

  let name;
  if (phase < 0.03 || phase > 0.97) name = 'Lua nova';
  else if (phase < 0.22) name = 'Lua crescente';
  else if (phase < 0.28) name = 'Quarto crescente';
  else if (phase < 0.47) name = 'Gibosa crescente';
  else if (phase < 0.53) name = 'Lua cheia';
  else if (phase < 0.72) name = 'Gibosa minguante';
  else if (phase < 0.78) name = 'Quarto minguante';
  else name = 'Lua minguante';

  return { phase, illumination, name };
}

export function fmtClock(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '—';
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function fmtDayLength(seconds) {
  if (!Number.isFinite(seconds)) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return `${h}h ${String(m).padStart(2, '0')}min`;
}
