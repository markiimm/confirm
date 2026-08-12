import { useEffect, useMemo, useState } from 'react';
import { useProtectedPage } from '../../lib/useProtectedPage';
import { Shell, Loading, Empty, ROLE_META } from '../../components/ui';

// Ignora acento e caixa, pra "joão" achar "Joao" e vice-versa.
function normalize(text) {
  return (text || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

export default function UsersPage() {
  const { session, profile, loading } = useProtectedPage('owner');
  const [users, setUsers] = useState(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    if (!session) return;
    fetch('/api/owner/users', { headers: { Authorization: `Bearer ${session.access_token}` } })
      .then((res) => res.json())
      .then((data) => setUsers(data.users || []));
  }, [session]);

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
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => {
                  const role = ROLE_META[u.role] || ROLE_META.consultant;
                  return (
                    <tr key={u.id}>
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
                    </tr>
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
