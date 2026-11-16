/* Morse code: text conversion, timing and playback helpers. */

export const MORSE_TABLE = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....',
  I: '..', J: '.---', K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.',
  Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-',
  Y: '-.--', Z: '--..',
  0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-',
  5: '.....', 6: '-....', 7: '--...', 8: '---..', 9: '----.',
  '.': '.-.-.-', ',': '--..--', '?': '..--..', '!': '-.-.--', '-': '-....-',
  '/': '-..-.', '(': '-.--.', ')': '-.--.-', ' ': '/',
};

const REVERSE = Object.fromEntries(
  Object.entries(MORSE_TABLE).filter(([key]) => key !== ' ').map(([key, value]) => [value, key]),
);

export function toMorse(text) {
  return text
    .toUpperCase()
    .split('')
    .map((char) => MORSE_TABLE[char] || '')
    .filter(Boolean)
    .join(' ');
}

export function fromMorse(code) {
  return code
    .trim()
    .split(/\s+/)
    .map((symbol) => (symbol === '/' ? ' ' : (REVERSE[symbol] || '?')))
    .join('');
}

export function morseUnits(code, unit = 140) {
  // Returns a timeline of on/off durations in milliseconds.
  const timeline = [];
  const chars = code.split('');
  for (let i = 0; i < chars.length; i += 1) {
    const char = chars[i];
    if (char === '.') timeline.push({ on: true, ms: unit });
    else if (char === '-') timeline.push({ on: true, ms: unit * 3 });
    else if (char === ' ') {
      const next = chars[i + 1];
      timeline.push({ on: false, ms: next === '/' ? unit * 7 : unit * 3 });
      continue;
    } else if (char === '/') {
      timeline.push({ on: false, ms: unit * 7 });
      continue;
    }
    if (chars[i + 1] && chars[i + 1] !== ' ' && chars[i + 1] !== '/') timeline.push({ on: false, ms: unit });
  }
  return timeline;
}

export function playMorse(code, { unit = 140, onStep, onDone, signal } = {}) {
  const timeline = morseUnits(code, unit);
  let elapsed = 0;
  const timers = [];
  for (const step of timeline) {
    const at = elapsed;
    timers.push(setTimeout(() => {
      if (signal?.aborted) return;
      onStep?.(step.on, step.ms);
    }, at));
    elapsed += step.ms;
  }
  timers.push(setTimeout(() => {
    if (!signal?.aborted) onDone?.();
  }, elapsed + 60));
  return () => {
    timers.forEach(clearTimeout);
    onStep?.(false, 0);
  };
}
