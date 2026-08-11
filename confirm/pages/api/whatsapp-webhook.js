import { supabaseAdmin } from '../../lib/supabase';
import { interpretReply, extractCompanions, sendImageMessage } from '../../lib/whatsapp';

export default async function handler(req, res) {
  // Verificação inicial do webhook (padrão Meta Cloud API)
  if (req.method === 'GET') {
    const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } = req.query;
    if (mode === 'subscribe' && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }
    return res.status(403).end();
  }

  if (req.method !== 'POST') return res.status(405).end();

  const entry = req.body?.entry?.[0];
  const change = entry?.changes?.[0]?.value;
  const message = change?.messages?.[0];
  if (!message) return res.status(200).end();

  const fromPhone = `+${message.from}`;
  const text = message.text?.body || '';

  const { data: guest } = await supabaseAdmin
    .from('guests')
    .select('*, events(*)')
    .eq('phone', fromPhone)
    .eq('confirmation_status', 'pending')
    .maybeSingle();

  if (!guest) return res.status(200).end();

  const intent = interpretReply(text);

  await supabaseAdmin.from('messages_log').insert({
    guest_id: guest.id,
    direction: 'inbound',
    message_type: 'reply',
    content: text,
  });

  // Guarda o texto completo mesmo quando a resposta é ambígua — é onde
  // aparecem acompanhantes, restrições alimentares e recados.
  const updates = { notes: text };

  const companions = extractCompanions(text);
  if (companions !== null) updates.companions = companions;

  if (intent === 'unclear') {
    // Não muda o status: a consultora resolve manualmente pelo painel,
    // já vendo o texto que o convidado escreveu.
    await supabaseAdmin.from('guests').update(updates).eq('id', guest.id);
    return res.status(200).end();
  }

  updates.confirmation_status = intent;
  await supabaseAdmin.from('guests').update(updates).eq('id', guest.id);

  if (intent === 'confirmed' && guest.events?.invite_image_url) {
    await sendImageMessage(
      fromPhone,
      guest.events.invite_image_url,
      'Que alegria! Seu convite digital está aqui 💌'
    );
  }

  return res.status(200).end();
}
