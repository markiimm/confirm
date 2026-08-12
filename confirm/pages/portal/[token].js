import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Tally, ResponseRing, Counter, STATUS_META } from '../../components/ui';

export default function ClientPortalPage() {
  const router = useRouter();
  const { token } = router.query;
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState('all');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  function loadPortal() {
    return fetch(`/api/portal?token=${token}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((json) => { setData(json); setLastUpdated(new Date()); })
      .catch(() => setData(false));
  }

  useEffect(() => {
    if (!token) return;
    loadPortal();
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const interval = setInterval(loadPortal, 20000);
    return () => clearInterval(interval);
  }, [token]);

  async function handleRefresh() {
    setRefreshing(true);
    await loadPortal();
    setRefreshing(false);
  }

  if (data === null) {
    return (
      <div className="shell">
        <main className="page page-narrow"><p className="meta">Carregando…</p></main>
      </div>
    );
  }

  if (data === false) {
    return (
      <div className="shell">
        <main className="page page-narrow">
          <div className="card empty">
            <h3>Link inválido</h3>
            <p className="meta">
              Este link não está mais ativo. Peça um novo para quem organiza o seu evento.
            </p>
          </div>
        </main>
      </div>
    );
  }

  const { event, totals, guests } = data;
  const visible = filter === 'all' ? guests : guests.filter((g) => g.status === filter);

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-inner">
          <span className="brand"><span className="brand-mark" />Confirmô</span>
          <div className="nav" />
          <span className="badge badge-neutral">Acompanhamento</span>
        </div>
      </header>

      <main className="page">
        <div className="page-head head-row">
          <div>
            <p className="eyebrow">Lista de convidados</p>
            <h1>{event.name}</h1>
            <p className="lede">
              {new Date(event.date).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
            {lastUpdated && (
              <p className="tiny" style={{ marginTop: 4 }}>
                Atualizado às {lastUpdated.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
          <button className="btn btn-secondary" onClick={handleRefresh} disabled={refreshing}>
            {refreshing ? 'Atualizando…' : '↻ Atualizar'}
          </button>
        </div>

        {totals.guests === 0 ? (
          <div className="card empty">
            <h3>A lista ainda está sendo montada</h3>
            <p className="meta">Assim que os convites forem enviados, as respostas aparecem aqui.</p>
          </div>
        ) : (
          <>
            <div className="grid-stats" style={{ marginBottom: 16 }}>
              <div className="stat" style={{ '--stat-hue': 'var(--confirmed)' }}>
                <div className="stat-value" style={{ color: 'var(--confirmed)' }}>
                  <Counter value={totals.expected} />
                </div>
                <div className="stat-label">Pessoas esperadas</div>
                <div className="stat-trend">
                  {totals.confirmed} confirmados + {totals.companions} acompanhantes
                </div>
              </div>
              <div className="stat" style={{ '--stat-hue': 'var(--declined)' }}>
                <div className="stat-value" style={{ color: 'var(--declined)' }}>
                  <Counter value={totals.declined} />
                </div>
                <div className="stat-label">Não vão</div>
              </div>
              <div className="stat">
                <div className="stat-value"><Counter value={totals.pending} /></div>
                <div className="stat-label">Ainda não responderam</div>
              </div>
              <div className="stat" style={{ '--stat-hue': 'var(--accent)' }}>
                <div className="stat-value" style={{ color: 'var(--accent)' }}>
                  <Counter
                    value={totals.guests ? Math.round(((totals.confirmed + totals.declined) / totals.guests) * 100) : 0}
                    suffix="%"
                  />
                </div>
                <div className="stat-label">Já responderam</div>
              </div>
            </div>

            <section className="card" style={{ marginBottom: 16 }}>
              <ResponseRing
                confirmed={totals.confirmed}
                declined={totals.declined}
                pending={totals.pending}
              />
            </section>

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

              {visible.length === 0 ? (
                <p className="meta">Nenhum convidado nesse status.</p>
              ) : (
                <div className="card card-flush">
                  <table className="table">
                    <thead>
                      <tr><th>Convidado</th><th>Status</th></tr>
                    </thead>
                    <tbody>
                      {visible.map((g, i) => (
                        <tr key={i}>
                          <td>
                            {g.name}
                            {g.companions > 0 && (
                              <span className="tiny"> · +{g.companions} acompanhante{g.companions > 1 ? 's' : ''}</span>
                            )}
                          </td>
                          <td>
                            <span className={STATUS_META[g.status].className}>
                              {STATUS_META[g.status].label}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <p className="tiny" style={{ marginTop: 20, textAlign: 'center' }}>
              Esta página é somente para acompanhamento. Para alterar a lista, fale com quem organiza o evento.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
