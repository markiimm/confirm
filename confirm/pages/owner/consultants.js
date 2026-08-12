import { Fragment, useEffect, useState } from 'react';
import { useProtectedPage } from '../../lib/useProtectedPage';
import { EVENT_TYPES } from '../../lib/eventTypes';
import { PATTERN_TYPES } from '../../lib/patternTypes';
import { Shell, Loading, Empty, SUBSCRIPTION_META } from '../../components/ui';
import { useToast } from '../../components/Toast';

const BLANK = {
  full_name: '', email: '', password: '',
  plan: 'normal', pattern_type: 'lista_confirmacao', business_type: 'casamento',
};

export default function ConsultantsPage() {
  const { session, profile, loading } = useProtectedPage('owner');
  const toast = useToast();
  const [consultants, setConsultants] = useState(null);
  const [form, setForm] = useState(BLANK);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [teams, setTeams] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  async function loadConsultants(token) {
    const res = await fetch('/api/owner/consultants', { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    setConsultants(data.consultants || []);
  }

  useEffect(() => { if (session) loadConsultants(session.access_token); }, [session]);

  async function toggleTeam(consultantId) {
    if (expandedId === consultantId) { setExpandedId(null); return; }
    setExpandedId(consultantId);
    if (teams[consultantId]) return;
    const res = await fetch(`/api/owner/company-team?consultant_id=${consultantId}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const data = await res.json();
    setTeams((prev) => ({ ...prev, [consultantId]: data.collaborators || [] }));
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    const res = await fetch('/api/owner/create-consultant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Não foi possível criar a empresa.');
      setSaving(false);
      return;
    }
    toast.success('Empresa cadastrada.');
    setForm(BLANK);
    setShowForm(false);
    await loadConsultants(session.access_token);
    setSaving(false);
  }

  async function toggleActive(consultant) {
    await fetch('/api/owner/update-user', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ id: consultant.id, active: !consultant.active }),
    });
    toast.success(consultant.active ? 'Acesso bloqueado.' : 'Acesso liberado.');
    loadConsultants(session.access_token);
  }

  function startEdit(c) {
    if (editingId === c.id) { setEditingId(null); return; }
    setEditError('');
    setEditingId(c.id);
    setEditForm({
      full_name: c.full_name,
      email: c.email,
      password: '',
      plan: c.plan,
      pattern_type: c.pattern_type,
      business_type: c.business_type,
    });
  }

  async function handleEditSubmit(e) {
    e.preventDefault();
    setEditError('');
    setEditSaving(true);
    const body = { id: editingId, ...editForm };
    if (!body.password) delete body.password;
    const res = await fetch('/api/owner/update-user', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setEditSaving(false);
    if (!res.ok) { setEditError(data.error || 'Não foi possível salvar.'); return; }
    toast.success('Empresa atualizada.');
    setEditingId(null);
    loadConsultants(session.access_token);
  }

  if (loading) return <Loading />;

  return (
    <Shell role="owner" profile={profile}>
      <main className="page">
        <div className="page-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <p className="eyebrow">Painel do administrador</p>
            <h1>Empresas</h1>
            <p className="lede">Quem usa a plataforma e em que situação está cada conta.</p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancelar' : 'Cadastrar empresa'}
          </button>
        </div>

        {showForm && (
          <form className="card" onSubmit={handleCreate} style={{ marginBottom: 24 }}>
            <h3 style={{ marginBottom: 4 }}>Nova empresa</h3>
            <p className="meta" style={{ marginBottom: 18 }}>
              Contas criadas aqui já entram com assinatura ativa, sem período de teste.
            </p>

            {error && <div className="alert alert-error">{error}</div>}

            <div className="grid-two">
              <label className="field">
                <span>Nome da empresa</span>
                <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
              </label>
              <label className="field">
                <span>E-mail de acesso</span>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              </label>
              <label className="field">
                <span>Senha provisória</span>
                <input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} minLength={6} required />
                <span className="field-hint">Passe para o cliente trocar depois.</span>
              </label>
              <label className="field">
                <span>Plano</span>
                <select value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })}>
                  <option value="normal">Normal</option>
                  <option value="pro">PRO</option>
                </select>
              </label>
              <label className="field">
                <span>Como o negócio funciona</span>
                <select value={form.pattern_type} onChange={(e) => setForm({ ...form, pattern_type: e.target.value })}>
                  {Object.entries(PATTERN_TYPES).map(([key, p]) => <option key={key} value={key}>{p.label}</option>)}
                </select>
              </label>
              <label className="field">
                <span>Tipo de evento</span>
                <select value={form.business_type} onChange={(e) => setForm({ ...form, business_type: e.target.value })}>
                  {Object.entries(EVENT_TYPES).map(([key, t]) => <option key={key} value={key}>{t.label}</option>)}
                </select>
              </label>
            </div>

            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Cadastrando…' : 'Cadastrar empresa'}
            </button>
          </form>
        )}

        {consultants === null ? (
          <p className="meta">Carregando empresas…</p>
        ) : consultants.length === 0 ? (
          <Empty
            title="Nenhuma empresa ainda"
            action={<button className="btn btn-primary" onClick={() => setShowForm(true)}>Cadastrar a primeira</button>}
          >
            Empresas aparecem aqui quando você as cadastra ou quando alguém se inscreve pelo site.
          </Empty>
        ) : (
          <div className="card card-flush">
            <table className="table">
              <thead>
                <tr>
                  <th />
                  <th>Empresa</th>
                  <th>Plano</th>
                  <th>Assinatura</th>
                  <th>Acesso</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {consultants.map((c) => {
                  const sub = SUBSCRIPTION_META[c.subscription_status] || SUBSCRIPTION_META.canceled;
                  const isOpen = expandedId === c.id;
                  const team = teams[c.id];
                  return (
                    <Fragment key={c.id}>
                      <tr>
                        <td style={{ width: 32 }}>
                          <button
                            className="btn btn-ghost"
                            style={{ padding: '2px 8px' }}
                            onClick={() => toggleTeam(c.id)}
                            aria-label="Ver colaboradores"
                          >
                            {isOpen ? '▾' : '▸'}
                          </button>
                        </td>
                        <td>
                          <div style={{ fontWeight: 500 }}>{c.full_name}</div>
                          <div className="tiny">{c.email}</div>
                        </td>
                        <td>{c.plan === 'pro' ? 'PRO' : 'Normal'}</td>
                        <td><span className={sub.className}>{sub.label}</span></td>
                        <td>
                          <span className={c.active ? 'badge badge-confirmed' : 'badge badge-neutral'}>
                            {c.active ? 'Liberado' : 'Bloqueado'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <button className="btn btn-ghost" onClick={() => startEdit(c)}>
                            {editingId === c.id ? 'Cancelar' : 'Editar'}
                          </button>{' '}
                          <button className="btn btn-ghost" onClick={() => toggleActive(c)}>
                            {c.active ? 'Bloquear' : 'Liberar'}
                          </button>
                        </td>
                      </tr>
                      {editingId === c.id && (
                        <tr>
                          <td />
                          <td colSpan={5} style={{ padding: '14px' }}>
                            <form onSubmit={handleEditSubmit} style={{ display: 'grid', gap: 12 }}>
                              {editError && <div className="alert alert-error">{editError}</div>}
                              <div className="grid-two">
                                <label className="field" style={{ margin: 0 }}>
                                  <span>Nome da empresa</span>
                                  <input
                                    value={editForm.full_name}
                                    onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                                    required
                                  />
                                </label>
                                <label className="field" style={{ margin: 0 }}>
                                  <span>E-mail de acesso</span>
                                  <input
                                    type="email"
                                    value={editForm.email}
                                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                                    required
                                  />
                                </label>
                                <label className="field" style={{ margin: 0 }}>
                                  <span>Nova senha</span>
                                  <input
                                    value={editForm.password}
                                    onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                                    placeholder="Deixe em branco para manter"
                                    minLength={6}
                                  />
                                </label>
                                <label className="field" style={{ margin: 0 }}>
                                  <span>Plano</span>
                                  <select value={editForm.plan} onChange={(e) => setEditForm({ ...editForm, plan: e.target.value })}>
                                    <option value="normal">Normal</option>
                                    <option value="pro">PRO</option>
                                  </select>
                                </label>
                                <label className="field" style={{ margin: 0 }}>
                                  <span>Como o negócio funciona</span>
                                  <select
                                    value={editForm.pattern_type}
                                    onChange={(e) => setEditForm({ ...editForm, pattern_type: e.target.value })}
                                  >
                                    {Object.entries(PATTERN_TYPES).map(([key, p]) => <option key={key} value={key}>{p.label}</option>)}
                                  </select>
                                </label>
                                <label className="field" style={{ margin: 0 }}>
                                  <span>Tipo de evento</span>
                                  <select
                                    value={editForm.business_type}
                                    onChange={(e) => setEditForm({ ...editForm, business_type: e.target.value })}
                                  >
                                    {Object.entries(EVENT_TYPES).map(([key, t]) => <option key={key} value={key}>{t.label}</option>)}
                                  </select>
                                </label>
                              </div>
                              <div>
                                <button type="submit" className="btn btn-primary" disabled={editSaving}>
                                  {editSaving ? 'Salvando…' : 'Salvar alterações'}
                                </button>
                              </div>
                            </form>
                          </td>
                        </tr>
                      )}
                      {isOpen && (
                        <tr>
                          <td />
                          <td colSpan={5} style={{ background: 'var(--bg-soft, rgba(255,255,255,0.02))', padding: '10px 14px' }}>
                            {team === undefined ? (
                              <p className="meta">Carregando colaboradores…</p>
                            ) : team.length === 0 ? (
                              <p className="meta">Essa empresa ainda não tem colaboradores.</p>
                            ) : (
                              <div style={{ display: 'grid', gap: 6 }}>
                                {team.map((m) => (
                                  <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                                    <div>
                                      <span style={{ fontWeight: 500 }}>{m.full_name}</span>{' '}
                                      <span className="tiny">{m.email}</span>
                                    </div>
                                    <span className={m.active ? 'badge badge-confirmed' : 'badge badge-neutral'}>
                                      {m.active ? 'Liberado' : 'Bloqueado'}
                                    </span>
                                  </div>
                                ))}
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
