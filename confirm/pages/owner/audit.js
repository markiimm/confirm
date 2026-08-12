import { useEffect, useState } from 'react';
import { useProtectedPage } from '../../lib/useProtectedPage';
import { Shell, Loading, Empty } from '../../components/ui';

const ACTION_LABEL = {
  'consultant.create': 'Cadastrou empresa',
  'user.update': 'Editou usuário',
};

const FIELD_LABEL = {
  full_name: 'Nome',
  email: 'E-mail',
  active: 'Acesso',
  plan: 'Plano',
  pattern_type: 'Modelo de negócio',
  business_type: 'Tipo de evento',
  password_changed: 'Senha alterada',
};

function formatDetails(details) {
  if (!details) return '—';
  const parts = Object.entries(details)
    .filter(([, v]) => v !== undefined && v !== null && v !== '' && v !== false)
    .map(([k, v]) => `${FIELD_LABEL[k] || k}: ${v === true ? 'sim' : v}`);
  return parts.length ? parts.join(' · ') : '—';
}

export default function AuditLogPage() {
  const { session, profile, loading } = useProtectedPage('owner');
  const [entries, setEntries] = useState(null);

  useEffect(() => {
    if (!session) return;
    fetch('/api/owner/audit-log', { headers: { Authorization: `Bearer ${session.access_token}` } })
      .then((res) => res.json())
      .then((data) => setEntries(data.entries || []));
  }, [session]);

  if (loading) return <Loading />;

  return (
    <Shell role="owner" profile={profile}>
      <main className="page">
        <div className="page-head">
          <p className="eyebrow">Painel do administrador</p>
          <h1>Log de auditoria</h1>
          <p className="lede">Últimas 200 ações administrativas realizadas na plataforma.</p>
        </div>

        {entries === null ? (
          <p className="meta">Carregando…</p>
        ) : entries.length === 0 ? (
          <Empty title="Nenhuma ação registrada ainda">
            Ações administrativas (cadastrar empresa, editar usuário, etc.) aparecem aqui.
          </Empty>
        ) : (
          <div className="card card-flush">
            <table className="table">
              <thead>
                <tr>
                  <th>Quando</th>
                  <th>Quem</th>
                  <th>Ação</th>
                  <th>Detalhes</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id}>
                    <td className="meta">
                      {new Date(e.created_at).toLocaleString('pt-BR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td>{e.actor_name}</td>
                    <td>{ACTION_LABEL[e.action] || e.action}</td>
                    <td className="meta">{formatDetails(e.details)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </Shell>
  );
}
