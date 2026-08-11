import { supabaseAdmin } from '../../../lib/supabase';
import { getAuthedProfile, canManageEvents } from '../../../lib/requireAuth';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const profile = await getAuthedProfile(req);
  if (!canManageEvents(profile)) return res.status(403).json({ error: 'Acesso negado' });

  const { event_name, event_type, event_date } = req.body;
  if (!event_name || !event_date) {
    return res.status(400).json({ error: 'event_name e event_date são obrigatórios' });
  }

  const { data, error } = await supabaseAdmin
    .from('events')
    .insert({
      event_name,
      event_type: event_type || 'casamento',
      event_date,
      consultant_id: profile.account_id,
    })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });

  res.status(200).json({ event: data });
}
