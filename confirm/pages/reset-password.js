import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // O Supabase abre uma sessão temporária de recuperação a partir do
    // link do e-mail; esse evento confirma que ela está pronta.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (password !== confirm) { setError('As senhas não são iguais.'); return; }
    if (password.length < 6) { setError('Use pelo menos 6 caracteres.'); return; }

    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (err) { setError('Não foi possível salvar a nova senha. O link pode ter expirado.'); return; }
    setDone(true);
    setTimeout(() => router.push('/login'), 1800);
  }

  return (
    <div className="auth">
      <aside className="auth-aside">
        <a href="/" className="brand"><span className="brand-mark" />Confirmô</a>
        <div>
          <h2>Quase lá.</h2>
          <p>Escolha uma nova senha para sua conta.</p>
        </div>
        <p className="tiny">Confirmação de presença automática</p>
      </aside>

      <main className="auth-main">
        <div className="auth-form">
          <h1 style={{ marginBottom: 6 }}>Nova senha</h1>
          <p className="meta" style={{ marginBottom: 26 }}>Defina uma senha nova para entrar.</p>

          {done ? (
            <div className="alert alert-ok">Senha atualizada. Levando você para o login…</div>
          ) : !ready ? (
            <p className="meta">Confirmando o link de redefinição…</p>
          ) : (
            <form onSubmit={handleSubmit}>
              {error && <div className="alert alert-error">{error}</div>}
              <label className="field">
                <span>Nova senha</span>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required />
              </label>
              <label className="field">
                <span>Confirmar nova senha</span>
                <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} minLength={6} required />
              </label>
              <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
                {loading ? 'Salvando…' : 'Salvar nova senha'}
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
