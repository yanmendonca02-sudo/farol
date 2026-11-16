/* First aid list, search and guide detail. */

import { h, AID_ICONS, speak, stopSpeaking, toast } from '../ui.js';
import { FIRST_AID, EMERGENCY_NUMBERS, findAid } from '../data/firstaid.js';

function guideCard(guide) {
  return h('a', { class: 'card aid-card', href: `#/socorro/${guide.id}` },
    h('span', { class: 'aid-ico', 'aria-hidden': 'true', html: AID_ICONS[guide.icon] || AID_ICONS.bandage }),
    h('span', {},
      h('h3', {}, guide.title),
      h('p', {}, guide.short),
    ),
    h('span', { 'aria-hidden': 'true', class: 'muted' }, '›'),
  );
}

export async function render({ params }) {
  const id = params?.[0];

  if (id) {
    const guide = findAid(id);
    if (!guide) {
      return {
        node: h('div', { class: 'panel' },
          h('h1', {}, 'Guia não encontrado'),
          h('a', { class: 'btn btn-primary', href: '#/socorro' }, 'Ver todos os guias')),
      };
    }

    const stepEls = guide.steps.map((step, index) => h('div', { class: 'step' },
      h('div', { class: 'step-num', 'aria-hidden': 'true' }, index + 1),
      h('div', {},
        h('h3', {}, step.title),
        h('p', {}, step.text),
        step.icon && AID_ICONS[step.icon]
          ? h('div', { class: 'step-svg', 'aria-hidden': 'true', html: AID_ICONS[step.icon] })
          : null,
        h('button', {
          class: 'btn btn-sm btn-ghost', type: 'button', style: 'margin-top:8px',
          onclick: () => {
            const ok = speak(`${step.title}. ${step.text}`);
            if (!ok) toast('Voz não disponível neste navegador.', 'err');
          },
          'aria-label': `Ouvir o passo ${index + 1}`,
        }, '🔊 Ouvir'),
      ),
    ));

    const node = h('div', {},
      h('div', { class: 'page-head' },
        h('a', { class: 'meta', href: '#/socorro', style: 'text-decoration:none' }, '‹ Todos os guias'),
        h('h1', { style: 'margin-top:6px' }, guide.title),
        h('p', {}, guide.short),
      ),
      h('div', { class: 'row', style: 'margin-bottom:12px' },
        h('a', { class: 'btn btn-danger btn-lg', href: `#/emergencia/${guide.id}`, style: 'flex:1.2' }, 'Emergência'),
        h('button', {
          class: 'btn btn-lg', type: 'button',
          onclick: () => {
            const text = [guide.title, guide.summary, ...guide.steps.map((step, index) => `Passo ${index + 1}: ${step.title}. ${step.text}`)].join('. ');
            if (!speak(text)) toast('Voz não disponível neste navegador.', 'err');
          },
        }, '🔊 Ouvir'),
      ),
      guide.urgent ? h('div', { class: 'warn-box', style: 'margin-bottom:12px' },
        h('h3', {}, 'Risco de vida'),
        h('p', { style: 'margin:0' }, 'Chame ajuda assim que possível: SAMU 192, Bombeiros 193. Enquanto isso, siga os passos.'),
      ) : null,
      h('p', { style: 'margin-bottom:14px' }, guide.summary),
      h('div', { class: 'stack' }, ...stepEls),
      guide.donts?.length ? h('div', { class: 'warn-box', style: 'margin-top:14px' },
        h('h3', {}, 'Não faça'),
        h('ul', { style: 'margin:0' }, ...guide.donts.map((item) => h('li', {}, item))),
      ) : null,
      guide.note ? h('div', { class: 'danger-list', style: 'margin-top:12px' },
        h('h3', {}, 'Observação'),
        h('p', { style: 'margin:0' }, guide.note),
      ) : null,
      h('p', { class: 'explain', style: 'margin-top:14px' },
        'Este guia é orientação geral e não substitui treinamento nem atendimento profissional. Se houver dúvida, ligue 192.'),
    );

    return {
      node,
      cleanup: () => stopSpeaking(),
    };
  }

  const search = h('input', { type: 'search', placeholder: 'Buscar: sangramento, queimadura, cobra…', 'aria-label': 'Buscar guia de primeiros socorros', style: 'margin-bottom:10px' });
  const list = h('div', { class: 'aid-list', id: 'aid-list' }, ...FIRST_AID.map(guideCard));

  search.addEventListener('input', () => {
    const query = search.value.trim().toLowerCase();
    const visible = FIRST_AID.filter((guide) => !query
      || guide.title.toLowerCase().includes(query)
      || guide.short.toLowerCase().includes(query)
      || guide.summary.toLowerCase().includes(query));
    list.replaceChildren(...(visible.length ? visible.map(guideCard) : [h('p', { class: 'explain' }, 'Nada encontrado. Tente outra palavra ou ligue 192.')]));
  });

  const node = h('div', {},
    h('div', { class: 'page-head' },
      h('h1', {}, 'Primeiros socorros'),
      h('p', {}, '16 guias passo a passo, em português, sem internet.'),
    ),
    h('a', { class: 'btn btn-danger btn-xl btn-block', href: '#/emergencia', style: 'margin-bottom:12px' }, '⚠ MODO EMERGÊNCIA'),
    h('div', { class: 'panel', style: 'margin-bottom:12px' },
      h('h2', {}, 'Números de emergência'),
      h('div', { class: 'grid-3' },
        ...EMERGENCY_NUMBERS.filter((item) => item.number.length === 3).map((item) => h('a', {
          class: 'btn', href: `tel:${item.number}`, style: 'flex-direction:column; min-height:64px',
        }, h('strong', { style: 'font-size:1.3rem' }, item.number), h('span', { class: 'small muted' }, item.service))),
      ),
      h('p', { class: 'explain', style: 'margin:8px 0 0' }, 'Toque para ligar. Sem sinal de celular, a ligação de emergência pode funcionar em outra operadora. CIATox: 0800 722 6001 (intoxicações).'),
    ),
    search,
    list,
    h('p', { class: 'explain', style: 'margin-top:16px' },
      'Conteúdo baseado em orientações públicas de suporte básico de vida e primeiros socorros. Não substitui treinamento prático nem atendimento médico.'),
  );

  return { node, cleanup: () => stopSpeaking() };
}
