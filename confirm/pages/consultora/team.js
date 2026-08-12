import { Fragment, useEffect, useState } from 'react';
import { useProtectedPage } from '../../lib/useProtectedPage';
import { Shell, Loading, Empty } from '../../components/ui';
import { useToast } from '../../components/Toast';

const BLANK = { full_name: '', email: '', password: '', can_edit: true };

export default function TeamPage() {
  const { session, profile, loading } = useProtectedPage('consultant');
  const toast = useToast();
  const [members, setMembers] = useState(null);
  const [form, setForm] = useState(BLANK);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [access, setAccess] = useState({});

  async function load() {
    if (!session) return;
    const res = await fetch('/api/consultant/team', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const json = await res.json();
    setMembers(json.members || []);
  }

  useEffect(() => { load(); }, [session]);

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    const res = await fetch('/api/consultant/team', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) { setError(json.error || 'Não foi possível adicionar.'); return; }
    toast.success('Colaborador adicionado.');
    setForm(BLANK);
    setShowForm(false);
    load();
  }

  async function toggleCanEdit(member) {
    await fetch('/api/consultant/team', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ member_id: member.id, can_edit: !member.can_edit }),
    });
    toast.success(member.can_edit ? 'Agora só visualiza.' : 'Agora pode editar.');
    load();
  }

  async function loadAccess(memberId) {
    const res = await fetch(`/api/consultant/collaborator-events?member_id=${memberId}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const data = await res.json();
    setAccess((prev) => ({ ...prev, [memberId]: data }));
  }

  async function toggleExpand(memberId) {
    if (expandedId === memberId) { setExpandedId(null); return; }
    setExpandedId(memberId);
    if (!access[memberId]) await loadAccess(memberId);
  }

  async function toggleEventAccess(memberId, eventId, assigned) {
    await fetch('/api/consultant/collaborator-events', {
      method: assigned ? 'DELETE' : 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ member_id: memberId, event_id: eventId }),
    });
    await loadAccess(memberId);
  }

  async function removeMember(member) {
    if (!window.confirm(`Remover o acesso de ${member.full_name}?`)) return;
    const res = await fetch('/api/consultant/team', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ member_id: member.id }),
    });
    if (!res.ok) { toast.error('Não foi possível remover.'); return; }
    toast.success('Acesso removido.');
    load();
  }

  if (loading) return <Loading />;

  return (
    <Shell role={profile.role}>
      <main className="page page-narrow">
        <div className="page-head head-row">
          <div>
            <p className="eyebrow">Sua conta</p>
            <h1>Equipe</h1>
            <p className="lede">Quem mais pode gerenciar os eventos da sua empresa.</p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancelar' : 'Adicionar pessoa'}
          </button>
        </div>

        <div className="alert alert-info">
          Colaboradores criam eventos, sobem listas e acompanham confirmações — mas não
          acessam a assinatura nem gerenciam a equipe.
        </div>

        {showForm && (
          <form className="card" onSubmit={handleCreate} style={{ marginBottom: 20 }}>
            <h3 style={{ marginBottom: 16 }}>Novo colaborador</h3>
            {error && <div className="alert alert-error">{error}</div>}
            <label className="field">
              <span>Nome</span>
              <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
            </label>
            <label className="field">
              <span>E-mail de acesso</span>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </label>
            <label className="field">
              <span>Senha provisória</span>
              <input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} minLength={6} required />
              <span className="field-hint">A pessoa pode trocar depois em “Esqueci minha senha”.</span>
            </label>
            <label className="field" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                style={{ width: 'auto' }}
                checked={form.can_edit}
                onChange={(e) => setForm({ ...form, can_edit: e.target.checked })}
              />
              <span style={{ margin: 0 }}>Pode criar e editar eventos/convidados (desmarque para somente leitura)</span>
            </label>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Adicionando…' : 'Adicionar colaborador'}
            </button>
          </form>
        )}

        {members === null ? (
          <p className="meta">Carregando equipe…</p>
        ) : members.length === 0 ? (
          <Empty
            title="Você é a única pessoa com acesso"
            action={<button className="btn btn-primary" onClick={() => setShowForm(true)}>Adicionar pessoa</button>}
          >
            Adicione assistentes para dividir o trabalho dos eventos.
          </Empty>
        ) : (
          <div className="card card-flush">
            <table className="table">
              <thead><tr><th>Colaborador</th><th>Permissão</th><th /></tr></thead>
              <tbody>
                {members.map((m) => {
                  const isOpen = expandedId === m.id;
                  const memberAccess = access[m.id];
                  return (
                    <Fragment key={m.id}>
                      <tr>
                        <td>
                          <div style={{ fontWeight: 500 }}>{m.full_name}</div>
                          <div className="tiny">{m.email}</div>
                        </td>
                        <td>
                          <span className={m.can_edit ? 'badge badge-confirmed' : 'badge badge-pending'}>
                            {m.can_edit ? 'Pode editar' : 'Somente leitura'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <button className="btn btn-ghost" onClick={() => toggleExpand(m.id)}>
                            {isOpen ? 'Fechar' : 'Eventos'}
                          </button>{' '}
                          <button className="btn btn-ghost" onClick={() => toggleCanEdit(m)}>
                            {m.can_edit ? 'Tornar somente leitura' : 'Permitir edição'}
                          </button>{' '}
                          <button className="btn btn-ghost" onClick={() => removeMember(m)}>Remover acesso</button>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr>
                          <td colSpan={3} style={{ padding: 14 }}>
                            {!memberAccess ? (
                              <p className="meta">Carregando eventos…</p>
                            ) : memberAccess.events.length === 0 ? (
                              <p className="meta">Você ainda não tem eventos cadastrados.</p>
                            ) : (
                              <div>
                                <p className="meta" style={{ marginBottom: 10 }}>
                                  {memberAccess.assigned.length === 0
                                    ? 'Sem restrição: essa pessoa vê todos os seus eventos. Marque abaixo para limitar a eventos específicos.'
                                    : 'Vendo só os eventos marcados abaixo.'}
                                </p>
                                <div style={{ display: 'grid', gap: 8 }}>
                                  {memberAccess.events.map((ev) => {
                                    const assigned = memberAccess.assigned.includes(ev.id);
                                    return (
                                      <label key={ev.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <input
                                          type="checkbox"
                                          style={{ width: 'auto' }}
                                          checked={assigned}
                                          onChange={() => toggleEventAccess(m.id, ev.id, assigned)}
                                        />
                                        <span>{ev.event_name}</span>
                                        <span className="tiny">
                                          {new Date(ev.event_date).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </span>
                                      </label>
                                    );
                                  })}
                                </div>
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
