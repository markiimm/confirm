import { supabaseAdmin } from '../../../lib/supabase';
import { getAuthedProfile } from '../../../lib/requireAuth';

// Colaboradores de uma empresa específica — usado para expandir a linha
// da empresa na tela /owner/consultants. Só o owner enxerga isso.
export default async function handler(req, res) {
  const profile = await getAuthedProfile(req);
  if (!profile || profile.role !== 'owner') return res.status(403).json({ error: 'Acesso negado' });

  const { consultant_id } = req.query;
  if (!consultant_id) return res.status(400).json({ error: 'consultant_id é obrigatório' });

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, email, active, created_at')
    .eq('role', 'collaborator')
    .eq('parent_id', consultant_id)
    .order('created_at');

  if (error) return res.status(500).json({ error: error.message });
  res.status(200).json({ collaborators: data || [] });
}
