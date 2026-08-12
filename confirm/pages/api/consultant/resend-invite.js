import { supabaseAdmin } from '../../../lib/supabase';
import { getAuthedProfile, canEditEvents, getAllowedEventIds, isEventAllowed } from '../../../lib/requireAuth';
import { sendTemplateMessage } from '../../../lib/whatsapp';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const profile = await getAuthedProfile(req);
  if (!canEditEvents(profile)) return res.status(403).json({ error: 'Acesso negado' });

  const allowedIds = await getAllowedEventIds(profile);

  // Aceita um id ou vários (ação em lote)
  const { guest_id, guest_ids } = req.body;
  const ids = guest_ids?.length ? guest_ids : [guest_id];

  let sent = 0;
  const failures = [];

  for (const id of ids) {
    const { data: guest } = await supabaseAdmin
      .from('guests')
      .select('*, events!inner(*)')
      .eq('id', id)
      .single();
    if (!guest || guest.events.consultant_id !== profile.account_id) continue;
    if (!isEventAllowed(allowedIds, guest.event_id)) continue;

    try {
      await sendTemplateMessage(guest.phone, 'lembrete_confirmacao', [guest.full_name]);
      await supabaseAdmin
        .from('guests')
        .update({
          last_reminder_sent_at: new Date().toISOString(),
          reminder_count: (guest.reminder_count || 0) + 1,
        })
        .eq('id', id);
      await supabaseAdmin.from('messages_log').insert({
        guest_id: id,
        direction: 'outbound',
        message_type: 'reminder',
      });
      sent++;
    } catch (err) {
      failures.push({ name: guest.full_name, reason: err.message });
    }
  }

  res.status(200).json({ ok: true, sent, failures });
}
