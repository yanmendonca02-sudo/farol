/* Water, food, shelter and sanitation reference (pt-BR).
 * Based on WHO/CDC household water treatment guidance, Brazilian Civil Defence
 * material and standard wilderness sanitation practice. */

export const SURVIVAL_SECTIONS = [
  {
    id: 'agua',
    title: 'Água',
    icon: 'drop',
    intro: 'Planeje 3 a 4 litros por pessoa por dia (beber e higiene básica). Sem água limpa, doenças aparecem em poucos dias. Trate sempre, mesmo que a água pareça limpa.',
    blocks: [
      {
        type: 'text',
        title: 'Antes de tratar',
        text: 'Deixe a água parar em um recipiente por algumas horas para a terra assentar, ou passe por um pano limpo. Água turva precisa de mais cloro e não funciona bem no sol.',
      },
      {
        type: 'table',
        title: 'Ferver — tempo depois de começar a borbulhar',
        head: ['Altitude', 'Tempo de fervura'],
        rows: [
          ['Até 2.000 m', '1 minuto'],
          ['Acima de 2.000 m', '3 minutos'],
          ['Dúvida sobre a altitude', '3 minutos (não faz mal)'],
        ],
        note: 'Ferver mata vírus, bactérias e parasitas. Não remove veneno, metal pesado nem produto químico. Água com gosto estranho deve ser evitada.',
      },
      {
        type: 'table',
        title: 'Cloro (água sanitária) — para 1 litro de água',
        head: ['Concentração do produto', 'Quantidade por litro', 'Espera'],
        rows: [
          ['2,5% (hipoclorito de sódio)', '4 gotas', '30 minutos'],
          ['4% a 5%', '2 gotas', '30 minutos'],
          ['Água turva', 'dobre a dose e filtre antes', '60 minutos'],
        ],
        note: 'Use apenas água sanitária sem perfume, sem corante e sem detergente. Nunca use “lava roupas” ou produto com alvejante em pó. O cloro não mata o Cryptosporidium (parasita resistente): ferva se puder.',
      },
      {
        type: 'text',
        title: 'Sol (SODIS)',
        text: 'Use garrafa PET transparente, limpa, cheia até o topo com água já filtrada. Deite no sol por no mínimo 6 horas (ou 2 dias seguidos se o céu estiver nublado). Funciona melhor com garrafas de 1 a 2 litros e água não muito turva. Não substitui a fervura em caso de diarreia na comunidade.',
      },
      {
        type: 'list',
        title: 'Filtro improvisado (só melhora a aparência)',
        items: [
          'Garrafa cortada ao meio, virada para baixo, com camadas de pano, areia fina, carvão vegetal triturado e pedras pequenas.',
          'Retira terra, folhas e parte do odor. Não elimina vírus nem bactérias.',
          'Depois de filtrar, sempre ferva ou clore a água.',
          'Troque as camadas quando a água sair turva.',
        ],
      },
      {
        type: 'warn',
        title: 'Sinais de água contaminada',
        text: 'Água barrenta, com cheiro, com partículas, espuma, ou coletada perto de esgoto, fossa, curral ou área de enchente. Água de rio urbano e de canal deve ser tratada como contaminada. Nunca beba água de enchente.',
      },
      {
        type: 'list',
        title: 'Guardar água',
        items: [
          'Use recipiente limpo, com tampa, de preferência próprio para alimento.',
          'Etiquete a data do tratamento. Troque a água guardada a cada 2 semanas.',
          'Não guarde água perto de produtos de limpeza ou combustível.',
          'Retire água com caneca limpa, nunca com a mão.',
        ],
      },
    ],
  },
  {
    id: 'comida',
    title: 'Comida',
    icon: 'sugar',
    intro: 'Sem geladeira, o risco é intoxicação alimentar. Na dúvida, jogue fora: passar fome é menos perigoso que uma infecção.',
    blocks: [
      {
        type: 'list',
        title: 'O que dura sem geladeira',
        items: [
          'Enlatados fechados e sem amassado: 1 a 2 anos, em local seco e fresco.',
          'Arroz, feijão, macarrão, farinha, milho seco: meses, em recipiente fechado e longe de umidade.',
          'Café, açúcar, sal, óleo, leite em pó: vários meses, protegidos de calor e bichos.',
          'Frutas e legumes firmes, mandioca, batata, abóbora: alguns dias a duas semanas em local ventilado e escuro.',
          'Mel, castanhas, biscoitos e barras: vários meses se bem fechados.',
        ],
      },
      {
        type: 'warn',
        title: 'Nunca coma',
        text: 'Lata estufada, amassada na costura ou enferrujada; comida com cheiro estranho, bolor, gosma ou gás ao abrir; carne, leite, ovos ou comida cozida que ficaram horas em temperatura ambiente; qualquer alimento que você não consiga identificar.',
      },
      {
        type: 'list',
        title: 'Cozinhar com segurança',
        items: [
          'Cozinhe bem: carne sem partes rosadas, ovo com clara e gema firmes.',
          'Ferva água de cozimento e lave as mãos antes de manipular comida.',
          'Separe tábua e faca de carne crua dos alimentos prontos.',
          'Coma imediatamente depois de cozinhar. Sobra só é segura se ficar bem refrigerada — sem energia, descarte.',
          'Não use o mesmo pano para mãos, pratos e bancada.',
        ],
      },
      {
        type: 'list',
        title: 'Alimentos de risco no Brasil',
        items: [
          'Mandioca (aipim): sempre cozida ou assada. A mandioca brava crua é tóxica.',
          'Feijão e grãos crus têm substâncias que só o cozimento elimina.',
          'Peixe e frutos do mar estragam rápido no calor: cozinhe e coma no mesmo dia.',
          'Leite cru deve ser fervido antes de beber.',
          'Água de coco aberta estraga em poucas horas fora da geladeira.',
        ],
      },
      {
        type: 'warn',
        title: 'Plantas e cogumelos: cuidado extremo',
        text: 'Não colha planta ou cogumelo que você não conheça com 100% de certeza. Não existe teste caseiro confiável: provar pode matar. Cogumelos silvestres são a causa mais comum de intoxicação fatal por plantas no mundo. Este aplicativo não ensina a identificar plantas comestíveis. Na dúvida, não coma. Prefira alimento industrializado fechado.',
      },
      {
        type: 'list',
        title: 'Guardar comida contra bichos',
        items: [
          'Use potes com tampa de rosca, latas ou sacos bem fechados.',
          'Guarde tudo suspenso em cordas ou caixas, longe do chão e da parede.',
          'Não deixe restos de comida abertos durante a noite.',
          'Proteja sal e açúcar da umidade com um pano seco por cima.',
        ],
      },
    ],
  },
  {
    id: 'abrigo',
    title: 'Abrigo e fogo',
    icon: 'sun',
    intro: 'No Brasil, o maior risco costuma ser chuva, vento e calor, não neve. Abrigo seco e uma muda de roupa seca valem mais que uma fogueira grande.',
    blocks: [
      {
        type: 'list',
        title: 'Escolher o lugar',
        items: [
          'Terreno alto e plano, longe de encosta, rio, córrego seco e boca de enchente.',
          'Longe de árvores com galhos mortos e de coqueiros inclinados.',
          'Perto de água limpa, mas a pelo menos 30 metros e corrente abaixo da área de banho e banheiro.',
          'Protegido do vento predominante: use arbustos, muro ou pedra como quebra-vento.',
          'Areia e chão batido drenam melhor que terra com folhas fundas.',
        ],
      },
      {
        type: 'list',
        title: 'Abrigos simples',
        items: [
          'Lona ou plástico grosso amarrado entre duas árvores, inclinado, com uma ponta mais baixa para a água escorrer.',
          'Teto de galhos e folhas sobre uma estrutura em A. Quanto mais folhas secas em cima, melhor a impermeabilização.',
          'Rede ou cama elevada do chão em região úmida, com mosquiteiro ou pano fino.',
          'Camada de folhas secas ou papelão embaixo do corpo: o chão rouba calor.',
          'Nunca durma em vala, depressão ou leito de rio seco: chove longe e a água desce.',
        ],
      },
      {
        type: 'list',
        title: 'Fogo',
        items: [
          'Três materiais: isca (capim seco, casca fina, algodão), gravetos finos e lenha grossa.',
          'Isca seca é o mais importante. Guarde em saquinho fechado antes da emergência.',
          'Isqueiro e fósforo à prova d’água. Faça fogo pequeno e alimente aos poucos.',
          'Fogueira em círculo de pedras, longe de folhas secas e da barraca. Apague com água e terra ao dormir.',
          'Nunca queime carvão dentro de casa, barraca ou local fechado: o monóxido de carbono mata sem cheiro.',
        ],
      },
      {
        type: 'list',
        title: 'Calor e frio',
        items: [
          'Camadas funcionam melhor que uma roupa grossa. Tire a camada molhada.',
          'Gorro e meias secas aquecem muito. Cabeça e pés perdem calor rápido.',
          'No calor: trabalhe de manhã e no fim da tarde, descanse na sombra entre 11h e 15h, beba água antes da sede.',
          'Roupa clara e solta no calor; escura e seca no frio.',
          'Nunca durma com roupa molhada. Seque ao sol durante o dia.',
        ],
      },
    ],
  },
  {
    id: 'higiene',
    title: 'Higiene e saneamento',
    icon: 'wave',
    intro: 'Depois de uma catástrofe, diarreia e infecção matam mais que o evento. Água limpa, banheiro correto e mãos lavadas previnem a maior parte.',
    blocks: [
      {
        type: 'list',
        title: 'Banheiro de emergência',
        items: [
          'Cave um buraco de 30 a 50 cm, a pelo menos 30 metros de qualquer água e 30 metros do abrigo.',
          'Depois de cada uso, cubra com terra ou cal. Mantenha uma tampa ou tábua.',
          'Tenha um recipiente de água e sabão ao lado, sempre.',
          'Separe o lixo: orgânico enterrado longe da água, plástico e metal guardados.',
          'Não faça necessidades perto de rio, nascente ou poço.',
        ],
      },
      {
        type: 'list',
        title: 'Lavar as mãos',
        items: [
          'Água + sabão por 20 segundos, esfregando dedos, unhas e punhos.',
          'Sem sabão: use cinza de madeira limpa ou areia e bastante água.',
          'Sempre antes de comer, cozinhar e depois do banheiro.',
          'Unhas curtas. Cabelo preso ao cozinhar.',
        ],
      },
      {
        type: 'list',
        title: 'Corpo, roupas e casa',
        items: [
          'Banho com pouca água: molhe, feche, ensaboe, enxágue. Priorize axilas, virilha e pés.',
          'Escove os dentes com água tratada. Não engula a água.',
          'Lave roupa suja de fezes e sangue separada e seque ao sol.',
          'Areje o abrigo e exponha colchões e cobertas ao sol.',
          'Cuidado com água parada: elimine recipientes para evitar mosquito da dengue.',
        ],
      },
      {
        type: 'warn',
        title: 'Sinais de alerta na comunidade',
        text: 'Vários casos de diarreia, vômito ou febre no mesmo local indicam água ou comida contaminada. Pare de usar a fonte, avise todos, ferva toda a água e procure o serviço de saúde.',
      },
    ],
  },
];

export function findSection(id) {
  return SURVIVAL_SECTIONS.find((section) => section.id === id) || null;
}
