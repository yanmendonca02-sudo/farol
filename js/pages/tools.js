/* Tools: flashlight, level, converters, sun/moon, timers, checklists,
 * notes, resource tracker and power guidance. */

import {
  h, toast, modal, confirmDialog, speak, stopSpeaking, beep, vibrate,
  download, fmtDate, promptDialog, getAudioContext,
} from '../ui.js';
import { getAll, putOne, deleteOne, uid, secureList, securePut } from '../store.js';
import { initTorch, setTorch, stopTorch } from '../lib/torch.js';
import { sunTimes, moonInfo, fmtClock, fmtDayLength } from '../lib/almanac.js';
import { playMorse, toMorse, MORSE_TABLE } from '../lib/morse.js';
import { CHECKLIST_TEMPLATES } from '../data/checklists.js';

const TABS = [
  ['lanterna', 'Lanterna'],
  ['morse', 'Morse e alarme'],
  ['nivel', 'Nível'],
  ['converter', 'Conversores'],
  ['sol', 'Sol e lua'],
  ['timer', 'Temporizador'],
  ['listas', 'Listas'],
  ['notas', 'Notas'],
  ['recursos', 'Recursos'],
  ['energia', 'Energia'],
];

const UNIT_GROUPS = {
  Comprimento: { m: 1, km: 1000, cm: 0.01, mm: 0.001, mi: 1609.344, ft: 0.3048, in: 0.0254 },
  Peso: { kg: 1, g: 0.001, mg: 0.000001, lb: 0.45359237, oz: 0.028349523 },
  Volume: { L: 1, mL: 0.001, m3: 1000, 'gal (EUA)': 3.785411784, 'xícara (240 ml)': 0.24 },
  Velocidade: { 'm/s': 1, 'km/h': 0.2777778, mph: 0.44704, 'nó': 0.5144444 },
  Área: { 'm²': 1, 'km²': 1000000, hectare: 10000, 'acre': 4046.8564224 },
  Temperatura: { '°C': 1, '°F': 1, K: 1 },
};

/* ---------- small builders ---------- */
function panel(title, ...children) {
  return h('div', { class: 'panel', style: 'margin-bottom:12px' }, h('h2', {}, title), ...children);
}

function safeDecode(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return number;
}

/* ---------- flashlight ---------- */
function flashlightPanel() {
  let torchState = { supported: false, reason: '' };
  let strobeTimer = null;
  let strobeOn = false;
  let overlay = null;
  let morseCancel = null;
  const status = h('p', { class: 'explain' }, 'Toque em “Ligar lanterna” para tentar usar o flash do aparelho. Se não funcionar, use a tela branca.');

  const setScreen = (on) => {
    if (on && !overlay) {
      overlay = h('div', { class: 'flash-screen', role: 'presentation', onclick: () => setScreen(false) });
      document.body.append(overlay);
    } else if (!on && overlay) {
      overlay.remove();
      overlay = null;
    }
    setTorch(on).catch(() => {});
  };

  const node = h('div', {},
    panel('Lanterna',
      h('div', { class: 'grid-2' },
        h('button', {
          class: 'btn btn-lg', type: 'button',
          onclick: async (event) => {
            const result = await initTorch();
            torchState = result;
            if (!result.supported) {
              status.textContent = result.reason || 'Lanterna não disponível. Use a tela branca.';
              toast(result.reason || 'Lanterna não disponível.', 'err');
              return;
            }
            const on = event.currentTarget.dataset.on !== '1';
            event.currentTarget.dataset.on = on ? '1' : '0';
            await setTorch(on);
            event.currentTarget.textContent = on ? 'Desligar lanterna' : 'Ligar lanterna';
            status.textContent = on ? 'Lanterna ligada.' : 'Lanterna desligada.';
          },
        }, 'Ligar lanterna'),
        h('button', {
          class: 'btn btn-lg', type: 'button',
          onclick: (event) => {
            const on = event.currentTarget.dataset.on !== '1';
            event.currentTarget.dataset.on = on ? '1' : '0';
            setScreen(on);
            event.currentTarget.textContent = on ? 'Apagar tela' : 'Tela branca';
          },
        }, 'Tela branca'),
      ),
      h('div', { class: 'row', style: 'margin-top:8px' },
        h('button', {
          class: 'btn', type: 'button',
          onclick: async (event) => {
            strobeOn = !strobeOn;
            if (strobeOn) {
              await initTorch();
              event.currentTarget.textContent = 'Parar estrobo';
              strobeTimer = setInterval(() => {
                if (!overlay) {
                  overlay = h('div', { class: 'flash-screen', role: 'presentation' });
                  document.body.append(overlay);
                  setTorch(true).catch(() => {});
                } else {
                  overlay.remove();
                  overlay = null;
                  setTorch(false).catch(() => {});
                }
              }, 280);
            } else {
              clearInterval(strobeTimer);
              strobeTimer = null;
              setScreen(false);
              event.currentTarget.textContent = 'Estrobo';
            }
          },
        }, 'Estrobo'),
        h('button', {
          class: 'btn', type: 'button',
          onclick: async () => {
            if (morseCancel) { morseCancel(); morseCancel = null; return; }
            await initTorch();
            let on = false;
            morseCancel = playMorse(toMorse('SOS'), {
              unit: 160,
              onStep: (state) => {
                on = state;
                setScreen(state);
              },
              onDone: () => { setScreen(false); morseCancel = null; },
            });
          },
        }, 'SOS em Morse'),
        h('button', {
          class: 'btn btn-ghost', type: 'button',
          onclick: () => { setScreen(false); clearInterval(strobeTimer); strobeTimer = null; },
        }, 'Desligar tudo'),
      ),
      status,
      h('p', { class: 'explain' }, 'No iPhone, o navegador não consegue ligar o flash. A tela branca funciona em qualquer aparelho e ilumina bem de perto.'),
    ),
  );

  return {
    node,
    cleanup: () => {
      clearInterval(strobeTimer);
      morseCancel?.();
      overlay?.remove();
      stopTorch();
    },
  };
}

/* ---------- morse, whistle and siren ---------- */
function morsePanel() {
  const textInput = h('input', { type: 'text', maxlength: '80', value: 'SOS', 'aria-label': 'Texto para converter em Morse' });
  const output = h('div', { class: 'morse-out', 'aria-live': 'polite' }, toMorse('SOS'));
  let cancelMorse = null;
  let flash = null;
  let alarm = null;
  let alarmType = null;

  const update = () => { output.textContent = toMorse(textInput.value) || '—'; };
  textInput.addEventListener('input', update);

  const setFlash = (on) => {
    if (on && !flash) {
      flash = h('div', { class: 'flash-screen', role: 'presentation' });
      document.body.append(flash);
    } else if (!on && flash) {
      flash.remove();
      flash = null;
    }
  };

  function stopAll() {
    cancelMorse?.();
    cancelMorse = null;
    setFlash(false);
    clearInterval(alarm);
    try { alarm?.stopNode?.(); } catch { /* ignore */ }
    alarm = null;
    alarmType = null;
    try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }
  }

  function playMorseText() {
    const code = toMorse(textInput.value);
    if (!code.trim()) { toast('Sem texto para transmitir.', 'err'); return; }
    cancelMorse?.();
    cancelMorse = playMorse(code, {
      unit: 150,
      onStep: (on, ms) => {
        setFlash(on);
        if (on) beep({ freq: 700, ms: Math.max(30, ms - 15), volume: 0.35, type: 'square' });
        if (on) vibrate(Math.max(30, ms - 15));
      },
      onDone: () => { setFlash(false); cancelMorse = null; },
    });
  }

  function whistle() {
    stopAll();
    alarmType = 'whistle';
    let count = 0;
    const blast = () => {
      beep({ freq: 2400, ms: 550, volume: 0.3, type: 'square' });
      vibrate(400);
      count += 1;
      if (count >= 6) { clearInterval(alarm); alarm = null; alarmType = null; }
    };
    blast();
    alarm = setInterval(blast, 1100);
  }

  function siren() {
    const ctx = getAudioContext();
    if (!ctx) { toast('Áudio não disponível.', 'err'); return; }
    if (alarmType === 'siren') { stopAll(); return; }
    stopAll();
    alarmType = 'siren';
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    gain.gain.value = 0.18;
    osc.frequency.value = 700;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    let up = true;
    alarm = setInterval(() => {
      up = !up;
      osc.frequency.setTargetAtTime(up ? 1300 : 650, ctx.currentTime, 0.12);
    }, 500);
    alarm.stopNode = () => { try { osc.stop(); gain.disconnect(); } catch { /* ignore */ } };
    vibrate([400, 200, 400]);
  }

  const rows = Object.entries(MORSE_TABLE).filter(([char]) => ![' ', '.', ',', '?', '!', '-', '/', '(', ')'].includes(char));

  const node = h('div', {},
    panel('Morse',
      h('label', { class: 'field' }, h('span', {}, 'Texto'), textInput),
      h('div', { class: 'morse-out', style: 'margin-bottom:10px' }, output),
      h('div', { class: 'row' },
        h('button', { class: 'btn btn-primary', type: 'button', onclick: playMorseText }, 'Transmitir (som e luz)'),
        h('button', { class: 'btn', type: 'button', onclick: stopAll }, 'Parar'),
        h('button', {
          class: 'btn btn-danger', type: 'button',
          onclick: () => { textInput.value = 'SOS'; update(); playMorseText(); },
        }, 'SOS'),
      ),
      h('p', { class: 'explain' }, 'Ponto = curto, traço = longo. O padrão de socorro é três curtos, três longos, três curtos, repetido com pausas. Funciona com lanterna, tela, apito ou batidas.'),
    ),
    panel('Apito e sirene',
      h('div', { class: 'row' },
        h('button', { class: 'btn', type: 'button', onclick: whistle }, 'Apito — 3+3 sinais'),
        h('button', { class: 'btn', type: 'button', onclick: siren }, 'Sirene contínua'),
        h('button', { class: 'btn btn-ghost', type: 'button', onclick: stopAll }, 'Parar'),
      ),
      h('p', { class: 'explain' }, 'Sinal internacional de socorro: qualquer coisa repetida três vezes (três apitos, três luzes, três tiros), com pausa entre os grupos. Gaste pouca energia: som e luz de emergência devem ser curtos e espaçados.'),
    ),
    panel('Tabela de referência',
      h('div', { class: 'table-wrap' },
        h('table', {},
          h('thead', {}, h('tr', {}, h('th', {}, 'Letra/número'), h('th', {}, 'Morse'))),
          h('tbody', {}, ...rows.map(([char, code]) => h('tr', {},
            h('td', {}, h('strong', {}, char)), h('td', { class: 'mono' }, code.replace(/-/g, '–').replace(/\./g, '·')),
          ))),
        ),
      ),
    ),
  );

  return {
    node,
    cleanup: () => {
      cancelMorse?.();
      clearInterval(alarm);
      try { alarm?.stopNode?.(); } catch { /* ignore */ }
      setFlash(false);
    },
  };
}

/* ---------- level ---------- */
function levelPanel() {
  const bubble = h('div', { class: 'level-bubble' });
  const readout = h('p', { class: 'small mono', style: 'margin:8px 0 0' }, 'Inclinação: —');
  let active = false;
  const handler = (event) => {
    const beta = event.beta || 0;
    const gamma = event.gamma || 0;
    const max = 40;
    const x = Math.max(-1, Math.min(1, gamma / max)) * 55;
    const y = Math.max(-1, Math.min(1, beta / max)) * 55;
    bubble.style.transform = `translate(${x}px, ${y}px)`;
    readout.textContent = `Inclinação: ${beta.toFixed(1)}° frente/trás · ${gamma.toFixed(1)}° lado`;
  };

  const node = h('div', {},
    panel('Nível de bolha',
      h('div', { class: 'level-stage' }, h('div', { class: 'cross' }), bubble),
      readout,
      h('div', { class: 'row', style: 'margin-top:8px' },
        h('button', {
          class: 'btn', type: 'button',
          onclick: async (event) => {
            if (active) {
              window.removeEventListener('deviceorientation', handler);
              active = false;
              event.currentTarget.textContent = 'Ativar nível';
              return;
            }
            try {
              if (window.DeviceOrientationEvent?.requestPermission) {
                const permission = await window.DeviceOrientationEvent.requestPermission();
                if (permission !== 'granted') { toast('Permissão negada.', 'err'); return; }
              }
              window.addEventListener('deviceorientation', handler, true);
              active = true;
              event.currentTarget.textContent = 'Desativar nível';
            } catch {
              toast('Sensor não disponível.', 'err');
            }
          },
        }, 'Ativar nível'),
      ),
      h('p', { class: 'explain' }, 'Deite o celular de costas numa superfície. Bolha no centro = superfície nivelada. Perto de metal e ímãs a leitura erra.'),
    ),
  );

  return { node, cleanup: () => window.removeEventListener('deviceorientation', handler) };
}

/* ---------- converters ---------- */
function converterPanel() {
  const category = h('select', {}, ...Object.keys(UNIT_GROUPS).map((name) => h('option', { value: name }, name)));
  const valueInput = h('input', { type: 'number', inputmode: 'decimal', value: '1', step: 'any', 'aria-label': 'Valor' });
  const from = h('select', { 'aria-label': 'Unidade de origem' });
  const to = h('select', { 'aria-label': 'Unidade de destino' });
  const result = h('div', { class: 'result big-num', 'aria-live': 'polite' }, '—');

  function fillUnits() {
    const units = Object.keys(UNIT_GROUPS[category.value]);
    from.replaceChildren(...units.map((unit) => h('option', { value: unit }, unit)));
    to.replaceChildren(...units.map((unit) => h('option', { value: unit }, unit)));
    to.value = units[1] || units[0];
    compute();
  }

  function convertTemp(value, fromUnit, toUnit) {
    let celsius = value;
    if (fromUnit === '°F') celsius = (value - 32) * (5 / 9);
    if (fromUnit === 'K') celsius = value - 273.15;
    if (toUnit === '°F') return celsius * (9 / 5) + 32;
    if (toUnit === 'K') return celsius + 273.15;
    return celsius;
  }

  function compute() {
    const value = Number(valueInput.value);
    if (!Number.isFinite(value)) { result.textContent = '—'; return; }
    if (category.value === 'Temperatura') {
      const converted = convertTemp(value, from.value, to.value);
      result.textContent = `${converted.toFixed(2).replace('.', ',')} ${to.value}`;
      return;
    }
    const units = UNIT_GROUPS[category.value];
    const base = value * units[from.value];
    const converted = base / units[to.value];
    const digits = Math.abs(converted) >= 100 ? 2 : 4;
    result.textContent = `${Number(converted.toFixed(digits)).toLocaleString('pt-BR')} ${to.value}`;
  }

  category.addEventListener('change', fillUnits);
  [valueInput, from, to].forEach((element) => element.addEventListener('input', compute));
  from.addEventListener('change', compute);
  to.addEventListener('change', compute);
  fillUnits();

  const node = h('div', {},
    panel('Conversores',
      h('label', { class: 'field' }, h('span', {}, 'Grandeza'), category),
      h('label', { class: 'field' }, h('span', {}, 'Valor'), valueInput),
      h('div', { class: 'grid-2' },
        h('label', { class: 'field' }, h('span', {}, 'De'), from),
        h('label', { class: 'field' }, h('span', {}, 'Para'), to),
      ),
      result,
      h('p', { class: 'explain' }, 'Medidas como alqueire e arroba variam por estado e produto: não são convertidas aqui de propósito.'),
    ),
  );
  return { node };
}

/* ---------- sun and moon ---------- */
function solarPanel() {
  const latInput = h('input', { type: 'number', step: 'any', placeholder: '-22,9068', 'aria-label': 'Latitude' });
  const lonInput = h('input', { type: 'number', step: 'any', placeholder: '-43,1729', 'aria-label': 'Longitude' });
  const dateInput = h('input', { type: 'date', value: new Date().toISOString().slice(0, 10) });
  const out = h('div', { class: 'stack-sm' });

  const MOON_GLYPH = ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘'];

  function compute() {
    const lat = Number(latInput.value);
    const lon = Number(lonInput.value);
    const date = dateInput.value ? new Date(`${dateInput.value}T12:00:00`) : new Date();
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90) {
      out.replaceChildren(h('p', { class: 'explain' }, 'Informe latitude e longitude, ou use o GPS.'));
      return;
    }
    const sun = sunTimes(date, lat, lon);
    const moon = moonInfo(date);
    const glyph = MOON_GLYPH[Math.floor((moon.phase + 0.0625) * 8) % 8];
    out.replaceChildren(
      h('div', { class: 'kv' },
        h('dt', {}, 'Nascer do sol'), h('dd', {}, sun.polar === 'day' ? 'Sol não se põe' : sun.polar === 'night' ? 'Sol não nasce' : fmtClock(sun.sunrise)),
        h('dt', {}, 'Meio-dia solar'), h('dd', {}, fmtClock(sun.solarNoon)),
        h('dt', {}, 'Pôr do sol'), h('dd', {}, sun.polar === 'day' ? '—' : sun.polar === 'night' ? '—' : fmtClock(sun.sunset)),
        h('dt', {}, 'Duração do dia'), h('dd', {}, sun.polar ? '—' : fmtDayLength(sun.dayLength)),
        h('dt', {}, 'Lua'), h('dd', {}, `${glyph} ${moon.name} · ${Math.round(moon.illumination * 100)}% iluminada`),
      ),
      h('p', { class: 'explain', style: 'margin:8px 0 0' }, 'Calculado no aparelho com as equações solares do NOAA. Pode variar 1–2 minutos conforme relevo e horário de verão.'),
    );
  }

  [latInput, lonInput, dateInput].forEach((element) => element.addEventListener('change', compute));

  const node = h('div', {},
    panel('Sol e lua',
      h('div', { class: 'grid-2' },
        h('label', { class: 'field' }, h('span', {}, 'Latitude'), latInput),
        h('label', { class: 'field' }, h('span', {}, 'Longitude'), lonInput),
      ),
      h('label', { class: 'field' }, h('span', {}, 'Data'), dateInput),
      h('div', { class: 'row', style: 'margin-bottom:10px' },
        h('button', {
          class: 'btn btn-sm', type: 'button',
          onclick: () => {
            if (!navigator.geolocation) { toast('Sem GPS.', 'err'); return; }
            navigator.geolocation.getCurrentPosition((position) => {
              latInput.value = position.coords.latitude.toFixed(5);
              lonInput.value = position.coords.longitude.toFixed(5);
              compute();
            }, () => toast('Não foi possível ler o GPS.', 'err'), { enableHighAccuracy: true, timeout: 15000 });
          },
        }, 'Usar meu GPS'),
        h('button', { class: 'btn btn-sm', type: 'button', onclick: compute }, 'Calcular'),
      ),
      out,
      h('p', { class: 'explain' }, 'Use para planejar deslocamento: sair ao nascer do sol gasta menos água e reduz o calor.'),
    ),
  );

  latInput.value = '-22.9068';
  lonInput.value = '-43.1729';
  compute();
  return { node };
}

/* ---------- timer ---------- */
function timerPanel() {
  let remaining = 0;
  let timer = null;
  let running = false;
  let wakeLock = null;

  const display = h('div', { class: 'big-num', 'aria-live': 'polite' }, '00:00');
  const status = h('p', { class: 'small muted' }, 'Escolha um tempo ou digite abaixo.');

  function renderDisplay() {
    const total = Math.max(0, Math.ceil(remaining / 1000));
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    display.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  function stop() {
    clearInterval(timer);
    timer = null;
    running = false;
    try { wakeLock?.release?.(); } catch { /* ignore */ }
    wakeLock = null;
  }

  function start() {
    if (running || remaining <= 0) return;
    running = true;
    const endAt = Date.now() + remaining;
    timer = setInterval(async () => {
      remaining = endAt - Date.now();
      renderDisplay();
      if (remaining <= 0) {
        stop();
        remaining = 0;
        renderDisplay();
        status.textContent = 'Tempo encerrado.';
        for (let i = 0; i < 3; i += 1) setTimeout(() => { beep({ freq: 1046, ms: 220, volume: 0.4 }); vibrate([200, 120, 200]); }, i * 500);
      }
    }, 250);
    status.textContent = 'Contando…';
    try { navigator.wakeLock?.request?.('screen').then((lock) => { wakeLock = lock; }).catch(() => {}); } catch { /* ignore */ }
  }

  function setMinutes(minutes) {
    stop();
    remaining = minutes * 60000;
    renderDisplay();
    status.textContent = `${minutes} minuto(s) prontos. Toque em Iniciar.`;
  }

  const custom = h('input', { type: 'number', min: '1', max: '600', value: '10', 'aria-label': 'Minutos', style: 'max-width:110px' });

  const node = h('div', {},
    panel('Temporizador',
      h('div', { class: 'timer-ring' }, display, status),
      h('div', { class: 'pill-row', style: 'margin:12px 0' },
        ...[1, 3, 5, 10, 15, 20, 30].map((minutes) => h('button', { class: 'btn btn-sm', type: 'button', onclick: () => setMinutes(minutes) }, `${minutes} min`)),
      ),
      h('div', { class: 'row', style: 'margin-bottom:10px' },
        custom, h('span', { class: 'small muted' }, 'minutos'),
        h('button', {
          class: 'btn btn-sm', type: 'button',
          onclick: () => setMinutes(Math.max(1, Math.min(600, Number(custom.value) || 1))),
        }, 'Definir'),
      ),
      h('div', { class: 'row' },
        h('button', {
          class: 'btn btn-primary btn-lg', type: 'button',
          onclick: (event) => {
            if (running) { stop(); event.currentTarget.textContent = 'Continuar'; status.textContent = 'Pausado.'; }
            else { start(); event.currentTarget.textContent = 'Pausar'; }
          },
        }, 'Iniciar'),
        h('button', {
          class: 'btn btn-lg', type: 'button',
          onclick: () => { stop(); remaining = 0; renderDisplay(); status.textContent = 'Zerado.'; },
        }, 'Zerar'),
      ),
      h('p', { class: 'explain' }, 'Sons e vibração funcionam mesmo em modo avião. Mantenha o app aberto: o navegador pausa a contagem em segundo plano.'),
    ),
  );

  return { node, cleanup: () => { stop(); } };
}

/* ---------- checklists ---------- */
function checklistsPanel() {
  const wrap = h('div');
  let lists = [];

  async function load() {
    lists = (await getAll('checklists')).sort((a, b) => b.createdAt - a.createdAt);
    paint();
  }

  function paint() {
    wrap.replaceChildren(
      h('div', { class: 'row', style: 'margin-bottom:10px' },
        h('button', {
          class: 'btn btn-primary', type: 'button',
          onclick: async () => {
            const title = await promptDialog('Nome da lista', { title: 'Nova lista', placeholder: 'Ex.: saída de casa' });
            if (!title) return;
            await putOne('checklists', { id: uid('list'), title, items: [], createdAt: Date.now() });
            load();
          },
        }, '+ Lista vazia'),
        h('button', {
          class: 'btn', type: 'button',
          onclick: () => modal({
            title: 'Modelos prontos',
            body: h('div', { class: 'stack-sm' }, ...CHECKLIST_TEMPLATES.map((template) => h('div', { class: 'card' },
              h('strong', {}, template.title),
              h('p', { class: 'meta', style: 'margin:2px 0 8px' }, template.note),
              h('button', {
                class: 'btn btn-sm btn-primary', type: 'button',
                onclick: async () => {
                  await putOne('checklists', {
                    id: uid('list'),
                    title: template.title,
                    items: template.items.map((text) => ({ text, done: false })),
                    createdAt: Date.now(),
                  });
                  toast('Lista criada.', 'ok');
                  load();
                },
              }, 'Usar este modelo'),
            ))),
          }),
        }, 'Modelos'),
      ),
      ...(lists.length ? lists.map(listCard) : [h('p', { class: 'explain' }, 'Nenhuma lista. Comece por “Modelos”: mochila de 72 horas, plano da família, kit de primeiros socorros.')]),
    );
  }

  function listCard(list) {
    const done = list.items.filter((item) => item.done).length;
    const percent = list.items.length ? Math.round((done / list.items.length) * 100) : 0;
    const bar = h('div', { class: 'progress' }, h('i', { style: `width:${percent}%` }));
    const counter = h('span', { class: 'meta' }, `${done}/${list.items.length} · ${percent}%`);
    const itemsHost = h('div');

    const paintItems = () => {
      counter.textContent = `${list.items.filter((item) => item.done).length}/${list.items.length} · ${list.items.length ? Math.round((list.items.filter((item) => item.done).length / list.items.length) * 100) : 0}%`;
      bar.firstElementChild.style.width = `${list.items.length ? Math.round((list.items.filter((item) => item.done).length / list.items.length) * 100) : 0}%`;
      itemsHost.replaceChildren(...list.items.map((item, index) => h('label', { class: 'check' },
        h('input', {
          type: 'checkbox', checked: item.done,
          onchange: async (event) => {
            list.items[index].done = event.target.checked;
            await putOne('checklists', list);
            paintItems();
          },
        }),
        h('span', {}, item.text),
      )));
    };

    const newItem = h('input', { type: 'text', placeholder: 'Adicionar item…', maxlength: '120' });
    const addItem = () => {
      const text = newItem.value.trim();
      if (!text) return;
      list.items.push({ text, done: false });
      newItem.value = '';
      putOne('checklists', list).then(paintItems);
    };
    newItem.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); addItem(); } });

    paintItems();

    return h('details', { class: 'accordion', style: 'margin-bottom:8px' },
      h('summary', {}, h('span', {}, list.title, h('span', { class: 'meta', style: 'display:block' }, `${list.items.length} itens`)), counter),
      h('div', { class: 'accordion-body' },
        bar,
        h('div', { style: 'margin-top:8px' }, itemsHost),
        h('div', { class: 'row', style: 'margin-top:8px' }, newItem, h('button', { class: 'btn btn-sm', type: 'button', onclick: addItem }, 'Adicionar')),
        h('div', { class: 'row', style: 'margin-top:8px' },
          h('button', {
            class: 'btn btn-sm btn-ghost', type: 'button',
            onclick: async () => {
              const ok = await confirmDialog(`Apagar a lista “${list.title}”?`, { confirmLabel: 'Apagar', danger: true });
              if (!ok) return;
              await deleteOne('checklists', list.id);
              load();
            },
          }, 'Apagar lista'),
          h('button', {
            class: 'btn btn-sm btn-ghost', type: 'button',
            onclick: () => {
              const text = `${list.title}\n\n${list.items.map((item) => `${item.done ? '[x]' : '[ ]'} ${item.text}`).join('\n')}\n`;
              download(`${list.title.replace(/\s+/g, '-').toLowerCase()}.txt`, text, 'text/plain');
            },
          }, 'Baixar .txt'),
        ),
      ),
    );
  }

  load();
  return { node: wrap };
}

/* ---------- notes ---------- */
function notesPanel() {
  const wrap = h('div');

  async function paint() {
    const notes = (await secureList('notes')).sort((a, b) => b.updatedAt - a.updatedAt);
    wrap.replaceChildren(
      h('button', {
        class: 'btn btn-primary', type: 'button', style: 'margin-bottom:10px',
        onclick: () => noteDialog(),
      }, '+ Nova anotação'),
      ...(notes.length ? notes.map((note) => h('div', { class: 'card', style: 'margin-bottom:8px' },
        h('div', { class: 'row-between' },
          h('span', { class: 'meta' }, fmtDate(note.updatedAt, { withTime: true })),
          h('div', { class: 'row', style: 'gap:4px' },
            h('button', { class: 'btn btn-sm btn-ghost', type: 'button', onclick: () => { speak(note.text); } }, '🔊'),
            h('button', { class: 'btn btn-sm btn-ghost', type: 'button', onclick: () => noteDialog(note) }, 'Editar'),
            h('button', {
              class: 'btn btn-sm btn-ghost', type: 'button',
              onclick: async () => {
                const ok = await confirmDialog('Apagar esta anotação?', { confirmLabel: 'Apagar', danger: true });
                if (!ok) return;
                await deleteOne('notes', note.id);
                paint();
              },
            }, '×'),
          ),
        ),
        h('p', { style: 'white-space:pre-wrap; margin:6px 0 0' }, note.text),
      )) : [h('p', { class: 'explain' }, 'Sem anotações. Use para registrar horários de remédio, telefonemas, o que funcionou e o que não funcionou.')]),
    );
  }

  function noteDialog(existing = null) {
    const input = h('textarea', { maxlength: '4000' }, existing?.text || '');
    modal({
      title: existing ? 'Editar anotação' : 'Nova anotação',
      body: h('div', {},
        h('label', { class: 'field' }, h('span', {}, 'Texto'), input),
        h('p', { class: 'explain' }, 'Com PIN ativo, esta anotação fica criptografada no aparelho.'),
      ),
      actions: [
        { label: 'Cancelar' },
        {
          label: 'Salvar', variant: 'btn-primary',
          onClick: async () => {
            const text = input.value.trim();
            if (!text) return;
            await securePut('notes', { id: existing?.id || uid('note'), text, updatedAt: Date.now() });
            toast('Anotação salva.', 'ok');
            paint();
          },
        },
      ],
    });
  }

  paint();
  return { node: wrap, cleanup: () => stopSpeaking() };
}

/* ---------- resources ---------- */
function resourcesPanel() {
  const wrap = h('div');

  const CATEGORIES = ['Água', 'Comida', 'Pilhas e bateria', 'Remédio', 'Gás/combustível', 'Outro'];

  function daysLeft(resource) {
    if (!resource.perDay || resource.perDay <= 0) return null;
    return resource.qty / resource.perDay;
  }

  async function paint() {
    const resources = (await getAll('resources')).sort((a, b) => a.name.localeCompare(b.name));
    const waterDays = (() => {
      const totals = resources.filter((item) => item.category === 'Água');
      const qty = totals.reduce((sum, item) => sum + Number(item.qty || 0), 0);
      const perDay = totals.reduce((sum, item) => sum + Number(item.perDay || 0), 0);
      return perDay > 0 ? qty / perDay : null;
    })();

    wrap.replaceChildren(
      h('div', { class: 'panel', style: 'margin-bottom:10px' },
        h('div', { class: 'row-between' },
          h('span', {}, 'Reserva de água'),
          h('strong', { class: waterDays !== null && waterDays < 3 ? 'big-num' : 'big-num', style: waterDays !== null && waterDays < 3 ? 'color:var(--risk)' : '' },
            waterDays === null ? '—' : `${waterDays.toFixed(1).replace('.', ',')} dias`),
        ),
        h('p', { class: 'explain', style: 'margin:4px 0 0' }, 'Base: 3 a 4 litros por pessoa por dia. Ajuste a quantidade diária de cada item.'),
      ),
      h('div', { class: 'pill-row', style: 'margin-bottom:10px' },
        h('button', { class: 'btn btn-sm btn-primary', type: 'button', onclick: () => resourceDialog() }, '+ Item'),
      ),
      ...(resources.length ? resources.map((resource) => {
        const days = daysLeft(resource);
        return h('div', { class: 'card', style: 'margin-bottom:8px' },
          h('div', { class: 'row-between' },
            h('div', {},
              h('strong', {}, resource.name),
              h('div', { class: 'meta' }, `${resource.category} · ${resource.qty} ${resource.unit}${resource.perDay ? ` · ${resource.perDay} ${resource.unit}/dia` : ''}`),
            ),
            h('span', {
              class: `tag ${days === null ? '' : days < 3 ? 'risk' : days < 7 ? 'info' : 'ok'}`,
            }, days === null ? 'sem consumo' : `${days.toFixed(1).replace('.', ',')} dias`),
          ),
          h('div', { class: 'row', style: 'margin-top:8px' },
            h('button', {
              class: 'btn btn-sm', type: 'button', 'aria-label': `Menos um ${resource.unit}`,
              onclick: async () => {
                resource.qty = Math.max(0, Number((Number(resource.qty) - 1).toFixed(2)));
                resource.updatedAt = Date.now();
                await putOne('resources', resource);
                paint();
              },
            }, '−1'),
            h('button', {
              class: 'btn btn-sm', type: 'button', 'aria-label': `Mais um ${resource.unit}`,
              onclick: async () => {
                resource.qty = Number((Number(resource.qty) + 1).toFixed(2));
                resource.updatedAt = Date.now();
                await putOne('resources', resource);
                paint();
              },
            }, '+1'),
            h('button', { class: 'btn btn-sm btn-ghost', type: 'button', onclick: () => resourceDialog(resource) }, 'Editar'),
            h('button', {
              class: 'btn btn-sm btn-ghost', type: 'button',
              onclick: async () => {
                const ok = await confirmDialog(`Apagar “${resource.name}”?`, { confirmLabel: 'Apagar', danger: true });
                if (!ok) return;
                await deleteOne('resources', resource.id);
                paint();
              },
            }, '×'),
          ),
        );
      }) : [h('p', { class: 'explain' }, 'Nada registrado. Comece pela água e pelos remédios de uso contínuo.')]),
    );
  }

  function resourceDialog(existing = null) {
    const name = h('input', { type: 'text', maxlength: '60', value: existing?.name || '', required: true });
    const category = h('select', {}, ...CATEGORIES.map((item) => h('option', { value: item, selected: existing?.category === item }, item)));
    const qty = h('input', { type: 'number', step: 'any', min: '0', value: existing?.qty ?? '0' });
    const unit = h('input', { type: 'text', maxlength: '12', value: existing?.unit || 'L' });
    const perDay = h('input', { type: 'number', step: 'any', min: '0', value: existing?.perDay ?? '0' });

    modal({
      title: existing ? 'Editar recurso' : 'Novo recurso',
      body: h('div', {},
        h('label', { class: 'field' }, h('span', {}, 'Nome'), name),
        h('label', { class: 'field' }, h('span', {}, 'Categoria'), category),
        h('div', { class: 'grid-2' },
          h('label', { class: 'field' }, h('span', {}, 'Quantidade'), qty),
          h('label', { class: 'field' }, h('span', {}, 'Unidade'), unit),
        ),
        h('label', { class: 'field' }, h('span', {}, 'Consumo por dia'), perDay),
        h('p', { class: 'explain' }, 'Exemplos: água 20 L com 4 L/dia = 5 dias. Remédio 30 comprimidos com 2/dia = 15 dias.'),
      ),
      actions: [
        { label: 'Cancelar' },
        {
          label: 'Salvar', variant: 'btn-primary',
          onClick: async () => {
            if (!name.value.trim()) { toast('Informe o nome.', 'err'); return true; }
            await putOne('resources', {
              id: existing?.id || uid('res'),
              name: name.value.trim(),
              category: category.value,
              qty: Number(qty.value) || 0,
              unit: unit.value.trim() || 'un',
              perDay: Number(perDay.value) || 0,
              updatedAt: Date.now(),
            });
            toast('Recurso salvo.', 'ok');
            paint();
          },
        },
      ],
    });
  }

  paint();
  return { node: wrap };
}

/* ---------- power guide ---------- */
function powerPanel() {
  return h('div', {},
    panel('Economizar bateria',
      h('ol', { style: 'margin:0' },
        h('li', {}, 'Ative o modo avião. Sem sinal, o celular gasta muito procurando torre. Este app continua funcionando.'),
        h('li', {}, 'Brilho no mínimo. A tela é o maior consumo.'),
        h('li', {}, 'Feche o GPS quando não estiver andando. Ele é o segundo maior consumo.'),
        h('li', {}, 'Desligue Wi-Fi, Bluetooth e vibração.'),
        h('li', {}, 'Use o tema escuro em tela OLED.'),
        h('li', {}, 'Evite vídeo, jogos e fotos.'),
        h('li', {}, 'Mantenha o aparelho longe do calor: bateria quente perde carga mais rápido.'),
        h('li', {}, 'Anote ligações e mensagens importantes no papel, e desligue o celular entre os usos programados.'),
      ),
    ),
    panel('Fontes de energia',
      h('div', { class: 'table-wrap' },
        h('table', {},
          h('thead', {}, h('tr', {}, h('th', {}, 'Fonte'), h('th', {}, 'Rende'), h('th', {}, 'Cuidados'))),
          h('tbody', {},
            h('tr', {}, h('td', {}, 'Carregador portátil'), h('td', {}, '1 a 4 cargas'), h('td', {}, 'Guarde com 50–60% de carga e recarregue a cada 3 meses.')),
            h('tr', {}, h('td', {}, 'Placa solar dobrável'), h('td', {}, '10 a 20 W rendem uma carga em um dia de sol'), h('td', {}, 'Sol direto, sem sombra. Não deixe dentro do carro quente.')),
            h('tr', {}, h('td', {}, 'Bateria de carro (12 V)'), h('td', {}, 'Várias cargas com inversor'), h('td', {}, 'Nunca descarregue abaixo da metade: você perde o transporte. Faça em local ventilado.')),
            h('tr', {}, h('td', {}, 'Dínamo de manivela'), h('td', {}, 'Poucos minutos de ligação por muito tempo girando'), h('td', {}, 'Serve para emergência, não para uso contínuo.')),
            h('tr', {}, h('td', {}, 'Painel solar pequeno (5 W)'), h('td', {}, 'Manutenção lenta da carga'), h('td', {}, 'Melhor para manter do que para recuperar.')),
          ),
        ),
      ),
      h('p', { class: 'explain', style: 'margin-top:8px' }, 'Estimativas variam muito com o aparelho e o equipamento. Teste antes do apagão e anote quanto rende de verdade.'),
    ),
    panel('Energia em casa',
      h('ul', { style: 'margin:0' },
        h('li', {}, 'Saiba desligar o disjuntor e o registro de gás.'),
        h('li', {}, 'Gerador nunca dentro de casa, garagem ou perto de janela: monóxido de carbono mata.'),
        h('li', {}, 'Não liga geladeira em gerador pequeno: pode queimar o motor.'),
        h('li', {}, 'Lanternas de dinamo e pilhas AA têm melhor relação custo-benefício que pilhas recarregáveis em emergência longa.'),
        h('li', {}, 'Mantenha uma lanterna presa à cabeceira e um par de pilhas na mochila.'),
      ),
    ),
  );
}

/* ---------- page ---------- */
export async function render() {
  const content = h('div');
  let activeCleanup = null;
  const buttons = new Map();

  function select(id) {
    if (activeCleanup) { try { activeCleanup(); } catch { /* ignore */ } activeCleanup = null; }
    stopSpeaking();
    for (const [key, button] of buttons) button.classList.toggle('btn-primary', key === id);
    let result;
    switch (id) {
      case 'lanterna': result = flashlightPanel(); break;
      case 'morse': result = morsePanel(); break;
      case 'nivel': result = levelPanel(); break;
      case 'converter': result = converterPanel(); break;
      case 'sol': result = solarPanel(); break;
      case 'timer': result = timerPanel(); break;
      case 'listas': result = checklistsPanel(); break;
      case 'notas': result = notesPanel(); break;
      case 'recursos': result = resourcesPanel(); break;
      default: result = { node: powerPanel() };
    }
    content.replaceChildren(result.node);
    activeCleanup = result.cleanup || null;
  }

  const nav = h('div', { class: 'seg', role: 'tablist', 'aria-label': 'Ferramentas' },
    ...TABS.map(([id, label]) => {
      const button = h('button', {
        class: 'btn btn-sm', type: 'button', onclick: () => select(id),
      }, label);
      buttons.set(id, button);
      return button;
    }),
  );

  const node = h('div', {},
    h('div', { class: 'page-head' },
      h('h1', {}, 'Ferramentas'),
      h('p', {}, 'Tudo calculado no aparelho, sem enviar nada para lugar nenhum.'),
    ),
    nav,
    content,
  );

  select('lanterna');

  return {
    node,
    cleanup: () => {
      if (activeCleanup) { try { activeCleanup(); } catch { /* ignore */ } }
      stopSpeaking();
    },
  };
}
