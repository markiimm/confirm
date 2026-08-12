import { supabaseAdmin } from '../../../lib/supabase';
import { getAuthedProfile, canManageEvents, getAllowedEventIds } from '../../../lib/requireAuth';

export default async function handler(req, res) {
  const profile = await getAuthedProfile(req);
  if (!canManageEvents(profile)) return res.status(403).json({ error: 'Acesso negado' });

  const allowedIds = await getAllowedEventIds(profile);

  let query = supabaseAdmin.from('events').select('*').eq('consultant_id', profile.account_id).order('event_date');
  if (allowedIds) query = query.in('id', allowedIds);
  const { data: events, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  const withCounts = await Promise.all(
    events.map(async (event) => {
      const { data: guests } = await supabaseAdmin
        .from('guests')
        .select('confirmation_status')
        .eq('event_id', event.id);
      const total = guests?.length || 0;
      const confirmed = guests?.filter((g) => g.confirmation_status === 'confirmed').length || 0;
      const declined = guests?.filter((g) => g.confirmation_status === 'declined').length || 0;
      return { ...event, guest_total: total, guest_confirmed: confirmed, guest_declined: declined };
    })
  );

  res.status(200).json({ events: withCounts });
}
