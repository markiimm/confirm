// Catálogo central dos tipos de negócio suportados no padrão "lista de
// confirmação". Adicionar um novo tipo aqui é o único lugar que precisa
// mudar para oferecer suporte a um novo segmento.

export const EVENT_TYPES = {
  casamento: {
    label: 'Casamento',
    inviteTemplate: (guestName, eventName, dateStr) =>
      `Olá, ${guestName}! Você foi convidado(a) para o ${eventName}. ` +
      `Será uma grande alegria contar com sua presença neste dia tão especial, em ${dateStr}. ` +
      `Para confirmar, responda apenas com SIM ou NÃO.`,
  },
  festa: {
    label: 'Festa / evento social',
    inviteTemplate: (guestName, eventName, dateStr) =>
      `Olá, ${guestName}! Você está convidado(a) para: ${eventName}, no dia ${dateStr}. ` +
      `Para confirmar sua presença, responda apenas com SIM ou NÃO.`,
  },
  formatura: {
    label: 'Formatura',
    inviteTemplate: (guestName, eventName, dateStr) =>
      `Olá, ${guestName}! Você foi convidado(a) para a cerimônia de ${eventName}, ` +
      `que acontecerá em ${dateStr}. Para confirmar presença, responda SIM ou NÃO.`,
  },
  outro: {
    label: 'Outro tipo de evento',
    inviteTemplate: (guestName, eventName, dateStr) =>
      `Olá, ${guestName}! Você foi convidado(a) para: ${eventName}, em ${dateStr}. ` +
      `Para confirmar sua presença, responda apenas com SIM ou NÃO.`,
  },
};

export function buildInviteMessage(event, guestName) {
  const dateStr = new Date(event.event_date).toLocaleDateString('pt-BR');

  if (event.invite_message_template) {
    return event.invite_message_template
      .replaceAll('{{convidado}}', guestName)
      .replaceAll('{{evento}}', event.event_name)
      .replaceAll('{{data}}', dateStr);
  }

  const type = EVENT_TYPES[event.event_type] || EVENT_TYPES.outro;
  return type.inviteTemplate(guestName, event.event_name, dateStr);
}
