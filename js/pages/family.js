/* Family plan, medical cards, meeting points and QR export. */

import { h, toast, modal, confirmDialog, download, speak } from '../ui.js';
import { getAll, putOne, deleteOne, uid, secureList, securePut, kvGet, kvSet, vaultUnlocked, getPinRecord } from '../store.js';
import { qrDataUrl, QR_MAX_CHARS } from '../lib/qr.js';

const BLOOD_TYPES = ['', 'A+', 'A−', 'B+', 'B−', 'AB+', 'AB−', 'O+', 'O−'];

function personCardText(person) {
  return [
    person.name,
    person.relation ? `Vínculo: ${person.relation}` : '',
    person.blood ? `Sangue: ${person.blood}` : '',
    person.allergies ? `Alergias: ${person.allergies}` : '',
    person.meds ? `Remédios: ${person.meds}` : '',
    person.conditions ? `Condições: ${person.conditions}` : '',
    person.phone ? `Telefone: ${person.phone}` : '',
    person.birth ? `Nascimento: ${person.birth}` : '',
  ].filter(Boolean).join('\n');
}

function planText(plan) {
  return [
    'PLANO DA FAMÍLIA — FAROL',
    plan.meeting1 ? `Encontro 1: ${plan.meeting1}` : '',
    plan.meeting2 ? `Encontro 2: ${plan.meeting2}` : '',
    plan.contactName ? `Contato fora da cidade: ${plan.contactName} ${plan.contactPhone || ''}` : '',
    plan.notes ? `Observações: ${plan.notes}` : '',
  ].filter(Boolean).join('\n');
}

export async function render() {
  const [plan, peopleRaw, waypoints, pinRecord] = await Promise.all([
    kvGet('family-plan', {}),
    secureList('contacts'),
    getAll('waypoints'),
    getPinRecord(),
  ]);
  let planData = plan || {};
  const locked = Boolean(pinRecord) && !vaultUnlocked();
  const people = (peopleRaw || []).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  const meetingPoints = waypoints.filter((point) => point.type === 'encontro');

  const cardFor = (person) => {
    const text = personCardText(person);
    const canQR = text.length <= QR_MAX_CHARS;
    return h('div', { class: 'panel', style: 'margin-bottom:10px' },
      h('div', { class: 'row-between' },
        h('div', {},
          h('h3', { style: 'margin:0' }, person.name),
          h('div', { class: 'meta' }, [person.relation, person.blood ? `sangue ${person.blood}` : ''].filter(Boolean).join(' · ') || 'Ficha médica'),
        ),
        h('div', { class: 'row', style: 'gap:4px' },
          h('button', { class: 'btn btn-sm', type: 'button', onclick: () => showCard(person) }, 'Cartão'),
          h('button', { class: 'btn btn-sm btn-ghost', type: 'button', onclick: () => personDialog(person) }, 'Editar'),
          h('button', {
            class: 'btn btn-sm btn-ghost', type: 'button', 'aria-label': `Apagar ${person.name}`,
            onclick: async () => {
              const ok = await confirmDialog(`Apagar a ficha de ${person.name}?`, { confirmLabel: 'Apagar', danger: true });
              if (!ok) return;
              await deleteOne('contacts', person.id);
              rerender();
            },
          }, '×'),
        ),
      ),
      h('dl', { class: 'kv', style: 'margin-top:10px' },
        person.allergies ? h('dt', {}, 'Alergias') : null, person.allergies ? h('dd', {}, person.allergies) : null,
        person.meds ? h('dt', {}, 'Remédios') : null, person.meds ? h('dd', {}, person.meds) : null,
        person.conditions ? h('dt', {}, 'Condições') : null, person.conditions ? h('dd', {}, person.conditions) : null,
        person.phone ? h('dt', {}, 'Telefone') : null, person.phone ? h('dd', {}, h('a', { href: `tel:${person.phone}` }, person.phone)) : null,
      ),
      !canQR ? h('p', { class: 'explain', style: 'margin:8px 0 0' }, 'Ficha longa: o cartão em QR fica simplificado.') : null,
    );
  };

  function showCard(person) {
    const text = personCardText(person);
    const shortText = text.split('\n').slice(0, 6).join('\n').slice(0, QR_MAX_CHARS - 20);
    modal({
      title: `Cartão de ${person.name}`,
      body: h('div', {},
        h('div', { class: 'qr-box' }, (() => {
          try { return h('img', { src: qrDataUrl(shortText), alt: 'QR com a ficha médica' }); } catch { return h('p', {}, 'QR indisponível.'); }
        })()),
        h('pre', { class: 'mono', style: 'white-space:pre-wrap; margin-top:12px' }, text),
        h('p', { class: 'explain' }, 'Mostre esta tela para quem for atender. Funciona sem internet.'),
      ),
      actions: [
        { label: 'Fechar' },
        { label: 'Ouvir', onClick: () => { speak(text); return true; } },
        { label: 'Baixar .txt', variant: 'btn-primary', onClick: () => download(`${person.name.replace(/\s+/g, '-').toLowerCase()}-ficha.txt`, text, 'text/plain') },
      ],
    });
  }

  function personDialog(existing = null) {
    const fields = {};
    const field = (key, label, props = {}) => {
      const input = h('input', { type: 'text', value: existing?.[key] || '', ...props });
      fields[key] = input;
      return h('label', { class: 'field' }, h('span', {}, label), input);
    };
    const blood = h('select', {}, ...BLOOD_TYPES.map((type) => h('option', { value: type, selected: (existing?.blood || '') === type }, type || 'Não sei')));
    const allergies = h('textarea', { maxlength: '300' }, existing?.allergies || '');
    const meds = h('textarea', { maxlength: '300' }, existing?.meds || '');
    const conditions = h('textarea', { maxlength: '300' }, existing?.conditions || '');

    modal({
      title: existing ? 'Editar ficha' : 'Nova pessoa',
      body: h('div', {},
        field('name', 'Nome', { maxlength: '60', required: true }),
        field('relation', 'Vínculo', { maxlength: '40', placeholder: 'mãe, filho, vizinho…' }),
        h('div', { class: 'grid-2' },
          field('birth', 'Nascimento', { maxlength: '10', placeholder: 'dd/mm/aaaa' }),
          h('label', { class: 'field' }, h('span', {}, 'Tipo sanguíneo'), blood),
        ),
        field('phone', 'Telefone', { maxlength: '30', inputmode: 'tel' }),
        h('label', { class: 'field' }, h('span', {}, 'Alergias'), allergies),
        h('label', { class: 'field' }, h('span', {}, 'Remédios de uso contínuo'), meds),
        h('label', { class: 'field' }, h('span', {}, 'Condições de saúde'), conditions),
        h('p', { class: 'explain' }, pinRecord && vaultUnlocked()
          ? 'Estes dados ficam criptografados neste aparelho com a chave do seu PIN.'
          : 'Estes dados ficam salvos neste aparelho, sem criptografia. Ative um PIN em Ajustes.'),
      ),
      actions: [
        { label: 'Cancelar' },
        {
          label: 'Salvar', variant: 'btn-primary',
          onClick: () => {
            const name = fields.name.value.trim();
            if (!name) { toast('Informe o nome.', 'err'); return true; }
            securePut('contacts', {
              id: existing?.id || uid('person'),
              name,
              relation: fields.relation.value.trim(),
              birth: fields.birth.value.trim(),
              phone: fields.phone.value.trim(),
              blood: blood.value,
              allergies: allergies.value.trim(),
              meds: meds.value.trim(),
              conditions: conditions.value.trim(),
              updatedAt: Date.now(),
            }).then(() => { toast('Ficha salva.', 'ok'); rerender(); })
              .catch((error) => toast(`Não foi possível salvar: ${error.message}`, 'err'));
          },
        },
      ],
    });
  }

  function planDialog() {
    const fields = {};
    const field = (key, label, placeholder, multiline = false) => {
      const input = multiline
        ? h('textarea', { maxlength: '400', placeholder }, planData[key] || '')
        : h('input', { type: 'text', maxlength: '80', placeholder, value: planData[key] || '' });
      fields[key] = input;
      return h('label', { class: 'field' }, h('span', {}, label), input);
    };
    modal({
      title: 'Plano da família',
      body: h('div', {},
        field('meeting1', 'Ponto de encontro perto de casa', 'Ex.: portaria do prédio, praça da igreja'),
        field('meeting2', 'Ponto de encontro fora do bairro', 'Ex.: casa da tia no bairro X'),
        field('contactName', 'Contato fora da cidade (nome)', 'Nome de quem talvez tenha sinal'),
        field('contactPhone', 'Telefone desse contato', '+55…'),
        field('notes', 'Combinações', 'Quem busca as crianças, quem cuida dos idosos, remédios…', true),
      ),
      actions: [
        { label: 'Cancelar' },
        {
          label: 'Salvar', variant: 'btn-primary',
          onClick: async () => {
            planData = Object.fromEntries(Object.entries(fields).map(([key, input]) => [key, input.value.trim()]));
            await kvSet('family-plan', planData);
            toast('Plano salvo.', 'ok');
            rerender();
          },
        },
      ],
    });
  }

  const hasPlan = Boolean(planData.meeting1 || planData.meeting2 || planData.contactName || planData.notes);
  const plannedQR = (() => {
    if (!hasPlan) return null;
    const text = planText(planData).slice(0, QR_MAX_CHARS - 10);
    try { return qrDataUrl(text); } catch { return null; }
  })();

  const node = h('div', {},
    h('div', { class: 'page-head' },
      h('h1', {}, 'Família e ficha médica'),
      h('p', {}, locked
        ? 'O cofre está bloqueado: as fichas ficam visíveis depois de desbloquear com o PIN.'
        : 'Quem é quem, o que cada um tem e onde se encontrar.'),
    ),

    locked ? h('div', { class: 'warn-box', style: 'margin-bottom:12px' },
      h('h3', {}, 'Cofre bloqueado'),
      h('p', { style: 'margin:0' }, 'Toque no botão de bloqueio na barra de cima e digite o PIN para ver as fichas.'),
    ) : null,

    h('div', { class: 'panel', style: 'margin-bottom:12px' },
      h('div', { class: 'row-between' },
        h('h2', { style: 'margin:0' }, 'Plano da família'),
        h('button', { class: 'btn btn-sm', type: 'button', onclick: planDialog }, 'Editar'),
      ),
      planData.meeting1 || planData.meeting2 || planData.contactName
        ? h('dl', { class: 'kv', style: 'margin-top:10px' },
          planData.meeting1 ? h('dt', {}, 'Encontro 1') : null, planData.meeting1 ? h('dd', {}, planData.meeting1) : null,
          planData.meeting2 ? h('dt', {}, 'Encontro 2') : null, planData.meeting2 ? h('dd', {}, planData.meeting2) : null,
          planData.contactName ? h('dt', {}, 'Contato externo') : null,
          planData.contactName ? h('dd', {}, `${planData.contactName}${planData.contactPhone ? ` · ${planData.contactPhone}` : ''}`) : null,
          planData.notes ? h('dt', {}, 'Combinações') : null, planData.notes ? h('dd', {}, planData.notes) : null,
        )
        : h('p', { class: 'explain', style: 'margin:10px 0 0' }, 'Ainda em branco. Combine dois pontos de encontro e uma pessoa de fora da cidade.'),
      plannedQR ? h('div', { class: 'row', style: 'margin-top:12px' },
        h('img', { src: plannedQR, alt: 'QR do plano da família', style: 'width:120px;height:120px;background:#fff;border-radius:8px;padding:4px' }),
        h('div', {},
          h('p', { class: 'small', style: 'margin:0' }, 'Este QR guarda o plano combinado. Imprima ou mostre para a família.'),
          h('button', {
            class: 'btn btn-sm', type: 'button', style: 'margin-top:6px',
            onclick: () => window.print(),
          }, 'Imprimir'),
        ),
      ) : null,
    ),

    h('div', { class: 'row-between', style: 'margin-bottom:8px' },
      h('h2', { style: 'margin:0' }, 'Fichas'),
      h('button', { class: 'btn btn-sm btn-primary', type: 'button', onclick: () => personDialog() }, '+ Pessoa'),
    ),
    people.length ? h('div', {}, ...people.map(cardFor)) : h('div', { class: 'panel' }, h('p', { class: 'explain', style: 'margin:0' }, 'Nenhuma ficha ainda. Cadastre cada pessoa da casa com sangue, alergias e remédios.')),

    meetingPoints.length ? h('div', { class: 'panel', style: 'margin-top:12px' },
      h('h2', {}, 'Pontos de encontro no mapa'),
      h('ul', { style: 'margin:0' },
        ...meetingPoints.map((point) => h('li', {},
          h('a', { href: '#/mapa' }, point.name), ` — ${point.lat.toFixed(5)}, ${point.lon.toFixed(5)}`,
        )),
      ),
      h('p', { class: 'explain', style: 'margin:8px 0 0' }, 'Para navegar até um ponto, abra o Mapa e use “Ir”. Salve novos pontos como tipo “Ponto de encontro”.'),
    ) : null,

    h('div', { class: 'panel', style: 'margin-top:12px' },
      h('h2', {}, 'Cartões impressos'),
      h('p', { class: 'small muted' }, 'Papel não descarrega. Imprima as fichas e o plano e guarde na mochila de emergência.'),
      h('button', {
        class: 'btn', type: 'button',
        onclick: () => {
          const text = [
            planText(planData),
            '',
            ...people.map((person) => `${personCardText(person)}\n---`),
          ].join('\n');
          download('farol-fichas-familia.txt', text, 'text/plain');
        },
      }, 'Baixar todas as fichas (.txt)'),
    ),

    h('p', { class: 'explain', style: 'margin-top:14px' },
      'Dados de saúde são sensíveis. Com PIN ativo, as fichas são criptografadas no aparelho (AES-GCM). Sem PIN, qualquer pessoa com o celular desbloqueado pode ler.'),
  );

  function rerender() { window.dispatchEvent(new HashChangeEvent('hashchange')); }

  return { node };
}
