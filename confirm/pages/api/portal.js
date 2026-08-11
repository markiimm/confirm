import { supabaseAdmin } from '../../lib/supabase';

// Rota PÚBLICA e somente leitura. O token do link é a única credencial,
// então devolvemos apenas o necessário para acompanhar as confirmações —
// nunca telefone de convidado, dados da consultora ou id interno.
export default async function handler(req, res) {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'Link inválido' });

  const { data: event } = await supabaseAdmin
    .from('events')
    .select('id, event_name, event_type, event_date')
    .eq('portal_token', token)
    .maybeSingle();

  if (!event) return res.status(404).json({ error: 'Link inválido ou expirado' });

  const { data: guests } = await supabaseAdmin
    .from('guests')
    .select('full_name, confirmation_status, companions')
    .eq('event_id', event.id)
    .order('full_name');

  const list = guests || [];
  const confirmed = list.filter((g) => g.confirmation_status === 'confirmed');
  const declined = list.filter((g) => g.confirmation_status === 'declined');
  const pending = list.filter((g) => g.confirmation_status === 'pending');
  const companions = confirmed.reduce((sum, g) => sum + (g.companions || 0), 0);

  res.status(200).json({
    event: {
      name: event.event_name,
      type: event.event_type,
      date: event.event_date,
    },
    totals: {
      guests: list.length,
      confirmed: confirmed.length,
      declined: declined.length,
      pending: pending.length,
      companions,
      expected: confirmed.length + companions,
    },
    guests: list.map((g) => ({
      name: g.full_name,
      status: g.confirmation_status,
      companions: g.companions || 0,
    })),
  });
}
