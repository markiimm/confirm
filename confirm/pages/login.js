import { useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';
import { ResponseRing } from '../components/ui';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      setError('E-mail ou senha não conferem. Verifique e tente de novo.');
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, active')
      .eq('id', data.user.id)
      .single();

    if (!profile || !profile.active) {
      setError('Esta conta está desativada. Fale com o suporte para reativar.');
      await supabase.auth.signOut();
      setLoading(false);
      return;
    }

    router.push(profile.role === 'owner' ? '/owner/dashboard' : '/consultora/dashboard');
  }

  return (
    <div className="auth">
      <aside className="auth-aside">
        <a href="/" className="brand"><span className="brand-mark" />Confirmô</a>
        <div>
          <h2>Quem vem, quem não vem, quem ainda não respondeu.</h2>
          <p style={{ marginBottom: 28 }}>
            Tudo atualizado sozinho, conforme seus convidados respondem no WhatsApp.
          </p>
          <div className="auth-demo">
            <p className="tiny" style={{ marginBottom: 12 }}>
              Casamento de Marcelo e Karine
            </p>
            <ResponseRing confirmed={98} declined={12} pending={32} />
          </div>
        </div>
        <p className="tiny">
          Confirmação de presença automática
        </p>
      </aside>

      <main className="auth-main">
        <form className="auth-form" onSubmit={handleLogin}>
          <h1 style={{ marginBottom: 6 }}>Entrar</h1>
          <p className="meta" style={{ marginBottom: 26 }}>
            Acesse o painel da sua empresa.
          </p>

          {error && <div className="alert alert-error">{error}</div>}

          <label className="field">
            <span>E-mail</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>

          <label className="field">
            <span>Senha</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>

          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? 'Entrando…' : 'Entrar'}
          </button>

          <p className="meta" style={{ marginTop: 14, textAlign: 'center' }}>
            <a href="/forgot-password">Esqueci minha senha</a>
          </p>
          <p className="meta" style={{ marginTop: 8, textAlign: 'center' }}>
            Ainda não tem conta? <a href="/signup">Teste 14 dias grátis</a>
          </p>
        </form>
      </main>
    </div>
  );
}
