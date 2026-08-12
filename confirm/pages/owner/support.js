import { Fragment, useEffect, useState } from 'react';
import { useProtectedPage } from '../../lib/useProtectedPage';
import { Shell, Loading, Empty } from '../../components/ui';
import { useToast } from '../../components/Toast';

const STATUS_LABEL = {
  open: { label: 'Aberto', className: 'badge badge-pending' },
  closed: { label: 'Fechado', className: 'badge badge-neutral' },
};

export default function OwnerSupportPage() {
  const { session, profile, loading } = useProtectedPage('owner');
  const toast = useToast();
  const [tickets, setTickets] = useState(null);
  const [statusFilter, setStatusFilter] = useState('open');

  const [openId, setOpenId] = useState(null);
  const [thread, setThread] = useState(null);
  const [reply, setReply] = useState('');
  const [replying, setReplying] = useState(false);

  function loadTickets() {
    if (!session) return;
    const qs = statusFilter === 'all' ? '' : `?status=${statusFilter}`;
    fetch(`/api/owner/support${qs}`, { headers: { Authorization: `Bearer ${session.access_token}` } })
      .then((res) => res.json())
      .then((data) => setTickets(data.tickets || []));
  }

  useEffect(() => { loadTickets(); }, [session, statusFilter]);

  async function loadThread(id) {
    const res = await fetch(`/api/owner/support?ticket_id=${id}`, {
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

  async function handleReply(e, ticketId) {
    e.preventDefault();
    if (!reply.trim()) return;
    setReplying(true);
    const res = await fetch('/api/owner/support', {
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
    await fetch('/api/owner/support', {
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
    <Shell role="owner" profile={profile}>
      <main className="page">
        <div className="page-head">
          <p className="eyebrow">Painel do administrador</p>
          <h1>Suporte</h1>
          <p className="lede">Chamados abertos pelas empresas e seus colaboradores.</p>
        </div>

        <div className="card filter-bar" style={{ marginBottom: 20 }}>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="open">Abertos</option>
            <option value="closed">Fechados</option>
            <option value="all">Todos</option>
          </select>
        </div>

        {tickets === null ? (
          <p className="meta">Carregando chamados…</p>
        ) : tickets.length === 0 ? (
          <Empty title="Nenhum chamado por aqui">
            Chamados aparecem aqui quando alguma empresa pede ajuda.
          </Empty>
        ) : (
          <div className="card card-flush">
            <table className="table">
              <thead>
                <tr>
                  <th>Empresa</th>
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
                        <td style={{ cursor: 'pointer' }} onClick={() => toggleTicket(t.id)}>{t.account_name}</td>
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
                          <td colSpan={5} style={{ padding: 14 }}>
                            {!thread ? (
                              <p className="meta">Carregando conversa…</p>
                            ) : (
                              <div style={{ display: 'grid', gap: 12 }}>
                                <div style={{ display: 'grid', gap: 8 }}>
                                  {thread.messages.map((m) => (
                                    <div
                                      key={m.id}
                                      style={{
                                        justifySelf: m.sender_role === 'owner' ? 'end' : 'start',
                                        maxWidth: '80%',
                                        background: m.sender_role === 'owner' ? 'var(--accent-soft)' : 'var(--surface-2)',
                                        border: '1px solid var(--border)',
                                        borderRadius: 'var(--radius)',
                                        padding: '8px 12px',
                                      }}
                                    >
                                      <div className="tiny" style={{ marginBottom: 4 }}>
                                        {m.sender_role === 'owner' ? 'Você (suporte)' : thread.ticket.account_name} ·{' '}
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
