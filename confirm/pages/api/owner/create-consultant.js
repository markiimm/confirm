import { supabaseAdmin } from '../../../lib/supabase';
import { getAuthedProfile } from '../../../lib/requireAuth';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const profile = await getAuthedProfile(req);
  if (!profile || profile.role !== 'owner') return res.status(403).json({ error: 'Acesso negado' });

  const { full_name, email, password, plan, pattern_type, business_type } = req.body;
  if (!full_name || !email || !password) {
    return res.status(400).json({ error: 'full_name, email e password são obrigatórios' });
  }

  const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true });
  if (createError) return res.status(400).json({ error: createError.message });

  // Cadastro manual pelo dono já entra com assinatura ativa (é onboarding
  // pessoal/de confiança) — diferente do trial automático do /signup público.
  const { error: profileError } = await supabaseAdmin.from('profiles').insert({
    id: created.user.id,
    role: 'consultant',
    full_name,
    email,
    plan: plan || 'normal',
    pattern_type: pattern_type || 'lista_confirmacao',
    business_type: business_type || 'casamento',
    subscription_status: 'active',
  });
  if (profileError) return res.status(500).json({ error: profileError.message });

  res.status(200).json({ id: created.user.id });
}
