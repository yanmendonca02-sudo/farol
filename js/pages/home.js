/* Home: editorial hero, instrument panel and an asymmetric bento of sections. */

import { h } from '../ui.js';
import { countDownloadedTiles, getRegions } from '../lib/tiles.js';
import { storageInfo } from '../store.js';
import { fmtBytes } from '../ui.js';

function tile({ href, glyph, title, desc, variant = '', extra = '', body = null }) {
  return h('a', { class: `tile ${variant} ${extra}`, href },
    h('span', { class: 'tile-ico', 'aria-hidden': 'true' }, glyph),
    body,
    h('span', {},
      h('strong', {}, title),
      h('span', { class: 'desc' }, desc),
    ),
  );
}

export async function render() {
  const [tiles, regions, storage] = await Promise.all([countDownloadedTiles(), getRegions(), storageInfo()]);
  const swReady = Boolean(navigator.serviceWorker?.controller);
  const standalone = window.matchMedia('(display-mode: standalone)').matches;
  const mapReady = tiles > 0;

  const node = h('div', {},
    h('section', { class: 'hero' },
      h('p', { class: 'eyebrow' }, 'Offline · sem conta · sem rastreio'),
      h('h1', { class: 'display' }, 'Quando tudo para, ', h('em', {}, 'o Farol'), ' fica.'),
      h('p', { class: 'lede' }, 'Mapa, primeiros socorros e ferramentas que continuam funcionando quando a internet, o celular e a energia param.'),
      h('div', { class: 'hero-split' },
        h('div', {},
          h('div', { class: 'hero-cta' },
            h('a', { class: 'btn btn-primary btn-lg', href: '#/mapa' }, mapaCta(mapReady)),
            h('a', { class: 'btn btn-lg', href: '#/socorro' }, 'Primeiros socorros'),
          ),
          h('div', { class: 'status-chips', style: 'margin-top:12px' },
            h('span', { class: `chip ${swReady ? 'ok' : 'warn'}` }, swReady ? 'Offline pronto' : 'Preparando'),
            h('span', { class: `chip ${storage.persisted ? 'ok' : 'warn'}` }, storage.persisted ? 'Dados protegidos' : 'Dados frágeis'),
            h('span', { class: 'chip' }, standalone ? 'Instalado' : 'Navegador'),
          ),
        ),
        h('dl', { class: 'instrument' },
          h('div', {}, h('dt', {}, 'Quadros de mapa'), h('dd', { class: mapReady ? 'is-accent' : 'is-risk' }, tiles.toLocaleString('pt-BR'))),
          h('div', {}, h('dt', {}, 'Áreas baixadas'), h('dd', {}, String(regions.length || 0))),
          h('div', {}, h('dt', {}, 'Espaço usado'), h('dd', {}, storage.usage ? fmtBytes(storage.usage) : '0 MB')),
        ),
      ),
    ),

    h('div', { class: 'row', style: 'gap:8px; margin-bottom:6px' },
      h('a', {
        class: 'btn btn-danger btn-xl', href: '#/emergencia',
        style: 'flex:1; justify-content:space-between; padding-inline:22px',
      }, h('span', {}, '⚠ Emergência'), h('span', { class: 'mono', style: 'opacity:.8' }, '192')),
      h('a', { class: 'btn btn-xl btn-icon', href: 'tel:193', 'aria-label': 'Ligar para os bombeiros, 193', title: 'Bombeiros 193' }, '193'),
    ),

    h('div', { class: 'section-head' }, h('span', { class: 'index' }, '01'), h('h2', {}, 'Tudo o que está aqui')),

    h('div', { class: 'bento' },
      tile({
        href: '#/mapa', glyph: '◎', title: 'Mapa offline', variant: 'tile-map', extra: 'span-2x',
        desc: 'GPS, pontos salvos, trilhas e bússola.',
        body: h('span', { class: 'tile-extra' },
          h('span', { class: 'tile-kicker' }, 'Quadros guardados'),
          h('span', { class: 'tile-big' }, tiles.toLocaleString('pt-BR')),
          h('span', { class: 'tile-sub' }, `${regions.length || 0} área(s) · ${storage.usage ? fmtBytes(storage.usage) : '0 MB'}`),
        ),
      }),
      tile({ href: '#/emergencia', glyph: '✚', title: 'Emergência', desc: 'Voz e metrônomo em tela cheia.', variant: 'tile-risk' }),
      tile({ href: '#/socorro', glyph: '⌁', title: 'Primeiros socorros', desc: '16 guias passo a passo.' }),
      tile({ href: '#/agua', glyph: '◍', title: 'Água e comida', desc: 'Tratar, guardar, cozinhar.' }),
      tile({ href: '#/comunicacao', glyph: '≋', title: 'Sem internet', desc: 'QR, som e Wi-Fi local.' }),
      tile({ href: '#/ferramentas', glyph: '⚒', title: 'Ferramentas', desc: 'Lanterna, nível, listas, notas.' }),
      tile({ href: '#/radio', glyph: '⌁', title: 'Rádio', desc: 'Frequências e sinais de socorro.' }),
      tile({ href: '#/familia', glyph: '☎', title: 'Família', desc: 'Ficha médica, plano e QR.', variant: 'tile-wide' }),
    ),

    h('div', { class: 'section-head' }, h('span', { class: 'index' }, '02'), h('h2', {}, 'Antes do apagão')),

    h('div', { class: 'panel' },
      h('p', { style: 'margin-bottom:14px' }, 'Três coisas levam menos de dez minutos e mudam tudo.'),
      h('ol', { style: 'margin:0; padding-left:1.1em' },
        h('li', {}, h('a', { href: '#/mapa' }, 'Baixe o mapa'), ' da sua cidade e do caminho até o ponto de encontro.'),
        h('li', {}, h('a', { href: '#/familia' }, 'Preencha a ficha da família'), ' com sangue, alergias e remédios.'),
        h('li', {}, 'Em ', h('a', { href: '#/ferramentas' }, 'Ferramentas → Listas'), ', abra a preparação e imprima.'),
      ),
    ),

    h('p', { class: 'explain', style: 'margin-top:18px' },
      'Não substitui atendimento médico, autoridade pública ou equipamento adequado. Em risco de vida, procure o SAMU (192) ou os bombeiros (193) assim que houver qualquer sinal de rede.'),
  );

  return { node };
}

function mapaCta(mapReady) {
  return mapReady ? 'Abrir mapa' : 'Baixar mapa';
}
