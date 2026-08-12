import { useEffect, useState } from 'react';
import { useProtectedPage } from '../../lib/useProtectedPage';
import { EVENT_TYPES } from '../../lib/eventTypes';
import { Shell, Loading, Empty, Tally, ResponseRing, Counter, canEdit } from '../../components/ui';
import { useToast } from '../../components/Toast';

const BLANK = { event_name: '', event_type: 'casamento', event_date: '' };

export default function ConsultoraDashboard() {
  const { session, profile, loading } = useProtectedPage(['consultant', 'collaborator']);
  const toast = useToast();
  const [events, setEvents] = useState(null);
  const [form, setForm] = useState(BLANK);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  async function loadEvents(token) {
    const res = await fetch('/api/consultant/events', { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    setEvents(data.events || []);
  }

  useEffect(() => { if (session) loadEvents(session.access_token); }, [session]);

  async function handleCreateEvent(e) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch('/api/consultant/create-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (!res.ok) { toast.error('Não foi possível criar o evento.'); return; }
    toast.success('Evento criado.');
    setForm(BLANK);
    setShowForm(false);
    await loadEvents(session.access_token);
  }

  if (loading) return <Loading />;

  if (profile.pattern_type === 'agendamento_individual') {
    return (
      <Shell role={profile.role}>
        <main className="page page-narrow">
          <Empty title="Agenda de horários em construção">
            Olá, {profile.full_name}. A parte de agendamento individual ainda está sendo
            desenvolvida. Avisamos você por e-mail assim que estiver pronta.
          </Empty>
        </main>
      </Shell>
    );
  }

  const trialExpired = profile.subscription_status === 'trialing' && new Date(profile.trial_ends_at) < new Date();
  const blocked = trialExpired || profile.subscription_status === 'canceled';

  if (blocked) {
    return (
      <Shell role={profile.role}>
        <main className="page page-narrow">
          <Empty
            title="Seu período de teste terminou"
            action={<a href="/consultora/billing" className="btn btn-primary">Ver planos e assinar</a>}
          >
            Seus dados continuam salvos. Assine para voltar a enviar convites e acompanhar confirmações.
          </Empty>
        </main>
      </Shell>
    );
  }

  const daysLeft = Math.ceil((new Date(profile.trial_ends_at) - new Date()) / 86400000);

  // Consolidado de todos os eventos, para o resumo do topo
  const list = events || [];
  const totals = list.reduce(
    (acc, ev) => {
      acc.guests += ev.guest_total;
      acc.confirmed += ev.guest_confirmed;
      acc.declined += ev.guest_declined;
      return acc;
    },
    { guests: 0, confirmed: 0, declined: 0 }
  );
  totals.pending = Math.max(totals.guests - totals.confirmed - totals.declined, 0);
  totals.rate = totals.guests
    ? Math.round(((totals.confirmed + totals.declined) / totals.guests) * 100)
    : 0;

  return (
    <Shell role={profile.role}>
      <main className="page">
        {profile.subscription_status === 'trialing' && (
          <div className="alert alert-warn">
            Teste grátis: faltam {daysLeft} dia{daysLeft === 1 ? '' : 's'}.{' '}
            <a href="/consultora/billing">Assinar agora</a>
          </div>
        )}
        {profile.subscription_status === 'past_due' && (
          <div className="alert alert-error">
            Não conseguimos confirmar seu último pagamento.{' '}
            <a href="/consultora/billing">Regularizar</a>
          </div>
        )}

        <div className="page-head head-row">
          <div>
            <p className="eyebrow">{profile.full_name}</p>
            <h1>Meus eventos</h1>
            <p className="lede">Acompanhe quem já confirmou presença em cada evento.</p>
          </div>
          {canEdit(profile) && (
            <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
              {showForm ? 'Cancelar' : 'Criar evento'}
            </button>
          )}
        </div>

        {totals.guests > 0 && (
          <section className="card" style={{ marginBottom: 20 }}>
            <div className="grid-dash" style={{ alignItems: 'center' }}>
              <div>
                <h3 style={{ marginBottom: 4 }}>Resumo de todos os seus eventos</h3>
                <p className="meta" style={{ marginBottom: 16 }}>
                  Passe o mouse no gráfico para ver cada grupo separado.
                </p>
                <div style={{ display: 'flex', gap: 26, flexWrap: 'wrap' }}>
                  <div>
                    <div className="stat-value" style={{ fontSize: 24 }}>
                      <Counter value={totals.guests} />
                    </div>
                    <div className="stat-label">Convidados</div>
                  </div>
                  <div>
                    <div className="stat-value" style={{ fontSize: 24, color: 'var(--confirmed)' }}>
                      <Counter value={totals.rate} suffix="%" />
                    </div>
                    <div className="stat-label">Já responderam</div>
                  </div>
                  <div>
                    <div className="stat-value" style={{ fontSize: 24 }}>
                      <Counter value={events.length} />
                    </div>
                    <div className="stat-label">Eventos ativos</div>
                  </div>
                </div>
              </div>
              <ResponseRing
                confirmed={totals.confirmed}
                declined={totals.declined}
                pending={totals.pending}
              />
            </div>
          </section>
        )}

        {showForm && (
          <form className="card" onSubmit={handleCreateEvent} style={{ marginBottom: 24 }}>
            <h3 style={{ marginBottom: 18 }}>Novo evento</h3>
            <label className="field">
              <span>Nome do evento</span>
              <input
                value={form.event_name}
                onChange={(e) => setForm({ ...form, event_name: e.target.value })}
                placeholder="Ex: Casamento de Ana e Léo"
                required
              />
              <span className="field-hint">É esse nome que aparece na mensagem do convidado.</span>
            </label>
            <div className="grid-two">
              <label className="field">
                <span>Tipo de evento</span>
                <select value={form.event_type} onChange={(e) => setForm({ ...form, event_type: e.target.value })}>
                  {Object.entries(EVENT_TYPES).map(([key, t]) => <option key={key} value={key}>{t.label}</option>)}
                </select>
              </label>
              <label className="field">
                <span>Data do evento</span>
                <input type="date" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} required />
              </label>
            </div>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Criando…' : 'Criar evento'}
            </button>
          </form>
        )}

        {events === null ? (
          <p className="meta">Carregando eventos…</p>
        ) : events.length === 0 ? (
          <section className="card">
            <h3 style={{ marginBottom: 4 }}>Como começar</h3>
            <p className="meta" style={{ marginBottom: 4 }}>Três passos e os convites saem sozinhos.</p>

            <div className="onboard-step is-active">
              <span className="onboard-num">1</span>
              <div>
                <div className="onboard-title">Crie o seu primeiro evento</div>
                <div className="onboard-desc">Nome, tipo e data — leva menos de um minuto.</div>
              </div>
            </div>
            <div className="onboard-step">
              <span className="onboard-num">2</span>
              <div>
                <div className="onboard-title">Envie a planilha de convidados</div>
                <div className="onboard-desc">Duas colunas: Nome Completo e Número de Telefone.</div>
              </div>
            </div>
            <div className="onboard-step">
              <span className="onboard-num">3</span>
              <div>
                <div className="onboard-title">Acompanhe as confirmações</div>
                <div className="onboard-desc">Os convites saem sozinhos e o painel se atualiza a cada resposta.</div>
              </div>
            </div>

            {canEdit(profile) && (
              <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setShowForm(true)}>
                Criar meu primeiro evento
              </button>
            )}
          </section>
        ) : (
          <div style={{ display: 'grid', gap: 14 }}>
            {events.map((ev) => {
              const pending = Math.max(ev.guest_total - ev.guest_confirmed - ev.guest_declined, 0);
              const answered = ev.guest_total - pending;
              const rate = ev.guest_total ? Math.round((answered / ev.guest_total) * 100) : 0;
              return (
                <article className="card" key={ev.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
                    <div>
                      <h3><a href={`/consultora/event/${ev.id}`} style={{ color: 'inherit' }}>{ev.event_name}</a></h3>
                      <p className="meta">
                        {new Date(ev.event_date).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}
                        {' · '}
                        {ev.guest_total} convidado{ev.guest_total === 1 ? '' : 's'}
                      </p>
                    </div>
                    {ev.guest_total > 0 && (
                      <span className={rate === 100 ? 'badge badge-confirmed' : 'badge badge-pending'}>
                        {rate}% respondeu
                      </span>
                    )}
                  </div>

                  {ev.guest_total === 0 ? (
                    <div className="alert alert-info" style={{ marginBottom: 14 }}>
                      Nenhum convidado ainda. Envie a planilha para começar.
                    </div>
                  ) : (
                    <div style={{ marginBottom: 16 }}>
                      <Tally confirmed={ev.guest_confirmed} declined={ev.guest_declined} pending={pending} />
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <a href={`/consultora/event/${ev.id}`} className="btn btn-secondary">
                      Ver convidados
                    </a>
                    {canEdit(profile) && (
                      <a href={`/upload?event_id=${ev.id}`} className="btn btn-ghost">
                        Enviar planilha
                      </a>
                    )}
                    {ev.guest_total > 0 && (
                      <a href={`/api/export-guests?event_id=${ev.id}`} className="btn btn-ghost">
                        Baixar lista
                      </a>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </Shell>
  );
}
