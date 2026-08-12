import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';

// Colaborador com can_edit=false só visualiza (espelha lib/requireAuth.js
// no servidor). Titular e owner sempre podem editar.
export function canEdit(profile) {
  return !profile || profile.role !== 'collaborator' || profile.can_edit !== false;
}

/* ---------- Contador animado ----------
   Números que sobem ao carregar dão a sensação de dado vivo. */
export function Counter({ value = 0, suffix = '', duration = 900 }) {
  const [shown, setShown] = useState(0);
  const raf = useRef();

  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { setShown(value); return; }

    const start = performance.now();
    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(value * eased));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [value, duration]);

  return <>{shown.toLocaleString('pt-BR')}{suffix}</>;
}

/* ---------- Barra de status ---------- */
export function Tally({ confirmed = 0, declined = 0, pending = 0, showLegend = true }) {
  const total = confirmed + declined + pending;
  const pct = (n) => (total ? (n / total) * 100 : 0);

  return (
    <div>
      <div className="tally">
        {total > 0 && (
          <>
            <div className="tally-seg tally-confirmed" style={{ width: `${pct(confirmed)}%` }} />
            <div className="tally-seg tally-declined" style={{ width: `${pct(declined)}%` }} />
            <div className="tally-seg tally-pending" style={{ width: `${pct(pending)}%` }} />
          </>
        )}
      </div>
      {showLegend && (
        <div className="tally-legend">
          <span className="tally-legend-item">
            <span className="tally-dot" style={{ background: 'var(--confirmed)' }} />
            <span className="num">{confirmed}</span> confirmaram
          </span>
          <span className="tally-legend-item">
            <span className="tally-dot" style={{ background: 'var(--declined)' }} />
            <span className="num">{declined}</span> não vão
          </span>
          <span className="tally-legend-item">
            <span className="tally-dot" style={{ background: 'var(--border-strong)' }} />
            <span className="num">{pending}</span> sem resposta
          </span>
        </div>
      )}
    </div>
  );
}

/* ---------- Anel de respostas (interativo) ----------
   Passar o mouse em uma fatia destaca ela e troca o número do centro. */
export function ResponseRing({ confirmed = 0, declined = 0, pending = 0 }) {
  const [hover, setHover] = useState(null);
  const total = confirmed + declined + pending;

  const slices = [
    { key: 'confirmed', label: 'Confirmaram', value: confirmed, color: 'var(--confirmed)' },
    { key: 'declined', label: 'Não vão', value: declined, color: 'var(--declined)' },
    { key: 'pending', label: 'Sem resposta', value: pending, color: 'var(--border-strong)' },
  ];

  const R = 54;
  const C = 2 * Math.PI * R;
  let offset = 0;

  const active = hover ? slices.find((s) => s.key === hover) : null;
  const centerValue = active ? active.value : total;
  const centerLabel = active ? active.label : 'convidados';
  const centerPct = active && total ? ` · ${Math.round((active.value / total) * 100)}%` : '';

  return (
    <div className="ring-wrap">
      <svg width="140" height="140" viewBox="0 0 140 140" role="img" aria-label="Respostas dos convidados">
        <circle cx="70" cy="70" r={R} fill="none" stroke="var(--surface-3)" strokeWidth="14" />
        {total > 0 &&
          slices.map((s) => {
            const len = (s.value / total) * C;
            const el = (
              <circle
                key={s.key}
                className="ring-seg"
                cx="70" cy="70" r={R}
                fill="none"
                stroke={s.color}
                strokeWidth="14"
                strokeDasharray={`${len} ${C - len}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 70 70)"
                opacity={hover && hover !== s.key ? 0.28 : 1}
                onMouseEnter={() => setHover(s.key)}
                onMouseLeave={() => setHover(null)}
              />
            );
            offset += len;
            return el;
          })}
        <text x="70" y="66" textAnchor="middle" className="ring-center-value" fill="var(--text)">
          {centerValue.toLocaleString('pt-BR')}
        </text>
        <text x="70" y="84" textAnchor="middle" fontSize="11" fill="var(--text-muted)">
          {centerLabel}{centerPct}
        </text>
      </svg>

      <div className="ring-key">
        {slices.map((s) => (
          <div
            key={s.key}
            className={`ring-key-row ${hover && hover !== s.key ? 'is-dim' : ''}`}
            onMouseEnter={() => setHover(s.key)}
            onMouseLeave={() => setHover(null)}
          >
            <span className="tally-dot" style={{ background: s.color }} />
            <span className="ring-key-label">{s.label}</span>
            <span className="ring-key-value" style={{ color: s.color }}>
              {s.value.toLocaleString('pt-BR')}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Lista de barras ---------- */
export function BarList({ items = [], emptyText = 'Nada para mostrar ainda.' }) {
  if (!items.length) return <p className="meta">{emptyText}</p>;
  const max = Math.max(...items.map((i) => i.value), 1);

  return (
    <div className="barlist">
      {items.map((item) => (
        <div className="barrow" key={item.label}>
          <div className="barrow-fill" style={{ width: `${(item.value / max) * 100}%` }} />
          <span className="barrow-label">{item.label}</span>
          <span className="barrow-value">{item.value.toLocaleString('pt-BR')}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------- Cabeçalho do app ---------- */
export function Shell({ children, role }) {
  const router = useRouter();

  // Colaborador não vê assinatura nem equipe — são coisas do titular.
  const links =
    role === 'owner'
      ? [
          { href: '/owner/dashboard', label: 'Visão geral' },
          { href: '/owner/consultants', label: 'Empresas' },
          { href: '/owner/users', label: 'Usuários' },
          { href: '/owner/support', label: 'Suporte' },
          { href: '/owner/audit', label: 'Log' },
        ]
      : role === 'collaborator'
      ? [
          { href: '/consultora/dashboard', label: 'Meus eventos' },
          { href: '/consultora/support', label: 'Suporte' },
        ]
      : [
          { href: '/consultora/dashboard', label: 'Meus eventos' },
          { href: '/consultora/team', label: 'Equipe' },
          { href: '/consultora/billing', label: 'Assinatura' },
          { href: '/consultora/support', label: 'Suporte' },
        ];

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-inner">
          <a href={links[0].href} className="brand">
            <span className="brand-mark" />
            Confirmô
          </a>
          <nav className="nav">
            {links.map((l) => (
              <a key={l.href} href={l.href} className={router.pathname === l.href ? 'is-active' : ''}>
                {l.label}
              </a>
            ))}
          </nav>
          <button onClick={handleSignOut} className="btn btn-ghost">Sair</button>
        </div>
      </header>
      {children}
    </div>
  );
}

export function Empty({ title, children, action }) {
  return (
    <div className="card empty">
      <h3>{title}</h3>
      <p className="meta" style={{ marginBottom: action ? 18 : 0 }}>{children}</p>
      {action}
    </div>
  );
}

export function Loading() {
  return (
    <div className="page">
      <p className="meta">Carregando…</p>
    </div>
  );
}

export const STATUS_META = {
  confirmed: { label: 'Confirmado', className: 'badge badge-confirmed' },
  declined: { label: 'Não vai', className: 'badge badge-declined' },
  pending: { label: 'Sem resposta', className: 'badge badge-pending' },
};

export const SUBSCRIPTION_META = {
  trialing: { label: 'Em teste', className: 'badge badge-pending' },
  active: { label: 'Ativa', className: 'badge badge-confirmed' },
  past_due: { label: 'Pagamento pendente', className: 'badge badge-declined' },
  canceled: { label: 'Cancelada', className: 'badge badge-neutral' },
};

export const ROLE_META = {
  owner: { label: 'Administrador', className: 'badge badge-neutral' },
  consultant: { label: 'Empresa (titular)', className: 'badge badge-confirmed' },
  collaborator: { label: 'Colaborador', className: 'badge badge-pending' },
};
