import { Fragment, useEffect, useState } from 'react';
import { useProtectedPage } from '../../lib/useProtectedPage';
import { Shell, Loading, Empty } from '../../components/ui';
import { useToast } from '../../components/Toast';

const STATUS_LABEL = {
  open: { label: 'Aberto', className: 'badge badge-pending' },
  closed: { label: 'Fechado', className: 'badge badge-neutral' },
};

export default function SupportPage() {
  const { session, profile, loading } = useProtectedPage(['consultant', 'collaborator']);
  const toast = useToast();
  const [tickets, setTickets] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [openId, setOpenId] = useState(null);
  const [thread, setThread] = useState(null);
  const [reply, setReply] = useState('');
  const [replying, setReplying] = useState(false);

  function loadTickets() {
    if (!session) return;
    fetch('/api/consultant/support', { headers: { Authorization: `Bearer ${session.access_token}` } })
      .then((res) => res.json())
      .then((data) => setTickets(data.tickets || []));
  }

  useEffect(() => { loadTickets(); }, [session]);

  async function loadThread(id) {
    const res = await fetch(`/api/consultant/support?ticket_id=${id}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const data = await res.json();
    setThread(data);
  }

  async function toggleTicket(id) {
    if (openId === id) { setOpenId(null); setThread(null); return; }
    setOpenId(id);
    setThread(null);
    await loadThread(id);
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    const res = await fetch('/api/consultant/support', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ subject, message }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error || 'Não foi possível abrir o chamado.'); return; }
    toast.success('Chamado aberto.');
    setSubject('');
    setMessage('');
    setShowForm(false);
    loadTickets();
  }

  async function handleReply(e, ticketId) {
    e.preventDefault();
    if (!reply.trim()) return;
    setReplying(true);
    const res = await fetch('/api/consultant/support', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ ticket_id: ticketId, message: reply }),
    });
    setReplying(false);
    if (!res.ok) { toast.error('Não foi possível enviar.'); return; }
    setReply('');
    await loadThread(ticketId);
    loadTickets();
  }

  async function toggleStatus(ticket) {
    const nextStatus = ticket.status === 'open' ? 'closed' : 'open';
    await fetch('/api/consultant/support', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ ticket_id: ticket.id, status: nextStatus }),
    });
    toast.success(nextStatus === 'closed' ? 'Chamado fechado.' : 'Chamado reaberto.');
    loadTickets();
    if (openId === ticket.id) loadThread(ticket.id);
  }

  if (loading) return <Loading />;

  return (
    <Shell role={profile.role}>
      <main className="page page-narrow">
        <div className="page-head head-row">
          <div>
            <p className="eyebrow">Precisa de ajuda?</p>
            <h1>Suporte</h1>
            <p className="lede">Fale com a equipe do Confirmô sobre dúvidas, problemas ou pedidos.</p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancelar' : 'Abrir chamado'}
          </button>
        </div>

        {showForm && (
          <form className="card" onSubmit={handleCreate} style={{ marginBottom: 20 }}>
            <h3 style={{ marginBottom: 16 }}>Novo chamado</h3>
            {error && <div className="alert alert-error">{error}</div>}
            <label className="field">
              <span>Assunto</span>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} required />
            </label>
            <label className="field">
              <span>Mensagem</span>
              <textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} required />
            </label>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Enviando…' : 'Abrir chamado'}
            </button>
          </form>
        )}

        {tickets === null ? (
          <p className="meta">Carregando chamados…</p>
        ) : tickets.length === 0 ? (
          <Empty
            title="Nenhum chamado aberto"
            action={<button className="btn btn-primary" onClick={() => setShowForm(true)}>Abrir o primeiro chamado</button>}
          >
            Quando precisar de ajuda com a plataforma, abra um chamado por aqui.
          </Empty>
        ) : (
          <div className="card card-flush">
            <table className="table">
              <thead>
                <tr>
                  <th>Assunto</th>
                  <th>Status</th>
                  <th>Última atualização</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {tickets.map((t) => {
                  const status = STATUS_LABEL[t.status] || STATUS_LABEL.open;
                  const isOpen = openId === t.id;
                  return (
                    <Fragment key={t.id}>
                      <tr>
                        <td style={{ fontWeight: 500, cursor: 'pointer' }} onClick={() => toggleTicket(t.id)}>
                          {t.subject}
                        </td>
                        <td><span className={status.className}>{status.label}</span></td>
                        <td className="meta">
                          {new Date(t.updated_at).toLocaleString('pt-BR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button className="btn btn-ghost" onClick={() => toggleTicket(t.id)}>
                            {isOpen ? 'Fechar' : 'Ver conversa'}
                          </button>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr>
                          <td colSpan={4} style={{ padding: 14 }}>
                            {!thread ? (
                              <p className="meta">Carregando conversa…</p>
                            ) : (
                              <div style={{ display: 'grid', gap: 12 }}>
                                <div style={{ display: 'grid', gap: 8 }}>
                                  {thread.messages.map((m) => (
                                    <div
                                      key={m.id}
                                      style={{
                                        justifySelf: m.sender_role === 'owner' ? 'start' : 'end',
                                        maxWidth: '80%',
                                        background: m.sender_role === 'owner' ? 'var(--surface-2)' : 'var(--accent-soft)',
                                        border: '1px solid var(--border)',
                                        borderRadius: 'var(--radius)',
                                        padding: '8px 12px',
                                      }}
                                    >
                                      <div className="tiny" style={{ marginBottom: 4 }}>
                                        {m.sender_role === 'owner' ? 'Suporte Confirmô' : 'Você'} ·{' '}
                                        {new Date(m.created_at).toLocaleString('pt-BR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                      </div>
                                      {m.body}
                                    </div>
                                  ))}
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                  <button className="btn btn-ghost" onClick={() => toggleStatus(thread.ticket)}>
                                    {thread.ticket.status === 'open' ? 'Fechar chamado' : 'Reabrir chamado'}
                                  </button>
                                </div>
                                {thread.ticket.status === 'open' && (
                                  <form onSubmit={(e) => handleReply(e, t.id)} className="filter-bar">
                                    <input
                                      placeholder="Escreva uma resposta…"
                                      value={reply}
                                      onChange={(e) => setReply(e.target.value)}
                                      style={{ flex: 1, minWidth: 200 }}
                                    />
                                    <button type="submit" className="btn btn-primary" disabled={replying}>
                                      {replying ? 'Enviando…' : 'Enviar'}
                                    </button>
                                  </form>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </Shell>
  );
}
