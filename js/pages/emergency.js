/* Full-screen emergency mode: huge steps, voice, CPR metronome. */

import { h, speak, stopSpeaking, toast, beep, vibrate } from '../ui.js';
import { AID_ICONS } from '../ui.js';
import { FIRST_AID, findAid } from '../data/firstaid.js';
import { getSettings } from '../store.js';

const CPR_IDS = new Set(['rcp-adulto', 'rcp-crianca', 'rcp-bebe']);

export async function render({ params }) {
  const settings = await getSettings();
  const id = params?.[0];

  if (!id) {
    const urgent = FIRST_AID.filter((guide) => guide.urgent);
    const node = h('div', {},
      h('div', { class: 'page-head' },
        h('h1', {}, 'Emergência'),
        h('p', {}, 'Escolha o que está acontecendo. A tela fica grande, com poucos botões.'),
      ),
      h('div', { class: 'row', style: 'margin-bottom:12px' },
        h('a', { class: 'btn btn-danger btn-xl', href: 'tel:192', style: 'flex:1' }, 'Ligar 192'),
        h('a', { class: 'btn btn-xl', href: '#/socorro', style: 'flex:1' }, 'Todos os guias'),
      ),
      h('div', { class: 'list' },
        ...urgent.map((guide) => h('a', { class: 'card aid-card', href: `#/emergencia/${guide.id}`, style: 'min-height:76px' },
          h('span', { class: 'aid-ico', 'aria-hidden': 'true', html: AID_ICONS[guide.icon] || AID_ICONS.bandage }),
          h('span', {}, h('h3', {}, guide.title), h('p', {}, guide.short)),
          h('span', { 'aria-hidden': 'true', class: 'muted' }, '›'),
        )),
      ),
      h('p', { class: 'explain', style: 'margin-top:14px' },
        'Mantenha a calma. Fale em voz alta com a pessoa. Se estiver sozinho e sem telefone, peça ajuda gritando por alguém próximo.'),
    );
    return { node, cleanup: () => stopSpeaking() };
  }

  const guide = findAid(id);
  if (!guide) {
    return { node: h('div', { class: 'panel' }, h('h1', {}, 'Guia não encontrado'), h('a', { class: 'btn', href: '#/socorro' }, 'Voltar')) };
  }

  document.body.classList.add('emergency-mode');
  let index = 0;
  let metronome = null;
  let metronomeBpm = settings.metronomeBpm || 110;
  let wakeLock = null;
  let speakingEnabled = settings.tts;
  let pulseTimer = null;

  const stepTitle = h('strong', { id: 'em-title' }, '');
  const stepText = h('p', { id: 'em-text', style: 'margin:0' }, '');
  const stepIcon = h('div', { 'aria-hidden': 'true', style: 'color:var(--accent); width:64px; margin-bottom:8px' });
  const counter = h('span', { class: 'meta' }, '');
  const bar = h('i');
  const progress = h('div', { class: 'progress', 'aria-hidden': 'true' }, bar);
  const metronomeDot = h('span', { class: 'metronome-pulse' });
  const metronomeLabel = h('span', { class: 'small muted' }, 'Metrônomo desligado');
  const bpmLabel = h('span', { class: 'small muted', id: 'bpm-label' }, `${metronomeBpm} por minuto`);

  const body = h('div', { class: 'emergency-body' }, stepIcon, stepTitle, stepText);

  function renderStep({ announce = true } = {}) {
    const step = guide.steps[index];
    stepTitle.textContent = step.title;
    stepText.textContent = step.text;
    stepIcon.innerHTML = step.icon && AID_ICONS[step.icon] ? AID_ICONS[step.icon] : '';
    counter.textContent = `Passo ${index + 1} de ${guide.steps.length}`;
    bar.style.width = `${((index + 1) / guide.steps.length) * 100}%`;
    body.scrollTop = 0;
    if (announce && speakingEnabled) speak(`${step.title}. ${step.text}`, { rate: 0.92 });
    vibrate(30);
  }

  function move(delta) {
    index = Math.max(0, Math.min(guide.steps.length - 1, index + delta));
    renderStep();
  }

  function toggleMetronome() {
    if (metronome) {
      clearInterval(metronome);
      metronome = null;
      clearInterval(pulseTimer);
      pulseTimer = null;
      metronomeDot.classList.remove('beat');
      metronomeLabel.textContent = 'Metrônomo desligado';
      const button = document.getElementById('metronome-btn');
      if (button) button.textContent = 'Ligar';
      return;
    }
    metronomeLabel.textContent = 'Metrônomo ligado: mantenha o ritmo';
    const button = document.getElementById('metronome-btn');
    if (button) button.textContent = 'Parar';
    const interval = 60000 / metronomeBpm;
    metronome = setInterval(() => {
      beep({ freq: 880, ms: 70, volume: 0.4 });
      vibrate(90);
      metronomeDot.classList.add('beat');
      clearTimeout(pulseTimer);
      pulseTimer = setTimeout(() => metronomeDot.classList.remove('beat'), Math.min(180, interval * 0.5));
    }, interval);
    beep({ freq: 880, ms: 70, volume: 0.4 });
    vibrate(90);
  }

  function setBpm(value) {
    metronomeBpm = value;
    bpmLabel.textContent = `${value} por minuto`;
    if (metronome) { toggleMetronome(); toggleMetronome(); }
  }

  const bpmInput = h('input', {
    type: 'range', min: '100', max: '120', step: '5', value: String(metronomeBpm),
    'aria-label': 'Batidas por minuto',
    oninput: (event) => setBpm(Number(event.target.value)),
    style: 'flex:1',
  });

  const node = h('div', { class: 'emergency' },
    h('div', { class: 'emergency-top' },
      h('a', { class: 'btn btn-sm btn-ghost', href: `#/socorro/${guide.id}`, 'aria-label': 'Sair do modo emergência' }, '✕ Sair'),
      h('span', { class: 'small muted' }, `${counter.textContent ? '' : ''}${guide.title}`),
      h('button', {
        class: 'btn btn-sm', type: 'button',
        'aria-pressed': String(speakingEnabled),
        'aria-label': 'Ler os passos em voz alta',
        onclick: (event) => {
          speakingEnabled = !speakingEnabled;
          event.currentTarget.setAttribute('aria-pressed', String(speakingEnabled));
          event.currentTarget.textContent = speakingEnabled ? '🔊' : '🔇';
          if (!speakingEnabled) stopSpeaking();
          else speak(`${guide.steps[index].title}. ${guide.steps[index].text}`);
        },
      }, speakingEnabled ? '🔊' : '🔇'),
    ),
    h('a', { class: 'btn btn-danger btn-lg btn-block', href: 'tel:192' }, 'Ligar 192 agora'),
    progress,
    body,
    h('div', { class: 'row', style: 'justify-content:space-between' }, counter, h('span', { class: 'small' }, guide.urgent ? 'Risco de vida' : '')),
    h('div', { class: 'emergency-nav' },
      h('button', { class: 'btn btn-lg', type: 'button', onclick: () => move(-1) }, '‹ Anterior'),
      h('button', { class: 'btn btn-lg btn-primary', type: 'button', onclick: () => move(1) }, 'Próximo ›'),
    ),
    CPR_IDS.has(guide.id) || guide.id === 'engasgo' ? h('div', { class: 'panel panel-flat' },
      h('div', { class: 'row-between' },
        h('div', { class: 'row', style: 'gap:10px' }, metronomeDot, h('span', { class: 'small' }, 'Metrônomo de compressões'), metronomeLabel),
        h('button', { class: 'btn btn-sm', type: 'button', id: 'metronome-btn', 'aria-label': 'Ligar ou desligar metrônomo', onclick: toggleMetronome }, 'Ligar'),
      ),
      h('div', { class: 'row', style: 'margin-top:8px' }, bpmInput, bpmLabel),
      h('p', { class: 'explain', style: 'margin:6px 0 0' }, 'Use entre 100 e 120 por minuto. Cada batida é uma compressão.'),
    ) : null,
  );

  renderStep({ announce: false });
  if (speakingEnabled) setTimeout(() => speak(`${guide.title}. ${guide.steps[0].title}. ${guide.steps[0].text}`), 400);

  try { wakeLock = await navigator.wakeLock?.request?.('screen'); } catch { /* optional */ }

  const cleanup = () => {
    document.body.classList.remove('emergency-mode');
    clearInterval(metronome);
    clearInterval(pulseTimer);
    stopSpeaking();
    try { wakeLock?.release?.(); } catch { /* ignore */ }
    window.onbeforeunload = null;
  };

  window.onbeforeunload = (event) => {
    event.preventDefault();
    event.returnValue = '';
  };

  return { node, cleanup };
}
