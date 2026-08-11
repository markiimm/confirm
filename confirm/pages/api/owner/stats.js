import { supabaseAdmin } from '../../../lib/supabase';
import { getAuthedProfile } from '../../../lib/requireAuth';

export default async function handler(req, res) {
  const profile = await getAuthedProfile(req);
  if (!profile || profile.role !== 'owner') return res.status(403).json({ error: 'Acesso negado' });

  // Puxa o essencial de uma vez e agrega em memória — mais barato que
  // várias consultas de contagem separadas, e permite cruzar os dados.
  const [{ data: consultants }, { data: events }, { data: guests }] = await Promise.all([
    supabaseAdmin.from('profiles').select('id, full_name, plan, active, subscription_status, created_at').eq('role', 'consultant'),
    supabaseAdmin.from('events').select('id, event_name, event_type, event_date, consultant_id, created_at'),
    supabaseAdmin.from('guests').select('event_id, confirmation_status'),
  ]);

  const allConsultants = consultants || [];
  const allEvents = events || [];
  const allGuests = guests || [];

  const confirmed = allGuests.filter((g) => g.confirmation_status === 'confirmed').length;
  const declined = allGuests.filter((g) => g.confirmation_status === 'declined').length;
  const pending = allGuests.length - confirmed - declined;

  // Convidados por empresa, para o ranking
  const eventOwner = Object.fromEntries(allEvents.map((e) => [e.id, e.consultant_id]));
  const guestsByConsultant = {};
  for (const g of allGuests) {
    const owner = eventOwner[g.event_id];
    if (!owner) continue;
    guestsByConsultant[owner] = (guestsByConsultant[owner] || 0) + 1;
  }

  const topConsultants = allConsultants
    .map((c) => ({ label: c.full_name, value: guestsByConsultant[c.id] || 0 }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5)
    .filter((c) => c.value > 0);

  // Confirmações por evento, para a atividade recente
  const consultantName = Object.fromEntries(allConsultants.map((c) => [c.id, c.full_name]));
  const recentEvents = [...allEvents]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 6)
    .map((e) => {
      const evGuests = allGuests.filter((g) => g.event_id === e.id);
      const evConfirmed = evGuests.filter((g) => g.confirmation_status === 'confirmed').length;
      return {
        id: e.id,
        name: e.event_name,
        type: e.event_type,
        date: e.event_date,
        consultant: consultantName[e.consultant_id] || '—',
        total: evGuests.length,
        confirmed: evConfirmed,
      };
    });

  // Eventos por tipo de negócio
  const byType = {};
  for (const e of allEvents) byType[e.event_type] = (byType[e.event_type] || 0) + 1;

  res.status(200).json({
    consultants: allConsultants.length,
    consultants_active: allConsultants.filter((c) => c.active).length,
    consultants_paying: allConsultants.filter((c) => c.subscription_status === 'active').length,
    consultants_trialing: allConsultants.filter((c) => c.subscription_status === 'trialing').length,
    events: allEvents.length,
    guests: allGuests.length,
    confirmed,
    declined,
    pending,
    confirmation_rate: allGuests.length ? Math.round((confirmed / allGuests.length) * 100) : 0,
    response_rate: allGuests.length ? Math.round(((confirmed + declined) / allGuests.length) * 100) : 0,
    top_consultants: topConsultants,
    events_by_type: Object.entries(byType).map(([label, value]) => ({ label, value })),
    recent_events: recentEvents,
  });
}
