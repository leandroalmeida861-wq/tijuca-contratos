import { ArrowLeft, Edit3, Eye, EyeOff, Plus, Save, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { formatDate } from '../components/noticias/NewsCard.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import {
  deleteNews,
  getCategoryLabel,
  listAdminNews,
  NEWS_CATEGORIES,
  saveNews,
  setNewsPublished,
} from '../services/noticiasService.js';

const EMPTY_FORM = {
  categoria: 'reforma_tributaria',
  titulo: '',
  resumo: '',
  conteudo: '',
  data_publicacao: new Date().toISOString().slice(0, 10),
  fonte: '',
  fonte_url: '',
  publicado: false,
  destaque: false,
};

export default function AdminNewsPage() {
  const { profile } = useAuth();
  const [news, setNews] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const weeklyUpdates = countCurrentWeekUpdates(news);

  useEffect(() => {
    if (profile !== 'admin') return;
    refreshNews();
  }, [profile]);

  if (profile !== 'admin') return <Navigate to="/acesso-negado" replace />;

  async function refreshNews() {
    setLoading(true);
    setError('');
    try {
      setNews(await listAdminNews());
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  function handleChange(event) {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }));
  }

  function startEditing(item) {
    setEditingId(item.id);
    setForm({
      categoria: item.categoria,
      titulo: item.titulo,
      resumo: item.resumo,
      conteudo: item.conteudo,
      data_publicacao: item.data_publicacao,
      fonte: item.fonte,
      fonte_url: item.fonte_url || '',
      publicado: item.publicado,
      destaque: item.destaque,
    });
    setMessage('');
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function resetForm() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, data_publicacao: new Date().toISOString().slice(0, 10) });
    setMessage('');
    setError('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');
    try {
      await saveNews({ ...form, id: editingId });
      const successMessage = editingId ? 'Notícia atualizada com sucesso.' : 'Notícia cadastrada com sucesso.';
      resetForm();
      setMessage(successMessage);
      await refreshNews();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish(item) {
    setMessage('');
    setError('');
    try {
      await setNewsPublished(item.id, !item.publicado);
      setMessage(item.publicado ? 'Notícia despublicada.' : 'Notícia publicada.');
      await refreshNews();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function handleDelete(item) {
    if (!window.confirm(`Excluir a notícia “${item.titulo}”? Esta ação não pode ser desfeita.`)) return;
    setMessage('');
    setError('');
    try {
      await deleteNews(item.id);
      if (editingId === item.id) resetForm();
      setMessage('Notícia excluída com sucesso.');
      await refreshNews();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-[1500px] gap-5">
      <section className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-950 to-slate-800 p-5 text-white shadow-sm sm:p-8">
        <Link to="/noticias" className="inline-flex items-center gap-2 text-sm font-black text-emerald-300 hover:text-emerald-200">
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          Voltar às notícias
        </Link>
        <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-300">Acesso exclusivo do Admin</p>
            <h1 className="mt-1 text-3xl font-black">Gerenciar notícias</h1>
          </div>
          <button type="button" onClick={resetForm} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-black text-slate-950 hover:bg-emerald-400">
            <Plus aria-hidden="true" className="h-4 w-4" />
            Nova notícia
          </button>
        </div>
      </section>

      {message ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-bold text-emerald-800">{message}</div> : null}
      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-800">{error}</div> : null}

      <section className={`rounded-2xl border px-5 py-4 ${
        weeklyUpdates >= 2
          ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
          : 'border-amber-200 bg-amber-50 text-amber-950'
      }`}>
        <p className="text-sm font-black">
          Atualizações desta semana: {weeklyUpdates} de 2
        </p>
        <p className="mt-1 text-sm font-semibold">
          {weeklyUpdates >= 2
            ? 'Frequência semanal atendida.'
            : 'Atualize ou publique notícias até completar pelo menos duas atualizações nesta semana.'}
        </p>
      </section>

      <form onSubmit={handleSubmit} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-4">
          <h2 className="text-xl font-black text-slate-950">{editingId ? 'Editar notícia' : 'Cadastrar notícia'}</h2>
          {editingId ? (
            <button type="button" onClick={resetForm} className="inline-flex items-center gap-2 text-sm font-black text-slate-600 hover:text-slate-950">
              <X aria-hidden="true" className="h-4 w-4" />
              Cancelar edição
            </button>
          ) : null}
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Field label="Categoria">
            <select name="categoria" value={form.categoria} onChange={handleChange} required className={INPUT_CLASS}>
              {NEWS_CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </Field>
          <Field label="Data">
            <input name="data_publicacao" type="date" value={form.data_publicacao} onChange={handleChange} required className={INPUT_CLASS} />
          </Field>
          <Field label="Título" wide>
            <input name="titulo" value={form.titulo} onChange={handleChange} required maxLength={180} className={INPUT_CLASS} />
          </Field>
          <Field label="Resumo curto" wide>
            <textarea name="resumo" value={form.resumo} onChange={handleChange} required maxLength={420} rows={3} className={INPUT_CLASS} />
          </Field>
          <Field label="Conteúdo completo" wide>
            <textarea name="conteudo" value={form.conteudo} onChange={handleChange} required rows={9} className={INPUT_CLASS} />
          </Field>
          <Field label="Fonte">
            <input name="fonte" value={form.fonte} onChange={handleChange} required maxLength={120} className={INPUT_CLASS} />
          </Field>
          <Field label="URL da fonte original (opcional)">
            <input name="fonte_url" type="url" inputMode="url" placeholder="https://..." value={form.fonte_url} onChange={handleChange} className={INPUT_CLASS} />
          </Field>
        </div>

        <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:gap-6">
          <Checkbox name="publicado" checked={form.publicado} onChange={handleChange} label="Publicar notícia" />
          <Checkbox name="destaque" checked={form.destaque} onChange={handleChange} label="Exibir entre os destaques da Home" />
        </div>

        <button disabled={saving} type="submit" className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60">
          <Save aria-hidden="true" className="h-4 w-4" />
          {saving ? 'Salvando...' : 'Salvar notícia'}
        </button>
      </form>

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <h2 className="text-xl font-black text-slate-950">Notícias cadastradas</h2>
        {loading ? <p className="mt-5 text-sm font-bold text-slate-500">Carregando...</p> : null}
        {!loading && !news.length ? <p className="mt-5 text-sm font-bold text-slate-500">Nenhuma notícia cadastrada.</p> : null}
        <div className="mt-5 grid gap-3">
          {news.map((item) => (
            <article key={item.id} className="grid gap-4 rounded-2xl border border-slate-200 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs font-black uppercase tracking-wide">
                  <span className="text-emerald-700">{getCategoryLabel(item.categoria)}</span>
                  <span className={item.publicado ? 'text-emerald-600' : 'text-amber-600'}>{item.publicado ? 'Publicado' : 'Rascunho'}</span>
                  {item.destaque ? <span className="text-violet-600">Destaque</span> : null}
                </div>
                <h3 className="mt-2 font-black text-slate-950">{item.titulo}</h3>
                <p className="mt-1 text-sm font-medium text-slate-500">{item.fonte} · {formatDate(item.data_publicacao)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <ActionButton onClick={() => startEditing(item)} icon={Edit3}>Editar</ActionButton>
                <ActionButton onClick={() => handlePublish(item)} icon={item.publicado ? EyeOff : Eye}>
                  {item.publicado ? 'Despublicar' : 'Publicar'}
                </ActionButton>
                <ActionButton onClick={() => handleDelete(item)} icon={Trash2} danger>Excluir</ActionButton>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

const INPUT_CLASS = 'min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-medium text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100';

function Field({ label, wide = false, children }) {
  return (
    <label className={`grid gap-2 text-sm font-bold text-slate-700 ${wide ? 'md:col-span-2' : ''}`}>
      {label}
      {children}
    </label>
  );
}

function Checkbox({ name, checked, onChange, label }) {
  return (
    <label className="inline-flex items-center gap-3 text-sm font-bold text-slate-700">
      <input name={name} type="checkbox" checked={checked} onChange={onChange} className="h-5 w-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
      {label}
    </label>
  );
}

function ActionButton({ onClick, icon: Icon, danger = false, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-black transition ${
        danger
          ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
      }`}
    >
      <Icon aria-hidden="true" className="h-4 w-4" />
      {children}
    </button>
  );
}

function countCurrentWeekUpdates(items) {
  const now = new Date();
  const start = new Date(now);
  const day = start.getDay();
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  start.setDate(start.getDate() - daysSinceMonday);
  start.setHours(0, 0, 0, 0);

  return items.filter((item) => {
    const updatedAt = new Date(item.updated_at);
    return !Number.isNaN(updatedAt.getTime()) && updatedAt >= start && updatedAt <= now;
  }).length;
}
