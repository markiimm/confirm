import { supabaseAdmin } from '../../../lib/supabase';
import { getAuthedProfile } from '../../../lib/requireAuth';
import { logAction } from '../../../lib/auditLog';

// Edição administrativa de qualquer perfil (dono, empresa ou colaborador):
// dados de contato, senha, plano/negócio (quando fizer sentido) e acesso.
export default async function handler(req, res) {
  if (req.method !== 'PATCH') return res.status(405).end();

  const profile = await getAuthedProfile(req);
  if (!profile || profile.role !== 'owner') return res.status(403).json({ error: 'Acesso negado' });

  const { id, full_name, email, password, active, plan, pattern_type, business_type } = req.body;
  if (!id) return res.status(400).json({ error: 'id é obrigatório' });
  if (password && password.length < 6) {
    return res.status(400).json({ error: 'A senha precisa ter pelo menos 6 caracteres' });
  }

  if (email || password) {
    const authUpdates = {};
    if (email) authUpdates.email = email;
    if (password) authUpdates.password = password;
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, authUpdates);
    if (authError) return res.status(400).json({ error: authError.message });
  }

  const updates = {};
  if (full_name) updates.full_name = full_name;
  if (email) updates.email = email;
  if (typeof active === 'boolean') updates.active = active;
  if (plan) updates.plan = plan;
  if (pattern_type) updates.pattern_type = pattern_type;
  if (business_type) updates.business_type = business_type;

  if (Object.keys(updates).length > 0) {
    const { error } = await supabaseAdmin.from('profiles').update(updates).eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
  }

  await logAction(profile.id, 'user.update', id, {
    ...updates,
    password_changed: Boolean(password),
  });

  res.status(200).json({ ok: true });
}
