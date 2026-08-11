// Os dois padrões de negócio que a plataforma suporta. "lista_confirmacao"
// está 100% funcional hoje. "agendamento_individual" ainda não tem a
// funcionalidade de calendário construída — está aqui só para já capturar
// a intenção de quem se cadastra.
export const PATTERN_TYPES = {
  lista_confirmacao: {
    label: 'Lista de confirmação',
    tagline: 'Um evento, uma lista de convidados confirmando presença',
    description:
      'Você cadastra um evento (casamento, formatura, festa) e uma lista de ' +
      'convidados. A plataforma dispara o convite pra todo mundo, envia ' +
      'lembretes automáticos pra quem não respondeu, e você acompanha as ' +
      'confirmações em tempo real — sem trocar mensagem uma por uma.',
    examples: 'Consultoria de casamento, buffet, salão de festas, formaturas',
    status: 'available',
    recommendedPlan: 'pro',
  },
  agendamento_individual: {
    label: 'Agendamento individual',
    tagline: 'Um cliente por horário, em uma agenda recorrente',
    description:
      'Cada cliente marca um horário específico com você (corte de cabelo, ' +
      'consulta, sessão). A plataforma confirma o agendamento e envia ' +
      'lembretes automáticos antes do horário marcado.',
    examples: 'Barbearia, salão de beleza, clínicas, consultórios',
    status: 'coming_soon',
    recommendedPlan: 'normal',
  },
};
