/* Radio reference (not a receiver) and a local listening log. */

import { h, toast, fmtDate, confirmDialog, download, AID_ICONS } from '../ui.js';
import { getAll, putOne, deleteOne, uid } from '../store.js';
import { RADIO_INTRO, RADIO_SERVICES, RADIO_HOWTO, RADIO_QCODES, DISTRESS, RADIO_VERIFY_NOTE } from '../data/radio.js';

export async function render() {
  const logs = (await getAll('logs')).sort((a, b) => b.at - a.at);

  const freqInput = h('input', { type: 'text', placeholder: 'Ex.: 146,520 MHz', maxlength: '40', required: true });
  const modeSelect = h('select', {},
    h('option', { value: 'FM' }, 'FM'),
    h('option', { value: 'AM' }, 'AM'),
    h('option', { value: 'USB' }, 'USB'),
    h('option', { value: 'LSB' }, 'LSB'),
    h('option', { value: 'VHF' }, 'VHF'),
    h('option', { value: 'UHF' }, 'UHF'),
    h('option', { value: 'OC' }, 'Ondas curtas'),
  );
  const noteInput = h('textarea', { placeholder: 'O que você ouviu, horário, quem falou…', maxlength: '400' });

  const logList = h('div', { class: 'list' },
    ...(logs.length ? logs.map((entry) => h('div', { class: 'card' },
      h('div', { class: 'row-between' },
        h('div', {},
          h('strong', {}, `${entry.freq} · ${entry.mode}`),
          h('div', { class: 'meta' }, fmtDate(entry.at, { withTime: true })),
          entry.note ? h('p', { class: 'small', style: 'margin:6px 0 0' }, entry.note) : null,
        ),
        h('button', {
          class: 'btn btn-sm btn-ghost', type: 'button', 'aria-label': 'Apagar registro',
          onclick: async () => {
            const ok = await confirmDialog('Apagar este registro de escuta?', { confirmLabel: 'Apagar', danger: true });
            if (!ok) return;
            await deleteOne('logs', entry.id);
            window.dispatchEvent(new HashChangeEvent('hashchange'));
          },
        }, '×'),
      ),
    )) : [h('p', { class: 'explain' }, 'Nenhuma escuta registrada.')]),
  );

  const node = h('div', {},
    h('div', { class: 'page-head' },
      h('h1', {}, 'Rádio — referência'),
      h('p', {}, 'Frequências, procedimentos e um caderno de escuta.'),
    ),

    h('div', { class: 'warn-box', style: 'margin-bottom:14px' },
      h('h3', {}, 'Este celular não é um rádio'),
      h('p', { style: 'margin:0' }, RADIO_INTRO),
    ),

    h('div', { class: 'panel' },
      h('h2', {}, 'Frequências e serviços'),
      h('p', { class: 'explain' }, 'Itens com “confirmar localmente” são referências gerais: confirme antes de depender deles.'),
      h('div', { class: 'table-wrap' },
        h('table', {},
          h('thead', {}, h('tr', {},
            h('th', {}, 'Serviço'), h('th', {}, 'Frequência'), h('th', {}, 'Banda'), h('th', {}, 'Para quê'),
          )),
          h('tbody', {}, ...RADIO_SERVICES.map((service) => h('tr', {},
            h('td', {}, h('strong', {}, service.name), service.verify ? h('div', { class: 'meta', style: 'color:var(--accent)' }, 'confirmar localmente') : null),
            h('td', { class: 'mono' }, service.freq),
            h('td', {}, service.band),
            h('td', {}, service.use),
          ))),
        ),
      ),
    ),

    h('div', { style: 'margin-top:12px' },
      ...RADIO_HOWTO.map((blockData) => h('details', { class: 'accordion', style: 'margin-bottom:8px' },
        h('summary', {}, blockData.title),
        h('div', { class: 'accordion-body' }, h('ul', {}, ...blockData.items.map((item) => h('li', {}, item)))),
      )),
    ),

    h('div', { class: 'panel', style: 'margin-top:12px' },
      h('h2', {}, 'Códigos Q'),
      h('div', { class: 'table-wrap' },
        h('table', {},
          h('thead', {}, h('tr', {}, h('th', {}, 'Código'), h('th', {}, 'Significado'))),
          h('tbody', {}, ...RADIO_QCODES.map(([code, meaning]) => h('tr', {},
            h('td', { class: 'mono' }, code), h('td', {}, meaning),
          ))),
        ),
      ),
    ),

    h('div', { class: 'panel', style: 'margin-top:12px' },
      h('h2', {}, 'Sinais de socorro'),
      ...DISTRESS.map((item) => h('div', { style: 'margin-bottom:10px' },
        h('h3', {}, item.title),
        h('p', { style: 'margin:0' }, item.text),
      )),
    ),

    h('div', { class: 'panel', style: 'margin-top:12px' },
      h('h2', {}, 'Caderno de escuta'),
      h('p', { class: 'explain' }, 'Anote frequência, modo e o que ouviu. Funciona sem internet e ajuda a comparar informações depois.'),
      h('div', { class: 'grid-2' },
        h('label', { class: 'field' }, h('span', {}, 'Frequência'), freqInput),
        h('label', { class: 'field' }, h('span', {}, 'Modo'), modeSelect),
      ),
      h('label', { class: 'field' }, h('span', {}, 'Anotação'), noteInput),
      h('div', { class: 'row' },
        h('button', {
          class: 'btn btn-primary', type: 'button',
          onclick: async () => {
            const freq = freqInput.value.trim();
            if (!freq) { toast('Informe a frequência.', 'err'); return; }
            await putOne('logs', {
              id: uid('log'), freq, mode: modeSelect.value, note: noteInput.value.trim(), at: Date.now(),
            });
            toast('Escuta registrada.', 'ok');
            window.dispatchEvent(new HashChangeEvent('hashchange'));
          },
        }, 'Registrar escuta'),
        h('button', {
          class: 'btn', type: 'button',
          onclick: () => {
            if (!logs.length) { toast('Nada para exportar ainda.'); return; }
            const text = logs.map((entry) => `${fmtDate(entry.at, { withTime: true })} | ${entry.freq} | ${entry.mode} | ${entry.note || ''}`).join('\n');
            download(`farol-escuta-${new Date().toISOString().slice(0, 10)}.txt`, `${text}\n`, 'text/plain');
          },
        }, 'Exportar .txt'),
      ),
      h('div', { style: 'margin-top:12px' }, logList),
    ),

    h('p', { class: 'explain', style: 'margin-top:14px' }, RADIO_VERIFY_NOTE),
  );

  return { node };
}
