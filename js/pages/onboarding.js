/* First-run explanation, shown once and stored in settings. */

import { modal, h } from '../ui.js';

export function showOnboarding(onAccept) {
  const body = h('div', { class: 'stack' },
    h('p', {}, 'Este é um aplicativo de emergência. Ele foi feito para funcionar quando tudo o mais parar.'),
    h('ul', {},
      h('li', {}, h('strong', {}, 'Funciona sem internet. '), 'Depois do primeiro acesso com internet, todas as telas, guias e ferramentas abrem em modo avião.'),
      h('li', {}, h('strong', {}, 'O mapa precisa ser baixado antes. '), 'Escolha sua cidade em Mapa e baixe os quadros enquanto houver conexão.'),
      h('li', {}, h('strong', {}, 'Seus dados ficam só neste aparelho. '), 'Sem conta, sem nuvem, sem rastreamento. Se limpar os dados do navegador, as informações são apagadas.'),
      h('li', {}, h('strong', {}, 'Não substitui atendimento médico. '), 'Os guias seguem orientações gerais de primeiros socorros. Procure o serviço de saúde sempre que possível.'),
    ),
    h('div', { class: 'warn-box' }, h('h3', {}, 'Antes do apagão'),
      h('p', {}, 'Baixe o mapa, imprima a lista de preparação e carregue o celular e um carregador portátil. A lista completa está em Ferramentas → Listas.')),
    h('p', { class: 'explain' }, 'Ao continuar, o aplicativo pede ao navegador para guardar os dados de forma permanente, reduzindo o risco de o sistema apagar tudo por falta de espaço.'),
  );

  modal({
    title: 'Bem-vindo ao Farol',
    body,
    dismissible: false,
    actions: [{ label: 'Entendi, começar', variant: 'btn-primary', onClick: () => { onAccept?.(); } }],
  });
}
