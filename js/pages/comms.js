/* Offline communication: local message log, QR exchange, sound modem (ggwave)
 * and direct Wi-Fi (WebRTC with manual signalling). */

import {
  h, toast, modal, confirmDialog, fmtDate, clear,
} from '../ui.js';
import { getAll, putOne, deleteOne, uid } from '../store.js';
import { qrDataUrl, startScanner, QR_MAX_CHARS, scannerAvailable, nativeDetectorAvailable } from '../lib/qr.js';
import { playText, startListening, stopListening, modemSupported } from '../lib/modem.js';

const QUICK = [
  'Estou bem.',
  'Preciso de água.',
  'Preciso de comida.',
  'Preciso de ajuda médica.',
  'Estou no ponto de encontro.',
  'Não consigo chegar. Vou para o segundo ponto.',
  'Todos aqui estão bem.',
];

function parseWaypoint(text) {
  const match = /^FAROL:PONTO\|([^|]{1,60})\|(-?\d+(?:[.,]\d+)?)\|(-?\d+(?:[.,]\d+)?)\|?([a-z]*)$/i.exec(text.trim());
  if (!match) return null;
  const lat = Number(match[2].replace(',', '.'));
  const lon = Number(match[3].replace(',', '.'));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { name: match[1], lat, lon, type: match[4] || 'outro' };
}

function waypointMessage(name, lat, lon, type = 'encontro') {
  return `FAROL:PONTO|${name}|${lat.toFixed(5)}|${lon.toFixed(5)}|${type}`;
}

export async function render() {
  const messages = (await getAll('comms')).sort((a, b) => b.at - a.at);
  let pc = null;
  let dataChannel = null;
  let scannerStop = null;
  let listening = false;

  const status = (text, kind = '') => {
    const element = document.getElementById('comms-status');
    if (!element) return;
    element.textContent = text;
    element.className = `small ${kind === 'err' ? 'error' : 'muted'}`;
  };

  async function addMessage(text, dir, via) {
    if (!text) return;
    await putOne('comms', { id: uid('msg'), text, dir, via, at: Date.now() });
    paintLog();
    await offerWaypoint(text);
  }

  async function offerWaypoint(text) {
    const point = parseWaypoint(text);
    if (!point) return;
    const ok = await confirmDialog(`Salvar o ponto “${point.name}” no mapa?`, { title: 'Ponto recebido', confirmLabel: 'Salvar ponto' });
    if (!ok) return;
    await putOne('waypoints', { id: uid('wp'), ...point, note: 'Recebido por mensagem', createdAt: Date.now() });
    toast('Ponto salvo no mapa.', 'ok');
  }

  const logHost = h('div', { class: 'list' });
  async function paintLog() {
    const list = (await getAll('comms')).sort((a, b) => b.at - a.at).slice(0, 60);
    logHost.replaceChildren(...(list.length ? list.map((message) => h('div', { class: 'card' },
      h('div', { class: 'row-between' },
        h('span', { class: 'tag info' }, `${message.dir === 'out' ? 'Enviada' : 'Recebida'} · ${message.via}`),
        h('div', { class: 'row', style: 'gap:4px' },
          h('span', { class: 'meta' }, fmtDate(message.at, { withTime: true })),
          h('button', {
            class: 'btn btn-sm btn-ghost', type: 'button', 'aria-label': 'Apagar mensagem',
            onclick: async () => { await deleteOne('comms', message.id); paintLog(); },
          }, '×'),
        ),
      ),
      h('p', { style: 'white-space:pre-wrap; margin:8px 0 0' }, message.text),
    )) : [h('p', { class: 'explain' }, 'Nenhuma mensagem ainda.')]));
  }
  paintLog();

  /* ---------- QR ---------- */
  const qrText = h('textarea', { maxlength: String(QR_MAX_CHARS), placeholder: 'Escreva uma mensagem curta ou cole um ponto recebido…' });
  const qrTarget = h('div', { class: 'qr-box', hidden: true });
  const qrError = h('p', { class: 'explain' }, `Até ${QR_MAX_CHARS} caracteres. O QR funciona sem câmera: quem recebe pode digitar o texto.`);

  function generateQR() {
    const text = qrText.value.trim();
    if (!text) { toast('Escreva algo primeiro.', 'err'); return; }
    try {
      qrTarget.replaceChildren(h('img', { src: qrDataUrl(text), alt: 'QR code com a mensagem' }));
      qrTarget.hidden = false;
      qrError.textContent = 'Mostre esta tela para a outra pessoa ler com a câmera. Aumente o brilho.';
    } catch (error) {
      qrError.textContent = error.message;
      qrTarget.hidden = true;
    }
  }

  const video = h('video', { class: 'qr-reader', playsinline: true, muted: true });
  const scanHost = h('div', { hidden: true }, video,
    h('p', { class: 'explain' }, nativeDetectorAvailable() ? 'Leitor nativo do navegador ativo.' : 'Usando leitor interno (jsQR). Segure firme a uns 20 cm.'),
  );

  async function beginScan() {
    scanHost.hidden = false;
    scannerStop = await startScanner(video, async (text) => {
      stopScan();
      qrText.value = text;
      await addMessage(text, 'in', 'QR');
      toast('QR lido.', 'ok');
    }, (message) => { status(message, 'err'); stopScan(); });
  }

  function stopScan() {
    try { scannerStop?.(); } catch { /* ignore */ }
    scannerStop = null;
    scanHost.hidden = true;
  }

  const qrPanel = h('div', { class: 'panel', style: 'margin-bottom:12px' },
    h('h2', {}, 'Por QR code'),
    h('div', { class: 'pill-row', style: 'margin-bottom:8px' },
      ...QUICK.slice(0, 4).map((phrase) => h('button', {
        class: 'btn btn-sm', type: 'button',
        onclick: () => { qrText.value = phrase; },
      }, phrase.replace(/\.$/, ''))),
    ),
    h('label', { class: 'field' }, h('span', {}, 'Mensagem'), qrText),
    h('div', { class: 'row' },
      h('button', { class: 'btn btn-primary', type: 'button', onclick: generateQR }, 'Gerar QR'),
      h('button', {
        class: 'btn', type: 'button',
        onclick: async () => {
          const pointText = qrText.value.trim();
          if (!pointText) { toast('Escreva ou gere um ponto primeiro.', 'err'); return; }
          if (scannerStop) { stopScan(); return; }
          if (!scannerAvailable()) { toast('Câmera indisponível. Digite o texto.', 'err'); return; }
          await beginScan();
        },
      }, 'Ler com a câmera'),
      h('button', {
        class: 'btn', type: 'button',
        onclick: async () => {
          const text = qrText.value.trim();
          if (!text) { toast('Nada para salvar.', 'err'); return; }
          await addMessage(text, 'out', 'QR');
          generateQR();
        },
      }, 'Registrar como enviada'),
    ),
    qrTarget,
    scanHost,
    qrError,
  );

  /* ---------- sound ---------- */
  const soundText = h('textarea', { maxlength: '60', placeholder: 'Até 60 caracteres. Ex.: SOS água praça' });
  const soundStatus = h('p', { class: 'explain' }, modemSupported()
    ? 'O som transporta poucos caracteres por vez. Fique em local silencioso e a menos de 3 metros.'
    : 'Biblioteca de som não carregou. Use QR code.');

  const soundPanel = h('div', { class: 'panel', style: 'margin-bottom:12px' },
    h('h2', {}, 'Por som (sem nenhuma conexão)'),
    h('p', { class: 'small muted' }, 'Um aparelho transmite, o outro escuta. Não precisa de Wi-Fi, Bluetooth, dados ou chip.'),
    h('label', { class: 'field' }, h('span', {}, 'Mensagem curta'), soundText),
    h('div', { class: 'pill-row', style: 'margin-bottom:8px' },
      ...QUICK.slice(0, 3).map((phrase) => h('button', {
        class: 'btn btn-sm', type: 'button',
        onclick: () => { soundText.value = phrase.slice(0, 60); },
      }, phrase.replace(/\.$/, ''))),
    ),
    h('div', { class: 'row' },
      h('button', {
        class: 'btn btn-primary', type: 'button',
        onclick: async (event) => {
          const text = soundText.value.trim();
          if (!text) { toast('Escreva algo curto primeiro.', 'err'); return; }
          event.currentTarget.disabled = true;
          try {
            const { seconds } = await playText(text.toUpperCase(), {
              onDone: () => { soundStatus.textContent = 'Transmissão concluída. Confirme o recebimento.'; },
            });
            soundStatus.textContent = `Transmitindo por ${seconds.toFixed(1).replace('.', ',')} s. Aumente o volume.`;
            await addMessage(text, 'out', 'som');
          } catch (error) {
            soundStatus.textContent = error.message || 'Não foi possível transmitir.';
          } finally {
            event.currentTarget.disabled = false;
          }
        },
      }, 'Transmitir por som'),
      h('button', {
        class: 'btn', type: 'button',
        onclick: async (event) => {
          if (listening) {
            stopListening();
            listening = false;
            event.currentTarget.textContent = 'Escutar';
            soundStatus.textContent = 'Escuta encerrada.';
            return;
          }
          try {
            await startListening({
              onText: async (text) => {
                soundStatus.textContent = `Recebido: ${text}`;
                await addMessage(text, 'in', 'som');
              },
              onStatus: (text) => { soundStatus.textContent = text; },
            });
            listening = true;
            event.currentTarget.textContent = 'Parar escuta';
          } catch (error) {
            soundStatus.textContent = error.message || 'Não foi possível abrir o microfone.';
          }
        },
      }, 'Escutar'),
    ),
    soundStatus,
    h('p', { class: 'explain' }, 'Limitações reais: alcance de poucos metros, precisa de alto-falante e microfone livres, e a outra pessoa precisa estar com o app aberto escutando. Em local barulhento pode falhar.'),
  );

  /* ---------- WebRTC ---------- */
  const rtcStatus = h('p', { class: 'small muted', id: 'comms-status' }, 'Desconectado.');
  const inviteField = h('textarea', { placeholder: 'Cole aqui o convite (oferta) ou a resposta recebida…', rows: '4' });
  const output = h('textarea', { readonly: true, rows: '4', placeholder: 'O código para enviar à outra pessoa aparece aqui…' });
  const chatInput = h('input', { type: 'text', maxlength: '500', placeholder: 'Mensagem para o outro aparelho…' });

  const CONFIG = { iceServers: [] };

  function attachChannel(channel) {
    dataChannel = channel;
    channel.onopen = () => { rtcStatus.textContent = 'Conectado por Wi-Fi local. Sem internet.'; };
    channel.onclose = () => { rtcStatus.textContent = 'Conexão encerrada.'; };
    channel.onmessage = async (event) => {
      await addMessage(String(event.data), 'in', 'Wi-Fi');
    };
  }

  function newPeer() {
    if (pc) { try { pc.close(); } catch { /* ignore */ } }
    pc = new RTCPeerConnection(CONFIG);
    pc.onconnectionstatechange = () => {
      if (!pc) return;
      const state = pc.connectionState;
      if (state === 'failed') rtcStatus.textContent = 'Falhou. Os dois aparelhos precisam estar na mesma rede/hotspot.';
      if (state === 'disconnected') rtcStatus.textContent = 'Conexão instável.';
    };
    pc.ondatachannel = (event) => attachChannel(event.channel);
    return pc;
  }

  function waitForIce(connection) {
    return new Promise((resolve) => {
      if (connection.iceGatheringState === 'complete') { resolve(); return; }
      const done = () => {
        connection.removeEventListener('icegatheringstatechange', check);
        resolve();
      };
      const check = () => { if (connection.iceGatheringState === 'complete') done(); };
      connection.addEventListener('icegatheringstatechange', check);
      setTimeout(done, 4000);
    });
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      toast('Código copiado.', 'ok');
    } catch {
      output.select();
      toast('Copie manualmente: o texto está selecionado.');
    }
  }

  const rtcPanel = h('div', { class: 'panel', style: 'margin-bottom:12px' },
    h('h2', {}, 'Por Wi-Fi local (WebRTC)'),
    h('p', { class: 'small muted' }, 'Os dois aparelhos na mesma rede Wi-Fi ou no mesmo hotspot, sem internet. A troca de códigos é manual, porque não existe servidor.'),
    rtcStatus,
    h('div', { class: 'row', style: 'margin:10px 0' },
      h('button', {
        class: 'btn btn-primary', type: 'button',
        onclick: async () => {
          if (!window.RTCPeerConnection) { toast('Este navegador não tem WebRTC.', 'err'); return; }
          try {
            const connection = newPeer();
            attachChannel(connection.createDataChannel('farol'));
            const offer = await connection.createOffer();
            await connection.setLocalDescription(offer);
            await waitForIce(connection);
            output.value = JSON.stringify(connection.localDescription);
            rtcStatus.textContent = 'Convite gerado. Envie este código para a outra pessoa e cole a resposta dela abaixo.';
          } catch (error) {
            rtcStatus.textContent = `Erro ao criar convite: ${error.message}`;
          }
        },
      }, '1. Criar convite'),
      h('button', {
        class: 'btn', type: 'button',
        onclick: async () => {
          if (!pc) { toast('Crie um convite primeiro.', 'err'); return; }
          try {
            await pc.setRemoteDescription(JSON.parse(inviteField.value.trim()));
            rtcStatus.textContent = 'Resposta aceita. Aguardando conexão…';
          } catch (error) {
            rtcStatus.textContent = `Resposta inválida: ${error.message}`;
          }
        },
      }, '3. Conectar'),
    ),
    h('label', { class: 'field' }, h('span', {}, 'Código para enviar'), output),
    h('div', { class: 'row', style: 'margin-bottom:10px' },
      h('button', { class: 'btn btn-sm', type: 'button', onclick: () => copyText(output.value) }, 'Copiar código'),
      h('button', {
        class: 'btn btn-sm btn-ghost', type: 'button',
        onclick: () => {
          if (!output.value) { toast('Nada para mostrar.', 'err'); return; }
          try {
            modal({
              title: 'Convite em QR',
              body: h('div', { class: 'qr-box' }, h('img', { src: qrDataUrl(output.value, { ecc: 'L' }), alt: 'QR com o convite' })),
            });
          } catch {
            toast('Código grande demais para QR. Use copiar e colar.', 'err');
          }
        },
      }, 'Mostrar em QR'),
    ),
    h('label', { class: 'field' }, h('span', {}, 'Colar convite ou resposta'), inviteField),
    h('div', { class: 'row', style: 'margin-bottom:8px' },
      h('button', {
        class: 'btn', type: 'button',
        onclick: async () => {
          if (!window.RTCPeerConnection) { toast('Este navegador não tem WebRTC.', 'err'); return; }
          const raw = inviteField.value.trim();
          if (!raw) { toast('Cole o convite recebido.', 'err'); return; }
          try {
            const connection = newPeer();
            await connection.setRemoteDescription(JSON.parse(raw));
            const answer = await connection.createAnswer();
            await connection.setLocalDescription(answer);
            await waitForIce(connection);
            output.value = JSON.stringify(connection.localDescription);
            rtcStatus.textContent = 'Resposta gerada. Envie este código de volta para quem criou o convite.';
          } catch (error) {
            rtcStatus.textContent = `Convite inválido: ${error.message}`;
          }
        },
      }, '2. Aceitar convite e gerar resposta'),
      h('button', {
        class: 'btn btn-ghost', type: 'button',
        onclick: () => {
          try { pc?.close(); } catch { /* ignore */ }
          pc = null;
          dataChannel = null;
          rtcStatus.textContent = 'Desconectado.';
          output.value = '';
        },
      }, 'Desconectar'),
    ),
    h('div', { class: 'row' },
      chatInput,
      h('button', {
        class: 'btn btn-primary', type: 'button',
        onclick: async () => {
          const text = chatInput.value.trim();
          if (!text) return;
          if (!dataChannel || dataChannel.readyState !== 'open') {
            toast('Sem conexão aberta ainda. Faça os passos 1, 2 e 3.', 'err');
            return;
          }
          dataChannel.send(text);
          await addMessage(text, 'out', 'Wi-Fi');
          chatInput.value = '';
        },
      }, 'Enviar'),
    ),
    h('p', { class: 'explain', style: 'margin-top:8px' }, 'Funciona entre Android e iPhone na mesma rede. Pode falhar em redes corporativas ou com isolamento de clientes (rede de hotel, Wi-Fi público). Nesses casos, ative o hotspot de um dos aparelhos.'),
  );

  /* ---------- send waypoint quickly ---------- */
  const waypointPicker = h('select', {},
    h('option', { value: '' }, 'Escolher ponto salvo…'),
  );
  getAll('waypoints').then((points) => {
    for (const point of points) {
      waypointPicker.append(h('option', { value: point.id }, `${point.name} (${point.type})`));
    }
  });
  waypointPicker.addEventListener('change', () => {
    getAll('waypoints').then((points) => {
      const point = points.find((item) => item.id === waypointPicker.value);
      if (!point) return;
      qrText.value = waypointMessage(point.name, point.lat, point.lon, point.type);
      generateQR();
      toast('Ponto carregado no QR. Mostre para a outra pessoa.');
    });
  });

  const node = h('div', {},
    h('div', { class: 'page-head' },
      h('h1', {}, 'Comunicação sem internet'),
      h('p', {}, 'Três caminhos que funcionam em modo avião: QR, som e Wi-Fi local.'),
    ),

    h('div', { class: 'panel', style: 'margin-bottom:12px' },
      h('h2', {}, 'Enviar um ponto do mapa'),
      waypointPicker,
      h('p', { class: 'explain', style: 'margin:8px 0 0' }, 'Gera um QR com nome e coordenadas. Quem receber pode salvar o ponto no mapa do Farol.'),
    ),

    qrPanel,
    soundPanel,
    rtcPanel,

    h('div', { class: 'panel' },
      h('div', { class: 'row-between' },
        h('h2', { style: 'margin:0' }, 'Histórico'),
        h('button', {
          class: 'btn btn-sm btn-ghost', type: 'button',
          onclick: async () => {
            const ok = await confirmDialog('Apagar todo o histórico de mensagens?', { confirmLabel: 'Apagar', danger: true });
            if (!ok) return;
            for (const message of await getAll('comms')) await deleteOne('comms', message.id);
            paintLog();
          },
        }, 'Limpar'),
      ),
      h('div', { style: 'margin-top:10px' }, logHost),
    ),

    h('p', { class: 'explain', style: 'margin-top:14px' },
      'Nenhuma dessas opções usa internet. Elas têm alcance curto e não substituem rádio ou telefone. Combinem antes um ponto de encontro: pode ser mais confiável que qualquer mensagem.'),
  );

  const cleanup = () => {
    stopScan();
    stopListening();
    listening = false;
    try { dataChannel?.close(); } catch { /* ignore */ }
    try { pc?.close(); } catch { /* ignore */ }
    pc = null;
  };

  return { node, cleanup };
}
