/* Settings: appearance, voice, PIN vault, data, map cleanup, install. */

import { h, toast, modal, confirmDialog, speechAvailable, speak, fmtBytes } from '../ui.js';
import {
  saveSettings, getPinRecord, setPin, removePin, vaultUnlocked,
  storageInfo, requestPersistence, clearStore, getSettings,
} from '../store.js';
import { getRegions, deleteRegion, countDownloadedTiles } from '../lib/tiles.js';

async function pinDialog({ title, message, confirmLabel, danger = false }) {
  return new Promise((resolve) => {
    const input = h('input', {
      type: 'password', inputmode: 'numeric', pattern: '[0-9]*', maxlength: '8',
      autocomplete: 'off', placeholder: '4 a 8 números',
    });
    let settled = false;
    modal({
      title,
      body: h('div', {}, h('p', {}, message), h('label', { class: 'field' }, h('span', {}, 'PIN'), input)),
      actions: [
        { label: 'Cancelar', onClick: () => { settled = true; resolve(null); } },
        {
          label: confirmLabel,
          variant: danger ? 'btn-danger' : 'btn-primary',
          onClick: () => {
            const value = input.value.trim();
            if (!/^\d{4,8}$/.test(value)) {
              toast('O PIN precisa ter de 4 a 8 números.', 'err');
              return true;
            }
            settled = true;
            resolve(value);
          },
        },
      ],
      onClose: () => { if (!settled) resolve(null); },
    });
  });
}

export async function render({ settings }) {
  const [storage, tiles, regions, pinRecord] = await Promise.all([
    storageInfo(), countDownloadedTiles(), getRegions(), getPinRecord(),
  ]);
  const current = settings || await getSettings();

  const themeRadio = (value, label) => h('label', { class: 'check' },
    h('input', {
      type: 'radio', name: 'theme', value, checked: current.theme === value,
      onchange: async () => { await saveSettings({ theme: value }); toast('Tema alterado'); },
    }),
    h('span', {}, label),
  );

  const fontRadio = (value, label, sample) => h('label', { class: 'check' },
    h('input', {
      type: 'radio', name: 'font', value, checked: (current.font || 'normal') === value,
      onchange: async () => { await saveSettings({ font: value }); toast('Tamanho do texto alterado'); },
    }),
    h('span', {}, label, h('span', { class: 'meta', style: 'display:block' }, sample)),
  );

  const storageCard = h('div', { class: 'panel' },
    h('h2', {}, 'Dados neste aparelho'),
    h('p', { class: 'small muted' }, storage.supported
      ? `Usando ${fmtBytes(storage.usage)} de ${fmtBytes(storage.quota)} disponíveis.`
      : 'O navegador não informa o espaço usado.'),
    h('p', { class: 'small' }, storage.persisted
      ? '✓ Armazenamento permanente concedido. O sistema deve manter os dados.'
      : 'O armazenamento pode ser apagado pelo sistema se faltar espaço. Toque abaixo para pedir proteção.'),
    h('p', { class: 'explain' }, 'Por que isso importa: no iPhone e no Android, o navegador pode apagar dados de sites para liberar espaço, principalmente após dias sem uso. Com a permissão de armazenamento permanente, o risco cai muito.'),
    h('div', { class: 'row' },
      h('button', {
        class: 'btn btn-sm', type: 'button',
        onclick: async () => {
          const result = await requestPersistence();
          toast(result.persisted ? 'Proteção de dados concedida.' : 'O navegador não concedeu a proteção. Instale o app na tela inicial e tente de novo.', result.persisted ? 'ok' : 'err');
        },
      }, 'Pedir armazenamento permanente'),
    ),
  );

  const mapCard = h('div', { class: 'panel' },
    h('h2', {}, 'Mapa offline'),
    h('p', { class: 'small muted' }, `${tiles} quadros guardados em ${regions.length} área(s).`),
    ...(regions.length ? regions.map((region) => h('div', { class: 'row-between', style: 'border-top:1px solid var(--rule); padding:8px 0' },
      h('div', {}, h('strong', { class: 'small' }, region.name),
        h('div', { class: 'meta' }, `${region.done || 0}/${region.planned || 0} quadros · ${region.completed ? 'completo' : 'incompleto'}`)),
      h('button', {
        class: 'btn btn-sm btn-ghost', type: 'button',
        onclick: async (event) => {
          const ok = await confirmDialog(`Apagar os quadros de “${region.name}”? Os pontos salvos não são apagados.`, { confirmLabel: 'Apagar', danger: true });
          if (!ok) return;
          event.target.disabled = true;
          const removed = await deleteRegion(region.id);
          toast(`${removed} quadros removidos.`);
          event.target.closest('.row-between')?.remove();
        },
      }, 'Apagar'),
    )) : [h('p', { class: 'explain' }, 'Nenhuma área baixada. Vá em Mapa para baixar.')]),
    h('p', { class: 'explain' }, 'Baixe o mapa apenas com internet e bateria. Os quadros ficam guardados para sempre neste aparelho.'),
  );

  const node = h('div', {},
    h('div', { class: 'page-head' }, h('h1', {}, 'Ajustes'), h('p', {}, 'Tudo fica salvo neste aparelho e vale mesmo sem internet.')),

    h('div', { class: 'panel' },
      h('h2', {}, 'Aparência'),
      h('h3', { class: 'small muted' }, 'Tema'),
      themeRadio('dark', 'Escuro (economiza bateria em tela OLED)'),
      themeRadio('light', 'Claro (melhor no sol)'),
      h('h3', { class: 'small muted', style: 'margin-top:12px' }, 'Tamanho do texto'),
      fontRadio('normal', 'Normal', 'Texto padrão'),
      fontRadio('grande', 'Grande', 'Letras maiores em todo o app'),
      fontRadio('gigante', 'Gigante', 'Para ler a distância, com uma mão'),
      h('label', { class: 'check', style: 'margin-top:10px' },
        h('input', {
          type: 'checkbox', checked: current.reduceMotion,
          onchange: async (event) => { await saveSettings({ reduceMotion: event.target.checked }); },
        }),
        h('span', {}, 'Reduzir animações', h('span', { class: 'meta', style: 'display:block' }, 'Recomendado para economizar bateria.')),
      ),
    ),

    h('div', { class: 'panel', style: 'margin-top:12px' },
      h('h2', {}, 'Voz'),
      h('label', { class: 'check' },
        h('input', {
          type: 'checkbox', checked: current.tts,
          onchange: async (event) => { await saveSettings({ tts: event.target.checked }); },
        }),
        h('span', {}, 'Ler os passos em voz alta', h('span', { class: 'meta', style: 'display:block' }, speechAvailable() ? 'Usa a voz do próprio aparelho, sem internet.' : 'Este navegador não tem voz disponível.')),
      ),
      h('button', {
        class: 'btn btn-sm', type: 'button',
        onclick: () => {
          if (!speechAvailable()) { toast('Voz não disponível neste navegador.', 'err'); return; }
          speak('Esta é a voz do Farol. Bombeiros: 193. Samu: 192.', { stop: true });
        },
      }, 'Testar voz'),
    ),

    h('div', { class: 'panel', style: 'margin-top:12px' },
      h('h2', {}, 'Bússola'),
      h('label', { class: 'field' },
        h('span', {}, 'Declinação magnética da sua região (graus)'),
        h('input', {
          type: 'number', step: '0.5', min: '-30', max: '30', value: String(current.declination ?? 0),
          onchange: async (event) => {
            const value = Number(event.target.value) || 0;
            await saveSettings({ declination: value });
            toast('Declinação salva.');
          },
        }),
      ),
      h('p', { class: 'explain' }, 'O celular aponta o norte magnético. No Brasil a diferença para o norte verdadeiro (declinação) fica entre cerca de −20° e +5°, variando por cidade. Se não souber o valor, deixe 0 e use a bússola como referência relativa. Mapas oficiais e a Defesa Civil informam o valor local.'),
    ),

    h('div', { class: 'panel', style: 'margin-top:12px' },
      h('h2', {}, 'Privacidade e PIN'),
      h('p', { class: 'small muted' }, pinRecord
        ? 'O PIN está ativo. Contatos e anotações ficam criptografados com AES-GCM e a chave é derivada do seu PIN (PBKDF2).'
        : 'Sem PIN, os contatos e anotações ficam legíveis para quem abrir o aparelho. Com PIN, eles são criptografados no aparelho.'),
      h('div', { class: 'row' },
        pinRecord
          ? h('button', {
            class: 'btn btn-sm btn-ghost', type: 'button',
            onclick: async () => {
              const pin = await pinDialog({ title: 'Remover PIN', message: 'Digite o PIN atual para remover a criptografia.', confirmLabel: 'Remover', danger: true });
              if (!pin) return;
              const ok = await removePin(pin);
              toast(ok ? 'PIN removido. Os dados ficaram sem criptografia.' : 'PIN incorreto.', ok ? 'ok' : 'err');
              if (ok) document.querySelector('[data-reload]')?.click();
            },
          }, 'Remover PIN')
          : h('button', {
            class: 'btn btn-sm', type: 'button',
            onclick: async () => {
              const pin = await pinDialog({ title: 'Criar PIN', message: 'Escolha de 4 a 8 números. Se esquecer, não há como recuperar os contatos e anotações criptografados.', confirmLabel: 'Ativar PIN' });
              if (!pin) return;
              try {
                await setPin(pin);
                toast('PIN ativado e dados criptografados.', 'ok');
              } catch (error) {
                toast(`Não foi possível ativar: ${error.message}`, 'err');
              }
            },
          }, 'Ativar PIN'),
        h('button', {
          class: 'btn btn-sm', type: 'button', 'data-reload': '1',
          onclick: () => { window.location.reload(); },
        }, 'Atualizar'),
        h('a', { class: 'btn btn-sm btn-ghost', href: '#/ajustes' }, 'Ver agora'),
      ),
      h('p', { class: 'explain' }, vaultUnlocked() ? 'Cofre aberto nesta sessão.' : 'Cofre fechado.'),
    ),

    storageCard,
    h('div', { style: 'margin-top:12px' }, mapCard),

    h('div', { class: 'panel', style: 'margin-top:12px' },
      h('h2', {}, 'Apagar tudo'),
      h('p', { class: 'small muted' }, 'Remove pontos, trilhas, anotações, contatos, listas, recursos e o mapa baixado deste aparelho. Não pode ser desfeito.'),
      h('button', {
        class: 'btn btn-danger btn-sm', type: 'button',
        onclick: async () => {
          const ok = await confirmDialog('Apagar todos os dados do Farol neste aparelho?', { confirmLabel: 'Apagar tudo', danger: true });
          if (!ok) return;
          for (const name of ['waypoints', 'trails', 'notes', 'checklists', 'resources', 'contacts', 'logs', 'comms', 'tiles', 'kv']) {
            try { await clearStore(name); } catch { /* ignore */ }
          }
          toast('Dados apagados. Recarregando…');
          setTimeout(() => window.location.reload(), 800);
        },
      }, 'Apagar dados do app'),
    ),

    h('p', { class: 'explain', style: 'margin-top:16px' },
      'Sem contas, sem análise de uso e sem chamadas de rede depois do download. O único acesso à internet acontece quando você manda baixar mapas.'),
  );

  return { node };
}
