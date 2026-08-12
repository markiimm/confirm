import { supabaseAdmin } from '../../../lib/supabase';
import { getAuthedProfile } from '../../../lib/requireAuth';

export default async function handler(req, res) {
  const profile = await getAuthedProfile(req);
  if (!profile || profile.role !== 'owner') return res.status(403).json({ error: 'Acesso negado' });

  const { data, error } = await supabaseAdmin
    .from('audit_log')
    .select('*, profiles!audit_log_actor_id_fkey(full_name, email)')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) return res.status(500).json({ error: error.message });

  const entries = (data || []).map((e) => ({
    id: e.id,
    action: e.action,
    target_id: e.target_id,
    details: e.details,
    created_at: e.created_at,
    actor_name: e.profiles?.full_name || 'Desconhecido',
    actor_email: e.profiles?.email,
  }));

  res.status(200).json({ entries });
}
