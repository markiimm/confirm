import crypto from 'crypto';
import { supabaseAdmin } from '../../../lib/supabase';
import { getAuthedProfile, canManageEvents } from '../../../lib/requireAuth';

async function loadEventOwnedBy(eventId, accountId) {
  const { data: event } = await supabaseAdmin.from('events').select('*').eq('id', eventId).single();
  if (!event || event.consultant_id !== accountId) return null;
  return event;
}

export default async function handler(req, res) {
  const profile = await getAuthedProfile(req);
  if (!canManageEvents(profile)) return res.status(403).json({ error: 'Acesso negado' });

  if (req.method === 'GET') {
    const { event_id } = req.query;
    const event = await loadEventOwnedBy(event_id, profile.account_id);
    if (!event) return res.status(404).json({ error: 'Evento não encontrado' });

    const { data: guests } = await supabaseAdmin
      .from('guests')
      .select('*')
      .eq('event_id', event_id)
      .order('full_name');

    return res.status(200).json({ event, guests: guests || [] });
  }

  if (req.method === 'PATCH') {
    const { event_id, invite_message_template, generate_portal_token, revoke_portal_token } = req.body;
    const event = await loadEventOwnedBy(event_id, profile.account_id);
    if (!event) return res.status(404).json({ error: 'Evento não encontrado' });

    const updates = {};
    if (invite_message_template !== undefined) {
      updates.invite_message_template = invite_message_template || null;
    }
    if (generate_portal_token) {
      updates.portal_token = crypto.randomBytes(18).toString('base64url');
    }
    if (revoke_portal_token) {
      updates.portal_token = null;
    }

    const { data, error } = await supabaseAdmin
      .from('events')
      .update(updates)
      .eq('id', event_id)
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({ ok: true, event: data });
  }

  return res.status(405).end();
}
