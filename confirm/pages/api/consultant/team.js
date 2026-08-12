import { supabaseAdmin } from '../../../lib/supabase';
import { getAuthedProfile, isAccountOwner } from '../../../lib/requireAuth';

// Só o titular da empresa gerencia a equipe — colaborador não convida
// nem remove outro colaborador.
export default async function handler(req, res) {
  const profile = await getAuthedProfile(req);
  if (!isAccountOwner(profile)) return res.status(403).json({ error: 'Apenas o titular da conta gerencia a equipe' });

  if (req.method === 'GET') {
    const { data } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, email, active, can_edit, created_at')
      .eq('parent_id', profile.id)
      .order('created_at');
    return res.status(200).json({ members: data || [] });
  }

  if (req.method === 'POST') {
    const { full_name, email, password, can_edit } = req.body;
    if (!full_name || !email || !password) {
      return res.status(400).json({ error: 'Nome, e-mail e senha são obrigatórios' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'A senha precisa ter pelo menos 6 caracteres' });
    }

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createError) return res.status(400).json({ error: createError.message });

    const { error } = await supabaseAdmin.from('profiles').insert({
      id: created.user.id,
      role: 'collaborator',
      parent_id: profile.id,
      full_name,
      email,
      can_edit: can_edit !== false,
    });
    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({ ok: true });
  }

  if (req.method === 'PATCH') {
    const { member_id, can_edit } = req.body;
    if (!member_id || typeof can_edit !== 'boolean') {
      return res.status(400).json({ error: 'member_id e can_edit são obrigatórios' });
    }
    const { data: member } = await supabaseAdmin.from('profiles').select('id, parent_id').eq('id', member_id).single();
    if (!member || member.parent_id !== profile.id) {
      return res.status(404).json({ error: 'Colaborador não encontrado' });
    }
    const { error } = await supabaseAdmin.from('profiles').update({ can_edit }).eq('id', member_id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'DELETE') {
    const { member_id } = req.body;
    const { data: member } = await supabaseAdmin
      .from('profiles')
      .select('id, parent_id')
      .eq('id', member_id)
      .single();
    if (!member || member.parent_id !== profile.id) {
      return res.status(404).json({ error: 'Colaborador não encontrado' });
    }

    await supabaseAdmin.auth.admin.deleteUser(member_id);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
}
