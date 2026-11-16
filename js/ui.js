/* Small DOM + feedback helpers shared by every page. */

export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key === 'html') el.innerHTML = value;
    else if (key === 'text') el.textContent = value;
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === 'value') el.value = value;
    else if (key === 'checked' || key === 'disabled' || key === 'selected' || key === 'required') el[key] = Boolean(value);
    else el.setAttribute(key, String(value));
  }
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}

export function clear(node) {
  node.replaceChildren();
  return node;
}

let toastSeq = 0;
export function toast(message, kind = '') {
  const host = document.getElementById('toasts');
  if (!host) return;
  const node = h('div', { class: `toast ${kind}`, role: 'status' }, message);
  node.dataset.id = String(++toastSeq);
  host.append(node);
  setTimeout(() => {
    node.style.opacity = '0';
    node.style.transition = 'opacity .25s';
    setTimeout(() => node.remove(), 280);
  }, kind === 'err' ? 5200 : 3200);
}

export function vibrate(pattern) {
  try { navigator.vibrate?.(pattern); } catch { /* not supported */ }
}

let audioCtx = null;
export function beep({ freq = 880, ms = 120, volume = 0.25, type = 'sine' } = {}) {
  try {
    audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + ms / 1000);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + ms / 1000);
  } catch { /* audio unavailable */ }
}

export function getAudioContext() {
  try {
    audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  } catch {
    return null;
  }
}

/* ---------- speech ---------- */
let voicesCache = [];
function loadVoices() {
  try { voicesCache = window.speechSynthesis?.getVoices?.() || []; } catch { voicesCache = []; }
}
if (window.speechSynthesis) {
  loadVoices();
  window.speechSynthesis.addEventListener?.('voiceschanged', loadVoices);
}

export function speechAvailable() {
  return Boolean(window.speechSynthesis && window.SpeechSynthesisUtterance);
}

export function speak(text, { rate = 0.95, stop = true } = {}) {
  if (!speechAvailable() || !text) return false;
  try {
    if (stop) window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'pt-BR';
    utter.rate = rate;
    utter.pitch = 1;
    const voice = voicesCache.find((v) => /pt[-_]BR/i.test(v.lang)) || voicesCache.find((v) => /^pt/i.test(v.lang));
    if (voice) utter.voice = voice;
    window.speechSynthesis.speak(utter);
    return true;
  } catch {
    return false;
  }
}

export function stopSpeaking() {
  try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }
}

/* ---------- modal ---------- */
export function modal({ title, body, actions = [], onClose, dismissible = true }) {
  const root = document.getElementById('modal-root');
  const previous = document.activeElement;
  const backdrop = h('div', { class: 'modal-backdrop', role: 'presentation' });
  const close = () => {
    backdrop.remove();
    document.removeEventListener('keydown', onKey);
    if (previous instanceof HTMLElement) previous.focus?.();
    onClose?.();
  };
  const box = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': title || 'Janela' });
  const titleId = `modal-title-${Math.random().toString(36).slice(2, 8)}`;
  box.setAttribute('aria-labelledby', titleId);
  box.append(h('h2', { id: titleId }, title));
  if (body instanceof Node) box.append(body);
  else if (body) box.append(h('p', {}, body));

  const footer = h('div', { class: 'modal-actions' });
  for (const action of actions) {
    footer.append(h('button', {
      class: `btn ${action.variant || ''}`,
      type: 'button',
      onclick: () => {
        const keepOpen = action.onClick?.(close);
        if (!keepOpen) close();
      },
    }, action.label));
  }
  if (!actions.length) footer.append(h('button', { class: 'btn', type: 'button', onclick: close }, 'Fechar'));
  box.append(footer);

  function onKey(event) {
    if (event.key === 'Escape' && dismissible) { event.preventDefault(); close(); }
    if (event.key === 'Tab') {
      const focusables = box.querySelectorAll('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  }

  backdrop.addEventListener('click', (event) => { if (event.target === backdrop && dismissible) close(); });
  document.addEventListener('keydown', onKey);
  backdrop.append(box);
  root.append(backdrop);
  requestAnimationFrame(() => (box.querySelector('input, textarea, select, button') || box).focus());
  return close;
}

export function confirmDialog(message, { title = 'Confirmar', confirmLabel = 'Confirmar', danger = false } = {}) {
  return new Promise((resolve) => {
    modal({
      title,
      body: h('p', {}, message),
      actions: [
        { label: 'Cancelar', onClick: () => resolve(false) },
        { label: confirmLabel, variant: danger ? 'btn-danger' : 'btn-primary', onClick: () => resolve(true) },
      ],
      onClose: () => resolve(false),
    });
  });
}

export function promptDialog(message, { title = 'Digite', value = '', placeholder = '', multiline = false, confirmLabel = 'Salvar' } = {}) {
  return new Promise((resolve) => {
    const input = multiline
      ? h('textarea', { placeholder, value })
      : h('input', { type: 'text', placeholder, value });
    const body = h('div', {}, h('p', {}, message), h('label', { class: 'field' }, input));
    let settled = false;
    modal({
      title,
      body,
      actions: [
        { label: 'Cancelar', onClick: () => { settled = true; resolve(null); } },
        {
          label: confirmLabel,
          variant: 'btn-primary',
          onClick: () => { settled = true; resolve(input.value.trim() || null); },
        },
      ],
      onClose: () => { if (!settled) resolve(null); },
    });
  });
}

/* ---------- formatting ---------- */
export function pad2(n) { return String(n).padStart(2, '0'); }

export function fmtDate(ts, { withTime = false } = {}) {
  const d = new Date(ts);
  const date = `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
  if (!withTime) return date;
  return `${date} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function fmtDuration(ms) {
  const total = Math.max(0, Math.round(ms / 1000));
  const hh = Math.floor(total / 3600);
  const mm = Math.floor((total % 3600) / 60);
  const ss = total % 60;
  return hh > 0 ? `${hh}h ${pad2(mm)}min` : `${mm}min ${pad2(ss)}s`;
}

export function fmtDistance(meters) {
  if (!Number.isFinite(meters)) return '—';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(2).replace('.', ',')} km`;
}

export function fmtBytes(bytes) {
  if (!Number.isFinite(bytes)) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit += 1; }
  return `${value.toFixed(unit === 0 ? 0 : 1).replace('.', ',')} ${units[unit]}`;
}

export function download(filename, content, type = 'application/octet-stream') {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

/* Shared SVG icons for first-aid guides (no external images). */
export const AID_ICONS = {
  heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 20s-7-4.4-7-9.4A4.1 4.1 0 0 1 12 7a4.1 4.1 0 0 1 7 3.6c0 5-7 9.4-7 9.4Z"/><path d="M5 12h3l1.6-2.4 2 4.8 1.8-3.4H19"/></svg>',
  lungs: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 3v10"/><path d="M9 6C6 8 5 11 5 15a3 3 0 0 0 5 2V9"/><path d="M15 6c3 2 4 5 4 9a3 3 0 0 1-5 2V9"/></svg>',
  blood: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 3s6 6.6 6 11a6 6 0 0 1-12 0c0-4.4 6-11 6-11Z"/><path d="M9.5 14a2.5 2.5 0 0 0 2.5 2.5"/></svg>',
  burn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 3c2 3 1 4 2 6 1-1 1.5-2 1.5-2S19 10 19 14a7 7 0 0 1-14 0c0-3 2-5 4-7 0 2 1 3 1 3 .5-3 2-5 2-7Z"/></svg>',
  bone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M7 17 17 7"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="5.5" r="2.5"/><circle cx="8.5" cy="15.5" r="2.5"/><circle cx="15.5" cy="8.5" r="2.5"/></svg>',
  snow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 2v20M4 7l16 10M4 17 20 7"/><path d="m9 4 3 3 3-3M9 20l3-3 3 3"/></svg>',
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19"/></svg>',
  drop: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 3s6 6.5 6 10.5A6 6 0 0 1 6 13.5C6 9.5 12 3 12 3Z"/><path d="M9 14a3 3 0 0 0 3 3"/></svg>',
  snake: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 18c4 0 4-4 0-4s-4-4 0-4h8c4 0 4 4 0 4h-3"/><path d="M17 6h3M17 9h3"/><circle cx="15" cy="18" r="2"/></svg>',
  skull: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M5 11a7 7 0 1 1 14 0v3l-2 1v3H7v-3l-2-1v-3Z"/><circle cx="9.5" cy="11" r="1.5"/><circle cx="14.5" cy="11" r="1.5"/><path d="M10 17v2M14 17v2"/></svg>',
  wave: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M2 12c2-4 4-4 6 0s4 4 6 0 4-4 6 0"/><path d="M2 18c2-4 4-4 6 0s4 4 6 0 4-4 6 0"/></svg>',
  bandage: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="2" y="8" width="20" height="8" rx="4" transform="rotate(-30 12 12)"/><path d="M9 9.5l.01.01M11.5 12l.01.01M14 14.5l.01.01"/></svg>',
  baby: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="9" r="5"/><path d="M9.5 8.5h.01M14.5 8.5h.01M10.5 11.5c1 .8 2 .8 3 0"/><path d="M6 21c0-3 2.7-5 6-5s6 2 6 5"/></svg>',
  sugar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 9h16v11H4z"/><path d="M7 9V6l3-2v5M14 9V5l3 2v2"/></svg>',
  shock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M3 12h4l2-5 3 10 2-5h7"/></svg>',
  eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6Z"/><circle cx="12" cy="12" r="3"/></svg>',
};
