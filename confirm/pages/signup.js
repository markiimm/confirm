import { useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { PATTERN_TYPES } from '../lib/patternTypes';
import { EVENT_TYPES } from '../lib/eventTypes';

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    password: '',
    pattern_type: 'lista_confirmacao',
    business_type: 'casamento',
    website: '', // honeypot — fica sempre vazio para humanos
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const renderedAt = useRef(Date.now());

  const selected = PATTERN_TYPES[form.pattern_type];

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const res = await fetch('/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, rendered_at: renderedAt.current }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || 'Não foi possível criar a conta. Tente de novo.');
      setLoading(false);
      return;
    }

    router.push('/login');
  }

  return (
    <div className="auth">
      <aside className="auth-aside">
        <a href="/" className="brand"><span className="brand-mark" />Confirmô</a>
        <div>
          <h2>14 dias para testar com um evento de verdade.</h2>
          <p>
            Sem cartão de crédito agora. Se não fizer sentido para o seu negócio,
            é só não continuar.
          </p>
        </div>
        <p className="tiny">
          Confirmação de presença automática
        </p>
      </aside>

      <main className="auth-main">
        <form className="auth-form" onSubmit={handleSubmit}>
          <h1 style={{ marginBottom: 6 }}>Criar conta</h1>
          <p className="meta" style={{ marginBottom: 26 }}>
            Leva menos de um minuto.
          </p>

          {error && <div className="alert alert-error">{error}</div>}

          <label className="field">
            <span>Nome da empresa</span>
            <input
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              placeholder="Ex: Ateliê Marina Eventos"
              required
            />
          </label>

          <label className="field">
            <span>E-mail</span>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </label>

          <label className="field">
            <span>Senha</span>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              minLength={6}
              required
            />
            <span className="field-hint">Pelo menos 6 caracteres.</span>
          </label>

          {/* Cartões em vez de select: a escolha muda o produto inteiro,
              então ela merece espaço e explicação */}
          <div className="field">
            <span>Como o seu negócio funciona?</span>
            <div style={{ display: 'grid', gap: 10 }}>
              {Object.entries(PATTERN_TYPES).map(([key, p]) => {
                const disabled = p.status === 'coming_soon';
                return (
                  <button
                    type="button"
                    key={key}
                    className={`choice ${form.pattern_type === key ? 'is-selected' : ''}`}
                    onClick={() => setForm({ ...form, pattern_type: key })}
                    disabled={disabled}
                  >
                    <span className="choice-title">
                      <strong>{p.label}</strong>
                      {disabled && <span className="badge badge-neutral">Em breve</span>}
                    </span>
                    <span className="meta" style={{ display: 'block' }}>{p.tagline}</span>
                    <span className="tiny" style={{ display: 'block', marginTop: 6 }}>
                      {p.examples}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {form.pattern_type === 'lista_confirmacao' && (
            <label className="field">
              <span>Que tipo de evento você organiza?</span>
              <select
                value={form.business_type}
                onChange={(e) => setForm({ ...form, business_type: e.target.value })}
              >
                {Object.entries(EVENT_TYPES).map(([key, t]) => (
                  <option key={key} value={key}>{t.label}</option>
                ))}
              </select>
              <span className="field-hint">
                Define o texto padrão do convite. Você pode mudar depois.
              </span>
            </label>
          )}

          <div className="alert alert-info">
            Plano recomendado para você:{' '}
            <strong>{selected.recommendedPlan === 'pro' ? 'PRO' : 'Normal'}</strong> — você só
            escolhe se quer continuar depois dos 14 dias.
          </div>

          {/* Honeypot: invisível para pessoas, tentador para robôs */}
          <input
            type="text"
            name="website"
            value={form.website}
            onChange={(e) => setForm({ ...form, website: e.target.value })}
            tabIndex={-1}
            autoComplete="off"
            style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }}
            aria-hidden="true"
          />

          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? 'Criando conta…' : 'Começar meus 14 dias grátis'}
          </button>

          <p className="meta" style={{ marginTop: 18, textAlign: 'center' }}>
            Já tem conta? <a href="/login">Entrar</a>
          </p>
        </form>
      </main>
    </div>
  );
}
