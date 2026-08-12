import { supabaseAdmin } from './supabase';

// Lê o token enviado pelo frontend (Authorization: Bearer <token>),
// confirma que é válido e retorna o perfil.
//
// Colaboradores herdam os dados da empresa (plano, assinatura) e
// operam sobre os eventos dela — por isso o perfil devolvido carrega
// `account_id`, que é sempre a empresa dona dos dados. Toda consulta
// de evento deve filtrar por `account_id`, nunca por `id`.
export async function getAuthedProfile(req) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) return null;

  const { data: userData, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !userData?.user) return null;

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', userData.user.id)
    .single();

  if (!profile || !profile.active) return null;

  // Colaborador: puxa plano e assinatura da empresa a que pertence
  if (profile.role === 'collaborator' && profile.parent_id) {
    const { data: parent } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', profile.parent_id)
      .single();
    if (!parent || !parent.active) return null;

    return {
      ...profile,
      account_id: parent.id,
      account_name: parent.full_name,
      plan: parent.plan,
      pattern_type: parent.pattern_type,
      subscription_status: parent.subscription_status,
      trial_ends_at: parent.trial_ends_at,
      asaas_customer_id: parent.asaas_customer_id,
      asaas_subscription_id: parent.asaas_subscription_id,
    };
  }

  return { ...profile, account_id: profile.id, account_name: profile.full_name };
}

// Papéis que podem operar eventos e convidados
export function canManageEvents(profile) {
  return profile && (profile.role === 'consultant' || profile.role === 'collaborator');
}

// Colaborador com can_edit=false só visualiza — nunca cria, edita ou
// apaga evento/convidado. Titular e owner sempre podem editar.
export function canEditEvents(profile) {
  if (!canManageEvents(profile)) return false;
  return profile.role !== 'collaborator' || profile.can_edit !== false;
}

// Só o titular da empresa mexe em assinatura e em equipe
export function isAccountOwner(profile) {
  return profile && profile.role === 'consultant';
}

// Se o colaborador não tiver nenhuma restrição em event_access, ele
// continua vendo todos os eventos da empresa (null = sem restrição).
// Assim que a consultora atribuir ao menos um evento a ele, passa a
// enxergar só os eventos da lista retornada.
export async function getAllowedEventIds(profile) {
  if (!profile || profile.role !== 'collaborator') return null;
  const { data } = await supabaseAdmin.from('event_access').select('event_id').eq('collaborator_id', profile.id);
  if (!data || data.length === 0) return null;
  return data.map((r) => r.event_id);
}

export function isEventAllowed(allowedIds, eventId) {
  return !allowedIds || allowedIds.includes(eventId);
}
