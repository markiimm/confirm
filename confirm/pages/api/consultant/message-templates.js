import { supabaseAdmin } from '../../../lib/supabase';
import { getAuthedProfile, canManageEvents, canEditEvents } from '../../../lib/requireAuth';

// Textos de convite salvos pela empresa, reutilizáveis entre eventos.
export default async function handler(req, res) {
  const profile = await getAuthedProfile(req);
  if (!canManageEvents(profile)) return res.status(403).json({ error: 'Acesso negado' });

  if (req.method === 'GET') {
    const { data } = await supabaseAdmin
      .from('message_templates')
      .select('*')
      .eq('account_id', profile.account_id)
      .order('created_at', { ascending: false });
    return res.status(200).json({ templates: data || [] });
  }

  if (!canEditEvents(profile)) return res.status(403).json({ error: 'Acesso negado' });

  if (req.method === 'POST') {
    const { name, body } = req.body;
    if (!name || !body) return res.status(400).json({ error: 'Nome e texto são obrigatórios' });
    const { data, error } = await supabaseAdmin
      .from('message_templates')
      .insert({ account_id: profile.account_id, name, body })
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ template: data });
  }

  if (req.method === 'DELETE') {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id é obrigatório' });
    await supabaseAdmin.from('message_templates').delete().eq('id', id).eq('account_id', profile.account_id);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
}
