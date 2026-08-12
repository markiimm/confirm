import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useProtectedPage } from '../lib/useProtectedPage';
import { Shell, Loading } from '../components/ui';
import { useToast } from '../components/Toast';

export default function UploadPage() {
  const router = useRouter();
  const { session, profile, loading } = useProtectedPage(['consultant', 'collaborator']);
  const toast = useToast();
  const [eventId, setEventId] = useState('');
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (router.query.event_id) setEventId(router.query.event_id);
  }, [router.query.event_id]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setResult(null);
    setSending(true);

    const formData = new FormData();
    formData.append('event_id', eventId);
    formData.append('file', file);

    const res = await fetch('/api/upload-guests', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
      body: formData,
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || 'Não foi possível ler a planilha.');
      setSending(false);
      return;
    }

    setResult(data);
    setSending(false);
    if (data.inserted > 0) toast.success(`${data.inserted} convidado(s) importado(s).`);
  }

  if (loading) return <Loading />;

  return (
    <Shell role={profile.role}>
      <main className="page page-narrow">
        <div className="page-head">
          <p className="eyebrow">
            <a href="/consultora/dashboard">← Voltar aos eventos</a>
          </p>
          <h1>Enviar lista de convidados</h1>
          <p className="lede">
            A planilha precisa ter duas colunas: <strong>Nome Completo</strong> e{' '}
            <strong>Número de Telefone</strong>.
          </p>
        </div>

        <form className="card" onSubmit={handleSubmit} style={{ marginBottom: 20 }}>
          {error && <div className="alert alert-error">{error}</div>}

          <label className="field">
            <span>Evento</span>
            <input value={eventId} onChange={(e) => setEventId(e.target.value)} required />
            <span className="field-hint">
              Preenchido automaticamente quando você vem pelo botão do evento.
            </span>
          </label>

          <label className="field">
            <span>Planilha</span>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => setFile(e.target.files[0])}
              required
            />
            <span className="field-hint">Aceita .xlsx, .xls ou .csv.</span>
          </label>

          <button type="submit" className="btn btn-primary" disabled={sending}>
            {sending ? 'Conferindo planilha…' : 'Enviar e conferir'}
          </button>
        </form>

        {result && (
          <section className="card">
            <h3 style={{ marginBottom: 14 }}>Resultado</h3>

            <div className={result.inserted > 0 ? 'alert alert-ok' : 'alert alert-warn'}>
              {result.inserted > 0
                ? `${result.inserted} convidado${result.inserted === 1 ? '' : 's'} importado${result.inserted === 1 ? '' : 's'} com sucesso.`
                : 'Nenhum convidado foi importado.'}
            </div>

            {result.errors_count > 0 && (
              <>
                <p className="meta" style={{ marginBottom: 10 }}>
                  {result.errors_count} linha{result.errors_count === 1 ? '' : 's'} não{' '}
                  {result.errors_count === 1 ? 'pôde' : 'puderam'} ser importada
                  {result.errors_count === 1 ? '' : 's'}. Corrija na planilha e envie de novo —
                  quem já entrou não será duplicado.
                </p>
                <div className="card card-flush">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Linha</th>
                        <th>O que precisa corrigir</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.errors.map((e, i) => (
                        <tr key={i}>
                          <td style={{ fontWeight: 500 }}>{e.line}</td>
                          <td>{e.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            <div style={{ marginTop: 18 }}>
              <a href="/consultora/dashboard" className="btn btn-secondary">
                Voltar aos eventos
              </a>
            </div>
          </section>
        )}
      </main>
    </Shell>
  );
}
