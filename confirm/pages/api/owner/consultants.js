import { supabaseAdmin } from '../../../lib/supabase';
import { getAuthedProfile } from '../../../lib/requireAuth';

export default async function handler(req, res) {
  const profile = await getAuthedProfile(req);
  if (!profile || profile.role !== 'owner') return res.status(403).json({ error: 'Acesso negado' });

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, email, plan, active, pattern_type, subscription_status, trial_ends_at, created_at')
    .eq('role', 'consultant')
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.status(200).json({ consultants: data });
}
