import { supabaseAdmin } from '../../lib/supabase';

// Rota PÚBLICA — qualquer empresa pode criar a própria conta, sem
// depender do dono do sistema. Sempre cria com role='consultant' e
// 14 dias de teste grátis (subscription_status='trialing').
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { full_name, email, password, pattern_type, business_type, website, rendered_at } = req.body;

  // Honeypot: campo invisível para humanos, que só um robô preenche.
  // Devolvemos sucesso falso para não avisar o robô de que foi barrado.
  if (website) {
    return res.status(200).json({ ok: true, trial_ends_at: new Date().toISOString() });
  }

  // Armadilha de tempo: nenhum humano preenche o formulário em menos de
  // 2 segundos — isso pega scripts que enviam o POST direto.
  if (rendered_at && Date.now() - Number(rendered_at) < 2000) {
    return res.status(400).json({ error: 'Não foi possível processar o cadastro. Tente de novo.' });
  }

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

  const recommendedPlan = pattern_type === 'agendamento_individual' ? 'normal' : 'pro';
  const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

  const { error: profileError } = await supabaseAdmin.from('profiles').insert({
    id: created.user.id,
    role: 'consultant',
    full_name,
    email,
    pattern_type: pattern_type || 'lista_confirmacao',
    business_type: business_type || 'casamento',
    plan: recommendedPlan,
    subscription_status: 'trialing',
    trial_ends_at: trialEndsAt,
  });
  if (profileError) return res.status(500).json({ error: profileError.message });

  res.status(200).json({ ok: true, trial_ends_at: trialEndsAt });
}
