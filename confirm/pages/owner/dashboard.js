import { useEffect, useState } from 'react';
import { useProtectedPage } from '../../lib/useProtectedPage';
import { EVENT_TYPES } from '../../lib/eventTypes';
import { Shell, Loading, Counter, ResponseRing, BarList, Empty } from '../../components/ui';

export default function OwnerDashboard() {
  const { session, loading } = useProtectedPage('owner');
  const [stats, setStats] = useState(null);
  const [lens, setLens] = useState('empresas');

  useEffect(() => {
    if (!session) return;
    fetch('/api/owner/stats', { headers: { Authorization: `Bearer ${session.access_token}` } })
      .then((r) => r.json())
      .then(setStats);
  }, [session]);

  if (loading) return <Loading />;

  if (!stats) {
    return (
      <Shell role="owner">
        <main className="page"><p className="meta">Carregando números…</p></main>
      </Shell>
    );
  }

  const cards = [
    { value: stats.consultants, label: 'Empresas na plataforma', trend: `${stats.consultants_active} com acesso liberado`, hue: 'var(--accent)' },
    { value: stats.consultants_paying, label: 'Assinaturas pagas', trend: `${stats.consultants_trialing} ainda em teste`, hue: 'var(--confirmed)' },
    { value: stats.events, label: 'Eventos criados', trend: `${stats.guests.toLocaleString('pt-BR')} convidados no total`, hue: 'var(--pending)' },
    { value: stats.response_rate, suffix: '%', label: 'Taxa de resposta', trend: `${stats.confirmation_rate}% confirmaram presença`, hue: 'var(--confirmed)' },
  ];

  const lensData =
    lens === 'empresas'
      ? stats.top_consultants
      : stats.events_by_type.map((t) => ({
          label: EVENT_TYPES[t.label]?.label || t.label,
          value: t.value,
        }));

  return (
    <Shell role="owner">
      <main className="page">
        <div className="page-head">
          <p className="eyebrow">Administração</p>
          <h1>Visão geral</h1>
          <p className="lede">Como a plataforma está sendo usada, somando todas as empresas.</p>
        </div>

        <div className="grid-stats" style={{ marginBottom: 16 }}>
          {cards.map((c) => (
            <div className="stat" key={c.label} style={{ '--stat-hue': c.hue }}>
              <div className="stat-value" style={{ color: c.hue }}>
                <Counter value={c.value} suffix={c.suffix || ''} />
              </div>
              <div className="stat-label">{c.label}</div>
              <div className="stat-trend">{c.trend}</div>
            </div>
          ))}
        </div>

        <div className="grid-dash" style={{ marginBottom: 16 }}>
          <section className="card">
            <h3 style={{ marginBottom: 4 }}>Respostas dos convidados</h3>
            <p className="meta" style={{ marginBottom: 18 }}>
              Todos os convidados de todos os eventos. Passe o mouse para detalhar.
            </p>
            {stats.guests === 0 ? (
              <p className="meta">Nenhum convidado cadastrado ainda.</p>
            ) : (
              <ResponseRing
                confirmed={stats.confirmed}
                declined={stats.declined}
                pending={stats.pending}
              />
            )}
          </section>

          <section className="card">
            <div className="head-row" style={{ marginBottom: 18 }}>
              <div>
                <h3 style={{ marginBottom: 4 }}>Distribuição</h3>
                <p className="meta">Onde está concentrado o uso.</p>
              </div>
              <div className="segmented">
                <button
                  className={lens === 'empresas' ? 'is-active' : ''}
                  onClick={() => setLens('empresas')}
                >
                  Por empresa
                </button>
                <button
                  className={lens === 'tipos' ? 'is-active' : ''}
                  onClick={() => setLens('tipos')}
                >
                  Por tipo
                </button>
              </div>
            </div>
            <BarList
              items={lensData}
              emptyText={
                lens === 'empresas'
                  ? 'Nenhuma empresa com convidados cadastrados ainda.'
                  : 'Nenhum evento criado ainda.'
              }
            />
          </section>
        </div>

        <section className="card">
          <h3 style={{ marginBottom: 4 }}>Eventos recentes</h3>
          <p className="meta" style={{ marginBottom: 18 }}>
            Os últimos eventos criados na plataforma, de qualquer empresa.
          </p>

          {stats.recent_events.length === 0 ? (
            <p className="meta">Nenhum evento criado ainda.</p>
          ) : (
            <div className="feed">
              {stats.recent_events.map((ev) => {
                const rate = ev.total ? Math.round((ev.confirmed / ev.total) * 100) : 0;
                const dot = ev.total === 0 ? 'var(--border-strong)' : rate >= 50 ? 'var(--confirmed)' : 'var(--pending)';
                return (
                  <div className="feed-item" key={ev.id}>
                    <span className="feed-dot" style={{ background: dot }} />
                    <div className="feed-body">
                      <div className="feed-title">{ev.name}</div>
                      <div className="feed-meta">
                        {ev.consultant} · {new Date(ev.date).toLocaleDateString('pt-BR')} ·{' '}
                        {ev.total} convidado{ev.total === 1 ? '' : 's'}
                      </div>
                    </div>
                    {ev.total > 0 && (
                      <span className={rate >= 50 ? 'badge badge-confirmed' : 'badge badge-pending'}>
                        {rate}% confirmou
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </Shell>
  );
}
