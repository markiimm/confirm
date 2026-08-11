import { useEffect, useState } from 'react';
import { useProtectedPage } from '../../lib/useProtectedPage';
import { Shell, Loading, Empty } from '../../components/ui';
import { useToast } from '../../components/Toast';

const BLANK = { full_name: '', email: '', password: '' };

export default function TeamPage() {
  const { session, profile, loading } = useProtectedPage('consultant');
  const toast = useToast();
  const [members, setMembers] = useState(null);
  const [form, setForm] = useState(BLANK);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    if (!session) return;
    const res = await fetch('/api/consultant/team', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const json = await res.json();
    setMembers(json.members || []);
  }

  useEffect(() => { load(); }, [session]);

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    const res = await fetch('/api/consultant/team', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) { setError(json.error || 'Não foi possível adicionar.'); return; }
    toast.success('Colaborador adicionado.');
    setForm(BLANK);
    setShowForm(false);
    load();
  }

  async function removeMember(member) {
    if (!window.confirm(`Remover o acesso de ${member.full_name}?`)) return;
    const res = await fetch('/api/consultant/team', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ member_id: member.id }),
    });
    if (!res.ok) { toast.error('Não foi possível remover.'); return; }
    toast.success('Acesso removido.');
    load();
  }

  if (loading) return <Loading />;

  return (
    <Shell role={profile.role}>
      <main className="page page-narrow">
        <div className="page-head head-row">
          <div>
            <p className="eyebrow">Sua conta</p>
            <h1>Equipe</h1>
            <p className="lede">Quem mais pode gerenciar os eventos da sua empresa.</p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancelar' : 'Adicionar pessoa'}
          </button>
        </div>

        <div className="alert alert-info">
          Colaboradores criam eventos, sobem listas e acompanham confirmações — mas não
          acessam a assinatura nem gerenciam a equipe.
        </div>

        {showForm && (
          <form className="card" onSubmit={handleCreate} style={{ marginBottom: 20 }}>
            <h3 style={{ marginBottom: 16 }}>Novo colaborador</h3>
            {error && <div className="alert alert-error">{error}</div>}
            <label className="field">
              <span>Nome</span>
              <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
            </label>
            <label className="field">
              <span>E-mail de acesso</span>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </label>
            <label className="field">
              <span>Senha provisória</span>
              <input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} minLength={6} required />
              <span className="field-hint">A pessoa pode trocar depois em “Esqueci minha senha”.</span>
            </label>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Adicionando…' : 'Adicionar colaborador'}
            </button>
          </form>
        )}

        {members === null ? (
          <p className="meta">Carregando equipe…</p>
        ) : members.length === 0 ? (
          <Empty
            title="Você é a única pessoa com acesso"
            action={<button className="btn btn-primary" onClick={() => setShowForm(true)}>Adicionar pessoa</button>}
          >
            Adicione assistentes para dividir o trabalho dos eventos.
          </Empty>
        ) : (
          <div className="card card-flush">
            <table className="table">
              <thead><tr><th>Colaborador</th><th /></tr></thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{m.full_name}</div>
                      <div className="tiny">{m.email}</div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn btn-ghost" onClick={() => removeMember(m)}>Remover acesso</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </Shell>
  );
}
