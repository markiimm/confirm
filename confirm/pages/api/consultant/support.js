import { supabaseAdmin } from '../../../lib/supabase';
import { getAuthedProfile, canManageEvents } from '../../../lib/requireAuth';

// Chamados de suporte abertos pela empresa (titular ou colaborador) para
// o dono da plataforma. Tudo é escopado por account_id — colaborador e
// titular veem os mesmos chamados da empresa.
export default async function handler(req, res) {
  const profile = await getAuthedProfile(req);
  if (!canManageEvents(profile)) return res.status(403).json({ error: 'Acesso negado' });

  if (req.method === 'GET') {
    const { ticket_id } = req.query;

    if (ticket_id) {
      const { data: ticket } = await supabaseAdmin
        .from('support_tickets')
        .select('*')
        .eq('id', ticket_id)
        .eq('account_id', profile.account_id)
        .single();
      if (!ticket) return res.status(404).json({ error: 'Chamado não encontrado' });

      const { data: messages } = await supabaseAdmin
        .from('support_messages')
        .select('*')
        .eq('ticket_id', ticket_id)
        .order('created_at');

      return res.status(200).json({ ticket, messages: messages || [] });
    }

    const { data: tickets } = await supabaseAdmin
      .from('support_tickets')
      .select('*')
      .eq('account_id', profile.account_id)
      .order('updated_at', { ascending: false });

    return res.status(200).json({ tickets: tickets || [] });
  }

  if (req.method === 'POST') {
    const { ticket_id, subject, message } = req.body;
    if (!message) return res.status(400).json({ error: 'Mensagem é obrigatória' });

    if (ticket_id) {
      const { data: ticket } = await supabaseAdmin
        .from('support_tickets')
        .select('id')
        .eq('id', ticket_id)
        .eq('account_id', profile.account_id)
        .single();
      if (!ticket) return res.status(404).json({ error: 'Chamado não encontrado' });

      const { error } = await supabaseAdmin.from('support_messages').insert({
        ticket_id,
        sender_id: profile.id,
        sender_role: profile.role,
        body: message,
      });
      if (error) return res.status(500).json({ error: error.message });

      await supabaseAdmin
        .from('support_tickets')
        .update({ updated_at: new Date().toISOString(), status: 'open' })
        .eq('id', ticket_id);

      return res.status(200).json({ ok: true });
    }

    if (!subject) return res.status(400).json({ error: 'Assunto é obrigatório' });

    const { data: ticket, error } = await supabaseAdmin
      .from('support_tickets')
      .insert({ account_id: profile.account_id, created_by: profile.id, subject })
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });

    await supabaseAdmin.from('support_messages').insert({
      ticket_id: ticket.id,
      sender_id: profile.id,
      sender_role: profile.role,
      body: message,
    });

    return res.status(200).json({ id: ticket.id });
  }

  if (req.method === 'PATCH') {
    const { ticket_id, status } = req.body;
    if (!ticket_id || !['open', 'closed'].includes(status)) {
      return res.status(400).json({ error: 'ticket_id e status válido são obrigatórios' });
    }
    const { error } = await supabaseAdmin
      .from('support_tickets')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', ticket_id)
      .eq('account_id', profile.account_id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
}
