import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    // Sempre mostramos a mesma mensagem, exista ou não o e-mail — isso
    // evita que alguém use esse formulário para descobrir quais e-mails
    // estão cadastrados na plataforma.
    setLoading(false);
    if (err) { setError('Não foi possível processar agora. Tente de novo em instantes.'); return; }
    setSent(true);
  }

  return (
    <div className="auth">
      <aside className="auth-aside">
        <a href="/" className="brand"><span className="brand-mark" />Confirmô</a>
        <div>
          <h2>Vamos recuperar seu acesso.</h2>
          <p>Enviamos um link de redefinição para o e-mail cadastrado.</p>
        </div>
        <p className="tiny">Confirmação de presença automática</p>
      </aside>

      <main className="auth-main">
        <div className="auth-form">
          <h1 style={{ marginBottom: 6 }}>Esqueci minha senha</h1>
          <p className="meta" style={{ marginBottom: 26 }}>
            Informe o e-mail da sua conta.
          </p>

          {sent ? (
            <div className="alert alert-ok">
              Se {email} estiver cadastrado, um link para redefinir a senha chega em instantes.
              Confira também a caixa de spam.
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              {error && <div className="alert alert-error">{error}</div>}
              <label className="field">
                <span>E-mail</span>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </label>
              <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
                {loading ? 'Enviando…' : 'Enviar link de redefinição'}
              </button>
            </form>
          )}

          <p className="meta" style={{ marginTop: 18, textAlign: 'center' }}>
            <a href="/login">Voltar para o login</a>
          </p>
        </div>
      </main>
    </div>
  );
}
