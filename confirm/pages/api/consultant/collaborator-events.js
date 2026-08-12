import { supabaseAdmin } from '../../../lib/supabase';
import { getAuthedProfile, isAccountOwner } from '../../../lib/requireAuth';

// Quais eventos um colaborador específico enxerga. Sem nenhuma linha em
// event_access, o colaborador vê todos os eventos da empresa (padrão).
export default async function handler(req, res) {
  const profile = await getAuthedProfile(req);
  if (!isAccountOwner(profile)) return res.status(403).json({ error: 'Acesso negado' });

  const member_id = req.method === 'GET' ? req.query.member_id : req.body.member_id;
  if (!member_id) return res.status(400).json({ error: 'member_id é obrigatório' });

  const { data: member } = await supabaseAdmin.from('profiles').select('id, parent_id').eq('id', member_id).single();
  if (!member || member.parent_id !== profile.id) return res.status(404).json({ error: 'Colaborador não encontrado' });

  if (req.method === 'GET') {
    const { data: events } = await supabaseAdmin
      .from('events')
      .select('id, event_name, event_date')
      .eq('consultant_id', profile.account_id)
      .order('event_date');
    const { data: access } = await supabaseAdmin.from('event_access').select('event_id').eq('collaborator_id', member_id);
    return res.status(200).json({ events: events || [], assigned: (access || []).map((a) => a.event_id) });
  }

  if (req.method === 'POST') {
    const { event_id } = req.body;
    if (!event_id) return res.status(400).json({ error: 'event_id é obrigatório' });
    const { error } = await supabaseAdmin
      .from('event_access')
      .upsert({ event_id, collaborator_id: member_id }, { onConflict: 'event_id,collaborator_id' });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'DELETE') {
    const { event_id } = req.body;
    if (!event_id) return res.status(400).json({ error: 'event_id é obrigatório' });
    await supabaseAdmin.from('event_access').delete().eq('event_id', event_id).eq('collaborator_id', member_id);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
}
