/* Map regions available for offline download (bounding boxes in WGS84).
 * These are approximate city/metro extents, not political boundaries. */

export const REGIONS = [
  {
    id: 'rio-cidade',
    name: 'Rio de Janeiro — cidade',
    bbox: [-43.83, -23.10, -43.09, -22.74],
    zooms: [11, 15],
    hint: 'Inclui a maior parte da Zona Sul, Centro, Tijuca e Barra. Bom para uso urbano.',
  },
  {
    id: 'rio-metro',
    name: 'Grande Rio — região metropolitana',
    bbox: [-44.15, -23.15, -42.60, -22.45],
    zooms: [10, 13],
    hint: 'Niterói, São Gonçalo, Duque de Caxias, Nova Iguaçu e arredores. Menos detalhe, área maior.',
  },
  {
    id: 'rio-estado',
    name: 'Estado do Rio de Janeiro',
    bbox: [-44.90, -23.40, -40.90, -20.70],
    zooms: [8, 11],
    hint: 'Visão estadual para deslocamento longo. Não serve para achar ruas.',
  },
  {
    id: 'sao-paulo',
    name: 'São Paulo — cidade',
    bbox: [-46.90, -24.10, -46.25, -23.35],
    zooms: [11, 14],
    hint: 'Cidade inteira com ruas principais. Baixe em partes se o espaço for pequeno.',
  },
  {
    id: 'bh',
    name: 'Belo Horizonte',
    bbox: [-44.10, -20.10, -43.75, -19.75],
    zooms: [11, 14],
    hint: 'Área urbana de BH.',
  },
  {
    id: 'brasilia',
    name: 'Brasília e entorno',
    bbox: [-48.30, -16.10, -47.60, -15.55],
    zooms: [10, 14],
    hint: 'Plano Piloto, cidades satélites próximas e entorno.',
  },
  {
    id: 'salvador',
    name: 'Salvador',
    bbox: [-38.65, -13.10, -38.30, -12.80],
    zooms: [11, 14],
    hint: 'Cidade baixa e alta, orla e centro.',
  },
  {
    id: 'recife',
    name: 'Recife e Olinda',
    bbox: [-35.10, -8.20, -34.80, -7.95],
    zooms: [11, 14],
    hint: 'Recife, Olinda e entorno imediato.',
  },
  {
    id: 'fortaleza',
    name: 'Fortaleza',
    bbox: [-38.70, -3.90, -38.40, -3.65],
    zooms: [11, 14],
    hint: 'Orla, centro e bairros principais.',
  },
  {
    id: 'porto-alegre',
    name: 'Porto Alegre',
    bbox: [-51.35, -30.25, -51.05, -29.95],
    zooms: [11, 14],
    hint: 'Cidade e região próxima.',
  },
  {
    id: 'manaus',
    name: 'Manaus',
    bbox: [-60.20, -3.25, -59.75, -2.95],
    zooms: [10, 13],
    hint: 'Área urbana e rio próximo.',
  },
  {
    id: 'belem',
    name: 'Belém',
    bbox: [-48.65, -1.55, -48.30, -1.30],
    zooms: [11, 14],
    hint: 'Centro, docas e bairros.',
  },
  {
    id: 'curitiba',
    name: 'Curitiba',
    bbox: [-49.45, -25.55, -49.15, -25.30],
    zooms: [11, 14],
    hint: 'Cidade e arredores.',
  },
  {
    id: 'florianopolis',
    name: 'Florianópolis',
    bbox: [-48.65, -27.75, -48.35, -27.45],
    zooms: [11, 14],
    hint: 'Ilha e continente próximo.',
  },
  {
    id: 'goiania',
    name: 'Goiânia',
    bbox: [-49.45, -16.85, -49.15, -16.55],
    zooms: [11, 14],
    hint: 'Setores centrais e entorno.',
  },
];

/* Average tile weight used only for the size estimate on screen. */
export const BYTES_PER_TILE = 22000;

/* OpenStreetMap tile server used only during an explicit download. */
export const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
