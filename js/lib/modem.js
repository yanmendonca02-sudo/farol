/* Data-over-sound using ggwave (MIT licence, WASM bundled locally).
 * Short text only: a few dozen characters per transmission. Range is a few
 * metres indoors and depends on speaker and microphone quality. */

import { getAudioContext } from '../ui.js';

const SAMPLE_RATE = 48000;
const WINDOW_SECONDS = 12;
const DECODE_EVERY_MS = 700;

let ggwave = null;
let loadPromise = null;

export function modemSupported() {
  return typeof window.ggwave_factory === 'function';
}

export async function loadModem() {
  if (ggwave) return ggwave;
  if (!modemSupported()) throw new Error('Biblioteca de som não carregada.');
  loadPromise ||= window.ggwave_factory().then((instance) => {
    ggwave = instance;
    try { ggwave.disableLog?.(); } catch { /* optional */ }
    return instance;
  });
  return loadPromise;
}

function int8ToFloat32(samples) {
  const out = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i += 1) out[i] = samples[i] / 128;
  return out;
}

function floatToInt8Resampled(input, inputRate) {
  const ratio = inputRate / SAMPLE_RATE;
  const length = Math.floor(input.length / ratio);
  const out = new Int8Array(length);
  for (let i = 0; i < length; i += 1) {
    const pos = i * ratio;
    const index = Math.floor(pos);
    const frac = pos - index;
    const a = input[index] || 0;
    const b = input[index + 1] || a;
    const value = a * (1 - frac) + b * frac;
    out[i] = Math.max(-127, Math.min(127, Math.round(value * 127)));
  }
  return out;
}

export function encodeText(text, { protocol } = {}) {
  if (!ggwave) throw new Error('Módulo de som não iniciado.');
  const params = ggwave.getDefaultParameters();
  const instance = ggwave.init(params);
  try {
    const proto = protocol ?? ggwave.ProtocolId.GGWAVE_PROTOCOL_AUDIBLE_FASTEST;
    const waveform = ggwave.encode(instance, text, proto, 20);
    return waveform;
  } finally {
    try { ggwave.free(instance); } catch { /* ignore */ }
  }
}

export async function playText(text, { onDone } = {}) {
  await loadModem();
  const waveform = encodeText(text);
  const ctx = getAudioContext();
  if (!ctx) throw new Error('Áudio indisponível neste navegador.');
  const buffer = ctx.createBuffer(1, waveform.length, SAMPLE_RATE);
  buffer.copyToChannel(int8ToFloat32(waveform), 0);
  const source = ctx.createBufferSource();
  const gain = ctx.createGain();
  gain.gain.value = 0.9;
  source.buffer = buffer;
  source.connect(gain).connect(ctx.destination);
  source.onended = () => onDone?.();
  source.start();
  return { seconds: waveform.length / SAMPLE_RATE, stop: () => { try { source.stop(); } catch { /* ignore */ } } };
}

let receiver = null;

export async function startListening({ onText, onStatus } = {}) {
  if (receiver) stopListening();
  await loadModem();
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Este navegador não permite usar o microfone.');
  }
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true, channelCount: 1 },
  });
  const ctx = getAudioContext();
  if (!ctx) throw new Error('Áudio indisponível.');
  const inputRate = ctx.sampleRate;
  const source = ctx.createMediaStreamSource(stream);
  const processor = ctx.createScriptProcessor(4096, 1, 1);
  const rx = ggwave.init(ggwave.getDefaultParameters());

  let chunks = [];
  let samples = 0;
  let lastDecode = 0;
  let lastText = '';
  let lastTextAt = 0;
  let closed = false;
  const maxSamples = SAMPLE_RATE * WINDOW_SECONDS;

  const handle = (buffer) => {
    if (closed) return;
    const now = performance.now();
    if (now - lastDecode < DECODE_EVERY_MS) return;
    lastDecode = now;
    if (samples < SAMPLE_RATE * 0.8) return;
    try {
      const result = ggwave.decode(rx, buffer);
      if (result && result.length) {
        const text = new TextDecoder().decode(result);
        if (text && !(text === lastText && now - lastTextAt < 4000)) {
          lastText = text;
          lastTextAt = now;
          onText?.(text);
        }
        chunks = [];
        samples = 0;
      }
    } catch { /* decode errors are expected on noise */ }
  };

  processor.onaudioprocess = (event) => {
    if (closed) return;
    const input = event.inputBuffer.getChannelData(0);
    const int8 = floatToInt8Resampled(input, inputRate);
    chunks.push(int8);
    samples += int8.length;
    while (samples > maxSamples && chunks.length > 1) {
      samples -= chunks.shift().length;
    }
    if (samples > 0) {
      const merged = new Int8Array(samples);
      let offset = 0;
      for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.length; }
      handle(merged);
    }
  };

  source.connect(processor);
  const silentGain = ctx.createGain();
  silentGain.gain.value = 0;
  processor.connect(silentGain).connect(ctx.destination);

  receiver = {
    stop() {
      closed = true;
      try { processor.disconnect(); } catch { /* ignore */ }
      try { source.disconnect(); } catch { /* ignore */ }
      try { silentGain.disconnect(); } catch { /* ignore */ }
      stream.getTracks().forEach((track) => track.stop());
      try { ggwave.free(rx); } catch { /* ignore */ }
    },
  };
  onStatus?.('Ouvindo. Aproxime os aparelhos e mantenha o som ambiente baixo.');
  return receiver;
}

export function stopListening() {
  try { receiver?.stop(); } catch { /* ignore */ }
  receiver = null;
}
