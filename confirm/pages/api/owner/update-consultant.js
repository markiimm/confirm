import { supabaseAdmin } from '../../../lib/supabase';
import { getAuthedProfile } from '../../../lib/requireAuth';

export default async function handler(req, res) {
  if (req.method !== 'PATCH') return res.status(405).end();

  const profile = await getAuthedProfile(req);
  if (!profile || profile.role !== 'owner') return res.status(403).json({ error: 'Acesso negado' });

  const { consultant_id, active, plan } = req.body;
  if (!consultant_id) return res.status(400).json({ error: 'consultant_id é obrigatório' });

  const updates = {};
  if (typeof active === 'boolean') updates.active = active;
  if (plan) updates.plan = plan;

  const { error } = await supabaseAdmin.from('profiles').update(updates).eq('id', consultant_id);
  if (error) return res.status(500).json({ error: error.message });

  res.status(200).json({ ok: true });
}
