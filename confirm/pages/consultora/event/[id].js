import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useProtectedPage } from '../../../lib/useProtectedPage';
import { buildInviteMessage } from '../../../lib/eventTypes';
import { Shell, Loading, Empty, Tally, STATUS_META } from '../../../components/ui';
import { useToast } from '../../../components/Toast';

export default function EventDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const { session, profile, loading } = useProtectedPage(['consultant', 'collaborator']);
  const toast = useToast();

  const [data, setData] = useState(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState([]);
  const [messageDraft, setMessageDraft] = useState('');
  const [editingMessage, setEditingMessage] = useState(false);
  const [savingMessage, setSavingMessage] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  async function load() {
    if (!session || !id) return;
    const res = await fetch(`/api/consultant/event-detail?event_id=${id}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!res.ok) { setData(false); return; }
    const json = await res.json();
    setData(json);
    setMessageDraft(json.event.invite_message_template || '');
  }

  useEffect(() => { load(); }, [session, id]);

  async function patchEvent(body, successMsg) {
    const res = await fetch('/api/consultant/event-detail', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ event_id: id, ...body }),
    });
    if (!res.ok) { toast.error('Não foi possível salvar.'); return false; }
    if (successMsg) toast.success(successMsg);
    await load();
    return true;
  }

  async function saveMessage() {
    setSavingMessage(true);
    const ok = await patchEvent({ invite_message_template: messageDraft }, 'Mensagem do convite atualizada.');
    setSavingMessage(false);
    if (ok) setEditingMessage(false);
  }

  async function setGuestStatus(guestId, status) {
    setBusyId(guestId);
    const res = await fetch('/api/consultant/guest', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ guest_id: guestId, confirmation_status: status }),
    });
    setBusyId(null);
    if (!res.ok) { toast.error('Não foi possível atualizar.'); return; }
    toast.success('Status atualizado.');
    load();
  }

  async function removeGuest(guestId, name) {
    if (!window.confirm(`Remover ${name} da lista?`)) return;
    setBusyId(guestId);
    const res = await fetch('/api/consultant/guest', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ guest_id: guestId }),
    });
    setBusyId(null);
    if (!res.ok) { toast.error('Não foi possível remover.'); return; }
    toast.success('Convidado removido.');
    load();
  }

  async function bulkResend() {
    setBulkBusy(true);
    const res = await fetch('/api/consultant/resend-invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ guest_ids: selected }),
    });
    const json = await res.json();
    setBulkBusy(false);
    if (!res.ok) { toast.error('Não foi possível reenviar.'); return; }
    toast.success(`${json.sent} mensagem(ns) reenviada(s).`);
    if (json.failures?.length) toast.error(`${json.failures.length} falharam.`);
    setSelected([]);
    load();
  }

  async function bulkRemove() {
    if (!window.confirm(`Remover ${selected.length} convidado(s) da lista?`)) return;
    setBulkBusy(true);
    const res = await fetch('/api/consultant/guest', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ guest_ids: selected }),
    });
    const json = await res.json();
    setBulkBusy(false);
    if (!res.ok) { toast.error('Não foi possível remover.'); return; }
    toast.success(`${json.removed} convidado(s) removido(s).`);
    setSelected([]);
    load();
  }

  if (loading || data === null) return <Loading />;
  if (data === false) {
    return (
      <Shell role={profile?.role}>
        <main className="page page-narrow">
          <Empty title="Evento não encontrado">Ele pode ter sido removido, ou não pertence à sua conta.</Empty>
        </main>
      </Shell>
    );
  }

  const { event, guests } = data;
  const counts = {
    confirmed: guests.filter((g) => g.confirmation_status === 'confirmed').length,
    declined: guests.filter((g) => g.confirmation_status === 'declined').length,
    pending: guests.filter((g) => g.confirmation_status === 'pending').length,
  };
  const companions = guests
    .filter((g) => g.confirmation_status === 'confirmed')
    .reduce((sum, g) => sum + (g.companions || 0), 0);

  const visible = guests
    .filter((g) => (filter === 'all' ? true : g.confirmation_status === filter))
    .filter((g) => {
      if (!search.trim()) return true;
      const q = search.trim().toLowerCase();
      return g.full_name.toLowerCase().includes(q) || g.phone.includes(q);
    });

  const allVisibleSelected = visible.length > 0 && visible.every((g) => selected.includes(g.id));
  const preview = buildInviteMessage({ ...event, invite_message_template: messageDraft }, 'Marcos Vinicius');
  const portalUrl = event.portal_token
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/portal/${event.portal_token}`
    : null;

  function toggleAllVisible() {
    if (allVisibleSelected) {
      setSelected(selected.filter((id) => !visible.some((g) => g.id === id)));
    } else {
      setSelected([...new Set([...selected, ...visible.map((g) => g.id)])]);
    }
  }

  return (
    <Shell role={profile.role}>
      <main className="page">
        <p className="eyebrow" style={{ marginBottom: 8 }}>
          <a href="/consultora/dashboard">← Meus eventos</a>
        </p>
        <div className="page-head head-row">
          <div>
            <h1>{event.event_name}</h1>
            <p className="lede">
              {new Date(event.event_date).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}
              {' · '}{guests.length} convidado{guests.length === 1 ? '' : 's'}
              {companions > 0 && ` · ${counts.confirmed + companions} pessoas esperadas`}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <a href={`/upload?event_id=${event.id}`} className="btn btn-secondary">Enviar planilha</a>
            {guests.length > 0 && (
              <a href={`/api/export-guests?event_id=${event.id}`} className="btn btn-ghost">Baixar lista</a>
            )}
          </div>
        </div>

        {guests.length > 0 && (
          <section className="card" style={{ marginBottom: 20 }}>
            <Tally confirmed={counts.confirmed} declined={counts.declined} pending={counts.pending} />
          </section>
        )}

        {/* Portal somente-leitura para o cliente final */}
        <section className="card" style={{ marginBottom: 20 }}>
          <div className="head-row">
            <div>
              <h3 style={{ marginBottom: 4 }}>Acompanhamento do cliente</h3>
              <p className="meta">
                {portalUrl
                  ? 'Link ativo. Quem tiver o endereço vê a lista, sem poder alterar nada.'
                  : 'Gere um link para os noivos ou organizadores acompanharem sozinhos.'}
              </p>
            </div>
            {portalUrl ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    navigator.clipboard.writeText(portalUrl);
                    toast.success('Link copiado.');
                  }}
                >
                  Copiar link
                </button>
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    if (window.confirm('Desativar o link? Quem já tem o endereço perde o acesso.')) {
                      patchEvent({ revoke_portal_token: true }, 'Link desativado.');
                    }
                  }}
                >
                  Desativar
                </button>
              </div>
            ) : (
              <button className="btn btn-primary" onClick={() => patchEvent({ generate_portal_token: true }, 'Link criado.')}>
                Gerar link
              </button>
            )}
          </div>
          {portalUrl && (
            <div className="alert alert-info" style={{ marginTop: 14, marginBottom: 0, wordBreak: 'break-all' }}>
              {portalUrl}
            </div>
          )}
        </section>

        {/* Editor da mensagem */}
        <section className="card" style={{ marginBottom: 20 }}>
          <div className="head-row" style={{ marginBottom: editingMessage ? 16 : 0 }}>
            <div>
              <h3 style={{ marginBottom: 4 }}>Mensagem do convite</h3>
              <p className="meta">
                {event.invite_message_template ? 'Personalizada para este evento.' : `Usando o texto padrão de ${event.event_type}.`}
              </p>
            </div>
            <button className="btn btn-ghost" onClick={() => setEditingMessage(!editingMessage)}>
              {editingMessage ? 'Cancelar' : 'Editar mensagem'}
            </button>
          </div>

          {editingMessage && (
            <div style={{ marginTop: 4 }}>
              <label className="field">
                <span>Texto enviado ao convidado</span>
                <textarea rows={4} value={messageDraft} onChange={(e) => setMessageDraft(e.target.value)} />
                <span className="field-hint">
                  Use {'{{convidado}}'}, {'{{evento}}'} e {'{{data}}'}. Deixe em branco para o texto padrão.
                </span>
              </label>
              <div className="alert alert-info">
                <strong style={{ display: 'block', marginBottom: 4, fontSize: 12, color: 'var(--text-muted)' }}>
                  Pré-visualização
                </strong>
                {preview}
              </div>
              <button className="btn btn-primary" onClick={saveMessage} disabled={savingMessage}>
                {savingMessage ? 'Salvando…' : 'Salvar mensagem'}
              </button>
            </div>
          )}
        </section>

        {/* Lista de convidados */}
        <section>
          <div className="head-row" style={{ marginBottom: 14 }}>
            <h3>Convidados</h3>
            <div className="segmented">
              {['all', 'pending', 'confirmed', 'declined'].map((f) => (
                <button key={f} className={filter === f ? 'is-active' : ''} onClick={() => setFilter(f)}>
                  {f === 'all' ? 'Todos' : STATUS_META[f].label}
                </button>
              ))}
            </div>
          </div>

          {guests.length === 0 ? (
            <Empty
              title="Nenhum convidado ainda"
              action={<a href={`/upload?event_id=${event.id}`} className="btn btn-primary">Enviar planilha</a>}
            >
              Suba a lista de convidados para começar a enviar os convites.
            </Empty>
          ) : (
            <>
              <input
                type="search"
                placeholder="Buscar por nome ou telefone…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: '100%', padding: '11px 13px', marginBottom: 12,
                  border: '1px solid var(--border-strong)', borderRadius: 'var(--radius)',
                  background: 'var(--surface-2)', color: 'var(--text)',
                  fontFamily: 'inherit', fontSize: 15,
                }}
              />

              {selected.length > 0 && (
                <div className="alert alert-info" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <strong>{selected.length} selecionado{selected.length > 1 ? 's' : ''}</strong>
                  <button className="btn btn-secondary" onClick={bulkResend} disabled={bulkBusy}>
                    {bulkBusy ? 'Enviando…' : 'Reenviar mensagem'}
                  </button>
                  <button className="btn btn-ghost" onClick={bulkRemove} disabled={bulkBusy}>Remover</button>
                  <button className="btn btn-ghost" onClick={() => setSelected([])}>Limpar seleção</button>
                </div>
              )}

              {visible.length === 0 ? (
                <p className="meta">Nenhum convidado encontrado.</p>
              ) : (
                <div className="card card-flush">
                  <table className="table">
                    <thead>
                      <tr>
                        <th style={{ width: 36 }}>
                          <input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} aria-label="Selecionar todos" />
                        </th>
                        <th>Convidado</th>
                        <th>Status</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((g) => {
                        const meta = STATUS_META[g.confirmation_status];
                        const busy = busyId === g.id;
                        return (
                          <tr key={g.id}>
                            <td>
                              <input
                                type="checkbox"
                                checked={selected.includes(g.id)}
                                onChange={() =>
                                  setSelected(
                                    selected.includes(g.id)
                                      ? selected.filter((x) => x !== g.id)
                                      : [...selected, g.id]
                                  )
                                }
                                aria-label={`Selecionar ${g.full_name}`}
                              />
                            </td>
                            <td>
                              <div style={{ fontWeight: 500 }}>
                                {g.full_name}
                                {g.companions > 0 && (
                                  <span className="badge badge-neutral" style={{ marginLeft: 8 }}>
                                    +{g.companions}
                                  </span>
                                )}
                              </div>
                              <div className="tiny">{g.phone}</div>
                              {g.notes && (
                                <div className="tiny" style={{ marginTop: 4, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                                  “{g.notes}”
                                </div>
                              )}
                            </td>
                            <td><span className={meta.className}>{meta.label}</span></td>
                            <td>
                              <div className="guest-row-actions">
                                {g.confirmation_status !== 'confirmed' && (
                                  <button className="icon-btn" title="Marcar como confirmado" disabled={busy} onClick={() => setGuestStatus(g.id, 'confirmed')}>✓</button>
                                )}
                                {g.confirmation_status !== 'declined' && (
                                  <button className="icon-btn" title="Marcar como não vai" disabled={busy} onClick={() => setGuestStatus(g.id, 'declined')}>✕</button>
                                )}
                                {g.confirmation_status !== 'pending' && (
                                  <button className="icon-btn" title="Voltar para pendente" disabled={busy} onClick={() => setGuestStatus(g.id, 'pending')}>↺</button>
                                )}
                                <button className="icon-btn is-danger" title="Remover" disabled={busy} onClick={() => removeGuest(g.id, g.full_name)}>🗑</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </section>
      </main>
    </Shell>
  );
}
