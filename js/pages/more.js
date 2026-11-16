/* "More": every section not in the tab bar, plus limitations and about. */

import { h } from '../ui.js';

const LINKS = [
  ['#/agua', '◍', 'Água, comida e abrigo', 'Tratamento de água, conservação de comida, fogo e higiene.'],
  ['#/comunicacao', '≋', 'Comunicação sem internet', 'QR code, som entre aparelhos e Wi-Fi local.'],
  ['#/radio', '⌁', 'Rádio — referência', 'Frequências, como achar notícias, registro de escuta.'],
  ['#/familia', '☎', 'Família e ficha médica', 'Contatos, sangue, alergias, remédios e QR.'],
  ['#/ajustes', '⚙', 'Ajustes', 'Tema, texto grande, voz, PIN, dados e mapa.'],
  ['#/ferramentas', '⚒', 'Ferramentas', 'Lanterna, bússola, nível, sol e lua, conversores, listas.'],
];

const LIMITS = [
  ['iOS (Safari)', [
    'Web Bluetooth não existe: não há troca de mensagens por Bluetooth.',
    'A lanterna não pode ser ligada pelo site; use a tela branca.',
    'O Safari pode apagar os dados do site após alguns dias sem uso. Abra o app de vez em quando e use "Adicionar à Tela de Início".',
    'GPS em segundo plano para de funcionar quando a tela apaga.',
    'A bússola precisa de permissão e pode ser imprecisa perto de metal.',
    'Ler QR pela câmera pode não funcionar; o app tenta de todo jeito e aceita código digitado.',
  ]],
  ['Android (Chrome)', [
    'A lanterna funciona em muitos aparelhos, mas não em todos.',
    'Web Bluetooth existe no Chrome, mas este app não o utiliza.',
    'O sistema pode encerrar o app em segundo plano para economizar bateria.',
    'GPS continua com o app aberto; com a tela apagada, pode parar.',
    'Alguns fabricantes limitam o armazenamento do site mesmo com pedido de persistência.',
  ]],
  ['Os dois', [
    'Nenhum celular comum recebe rádio AM/FM/ondas curtas sem hardware e app específicos. Este app não finge ser um rádio.',
    'O mapa só mostra as áreas baixadas. Fora delas, aparece "sem mapa".',
    'O som entre aparelhos (ggwave) alcança poucos metros e depende do alto-falante e do microfone.',
    'A conexão por Wi-Fi local (WebRTC) exige os dois aparelhos na mesma rede ou hotspot e troca manual de códigos.',
    'Não há mapa de trânsito, clima, notícias ou atualização em tempo real.',
    'Criptografia com PIN protege contatos e anotações. Não é um cofre militar: quem tiver o aparelho desbloqueado e o PIN consegue abrir.',
  ]],
];

export async function render() {
  const node = h('div', {},
    h('div', { class: 'page-head' }, h('h1', {}, 'Mais'), h('p', {}, 'Tudo o que não cabe na barra de baixo.')),

    h('div', { class: 'list' }, ...LINKS.map(([href, glyph, title, desc]) => h('a', { class: 'card card-link', href },
      h('span', { class: 'row', style: 'gap:12px; flex-wrap:nowrap' },
        h('span', { class: 'tile-ico', 'aria-hidden': 'true' }, glyph),
        h('span', {}, h('strong', { style: 'display:block' }, title), h('span', { class: 'meta' }, desc)),
      ),
      h('span', { 'aria-hidden': 'true', class: 'muted' }, '›'),
    ))),

    h('h2', { style: 'margin:20px 0 8px' }, 'Limitações — o que não funciona offline'),
    h('p', { class: 'explain' }, 'Esta lista é honesta de propósito. Prometer o que o navegador não faz colocaria você em risco.'),
    ...LIMITS.map(([title, items]) => h('details', { class: 'accordion', style: 'margin-bottom:8px' },
      h('summary', {}, title),
      h('div', { class: 'accordion-body' }, h('ul', { class: 'small' }, ...items.map((item) => h('li', {}, item)))),
    )),

    h('h2', { style: 'margin:20px 0 8px' }, 'Instalar no celular'),
    h('div', { class: 'panel' },
      h('h3', {}, 'iPhone (Safari)'),
      h('ol', { class: 'small' },
        h('li', {}, 'Abra este endereço no Safari.'),
        h('li', {}, 'Toque no botão Compartilhar (quadrado com flecha).'),
        h('li', {}, 'Escolha “Adicionar à Tela de Início” e confirme.'),
      ),
      h('h3', { style: 'margin-top:12px' }, 'Android (Chrome)'),
      h('ol', { class: 'small' },
        h('li', {}, 'Abra este endereço no Chrome.'),
        h('li', {}, 'Toque no menu de três pontos.'),
        h('li', {}, 'Escolha “Instalar aplicativo” ou “Adicionar à tela inicial”.'),
      ),
      h('p', { class: 'explain' }, 'Depois de instalar, abra uma vez com internet e baixe o mapa. A partir daí, funciona em modo avião.'),
    ),

    h('div', { class: 'panel panel-flat', style: 'margin-top:16px' },
      h('h2', {}, 'Sobre'),
      h('p', { class: 'small muted' }, 'Farol é um aplicativo livre, sem contas, sem anúncios, sem análise de uso e sem nenhuma chamada de rede depois do download.'),
      h('p', { class: 'small muted' }, 'Código aberto para uso comunitário. Mapas © colaboradores do OpenStreetMap (ODbL). ggwave (MIT), Leaflet (BSD-2), qrcode-generator (MIT), jsQR (Apache-2.0).'),
      h('p', { class: 'small muted', style: 'margin:0' }, 'Versão 1.0 · Conteúdo médico baseado em orientações públicas de primeiros socorros. Em emergência, procure o SAMU 192.'),
    ),
  );

  return { node };
}
