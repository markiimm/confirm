import { Fragment, useEffect, useMemo, useState } from 'react';
import { useProtectedPage } from '../../lib/useProtectedPage';
import { PATTERN_TYPES } from '../../lib/patternTypes';
import { EVENT_TYPES } from '../../lib/eventTypes';
import { Shell, Loading, Empty, ROLE_META } from '../../components/ui';
import { useToast } from '../../components/Toast';

// Ignora acento e caixa, pra "joão" achar "Joao" e vice-versa.
function normalize(text) {
  return (text || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

export default function UsersPage() {
  const { session, profile, loading } = useProtectedPage('owner');
  const toast = useToast();
  const [users, setUsers] = useState(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  function loadUsers() {
    if (!session) return;
    fetch('/api/owner/users', { headers: { Authorization: `Bearer ${session.access_token}` } })
      .then((res) => res.json())
      .then((data) => setUsers(data.users || []));
  }

  useEffect(() => { loadUsers(); }, [session]);

  const filtered = useMemo(() => {
    if (!users) return [];
    const term = normalize(search.trim());
    return users.filter((u) => {
      const matchesRole = roleFilter === 'all' || u.role === roleFilter;
      const matchesStatus =
        statusFilter === 'all' || (statusFilter === 'active' ? u.active : !u.active);
      const matchesTerm =
        !term ||
        normalize(u.full_name).includes(term) ||
        normalize(u.email).includes(term) ||
        normalize(u.company_name).includes(term) ||
        normalize(ROLE_META[u.role]?.label).includes(term);
      return matchesRole && matchesStatus && matchesTerm;
    });
  }, [users, search, roleFilter, statusFilter]);

  const hasFilters = search.trim() !== '' || roleFilter !== 'all' || statusFilter !== 'all';

  function clearFilters() {
    setSearch('');
    setRoleFilter('all');
    setStatusFilter('all');
  }

  function startEdit(u) {
    if (editingId === u.id) { setEditingId(null); return; }
    setEditError('');
    setEditingId(u.id);
    setEditForm({
      full_name: u.full_name,
      email: u.email,
      password: '',
      active: u.active,
      plan: u.plan || 'normal',
      pattern_type: u.pattern_type || 'lista_confirmacao',
      business_type: u.business_type || 'casamento',
    });
  }

  async function handleEditSubmit(e, role) {
    e.preventDefault();
    setEditError('');
    setEditSaving(true);
    const body = { id: editingId, full_name: editForm.full_name, email: editForm.email, active: editForm.active };
    if (editForm.password) body.password = editForm.password;
    if (role === 'consultant') {
      body.plan = editForm.plan;
      body.pattern_type = editForm.pattern_type;
      body.business_type = editForm.business_type;
    }
    const res = await fetch('/api/owner/update-user', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setEditSaving(false);
    if (!res.ok) { setEditError(data.error || 'Não foi possível salvar.'); return; }
    toast.success('Usuário atualizado.');
    setEditingId(null);
    loadUsers();
  }

  if (loading) return <Loading />;

  return (
    <Shell role="owner" profile={profile}>
      <main className="page">
        <div className="page-head">
          <p className="eyebrow">Painel do administrador</p>
          <h1>Usuários</h1>
          <p className="lede">Todo mundo com acesso à plataforma: empresas e colaboradores.</p>
        </div>

        <div className="card filter-bar" style={{ marginBottom: 20 }}>
          <input
            placeholder="Buscar por nome, e-mail, empresa ou papel…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1, minWidth: 220 }}
          />
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
            <option value="all">Todos os papéis</option>
            <option value="owner">Administradores</option>
            <option value="consultant">Empresas (titulares)</option>
            <option value="collaborator">Colaboradores</option>
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">Todos os acessos</option>
            <option value="active">Liberados</option>
            <option value="blocked">Bloqueados</option>
          </select>
          {hasFilters && (
            <button className="btn btn-ghost" onClick={clearFilters}>Limpar filtros</button>
          )}
        </div>

        {users !== null && (
          <p className="meta" style={{ marginBottom: 12 }}>
            {filtered.length} de {users.length} usuário{users.length === 1 ? '' : 's'}
          </p>
        )}

        {users === null ? (
          <p className="meta">Carregando usuários…</p>
        ) : filtered.length === 0 ? (
          <Empty title="Nenhum usuário encontrado">
            Ajuste a busca ou os filtros.
          </Empty>
        ) : (
          <div className="card card-flush">
            <table className="table">
              <thead>
                <tr>
                  <th>Usuário</th>
                  <th>Papel</th>
                  <th>Empresa</th>
                  <th>Acesso</th>
                  <th>Criado em</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => {
                  const role = ROLE_META[u.role] || ROLE_META.consultant;
                  const isEditing = editingId === u.id;
                  return (
                    <Fragment key={u.id}>
                      <tr>
                        <td>
                          <div style={{ fontWeight: 500 }}>{u.full_name}</div>
                          <div className="tiny">{u.email}</div>
                        </td>
                        <td><span className={role.className}>{role.label}</span></td>
                        <td>{u.company_name || (u.role === 'consultant' ? u.full_name : '—')}</td>
                        <td>
                          <span className={u.active ? 'badge badge-confirmed' : 'badge badge-neutral'}>
                            {u.active ? 'Liberado' : 'Bloqueado'}
                          </span>
                        </td>
                        <td className="meta">
                          {new Date(u.created_at).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <button className="btn btn-ghost" onClick={() => startEdit(u)}>
                            {isEditing ? 'Cancelar' : 'Editar'}
                          </button>
                        </td>
                      </tr>
                      {isEditing && (
                        <tr>
                          <td colSpan={6} style={{ padding: '14px' }}>
                            <form onSubmit={(e) => handleEditSubmit(e, u.role)} style={{ display: 'grid', gap: 12 }}>
                              {editError && <div className="alert alert-error">{editError}</div>}
                              <div className="grid-two">
                                <label className="field" style={{ margin: 0 }}>
                                  <span>Nome</span>
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
                                <label className="field" style={{ margin: 0, display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 22 }}>
                                  <input
                                    type="checkbox"
                                    style={{ width: 'auto' }}
                                    checked={editForm.active}
                                    onChange={(e) => setEditForm({ ...editForm, active: e.target.checked })}
                                  />
                                  <span style={{ margin: 0 }}>Conta liberada</span>
                                </label>
                                {u.role === 'consultant' && (
                                  <>
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
                                  </>
                                )}
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
