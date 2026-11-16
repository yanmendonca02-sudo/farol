/* GPX 1.1 export and import (waypoints + tracks), no dependencies. */

function esc(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function buildGPX(waypoints = [], trails = []) {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<gpx version="1.1" creator="Farol offline" xmlns="http://www.topografix.com/GPX/1/1">',
  ];
  for (const point of waypoints) {
    if (!Number.isFinite(point.lat) || !Number.isFinite(point.lon)) continue;
    lines.push(`  <wpt lat="${point.lat}" lon="${point.lon}">`);
    lines.push(`    <name>${esc(point.name || 'Ponto')}</name>`);
    if (point.type) lines.push(`    <type>${esc(point.type)}</type>`);
    if (point.note) lines.push(`    <desc>${esc(point.note)}</desc>`);
    if (point.createdAt) lines.push(`    <time>${new Date(point.createdAt).toISOString()}</time>`);
    lines.push('  </wpt>');
  }
  for (const trail of trails) {
    lines.push(`  <trk><name>${esc(trail.name || 'Trilha')}</name><trkseg>`);
    for (const point of trail.points || []) {
      if (!Number.isFinite(point.lat) || !Number.isFinite(point.lon)) continue;
      lines.push(`    <trkpt lat="${point.lat}" lon="${point.lon}">`);
      if (point.at) lines.push(`      <time>${new Date(point.at).toISOString()}</time>`);
      if (Number.isFinite(point.alt)) lines.push(`      <ele>${point.alt.toFixed(1)}</ele>`);
      lines.push('    </trkpt>');
    }
    lines.push('  </trkseg></trk>');
  }
  lines.push('</gpx>');
  return lines.join('\n');
}

export function parseGPX(text) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('Arquivo GPX inválido.');

  const waypoints = [];
  doc.querySelectorAll('wpt').forEach((node) => {
    waypoints.push({
      name: node.querySelector('name')?.textContent?.trim() || 'Ponto importado',
      type: node.querySelector('type')?.textContent?.trim() || 'outro',
      note: node.querySelector('desc')?.textContent?.trim() || '',
      lat: Number(node.getAttribute('lat')),
      lon: Number(node.getAttribute('lon')),
      createdAt: Date.now(),
    });
  });

  const trails = [];
  doc.querySelectorAll('trk').forEach((node, index) => {
    const name = node.querySelector('name')?.textContent?.trim() || `Trilha importada ${index + 1}`;
    const points = [];
    node.querySelectorAll('trkpt').forEach((pt) => {
      const lat = Number(pt.getAttribute('lat'));
      const lon = Number(pt.getAttribute('lon'));
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
      points.push({
        lat,
        lon,
        alt: Number(pt.querySelector('ele')?.textContent || NaN),
        at: Date.parse(pt.querySelector('time')?.textContent || '') || Date.now(),
      });
    });
    if (points.length) trails.push({ name, points, createdAt: Date.now() });
  });

  return { waypoints, trails };
}
