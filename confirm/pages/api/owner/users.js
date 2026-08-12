import { supabaseAdmin } from '../../../lib/supabase';
import { getAuthedProfile } from '../../../lib/requireAuth';

// Lista todo mundo que já logou na plataforma: administradores, empresas
// (consultoras) e colaboradores — só o owner enxerga essa visão completa.
export default async function handler(req, res) {
  const profile = await getAuthedProfile(req);
  if (!profile || profile.role !== 'owner') return res.status(403).json({ error: 'Acesso negado' });

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, email, role, active, parent_id, created_at')
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  const byId = Object.fromEntries(data.map((p) => [p.id, p]));
  const users = data.map((p) => ({
    ...p,
    company_name: p.role === 'collaborator' ? byId[p.parent_id]?.full_name || null : null,
  }));

  res.status(200).json({ users });
}
