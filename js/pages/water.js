/* Water, food, shelter and hygiene, rendered from the data file. */

import { h, AID_ICONS, speak, toast } from '../ui.js';
import { SURVIVAL_SECTIONS } from '../data/survival.js';

function block(blockData) {
  switch (blockData.type) {
    case 'text':
      return h('div', { class: 'panel panel-flat', style: 'margin-bottom:10px' },
        h('h3', {}, blockData.title),
        h('p', { style: 'margin:0' }, blockData.text),
      );
    case 'list':
      return h('div', { class: 'panel panel-flat', style: 'margin-bottom:10px' },
        h('h3', {}, blockData.title),
        h('ul', { style: 'margin:0' }, ...blockData.items.map((item) => h('li', {}, item))),
      );
    case 'table':
      return h('div', { class: 'panel panel-flat', style: 'margin-bottom:10px' },
        h('h3', {}, blockData.title),
        h('div', { class: 'table-wrap' },
          h('table', {},
            h('thead', {}, h('tr', {}, ...blockData.head.map((cell) => h('th', {}, cell)))),
            h('tbody', {}, ...blockData.rows.map((row) => h('tr', {}, ...row.map((cell) => h('td', {}, cell))))),
          ),
        ),
        blockData.note ? h('p', { class: 'explain', style: 'margin:8px 0 0' }, blockData.note) : null,
      );
    case 'warn':
      return h('div', { class: 'warn-box', style: 'margin-bottom:10px' },
        h('h3', {}, blockData.title),
        h('p', { style: 'margin:0' }, blockData.text),
      );
    default:
      return null;
  }
}

export async function render() {
  const sections = SURVIVAL_SECTIONS.map((section) => h('section', { id: section.id, style: 'margin-bottom:22px' },
    h('div', { class: 'row-between', style: 'margin-bottom:8px' },
      h('h2', { style: 'margin:0' }, `${section.title}`),
      h('button', {
        class: 'btn btn-sm btn-ghost', type: 'button',
        'aria-label': `Ouvir a introdução de ${section.title}`,
        onclick: () => {
          const text = [section.intro, ...section.blocks.map((item) => `${item.title || ''}. ${item.text || (item.items || []).join('. ') || ''}`)].join(' ');
          if (!speak(text)) toast('Voz não disponível neste navegador.', 'err');
        },
      }, '🔊'),
    ),
    h('p', { class: 'muted', style: 'margin-bottom:12px' }, section.intro),
    ...section.blocks.map(block),
  ));

  const nav = h('div', { class: 'pill-row', style: 'margin-bottom:14px' },
    ...SURVIVAL_SECTIONS.map((section) => h('a', {
      class: 'btn btn-sm', href: `#${section.id}`,
      onclick: (event) => {
        event.preventDefault();
        document.getElementById(section.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      },
    }, section.title)),
  );

  const node = h('div', {},
    h('div', { class: 'page-head' },
      h('h1', {}, 'Água, comida e abrigo'),
      h('p', {}, 'O básico que evita doença e desidratação depois de uma catástrofe.'),
    ),
    nav,
    h('div', { class: 'warn-box', style: 'margin-bottom:16px' },
      h('h3', {}, 'Prioridade'),
      h('p', { style: 'margin:0' }, '1º água tratada, 2º abrigo seco, 3º comida. Um adulto aguenta dias sem comer, mas não sem água limpa.'),
    ),
    ...sections,
    h('div', { class: 'panel' },
      h('h2', {}, 'Regra de ouro'),
      h('ul', { style: 'margin:0' },
        h('li', {}, 'Trate toda água, mesmo a de torneira, depois de enchente ou interrupção.'),
        h('li', {}, 'Na dúvida sobre a comida, descarte.'),
        h('li', {}, 'Não colha planta ou cogumelo que você não conhece com certeza absoluta.'),
        h('li', {}, 'Lave as mãos. É a medida mais barata que salva mais vidas.'),
      ),
    ),
    h('p', { class: 'explain', style: 'margin-top:14px' },
      'Valores de fervura, cloro e soro seguem orientações públicas de tratamento domiciliar de água e reidratação. Em situações reais, siga as instruções da Defesa Civil e do serviço de saúde local.'),
  );

  return { node };
}
