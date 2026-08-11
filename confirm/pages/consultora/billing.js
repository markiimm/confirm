import { useEffect, useState } from 'react';
import { useProtectedPage } from '../../lib/useProtectedPage';
import { PLAN_PRICES, PLAN_LABELS } from '../../lib/asaas';
import { Shell, Loading, SUBSCRIPTION_META } from '../../components/ui';
import { useToast } from '../../components/Toast';

const BILLING_STATUS = {
  paid: { label: 'Pago', className: 'badge badge-confirmed' },
  overdue: { label: 'Em atraso', className: 'badge badge-declined' },
  canceled: { label: 'Cancelado', className: 'badge badge-neutral' },
};

export default function BillingPage() {
  const { session, profile, loading } = useProtectedPage('consultant');
  const toast = useToast();
  const [cpfCnpj, setCpfCnpj] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [history, setHistory] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!session) return;
    fetch('/api/consultant/subscription', { headers: { Authorization: `Bearer ${session.access_token}` } })
      .then((r) => r.json())
      .then((j) => setHistory(j.history || []));
  }, [session]);

  if (loading) return <Loading />;

  const daysLeft = Math.ceil((new Date(profile.trial_ends_at) - new Date()) / 86400000);
  const price = PLAN_PRICES[profile.plan] || PLAN_PRICES.normal;
  const status = SUBSCRIPTION_META[profile.subscription_status] || SUBSCRIPTION_META.canceled;
  const isActive = profile.subscription_status === 'active';

  async function handleSubscribe(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    const res = await fetch('/api/consultant/create-subscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ cpfCnpj, phone }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Não foi possível abrir a tela de pagamento.');
      setSubmitting(false);
      return;
    }
    window.location.href = data.checkout_url;
  }

  async function changePlan(plan) {
    if (plan === profile.plan) return;
    if (!window.confirm(`Trocar para o plano ${PLAN_LABELS[plan]} (R$ ${PLAN_PRICES[plan].toFixed(2).replace('.', ',')}/mês)?`)) return;
    setBusy(true);
    const res = await fetch('/api/consultant/subscription', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ plan }),
    });
    setBusy(false);
    if (!res.ok) { toast.error('Não foi possível trocar o plano.'); return; }
    toast.success(`Plano alterado para ${PLAN_LABELS[plan]}.`);
    window.location.reload();
  }

  async function cancelSubscription() {
    if (!window.confirm('Cancelar a assinatura? Você mantém o acesso até o fim do período já pago.')) return;
    setBusy(true);
    const res = await fetch('/api/consultant/subscription', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    setBusy(false);
    if (!res.ok) { toast.error('Não foi possível cancelar.'); return; }
    toast.success('Assinatura cancelada.');
    window.location.reload();
  }

  return (
    <Shell role={profile.role}>
      <main className="page page-narrow">
        <div className="page-head">
          <p className="eyebrow">Sua conta</p>
          <h1>Assinatura</h1>
        </div>

        <section className="card" style={{ marginBottom: 16 }}>
          <div className="head-row" style={{ marginBottom: 14 }}>
            <div>
              <p className="eyebrow" style={{ marginBottom: 6 }}>Plano {PLAN_LABELS[profile.plan]}</p>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 30, fontWeight: 600, lineHeight: 1.1, letterSpacing: '-0.03em' }}>
                R$ {price.toFixed(2).replace('.', ',')}
                <span style={{ fontSize: 15, fontFamily: 'var(--font-body)', fontWeight: 400, color: 'var(--text-secondary)' }}> /mês</span>
              </div>
            </div>
            <span className={status.className}>{status.label}</span>
          </div>

          {profile.subscription_status === 'trialing' && (
            <p className="meta">
              {daysLeft > 0
                ? `Teste grátis termina em ${daysLeft} dia${daysLeft === 1 ? '' : 's'}.`
                : 'Seu teste grátis terminou.'}
            </p>
          )}
          {isActive && <p className="meta">Cobrança automática ativa.</p>}
          {profile.subscription_status === 'past_due' && (
            <p className="meta">Não conseguimos confirmar o último pagamento.</p>
          )}
        </section>

        {/* Troca de plano */}
        {isActive && (
          <section className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ marginBottom: 4 }}>Trocar de plano</h3>
            <p className="meta" style={{ marginBottom: 16 }}>
              O novo valor passa a valer na próxima cobrança.
            </p>
            <div style={{ display: 'grid', gap: 10 }}>
              {['normal', 'pro'].map((p) => (
                <button
                  key={p}
                  className={`choice ${profile.plan === p ? 'is-selected' : ''}`}
                  onClick={() => changePlan(p)}
                  disabled={busy || profile.plan === p}
                >
                  <span className="choice-title">
                    <strong>Plano {PLAN_LABELS[p]}</strong>
                    {profile.plan === p && <span className="badge badge-confirmed">Atual</span>}
                  </span>
                  <span className="meta">R$ {PLAN_PRICES[p].toFixed(2).replace('.', ',')} por mês</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Contratar */}
        {!isActive && (
          <section className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ marginBottom: 4 }}>Dados para a cobrança</h3>
            <p className="meta" style={{ marginBottom: 18 }}>
              Você escolhe entre cartão, Pix ou boleto na próxima tela.
            </p>
            {error && <div className="alert alert-error">{error}</div>}
            <form onSubmit={handleSubscribe}>
              <label className="field">
                <span>CPF ou CNPJ</span>
                <input value={cpfCnpj} onChange={(e) => setCpfCnpj(e.target.value)} placeholder="Somente números" required />
              </label>
              <label className="field">
                <span>Telefone</span>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-0000" required />
              </label>
              <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
                {submitting ? 'Abrindo pagamento…' : 'Continuar para o pagamento'}
              </button>
            </form>
          </section>
        )}

        {/* Histórico */}
        <section className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginBottom: 4 }}>Histórico de cobranças</h3>
          <p className="meta" style={{ marginBottom: 16 }}>Registro de cada cobrança da sua conta.</p>

          {history === null ? (
            <p className="meta">Carregando…</p>
          ) : history.length === 0 ? (
            <p className="meta">Nenhuma cobrança registrada ainda.</p>
          ) : (
            <div className="card card-flush">
              <table className="table">
                <thead>
                  <tr><th>Vencimento</th><th>Valor</th><th>Situação</th><th /></tr>
                </thead>
                <tbody>
                  {history.map((h) => {
                    const st = BILLING_STATUS[h.status] || BILLING_STATUS.canceled;
                    return (
                      <tr key={h.id}>
                        <td className="num">{h.due_date ? new Date(h.due_date).toLocaleDateString('pt-BR') : '—'}</td>
                        <td className="num">{h.value ? `R$ ${Number(h.value).toFixed(2).replace('.', ',')}` : '—'}</td>
                        <td><span className={st.className}>{st.label}</span></td>
                        <td style={{ textAlign: 'right' }}>
                          {h.invoice_url && <a href={h.invoice_url} target="_blank" rel="noreferrer">Ver recibo</a>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {isActive && (
          <section className="card">
            <div className="head-row">
              <div>
                <h3 style={{ marginBottom: 4 }}>Cancelar assinatura</h3>
                <p className="meta">Você mantém o acesso até o fim do período já pago.</p>
              </div>
              <button className="btn btn-ghost" onClick={cancelSubscription} disabled={busy}>
                Cancelar assinatura
              </button>
            </div>
          </section>
        )}
      </main>
    </Shell>
  );
}
