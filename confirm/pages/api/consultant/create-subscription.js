import { supabaseAdmin } from '../../../lib/supabase';
import { getAuthedProfile } from '../../../lib/requireAuth';
import { createAsaasCustomer, createAsaasSubscription, PLAN_PRICES } from '../../../lib/asaas';

// Chamado quando a consultora clica em "Assinar agora" — cria (se ainda
// não existir) o cliente no Asaas e a assinatura recorrente, e devolve
// o link de pagamento hospedado (cartão, Pix ou boleto).
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const profile = await getAuthedProfile(req);
  if (!profile || profile.role !== 'consultant') return res.status(403).json({ error: 'Acesso negado' });

  const { cpfCnpj, phone } = req.body;
  if (!cpfCnpj) return res.status(400).json({ error: 'cpfCnpj é obrigatório' });

  try {
    let customerId = profile.asaas_customer_id;
    if (!customerId) {
      const customer = await createAsaasCustomer({
        name: profile.full_name,
        email: profile.email,
        cpfCnpj,
        phone,
      });
      customerId = customer.id;
    }

    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const subscription = await createAsaasSubscription({
      customerId,
      value: PLAN_PRICES[profile.plan] || PLAN_PRICES.normal,
      nextDueDate: tomorrow,
      description: `Assinatura ${profile.plan === 'pro' ? 'PRO' : 'Normal'}`,
    });

    await supabaseAdmin
      .from('profiles')
      .update({
        asaas_customer_id: customerId,
        asaas_subscription_id: subscription.id,
      })
      .eq('id', profile.id);

    // O Asaas devolve um link de pagamento da primeira cobrança nesse campo
    res.status(200).json({ checkout_url: subscription.invoiceUrl || subscription.paymentLink });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
