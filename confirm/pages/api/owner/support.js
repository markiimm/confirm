import { supabaseAdmin } from '../../../lib/supabase';
import { getAuthedProfile } from '../../../lib/requireAuth';

// Central de suporte do dono: vê e responde chamados de todas as empresas.
export default async function handler(req, res) {
  const profile = await getAuthedProfile(req);
  if (!profile || profile.role !== 'owner') return res.status(403).json({ error: 'Acesso negado' });

  if (req.method === 'GET') {
    const { ticket_id } = req.query;

    if (ticket_id) {
      const { data: ticket } = await supabaseAdmin
        .from('support_tickets')
        .select('*, profiles!support_tickets_account_id_fkey(full_name)')
        .eq('id', ticket_id)
        .single();
      if (!ticket) return res.status(404).json({ error: 'Chamado não encontrado' });

      const { data: messages } = await supabaseAdmin
        .from('support_messages')
        .select('*')
        .eq('ticket_id', ticket_id)
        .order('created_at');

      return res.status(200).json({
        ticket: { ...ticket, account_name: ticket.profiles?.full_name },
        messages: messages || [],
      });
    }

    const { status } = req.query;
    let query = supabaseAdmin
      .from('support_tickets')
      .select('*, profiles!support_tickets_account_id_fkey(full_name)')
      .order('updated_at', { ascending: false });
    if (status) query = query.eq('status', status);

    const { data: tickets, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({
      tickets: (tickets || []).map((t) => ({ ...t, account_name: t.profiles?.full_name })),
    });
  }

  if (req.method === 'POST') {
    const { ticket_id, message } = req.body;
    if (!ticket_id || !message) return res.status(400).json({ error: 'ticket_id e mensagem são obrigatórios' });

    const { error } = await supabaseAdmin.from('support_messages').insert({
      ticket_id,
      sender_id: profile.id,
      sender_role: 'owner',
      body: message,
    });
    if (error) return res.status(500).json({ error: error.message });

    await supabaseAdmin
      .from('support_tickets')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', ticket_id);

    return res.status(200).json({ ok: true });
  }

  if (req.method === 'PATCH') {
    const { ticket_id, status } = req.body;
    if (!ticket_id || !['open', 'closed'].includes(status)) {
      return res.status(400).json({ error: 'ticket_id e status válido são obrigatórios' });
    }
    const { error } = await supabaseAdmin
      .from('support_tickets')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', ticket_id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
}
