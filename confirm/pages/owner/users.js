import { useEffect, useMemo, useState } from 'react';
import { useProtectedPage } from '../../lib/useProtectedPage';
import { Shell, Loading, Empty, ROLE_META } from '../../components/ui';

export default function UsersPage() {
  const { session, profile, loading } = useProtectedPage('owner');
  const [users, setUsers] = useState(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  useEffect(() => {
    if (!session) return;
    fetch('/api/owner/users', { headers: { Authorization: `Bearer ${session.access_token}` } })
      .then((res) => res.json())
      .then((data) => setUsers(data.users || []));
  }, [session]);

  const filtered = useMemo(() => {
    if (!users) return [];
    const term = search.trim().toLowerCase();
    return users.filter((u) => {
      const matchesRole = roleFilter === 'all' || u.role === roleFilter;
      const matchesTerm =
        !term ||
        u.full_name.toLowerCase().includes(term) ||
        u.email.toLowerCase().includes(term) ||
        (u.company_name || '').toLowerCase().includes(term);
      return matchesRole && matchesTerm;
    });
  }, [users, search, roleFilter]);

  if (loading) return <Loading />;

  return (
    <Shell role="owner" profile={profile}>
      <main className="page">
        <div className="page-head">
          <p className="eyebrow">Painel do administrador</p>
          <h1>Usuários</h1>
          <p className="lede">Todo mundo com acesso à plataforma: empresas e colaboradores.</p>
        </div>

        <div className="card" style={{ marginBottom: 20, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <input
            placeholder="Buscar por nome, e-mail ou empresa…"
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
        </div>

        {users === null ? (
          <p className="meta">Carregando usuários…</p>
        ) : filtered.length === 0 ? (
          <Empty title="Nenhum usuário encontrado">
            Ajuste a busca ou o filtro de papel.
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
