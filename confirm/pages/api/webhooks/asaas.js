import { supabaseAdmin } from '../../../lib/supabase';

// Webhook público do Asaas — configure em Asaas > Integrações > Webhooks
// apontando para https://seusite.com/api/webhooks/asaas
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { event, payment } = req.body;
  if (!payment?.subscription) return res.status(200).end();

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('asaas_subscription_id', payment.subscription)
    .maybeSingle();
  if (!profile) return res.status(200).end();

  let subscription_status;
  if (event === 'PAYMENT_CONFIRMED' || event === 'PAYMENT_RECEIVED') {
    subscription_status = 'active';
  } else if (event === 'PAYMENT_OVERDUE') {
    subscription_status = 'past_due';
  } else if (event === 'PAYMENT_DELETED' || event === 'SUBSCRIPTION_DELETED') {
    subscription_status = 'canceled';
  }

  if (subscription_status) {
    await supabaseAdmin.from('profiles').update({ subscription_status }).eq('id', profile.id);
  }

  // Guarda o histórico para a consultora consultar na tela de assinatura
  await supabaseAdmin.from('billing_events').insert({
    profile_id: profile.id,
    asaas_payment_id: payment.id,
    event_type: event,
    status:
      subscription_status === 'active' ? 'paid'
      : subscription_status === 'past_due' ? 'overdue'
      : 'canceled',
    value: payment.value,
    due_date: payment.dueDate,
    invoice_url: payment.invoiceUrl,
  });

  res.status(200).end();
}
