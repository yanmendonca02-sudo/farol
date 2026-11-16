/* Offline map: local tiles, GPS, waypoints, trails, GPX, compass, downloads. */

import { h, toast, modal, confirmDialog, fmtDistance, download, readFile, promptDialog } from '../ui.js';
import { getAll, putOne, deleteOne, uid } from '../store.js';
import { makeMap, waypointIcon } from '../lib/map.js';
import { getRegions, downloadArea, deleteRegion, countDownloadedTiles, tilesForBox, estimateSize } from '../lib/tiles.js';
import { haversine, bearing, fmtCoord, toDMS, compassPoint } from '../lib/geo.js';
import { buildGPX, parseGPX } from '../lib/gpx.js';
import { REGIONS } from '../data/regions.js';
import { fmtBytes } from '../ui.js';

const TYPES = [
  { id: 'casa', label: 'Casa', glyph: '⌂' },
  { id: 'agua', label: 'Água', glyph: '≈' },
  { id: 'abrigo', label: 'Abrigo', glyph: '⌂' },
  { id: 'hospital', label: 'Hospital', glyph: '+' },
  { id: 'encontro', label: 'Ponto de encontro', glyph: '⚑' },
  { id: 'risco', label: 'Risco', glyph: '!' },
  { id: 'outro', label: 'Outro', glyph: '★' },
];

function glyphFor(type) {
  return TYPES.find((item) => item.id === type)?.glyph || '★';
}

function labelFor(type) {
  return TYPES.find((item) => item.id === type)?.label || 'Outro';
}

export async function render({ settings }) {
  const declination = Number(settings?.declination || 0);
  const [waypoints, trails, regions, tileCount] = await Promise.all([
    getAll('waypoints'), getAll('trails'), getRegions(), countDownloadedTiles(),
  ]);

  const state = {
    map: null,
    watchId: null,
    pos: null,
    marker: null,
    accuracy: null,
    wpLayer: null,
    trailLayer: null,
    lineLayer: null,
    recording: [],
    recordingLine: null,
    compassOn: false,
    heading: null,
    abort: null,
    wakeLock: null,
  };

  const gpsBox = h('dl', { class: 'geo-readout' },
    h('div', {}, h('dt', {}, 'Latitude'), h('dd', { id: 'gps-lat' }, '—')),
    h('div', {}, h('dt', {}, 'Longitude'), h('dd', { id: 'gps-lon' }, '—')),
    h('div', {}, h('dt', {}, 'Precisão'), h('dd', { id: 'gps-acc' }, '—')),
    h('div', {}, h('dt', {}, 'Altitude'), h('dd', { id: 'gps-alt' }, '—')),
    h('div', {}, h('dt', {}, 'Velocidade'), h('dd', { id: 'gps-speed' }, '—')),
    h('div', {}, h('dt', {}, 'Para o início'), h('dd', { id: 'gps-home' }, '—')),
  );

  const compassNeedle = h('div', { class: 'needle', id: 'compass-needle' });
  const compassHeading = h('div', { class: 'compass-heading', id: 'compass-heading', 'aria-live': 'off' }, '—');
  const compassSub = h('div', { class: 'meta', id: 'compass-sub' }, 'Bússola desligada');

  const compassCard = h('div', { class: 'panel' },
    h('h2', {}, 'Bússola'),
    h('div', { class: 'compass' },
      h('div', { class: 'compass-dial', role: 'img', 'aria-label': 'Bússola' },
        compassNeedle,
        h('span', { class: 'n' }, 'N'), h('span', { class: 'e' }, 'L'),
        h('span', { class: 's' }, 'S'), h('span', { class: 'w' }, 'O'),
      ),
      compassHeading,
      compassSub,
    ),
    h('div', { class: 'row' },
      h('button', { class: 'btn btn-sm', type: 'button', id: 'compass-toggle' }, 'Ligar bússola'),
    ),
    h('p', { class: 'explain' }, 'Aponta para o norte magnético. A declinação configurada em Ajustes é somada ao valor mostrado como “verdadeiro”. Afaste de ímãs, alto-falantes e metal e faça o movimento em oito para calibrar.'),
  );

  const wpList = h('div', { class: 'list', id: 'wp-list' },
    ...(waypoints.length ? waypoints.sort((a, b) => b.createdAt - a.createdAt).map((point) => h('div', { class: 'card' },
      h('div', { class: 'row-between' },
        h('div', {}, h('strong', {}, `${glyphFor(point.type)} ${point.name}`),
          h('div', { class: 'meta' }, `${labelFor(point.type)} · ${point.lat.toFixed(5)}, ${point.lon.toFixed(5)}`)),
        h('div', { class: 'row', style: 'gap:4px' },
          h('button', { class: 'btn btn-sm', type: 'button', onclick: () => focusWaypoint(point) }, 'Ir'),
          h('button', {
            class: 'btn btn-sm btn-ghost', type: 'button',
            onclick: async () => {
              const ok = await confirmDialog(`Apagar o ponto “${point.name}”?`, { confirmLabel: 'Apagar', danger: true });
              if (!ok) return;
              await deleteOne('waypoints', point.id);
              rerender();
            },
          }, '×'),
        ),
      ),
    )) : [h('p', { class: 'explain' }, 'Nenhum ponto salvo ainda. Ative o GPS e toque em “Salvar ponto aqui”.')]),
  );

  const trailList = h('div', { class: 'list' },
    ...(trails.length ? trails.sort((a, b) => b.createdAt - a.createdAt).map((trail) => {
      const length = trail.points.reduce((sum, point, index) => (index ? sum + haversine(trail.points[index - 1], point) : 0), 0);
      return h('div', { class: 'card' },
        h('div', { class: 'row-between' },
          h('div', {}, h('strong', {}, trail.name || 'Trilha'),
            h('div', { class: 'meta' }, `${trail.points.length} pontos · ${fmtDistance(length)}`)),
          h('div', { class: 'row', style: 'gap:4px' },
            h('button', {
              class: 'btn btn-sm', type: 'button',
              onclick: () => {
                if (!state.map) return;
                const latlngs = trail.points.map((point) => [point.lat, point.lon]);
                state.trailLayer.clearLayers();
                window.L.polyline(latlngs, { color: '#58d6c6', weight: 4 }).addTo(state.trailLayer);
                state.map.fitBounds(latlngs, { padding: [20, 20] });
              },
            }, 'Ver'),
            h('button', {
              class: 'btn btn-sm btn-ghost', type: 'button',
              onclick: async () => {
                const ok = await confirmDialog('Apagar esta trilha?', { confirmLabel: 'Apagar', danger: true });
                if (!ok) return;
                await deleteOne('trails', trail.id);
                rerender();
              },
            }, '×'),
          ),
        ),
      );
    }) : [h('p', { class: 'explain' }, 'Grave uma trilha para voltar pelo mesmo caminho.')]),
  );

  const regionSelect = h('select', { id: 'region-select', 'aria-label': 'Região para baixar' },
    ...REGIONS.map((region) => h('option', { value: region.id }, region.name)),
    h('option', { value: '__custom' }, 'Área visível no mapa (escolher agora)'),
  );

  const zoomMin = h('input', { type: 'number', min: '6', max: '17', value: '12', id: 'zoom-min', 'aria-label': 'Zoom mínimo' });
  const zoomMax = h('input', { type: 'number', min: '6', max: '18', value: '15', id: 'zoom-max', 'aria-label': 'Zoom máximo' });
  const estimateEl = h('div', { class: 'result small', id: 'estimate' }, '—');
  const progress = h('div', { class: 'progress', hidden: true }, h('i', { id: 'download-bar' }));
  const progressText = h('p', { class: 'meta', id: 'download-text', hidden: true }, '');
  const downloadBtn = h('button', { class: 'btn btn-primary', type: 'button', id: 'download-btn' }, 'Baixar mapa');
  const cancelBtn = h('button', { class: 'btn btn-danger btn-sm', type: 'button', id: 'cancel-download', hidden: true }, 'Cancelar');

  const regionHint = h('p', { class: 'explain', id: 'region-hint' });

  let customBox = null;

  function currentBox() {
    const id = regionSelect.value;
    if (id === '__custom') return customBox;
    const region = REGIONS.find((item) => item.id === id);
    return region ? { name: region.name, bbox: region.bbox, zooms: region.zooms } : null;
  }

  function updateEstimate() {
    const box = currentBox();
    if (!box) {
      estimateEl.textContent = 'Mova o mapa para a área desejada e toque em “Usar a área visível”.';
      regionHint.textContent = '';
      return;
    }
    const zMin = Math.max(6, Math.min(17, Number(zoomMin.value) || 12));
    const zMax = Math.max(zMin, Math.min(18, Number(zoomMax.value) || zMin));
    const { count } = tilesForBox(box.bbox, [zMin, zMax]);
    estimateEl.textContent = `${count.toLocaleString('pt-BR')} quadros · cerca de ${fmtBytes(estimateSize(count))} · zoom ${zMin}–${zMax}`;
    const region = REGIONS.find((item) => item.id === regionSelect.value);
    regionHint.textContent = region ? region.hint : 'Área escolhida a partir do mapa. Confira se o retângulo cobre o trajeto que você precisa.';
    return { box, count, zMin, zMax };
  }

  regionSelect.addEventListener('change', () => {
    const region = REGIONS.find((item) => item.id === regionSelect.value);
    if (region) {
      zoomMin.value = String(region.zooms[0]);
      zoomMax.value = String(region.zooms[1]);
      if (state.map) state.map.fitBounds([[region.bbox[1], region.bbox[0]], [region.bbox[3], region.bbox[2]]]);
    } else {
      const bounds = state.map?.getBounds();
      if (bounds) {
        customBox = {
          name: 'Área visível',
          bbox: [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()],
          zooms: [Math.max(10, Math.round(state.map.getZoom())), Math.min(17, Math.round(state.map.getZoom()) + 2)],
        };
        zoomMin.value = String(customBox.zooms[0]);
        zoomMax.value = String(customBox.zooms[1]);
      }
    }
    updateEstimate();
  });
  zoomMin.addEventListener('change', updateEstimate);
  zoomMax.addEventListener('change', updateEstimate);

  async function startDownload() {
    const plan = updateEstimate();
    if (!plan) return;
    if (!navigator.onLine) {
      toast('Sem internet agora. Baixe o mapa antes do apagão, com conexão.', 'err');
      return;
    }
    if (plan.count > 12000) {
      const ok = await confirmDialog(
        `São ${plan.count.toLocaleString('pt-BR')} quadros (${fmtBytes(estimateSize(plan.count))}). Isso pode demorar e gastar muitos dados. Recomendado reduzir o zoom máximo. Continuar?`,
        { confirmLabel: 'Continuar', danger: true },
      );
      if (!ok) return;
    }
    const id = regionSelect.value === '__custom' ? `custom-${Date.now()}` : regionSelect.value;
    state.abort = new AbortController();
    downloadBtn.disabled = true;
    cancelBtn.hidden = false;
    progress.hidden = false;
    progressText.hidden = false;
    try { state.wakeLock = await navigator.wakeLock?.request?.('screen'); } catch { /* optional */ }
    try {
      const meta = await downloadArea({
        id,
        name: plan.box.name,
        bbox: plan.box.bbox,
        zooms: [plan.zMin, plan.zMax],
        signal: state.abort.signal,
        onProgress: (data) => {
          const percent = Math.round((data.done / data.total) * 100);
          document.getElementById('download-bar').style.width = `${percent}%`;
          progressText.textContent = `${data.done.toLocaleString('pt-BR')} de ${data.total.toLocaleString('pt-BR')} quadros · ${percent}% · ${fmtBytes(data.bytes)} baixados${data.failed ? ` · ${data.failed} falhas` : ''}`;
        },
      });
      toast(`Mapa salvo: ${meta.done} quadros. Já funciona em modo avião.`, 'ok');
    } catch (error) {
      if (error?.name === 'AbortError') toast('Download cancelado. Os quadros já baixados ficam guardados.');
      else toast(error.message || 'Falha ao baixar o mapa.', 'err');
    } finally {
      downloadBtn.disabled = false;
      cancelBtn.hidden = true;
      progress.hidden = true;
      try { state.wakeLock?.release?.(); } catch { /* ignore */ }
      state.wakeLock = null;
      state.abort = null;
      rerender();
    }
  }

  downloadBtn.addEventListener('click', startDownload);
  cancelBtn.addEventListener('click', () => state.abort?.abort());

  const node = h('div', {},
    h('div', { class: 'page-head' },
      h('h1', {}, 'Mapa offline'),
      h('p', {}, `${tileCount.toLocaleString('pt-BR')} quadros baixados · só o que está aqui aparece no mapa.`),
    ),

    h('div', { class: 'map-wrap' },
      h('div', { id: 'map' }),
      h('div', { class: 'map-badge', id: 'map-badge' }, 'Ative o GPS para ver sua posição'),
      tileCount === 0
        ? h('div', { class: 'map-empty' },
          h('strong', {}, 'O mapa ainda está vazio'),
          h('p', {}, 'Baixe uma região enquanto houver internet. Depois disso, o mapa abre em modo avião.'),
          h('button', {
            class: 'btn btn-primary btn-sm', type: 'button',
            onclick: () => document.getElementById('baixar')?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
          }, 'Escolher região'),
        )
        : null,
    ),
    h('div', { class: 'map-actions' },
      h('button', { class: 'btn btn-primary', type: 'button', id: 'gps-btn' }, 'Ativar GPS'),
      h('button', { class: 'btn', type: 'button', id: 'save-wp' }, 'Salvar ponto aqui'),
      h('button', { class: 'btn', type: 'button', id: 'record-btn' }, 'Gravar trilha'),
      h('button', { class: 'btn', type: 'button', id: 'home-btn' }, 'Voltar ao início'),
      h('button', { class: 'btn', type: 'button', id: 'export-btn' }, 'Exportar GPX'),
      h('label', { class: 'btn', style: 'cursor:pointer' }, 'Importar GPX',
        h('input', { type: 'file', accept: '.gpx,application/gpx+xml', id: 'import-gpx', hidden: true }),
      ),
    ),

    h('div', { class: 'panel', style: 'margin-top:12px' },
      h('h2', {}, 'Sua posição'),
      gpsBox,
      h('p', { class: 'explain' }, 'O GPS funciona sem internet. A precisão melhora a céu aberto; embaixo de árvores, prédios ou dentro de casa pode errar dezenas de metros.'),
    ),

    h('div', { style: 'margin-top:12px' }, compassCard),

    h('div', { class: 'panel', style: 'margin-top:12px', id: 'baixar' },
      h('h2', {}, 'Baixar mapa para uso offline'),
      h('p', { class: 'explain' }, 'Escolha a região e o nível de detalhe. Quanto maior o zoom máximo, mais quadros e mais espaço. Baixe com Wi-Fi. Os quadros vêm do OpenStreetMap, de graça e sem chave.'),
      h('label', { class: 'field' }, h('span', {}, 'Região'), regionSelect),
      h('div', { class: 'grid-2' },
        h('label', { class: 'field' }, h('span', {}, 'Zoom mínimo'), zoomMin),
        h('label', { class: 'field' }, h('span', {}, 'Zoom máximo'), zoomMax),
      ),
      estimateEl,
      regionHint,
      h('div', { class: 'row', style: 'margin-top:8px' }, downloadBtn, cancelBtn),
      h('div', { style: 'margin-top:10px' }, progress, progressText),
      h('p', { class: 'explain' }, 'O servidor público do OpenStreetMap tem limite de uso. Baixe no máximo algumas milhares de quadros por vez e evite repetir downloads desnecessários. Se precisar de áreas enormes, use o script do projeto (tools/download-tiles.mjs) ou um provedor de PMTiles.'),
      regions.length ? h('details', { class: 'accordion', style: 'margin-top:10px' },
        h('summary', {}, `Áreas baixadas (${regions.length})`),
        h('div', { class: 'accordion-body' }, ...regions.map((region) => h('div', { class: 'row-between', style: 'padding:6px 0' },
          h('span', { class: 'small' }, `${region.name} — ${region.done || 0}/${region.planned || 0}`),
          h('button', {
            class: 'btn btn-sm btn-ghost', type: 'button',
            onclick: async () => {
              await deleteRegion(region.id);
              toast('Área removida.');
              rerender();
            },
          }, 'Apagar'),
        ))),
      ) : null,
    ),

    h('div', { class: 'panel', style: 'margin-top:12px' },
      h('h2', {}, 'Pontos salvos'),
      wpList,
    ),

    h('div', { class: 'panel', style: 'margin-top:12px' },
      h('h2', {}, 'Trilhas'),
      trailList,
      h('p', { class: 'explain' }, '“Gravar trilha” guarda um ponto a cada mudança de posição. Use “Voltar ao início” para ver a distância e a direção do primeiro ponto da trilha mais recente.'),
    ),
  );

  function rerender() {
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  }

  function updateHome() {
    const el = document.getElementById('gps-home');
    if (!el) return;
    const base = state.recording.length ? state.recording[0] : (trails[0]?.points?.[0] || null);
    if (!base || !state.pos) { el.textContent = '—'; return; }
    const meters = haversine(base, state.pos);
    const deg = bearing(state.pos, base);
    el.textContent = `${fmtDistance(meters)} · ${Math.round(deg)}° ${compassPoint(deg)}`;
  }

  function paintPosition() {
    if (!state.map || !state.pos) return;
    const latlng = [state.pos.lat, state.pos.lon];
    if (!state.marker) {
      state.marker = window.L.marker(latlng, {
        icon: window.L.divIcon({ html: '<div class="map-dot"></div>', className: '', iconSize: [22, 22], iconAnchor: [11, 11] }),
      }).addTo(state.map);
      state.accuracy = window.L.circle(latlng, {
        radius: state.pos.accuracy || 20,
        color: '#7fb2ff',
        weight: 1,
        fillColor: '#7fb2ff',
        fillOpacity: 0.12,
      }).addTo(state.map);
    } else {
      state.marker.setLatLng(latlng);
      state.accuracy.setLatLng(latlng).setRadius(state.pos.accuracy || 20);
    }

    document.getElementById('gps-lat').textContent = fmtCoord(state.pos.lat, true);
    document.getElementById('gps-lon').textContent = fmtCoord(state.pos.lon, false);
    document.getElementById('gps-acc').textContent = state.pos.accuracy ? `± ${Math.round(state.pos.accuracy)} m` : '—';
    document.getElementById('gps-alt').textContent = Number.isFinite(state.pos.altitude) ? `${Math.round(state.pos.altitude)} m` : '—';
    document.getElementById('gps-speed').textContent = Number.isFinite(state.pos.speed) && state.pos.speed >= 0
      ? `${(state.pos.speed * 3.6).toFixed(1).replace('.', ',')} km/h` : '—';
    document.getElementById('map-badge').textContent = `${toDMS(state.pos.lat, true)} · ${toDMS(state.pos.lon, false)}`;
    updateHome();
  }

  function startWatch() {
    if (!navigator.geolocation) {
      toast('Este navegador não tem GPS acessível.', 'err');
      return;
    }
    if (state.watchId !== null) {
      navigator.geolocation.clearWatch(state.watchId);
      state.watchId = null;
    }
    document.getElementById('gps-btn').textContent = 'Localizando…';
    state.watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, altitude, accuracy, speed, heading } = position.coords;
        state.pos = { lat: latitude, lon: longitude, altitude, accuracy, speed, heading, at: position.timestamp };
        document.getElementById('gps-btn').textContent = 'Centralizar em mim';
        paintPosition();
        if (state.recordingLine && state.recording.length) {
          state.recording.push({ lat: latitude, lon: longitude, alt: altitude, at: position.timestamp });
          state.recordingLine.addLatLng([latitude, longitude]);
          if (state.recording.length % 10 === 0) {
            putOne('trails', { id: state.recordingId, name: state.recordingName, points: state.recording.slice(), createdAt: state.recordingAt, partial: true }).catch(() => {});
          }
        }
        updateHome();
      },
      (error) => {
        document.getElementById('gps-btn').textContent = 'Tentar GPS de novo';
        const messages = {
          1: 'Permissão de localização negada. Libere o GPS nas configurações do navegador.',
          2: 'Sinal de GPS indisponível agora. Vá para um lugar aberto.',
          3: 'O GPS demorou demais. Tente de novo.',
        };
        toast(messages[error.code] || 'Não foi possível ler o GPS.', 'err');
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );
  }

  function focusWaypoint(point) {
    if (!state.map) return;
    state.map.setView([point.lat, point.lon], Math.max(15, state.map.getZoom()));
    if (state.lineLayer) state.lineLayer.clearLayers();
    window.L.marker([point.lat, point.lon], { icon: waypointIcon(glyphFor(point.type)) }).addTo(state.lineLayer);
    if (state.pos) {
      window.L.polyline([[state.pos.lat, state.pos.lon], [point.lat, point.lon]], { color: '#ffb340', dashArray: '6 8', weight: 3 }).addTo(state.lineLayer);
      toast(`Distância: ${fmtDistance(haversine(state.pos, point))} · direção ${Math.round(bearing(state.pos, point))}° ${compassPoint(bearing(state.pos, point))}`);
    }
  }

  function waypointDialog() {
    if (!state.pos) {
      toast('Ative o GPS primeiro para salvar um ponto.', 'err');
      return;
    }
    const nameInput = h('input', { type: 'text', placeholder: 'Ex.: caixa d’água da praça', maxlength: '60', required: true });
    const typeSelect = h('select', {}, ...TYPES.map((type) => h('option', { value: type.id }, `${type.glyph} ${type.label}`)));
    const noteInput = h('textarea', { placeholder: 'Observação (opcional): acesso, quantidade, perigo…', maxlength: '300' });
    modal({
      title: 'Salvar ponto',
      body: h('div', {},
        h('p', { class: 'small muted' }, `${toDMS(state.pos.lat, true)} · ${toDMS(state.pos.lon, false)} · precisão ${Math.round(state.pos.accuracy || 0)} m`),
        h('label', { class: 'field' }, h('span', {}, 'Nome'), nameInput),
        h('label', { class: 'field' }, h('span', {}, 'Tipo'), typeSelect),
        h('label', { class: 'field' }, h('span', {}, 'Observação'), noteInput),
      ),
      actions: [
        { label: 'Cancelar' },
        {
          label: 'Salvar',
          variant: 'btn-primary',
          onClick: () => {
            const name = nameInput.value.trim();
            if (!name) { toast('Dê um nome ao ponto.', 'err'); return true; }
            putOne('waypoints', {
              id: uid('wp'),
              name,
              type: typeSelect.value,
              note: noteInput.value.trim(),
              lat: state.pos.lat,
              lon: state.pos.lon,
              createdAt: Date.now(),
            }).then(() => { toast('Ponto salvo.', 'ok'); rerender(); });
          },
        },
      ],
    });
  }

  function toggleRecording() {
    const button = document.getElementById('record-btn');
    if (!state.recordingLine) {
      if (!state.pos) { toast('Ative o GPS para gravar a trilha.', 'err'); return; }
      state.recording = [{ lat: state.pos.lat, lon: state.pos.lon, alt: state.pos.altitude, at: Date.now() }];
      state.recordingId = uid('trail');
      state.recordingName = `Trilha ${new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`;
      state.recordingAt = Date.now();
      state.recordingLine = window.L.polyline([[state.pos.lat, state.pos.lon]], { color: '#ffb340', weight: 5 }).addTo(state.map);
      button.textContent = 'Parar e salvar';
      button.classList.add('btn-danger');
      toast('Gravando trilha. Mantenha o app aberto.');
    } else {
      const points = state.recording.slice();
      state.recordingLine.remove();
      state.recordingLine = null;
      button.textContent = 'Gravar trilha';
      button.classList.remove('btn-danger');
      if (points.length < 2) { toast('Poucos pontos: trilha não salva.'); state.recording = []; return; }
      putOne('trails', { id: state.recordingId, name: state.recordingName, points, createdAt: state.recordingAt })
        .then(() => { toast(`Trilha salva com ${points.length} pontos.`, 'ok'); state.recording = []; rerender(); });
    }
  }

  async function toggleCompass() {
    const button = document.getElementById('compass-toggle');
    if (state.compassOn) {
      window.removeEventListener('deviceorientationabsolute', onOrientation);
      window.removeEventListener('deviceorientation', onOrientation);
      state.compassOn = false;
      button.textContent = 'Ligar bússola';
      compassSub.textContent = 'Bússola desligada';
      return;
    }
    try {
      if (window.DeviceOrientationEvent?.requestPermission) {
        const permission = await window.DeviceOrientationEvent.requestPermission();
        if (permission !== 'granted') { toast('Permissão de movimento negada.', 'err'); return; }
      }
      if (!('DeviceOrientationEvent' in window)) {
        toast('Este aparelho não tem sensor de direção acessível.', 'err');
        return;
      }
      window.addEventListener('deviceorientationabsolute', onOrientation, true);
      window.addEventListener('deviceorientation', onOrientation, true);
      state.compassOn = true;
      button.textContent = 'Desligar bússola';
      compassSub.textContent = 'Aguardando o sensor…';
    } catch {
      toast('Não foi possível ativar a bússola.', 'err');
    }
  }

  function onOrientation(event) {
    let heading = null;
    if (Number.isFinite(event.webkitCompassHeading)) heading = event.webkitCompassHeading;
    else if (Number.isFinite(event.alpha)) heading = (360 - event.alpha) % 360;
    if (heading === null) return;
    state.heading = heading;
    const trueHeading = (heading + declination + 360) % 360;
    compassNeedle.style.transform = `rotate(${-heading}deg)`;
    compassHeading.textContent = `${Math.round(trueHeading)}° ${compassPoint(trueHeading)}`;
    compassSub.textContent = `Norte magnético ${Math.round(heading)}° · declinação ${declination}°`;
  }

  function exportGPX() {
    const gpx = buildGPX(waypoints, trails);
    download(`farol-pontos-${new Date().toISOString().slice(0, 10)}.gpx`, gpx, 'application/gpx+xml');
    toast('Arquivo GPX gerado.');
  }

  async function importGPXFile(file) {
    if (!file) return;
    try {
      const text = await readFile(file);
      const parsed = parseGPX(text);
      for (const point of parsed.waypoints) {
        await putOne('waypoints', { ...point, id: uid('wp') });
      }
      for (const trail of parsed.trails) {
        await putOne('trails', { ...trail, id: uid('trail') });
      }
      toast(`${parsed.waypoints.length} pontos e ${parsed.trails.length} trilhas importados.`, 'ok');
      rerender();
    } catch (error) {
      toast(error.message || 'GPX inválido.', 'err');
    }
  }

  function init() {
    try {
      state.map = makeMap(document.getElementById('map'), { center: [-22.9068, -43.1729], zoom: 12 });
    } catch (error) {
      document.getElementById('map').innerHTML = '';
      document.getElementById('map').append(h('div', { class: 'map-missing' }, `Mapa não disponível: ${error.message}`));
      return;
    }
    state.wpLayer = window.L.layerGroup().addTo(state.map);
    state.trailLayer = window.L.layerGroup().addTo(state.map);
    state.lineLayer = window.L.layerGroup().addTo(state.map);

    for (const point of waypoints) {
      window.L.marker([point.lat, point.lon], { icon: waypointIcon(glyphFor(point.type)), title: point.name })
        .bindPopup(`<strong>${point.name}</strong><br>${labelFor(point.type)}`)
        .on('click', () => focusWaypoint(point))
        .addTo(state.wpLayer);
    }

    if (trails[0]?.points?.length) {
      window.L.polyline(trails[0].points.map((point) => [point.lat, point.lon]), { color: '#58d6c6', weight: 3, opacity: 0.8 }).addTo(state.trailLayer);
    }

    state.map.on('moveend', () => {
      if (regionSelect.value === '__custom') {
        const bounds = state.map.getBounds();
        customBox = {
          name: 'Área visível',
          bbox: [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()],
          zooms: [Math.max(10, Math.round(state.map.getZoom())), Math.min(17, Math.round(state.map.getZoom()) + 2)],
        };
        updateEstimate();
      }
    });

    document.getElementById('gps-btn').addEventListener('click', () => {
      if (state.pos) state.map.setView([state.pos.lat, state.pos.lon], Math.max(16, state.map.getZoom()));
      else startWatch();
    });
    document.getElementById('save-wp').addEventListener('click', waypointDialog);
    document.getElementById('record-btn').addEventListener('click', toggleRecording);
    document.getElementById('home-btn').addEventListener('click', () => {
      const base = state.recording.length ? state.recording[0] : (trails[0]?.points?.[0] || null);
      if (!base) { toast('Grave uma trilha primeiro para ter um ponto de retorno.'); return; }
      if (!state.pos) { toast('Ative o GPS para calcular a volta.', 'err'); return; }
      state.map.setView([state.pos.lat, state.pos.lon], Math.max(15, state.map.getZoom()));
      state.lineLayer.clearLayers();
      window.L.polyline([[state.pos.lat, state.pos.lon], [base.lat, base.lon]], { color: '#ff7059', weight: 4, dashArray: '10 6' }).addTo(state.lineLayer);
      const meters = haversine(state.pos, base);
      const deg = bearing(state.pos, base);
      toast(`Início a ${fmtDistance(meters)}, direção ${Math.round(deg)}° ${compassPoint(deg)}.`);
    });
    document.getElementById('export-btn').addEventListener('click', exportGPX);
    document.getElementById('import-gpx').addEventListener('change', (event) => importGPXFile(event.target.files?.[0]));
    document.getElementById('compass-toggle').addEventListener('click', toggleCompass);

    updateEstimate();

    // Ask for the GPS only if the user already allowed it; otherwise the
    // "Ativar GPS" button triggers the permission prompt on a real tap.
    navigator.permissions?.query?.({ name: 'geolocation' })
      .then((status) => { if (status.state === 'granted') startWatch(); })
      .catch(() => {});
  }

  requestAnimationFrame(init);

  const cleanup = () => {
    if (state.watchId !== null) navigator.geolocation.clearWatch(state.watchId);
    window.removeEventListener('deviceorientationabsolute', onOrientation);
    window.removeEventListener('deviceorientation', onOrientation);
    state.abort?.abort();
    state.map?.remove();
  };

  return { node, cleanup };
}
