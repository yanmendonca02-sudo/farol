/* Farol app shell: hash router, settings, lock screen, service worker. */

import * as homePage from './pages/home.js';
import * as mapPage from './pages/map.js';
import * as aidPage from './pages/firstaid.js';
import * as emergencyPage from './pages/emergency.js';
import * as survivalPage from './pages/water.js';
import * as commsPage from './pages/comms.js';
import * as radioPage from './pages/radio.js';
import * as toolsPage from './pages/tools.js';
import * as familyPage from './pages/family.js';
import * as settingsPage from './pages/settings.js';
import * as morePage from './pages/more.js';
import { getSettings, saveSettings, getPinRecord, unlockWithPin, lockVault, vaultUnlocked, requestPersistence } from './store.js';
import { h, toast, stopSpeaking } from './ui.js';

const ROUTES = [
  { pattern: /^\/?$/, tab: 'home', title: 'Início', page: homePage },
  { pattern: /^\/mapa$/, tab: 'map', title: 'Mapa offline', page: mapPage },
  { pattern: /^\/socorro$/, tab: 'aid', title: 'Primeiros socorros', page: aidPage },
  { pattern: /^\/socorro\/([\w-]+)$/, tab: 'aid', title: 'Primeiros socorros', page: aidPage, param: true },
  { pattern: /^\/emergencia$/, tab: 'aid', title: 'Emergência', page: emergencyPage },
  { pattern: /^\/emergencia\/([\w-]+)$/, tab: 'aid', title: 'Emergência', page: emergencyPage, param: true },
  { pattern: /^\/agua$/, tab: 'more', title: 'Água, comida e abrigo', page: survivalPage },
  { pattern: /^\/comunicacao$/, tab: 'more', title: 'Comunicação sem internet', page: commsPage },
  { pattern: /^\/radio$/, tab: 'more', title: 'Rádio — referência', page: radioPage },
  { pattern: /^\/ferramentas$/, tab: 'tools', title: 'Ferramentas', page: toolsPage },
  { pattern: /^\/familia$/, tab: 'more', title: 'Família e ficha médica', page: familyPage },
  { pattern: /^\/ajustes$/, tab: 'more', title: 'Ajustes', page: settingsPage },
  { pattern: /^\/mais$/, tab: 'more', title: 'Mais', page: morePage },
];

const main = document.getElementById('main');
const lockScreen = document.getElementById('lock-screen');
let cleanup = null;
let settings = null;
let locked = false;

function currentPath() {
  const raw = window.location.hash.replace(/^#/, '');
  if (!raw) return '/';
  return raw.startsWith('/') ? raw : `/${raw}`;
}

function matchRoute(path) {
  for (const route of ROUTES) {
    const result = route.pattern.exec(path);
    if (result) return { route, params: result.slice(1) };
  }
  return null;
}

function setActiveTab(tab) {
  document.querySelectorAll('.tabbar .tab').forEach((element) => {
    if (element.dataset.tab === tab) element.setAttribute('aria-current', 'page');
    else element.removeAttribute('aria-current');
  });
}

function applySettings() {
  const root = document.documentElement;
  root.dataset.theme = settings.theme === 'light' ? 'light' : 'dark';
  root.dataset.font = settings.font || 'normal';
  root.dataset.reduce = settings.reduceMotion ? '1' : '0';
  document.getElementById('btn-font')?.setAttribute(
    'aria-label',
    settings.font === 'gigante' ? 'Voltar ao texto normal' : 'Aumentar tamanho do texto',
  );
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', settings.theme === 'light' ? '#f3f1ea' : '#0a0e12');
}

function showLockScreen() {
  locked = true;
  lockScreen.hidden = false;
  document.getElementById('lock-pin')?.focus();
}

function hideLockScreen() {
  locked = false;
  lockScreen.hidden = true;
  const form = document.getElementById('lock-form');
  form?.reset();
  document.getElementById('lock-error').hidden = true;
}

async function render() {
  if (locked) return;
  const path = currentPath();
  const matched = matchRoute(path);

  if (cleanup) {
    try { cleanup(); } catch { /* ignore */ }
    cleanup = null;
  }
  stopSpeaking();
  document.body.classList.remove('emergency-mode');

  if (!matched) {
    setActiveTab('');
    main.replaceChildren(h('div', { class: 'page-head' }, h('h1', {}, 'Página não encontrada'),
      h('p', {}, 'O endereço não existe neste aplicativo.'),
      h('a', { class: 'btn btn-primary', href: '#/' }, 'Voltar ao início')));
    document.title = 'Farol';
    return;
  }

  const { route, params } = matched;
  setActiveTab(route.tab);
  document.title = `${route.title} — Farol`;

  try {
    const result = await route.page.render({ params, settings, path });
    if (result && result.node instanceof Node) {
      result.node.classList.add('page-enter');
      main.replaceChildren(result.node);
      cleanup = typeof result.cleanup === 'function' ? result.cleanup : null;
    }
  } catch (error) {
    console.error(error);
    main.replaceChildren(h('div', { class: 'panel' },
      h('h1', {}, 'Algo deu errado'),
      h('p', {}, 'Não foi possível abrir esta tela.'),
      h('p', { class: 'mono' }, String(error?.message || error)),
      h('a', { class: 'btn btn-primary', href: '#/' }, 'Voltar ao início')));
  }
}

function setupChrome() {
  document.getElementById('btn-theme').addEventListener('click', async () => {
    settings = await saveSettings({ theme: settings.theme === 'light' ? 'dark' : 'light' });
    applySettings();
  });

  document.getElementById('btn-font').addEventListener('click', async () => {
    const order = ['normal', 'grande', 'gigante'];
    const next = order[(order.indexOf(settings.font || 'normal') + 1) % order.length];
    settings = await saveSettings({ font: next });
    applySettings();
    const labels = { normal: 'Texto normal', grande: 'Texto grande', gigante: 'Texto gigante' };
    toast(labels[next]);
  });

  document.getElementById('btn-lock').addEventListener('click', async () => {
    const record = await getPinRecord();
    if (!record) {
      location.hash = '#/ajustes';
      toast('Configure um PIN em Ajustes para usar o bloqueio.');
      return;
    }
    lockVault();
    stopSpeaking();
    showLockScreen();
  });

  document.getElementById('lock-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const input = document.getElementById('lock-pin');
    const pin = input.value.trim();
    const ok = await unlockWithPin(pin);
    if (ok) {
      hideLockScreen();
      await render();
    } else {
      const error = document.getElementById('lock-error');
      error.hidden = false;
      input.value = '';
      input.focus();
    }
  });

  const topbar = document.getElementById('topbar');
  const onScroll = () => topbar.classList.toggle('is-scrolled', window.scrollY > 6);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const offlineFlag = document.getElementById('offline-flag');
  const updateOnline = () => {
    offlineFlag.hidden = navigator.onLine;
    document.documentElement.dataset.online = navigator.onLine ? '1' : '0';
  };
  window.addEventListener('online', updateOnline);
  window.addEventListener('offline', updateOnline);
  updateOnline();

  window.addEventListener('farol:settings', (event) => {
    settings = event.detail;
    applySettings();
  });

  window.addEventListener('hashchange', () => {
    render();
    window.scrollTo({ top: 0, behavior: 'auto' });
  });
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((error) => {
      console.warn('Falha ao registrar o service worker', error);
    });
  });
}

function firstRun() {
  if (settings.onboarded) {
    requestPersistence();
    return;
  }
  import('./pages/onboarding.js').then(({ showOnboarding }) => showOnboarding(async () => {
    settings = await saveSettings({ onboarded: true });
    await requestPersistence();
    await render();
  }));
}

async function start() {
  settings = await getSettings();
  applySettings();
  setupChrome();
  registerServiceWorker();

  const record = await getPinRecord();
  if (record && !vaultUnlocked()) {
    showLockScreen();
  } else {
    await render();
  }
  firstRun();
}

start();
