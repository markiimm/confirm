import { supabaseAdmin } from '../../../lib/supabase';
import { getAuthedProfile, isAccountOwner } from '../../../lib/requireAuth';
import { cancelAsaasSubscription, updateAsaasSubscription, PLAN_PRICES } from '../../../lib/asaas';

export default async function handler(req, res) {
  const profile = await getAuthedProfile(req);
  if (!isAccountOwner(profile)) return res.status(403).json({ error: 'Apenas o titular da conta gerencia a assinatura' });

  if (req.method === 'GET') {
    const { data } = await supabaseAdmin
      .from('billing_events')
      .select('*')
      .eq('profile_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(24);
    return res.status(200).json({ history: data || [] });
  }

  // Trocar de plano
  if (req.method === 'PATCH') {
    const { plan } = req.body;
    if (!['normal', 'pro'].includes(plan)) return res.status(400).json({ error: 'Plano inválido' });

    try {
      if (profile.asaas_subscription_id) {
        await updateAsaasSubscription(profile.asaas_subscription_id, { value: PLAN_PRICES[plan] });
      }
      await supabaseAdmin.from('profiles').update({ plan }).eq('id', profile.id);
      return res.status(200).json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // Cancelar assinatura
  if (req.method === 'DELETE') {
    try {
      if (profile.asaas_subscription_id) {
        await cancelAsaasSubscription(profile.asaas_subscription_id);
      }
      await supabaseAdmin
        .from('profiles')
        .update({ subscription_status: 'canceled', asaas_subscription_id: null })
        .eq('id', profile.id);
      return res.status(200).json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).end();
}
