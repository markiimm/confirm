import { supabaseAdmin } from '../../lib/supabase';
import { sendTemplateMessage } from '../../lib/whatsapp';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { event_id } = req.body;

  const { data: event, error: eventError } = await supabaseAdmin
    .from('events')
    .select('*')
    .eq('id', event_id)
    .single();
  if (eventError) return res.status(404).json({ error: 'Evento não encontrado' });

  const { data: guests, error: guestsError } = await supabaseAdmin
    .from('guests')
    .select('*')
    .eq('event_id', event_id)
    .eq('confirmation_status', 'pending')
    .is('last_reminder_sent_at', null);
  if (guestsError) return res.status(500).json({ error: guestsError.message });

  const results = [];
  for (const guest of guests) {
    try {
      // 'convite_casamento' precisa ser o nome exato do template aprovado na Meta
      await sendTemplateMessage(guest.phone, 'convite_casamento', [
        guest.full_name,
        event.event_name,
        new Date(event.event_date).toLocaleDateString('pt-BR'),
      ]);
      await supabaseAdmin
        .from('guests')
        .update({ last_reminder_sent_at: new Date().toISOString() })
        .eq('id', guest.id);
      await supabaseAdmin.from('messages_log').insert({
        guest_id: guest.id,
        direction: 'outbound',
        message_type: 'invite',
      });
      results.push({ guest: guest.full_name, status: 'enviado' });
    } catch (err) {
      results.push({ guest: guest.full_name, status: 'erro', detail: err.message });
    }
  }

  return res.status(200).json({ sent: results.length, results });
}
