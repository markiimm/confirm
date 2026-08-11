import { supabaseAdmin } from '../../lib/supabase';
import { sendTemplateMessage } from '../../lib/whatsapp';

// Chame esta rota 1x por dia via cron externo (cron-job.org, Supabase
// Scheduled Functions, ou GitHub Actions agendado). Proteja com um
// header secreto simples, como no exemplo abaixo.
export default async function handler(req, res) {
  if (req.headers['x-cron-secret'] !== process.env.CRON_SECRET) {
    return res.status(401).end();
  }

  const today = new Date();
  const { data: events } = await supabaseAdmin.from('events').select('*');
  const results = [];

  for (const event of events) {
    const daysToEvent = Math.ceil(
      (new Date(event.event_date) - today) / (1000 * 60 * 60 * 24)
    );
    if (!event.reminder_days.includes(daysToEvent)) continue;

    const { data: pendingGuests } = await supabaseAdmin
      .from('guests')
      .select('*')
      .eq('event_id', event.id)
      .eq('confirmation_status', 'pending');

    for (const guest of pendingGuests) {
      try {
        // 'lembrete_confirmacao' também precisa ser um template aprovado
        await sendTemplateMessage(guest.phone, 'lembrete_confirmacao', [guest.full_name]);
        await supabaseAdmin
          .from('guests')
          .update({
            last_reminder_sent_at: new Date().toISOString(),
            reminder_count: (guest.reminder_count || 0) + 1,
          })
          .eq('id', guest.id);
        await supabaseAdmin.from('messages_log').insert({
          guest_id: guest.id,
          direction: 'outbound',
          message_type: 'reminder',
        });
        results.push({ guest: guest.full_name, status: 'lembrete enviado' });
      } catch (err) {
        results.push({ guest: guest.full_name, status: 'erro', detail: err.message });
      }
    }
  }

  return res.status(200).json({ processed: results.length, results });
}
