/* Offline radio reference for Brazil + logging helpers (pt-BR).
 * Frequencies are public reference values. Regulations and local channels
 * change: always mark what must be verified with local authorities. */

export const RADIO_INTRO =
  'Este aplicativo NÃO é um rádio. Um celular comum não recebe AM, FM ou ondas curtas sem internet, a não ser que o aparelho tenha chip FM e um aplicativo que use esse chip — o que a maioria dos iPhones não tem. O que está aqui é uma referência para usar um rádio de verdade.';

export const RADIO_SERVICES = [
  {
    name: 'SAMU',
    freq: '192 (telefone)',
    band: 'Telefone',
    use: 'Emergência médica. Use qualquer telefone fixo ou celular com sinal.',
    verify: false,
  },
  {
    name: 'Bombeiros',
    freq: '193 (telefone)',
    band: 'Telefone',
    use: 'Incêndio, resgate, afogamento.',
    verify: false,
  },
  {
    name: 'Defesa Civil',
    freq: '199 (telefone)',
    band: 'Telefone',
    use: 'Alagamento, deslizamento, abrigo e alertas.',
    verify: false,
  },
  {
    name: 'Emergência aeronáutica',
    freq: '121,500 MHz (AM)',
    band: 'VHF aéreo',
    use: 'Frequência internacional de emergência e socorro. Monitorada por aviões e torres.',
    verify: true,
  },
  {
    name: 'Marinha — chamada e socorro',
    freq: '156,800 MHz (FM) — canal 16',
    band: 'VHF marítimo',
    use: 'Canal internacional de chamada e socorro no mar. Use apenas em emergência real.',
    verify: true,
  },
  {
    name: 'Faixa cidadãos — CB 27 MHz',
    freq: '26,965 a 27,405 MHz (AM/FM)',
    band: 'HF CB',
    use: 'Rádio cidadão. No Brasil, o uso e o registro devem seguir a regulamentação da Anatel. Confirme localmente.',
    verify: true,
  },
  {
    name: 'Radioamador — 2 metros',
    freq: '144–148 MHz (FM)',
    band: 'VHF amador',
    use: 'Chamada frequente em simplex: 146,520 MHz. Precisa de licença de radioamador (COER) para transmitir.',
    verify: true,
  },
  {
    name: 'Radioamador — 70 centímetros',
    freq: '430–440 MHz (FM)',
    band: 'UHF amador',
    use: 'Simplex comum: 446,000 MHz. Repetidoras locais têm deslocamento e tom próprios. Precisa de licença.',
    verify: true,
  },
  {
    name: 'Ondas curtas — notícias',
    freq: '3 a 30 MHz',
    band: 'HF',
    use: 'Rádios de ondas curtas recebem emissoras distantes, inclusive internacionais. Melhor à noite, com antena longa e esticada.',
    verify: true,
  },
  {
    name: 'Rádio FM comunitária',
    freq: '87,5 a 108 MHz',
    band: 'FM',
    use: 'Em apagão, emissoras locais costumam voltar ao ar antes da internet. Procure estações de notícia e defesa civil.',
    verify: true,
  },
  {
    name: 'Rádio AM',
    freq: '530 a 1.710 kHz',
    band: 'AM',
    use: 'Alcance maior que FM em desastres. Ruído alto é normal. Antena interna ou externa melhora muito.',
    verify: true,
  },
];

export const RADIO_HOWTO = [
  {
    title: 'Rádio a pilha ou de manivela',
    icon: 'shock',
    items: [
      'Prefira aparelhos que funcionam com pilhas comuns (AA/AAA), fáceis de estocar.',
      'Manivela: gire por 1 a 2 minutos para cada 10 a 20 minutos de escuta.',
      'Estique a antena ao máximo e encoste o aparelho perto da janela ou do lado de fora.',
      'Ondas curtas: à noite o alcance melhora. Gire a antena para achar o sinal.',
      'Anote as estações que funcionam no seu bairro antes da emergência.',
    ],
  },
  {
    title: 'Encontrar notícias',
    icon: 'eye',
    items: [
      'Comece pelo FM local: emissoras comerciais e comunitárias.',
      'Em AM, procure estações de notícia e programas de serviço público.',
      'Ondas curtas: emissoras internacionais em português costumam ter boletins de notícias.',
      'Ouça nas horas cheias (a cada hora) para boletins.',
      'Anote horários e frequências que funcionaram. Repasse para os vizinhos.',
    ],
  },
  {
    title: 'Procedimento básico de radioamador',
    icon: 'wave',
    items: [
      'Escute antes de falar. Se a frequência estiver em uso, espere.',
      'Chamada: “Aqui é [seu indicativo ou nome], chamando e escutando.”',
      'Fale devagar, claro, com a boca perto do microfone. Use frases curtas.',
      'Ao terminar, diga “câmbio” e espere a resposta. No fim da conversa, “câmbio final”.',
      'Nunca transmita sem licença fora de emergência real com risco à vida.',
      'Em emergência, diga primeiro: “EMERGÊNCIA, EMERGÊNCIA” e o problema.',
    ],
  },
  {
    title: 'Alfabeto fonético',
    icon: 'bandage',
    items: [
      'A Alfa · B Bravo · C Charlie · D Delta · E Echo · F Foxtrot',
      'G Golf · H Hotel · I India · J Juliet · K Kilo · L Lima',
      'M Mike · N November · O Oscar · P Papa · Q Quebec · R Romeo',
      'S Sierra · T Tango · U Uniform · V Victor · W Whiskey',
      'X X-ray · Y Yankee · Z Zulu',
      'Use para soletrar nomes e locais. Exemplo: “R de Romeo, I de India, O de Oscar”.',
    ],
  },
];

export const RADIO_QCODES = [
  ['QRA', 'Nome ou identificação da estação'],
  ['QRG', 'Frequência exata'],
  ['QRK', 'Qualidade do sinal (1 a 5)'],
  ['QRL', 'Estou ocupado / frequência em uso'],
  ['QRM', 'Interferência de outras estações'],
  ['QRN', 'Ruído estático / atmosférico'],
  ['QRO', 'Aumente a potência'],
  ['QRP', 'Diminua a potência'],
  ['QRT', 'Encerrar a transmissão'],
  ['QRV', 'Estou pronto'],
  ['QRX', 'Aguarde / chame de novo em instantes'],
  ['QRZ', 'Quem me chamou?'],
  ['QSL', 'Confirmado / entendido'],
  ['QSO', 'Contato entre estações'],
  ['QTH', 'Localização'],
  ['QTR', 'Hora exata'],
];

export const DISTRESS = [
  {
    title: 'SOS — código Morse',
    text: 'Três curtos, três longos, três curtos: ··· ––– ···. Repita com pausas. É reconhecido internacionalmente e pode ser feito com lanterna, espelho, apito ou batidas.',
  },
  {
    title: 'Três de tudo',
    text: 'Três apitos, três assobios, três tiros ou três luzes, com pausa entre os grupos. Qualquer sinal repetido três vezes é sinal internacional de socorro.',
  },
  {
    title: 'Apito e espelho',
    text: 'Um apito alcança mais que a voz e gasta menos energia. Espelho ou tela brilhante refletindo o sol pode ser visto a quilômetros por aviões.',
  },
  {
    title: 'Formato no chão',
    text: 'Um X grande, um V ou uma seta feita com pedras, galhos ou roupa indica presença. Um triângulo significa “necessito de socorro”.',
  },
];

export const RADIO_VERIFY_NOTE =
  'Frequências, canais e regras mudam e variam por região. Confirme com a Defesa Civil, a Marinha, a Aeronáutica ou a Anatel antes de depender de qualquer frequência. Transmitir sem autorização é ilegal, exceto em emergência com risco à vida, e mesmo assim apenas na frequência apropriada.';
