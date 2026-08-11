import { supabaseAdmin } from '../../../lib/supabase';
import { getAuthedProfile, canManageEvents } from '../../../lib/requireAuth';

async function guestBelongsToAccount(guestId, accountId) {
  const { data: guest } = await supabaseAdmin
    .from('guests')
    .select('*, events!inner(consultant_id)')
    .eq('id', guestId)
    .single();
  if (!guest || guest.events.consultant_id !== accountId) return null;
  return guest;
}

export default async function handler(req, res) {
  const profile = await getAuthedProfile(req);
  if (!canManageEvents(profile)) return res.status(403).json({ error: 'Acesso negado' });

  if (req.method === 'PATCH') {
    const { guest_id, confirmation_status, notes, companions } = req.body;
    const guest = await guestBelongsToAccount(guest_id, profile.account_id);
    if (!guest) return res.status(404).json({ error: 'Convidado não encontrado' });

    const updates = {};
    if (confirmation_status !== undefined) {
      if (!['pending', 'confirmed', 'declined'].includes(confirmation_status)) {
        return res.status(400).json({ error: 'Status inválido' });
      }
      updates.confirmation_status = confirmation_status;
    }
    if (notes !== undefined) updates.notes = notes || null;
    if (companions !== undefined) updates.companions = Math.max(0, Number(companions) || 0);

    const { error } = await supabaseAdmin.from('guests').update(updates).eq('id', guest_id);
    if (error) return res.status(500).json({ error: error.message });

    if (updates.confirmation_status) {
      await supabaseAdmin.from('messages_log').insert({
        guest_id,
        direction: 'inbound',
        message_type: 'reply',
        content: `[Marcado manualmente como "${updates.confirmation_status}" por ${profile.full_name}]`,
      });
    }

    return res.status(200).json({ ok: true });
  }

  if (req.method === 'DELETE') {
    // Aceita um id ou vários (ação em lote)
    const { guest_id, guest_ids } = req.body;
    const ids = guest_ids?.length ? guest_ids : [guest_id];

    let removed = 0;
    for (const id of ids) {
      const guest = await guestBelongsToAccount(id, profile.account_id);
      if (!guest) continue;
      const { error } = await supabaseAdmin.from('guests').delete().eq('id', id);
      if (!error) removed++;
    }

    return res.status(200).json({ ok: true, removed });
  }

  return res.status(405).end();
}
