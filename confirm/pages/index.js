import { PATTERN_TYPES } from '../lib/patternTypes';
import { Tally, ResponseRing } from '../components/ui';

export default function HomePage() {
  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-inner">
          <a href="/" className="brand">
            <span className="brand-mark" />
            Confirmô
          </a>
          <div className="nav" />
          <a href="/login" className="btn btn-ghost">Entrar</a>
          <a href="/signup" className="btn btn-primary">Testar grátis</a>
        </div>
      </header>

      <main className="page">
        {/* O herói mostra o produto funcionando, em vez de descrever */}
        <section className="grid-dash" style={{ alignItems: 'center', marginBottom: 56, gap: 40 }}>
          <div>
            <p className="eyebrow" style={{ marginBottom: 14 }}>Confirmação de presença · WhatsApp</p>
            <h1 style={{ fontSize: 42, marginBottom: 16 }}>
              Pare de perguntar “você vem?” cento e vinte vezes.
            </h1>
            <p className="lede" style={{ marginBottom: 26 }}>
              Você sobe a lista de contatos. A plataforma manda o convite, cobra quem não
              respondeu e organiza tudo. Você abre e já sabe quem vem.
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <a href="/signup" className="btn btn-primary">Começar 14 dias grátis</a>
              <a href="/login" className="btn btn-secondary">Já tenho conta</a>
            </div>
            <p className="tiny" style={{ marginTop: 14 }}>Sem cartão de crédito agora.</p>
          </div>

          <div className="card">
            <div className="head-row" style={{ marginBottom: 18 }}>
              <div>
                <h3>Casamento de Marcelo e Karine</h3>
                <p className="meta">30 de agosto · 142 convidados</p>
              </div>
              <span className="badge badge-confirmed">77% respondeu</span>
            </div>
            <ResponseRing confirmed={98} declined={12} pending={32} />
          </div>
        </section>

        <section>
          <h2 style={{ marginBottom: 6 }}>Qual é o seu tipo de negócio?</h2>
          <p className="meta" style={{ marginBottom: 20 }}>
            A plataforma funciona de dois jeitos diferentes. Escolha o que descreve o seu.
          </p>

          <div className="grid-two">
            {Object.entries(PATTERN_TYPES).map(([key, p]) => (
              <div key={key} className="card">
                <div className="choice-title">
                  <strong>{p.label}</strong>
                  {p.status === 'coming_soon' && <span className="badge badge-neutral">Em breve</span>}
                </div>
                <p className="meta" style={{ marginBottom: 12 }}>{p.tagline}</p>
                <p style={{ fontSize: 14, marginBottom: 14 }}>{p.description}</p>
                <p className="tiny">Para: {p.examples}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
