import { ArrowLeft, Newspaper, Search, Settings2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import NewsCard from '../components/noticias/NewsCard.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { listPublishedNews, NEWS_CATEGORIES } from '../services/noticiasService.js';

export default function NewsListPage() {
  const { profile } = useAuth();
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');

    listPublishedNews({ category, search: appliedSearch })
      .then((items) => {
        if (active) setNews(items);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [category, appliedSearch]);

  function handleSearch(event) {
    event.preventDefault();
    setAppliedSearch(search.trim());
  }

  return (
    <div className="mx-auto grid w-full max-w-[1500px] gap-5">
      <section className="rounded-3xl border border-slate-200 bg-gradient-to-br from-emerald-50 via-white to-amber-50 p-5 shadow-sm sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Link to="/inicio" className="inline-flex items-center gap-2 text-sm font-black text-emerald-700 hover:text-emerald-800">
              <ArrowLeft aria-hidden="true" className="h-4 w-4" />
              Voltar ao início
            </Link>
            <div className="mt-4 flex items-center gap-4">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-900/15">
                <Newspaper aria-hidden="true" className="h-7 w-7" />
              </span>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Informações e Notícias</p>
                <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950">Todas as notícias</h1>
              </div>
            </div>
          </div>

          {profile === 'admin' ? (
            <Link
              to="/noticias/admin"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-black text-white transition hover:bg-slate-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-slate-300"
            >
              <Settings2 aria-hidden="true" className="h-4 w-4" />
              Gerenciar notícias
            </Link>
          ) : null}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <form onSubmit={handleSearch} className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px_auto] lg:items-end">
          <label className="grid gap-2 text-sm font-bold text-slate-700">
            Pesquisar por título
            <span className="relative">
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Digite o título da notícia"
                className="min-h-11 w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-11 pr-4 font-medium text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
              />
            </span>
          </label>
          <label className="grid gap-2 text-sm font-bold text-slate-700">
            Categoria
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-medium text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
            >
              <option value="">Todas as categorias</option>
              {NEWS_CATEGORIES.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </label>
          <button type="submit" className="min-h-11 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-black text-white transition hover:bg-emerald-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200">
            Pesquisar
          </button>
        </form>
      </section>

      {error ? <StatusMessage tone="error">{error}</StatusMessage> : null}
      {loading ? <StatusMessage>Carregando notícias...</StatusMessage> : null}
      {!loading && !error && !news.length ? <StatusMessage>Nenhuma notícia publicada foi encontrada.</StatusMessage> : null}

      {!loading && news.length ? (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {news.map((item) => <NewsCard key={item.id} news={item} />)}
        </section>
      ) : null}
    </div>
  );
}

function StatusMessage({ children, tone = 'default' }) {
  const className = tone === 'error'
    ? 'border-red-200 bg-red-50 text-red-800'
    : 'border-slate-200 bg-white text-slate-600';
  return <div className={`rounded-2xl border px-5 py-8 text-center text-sm font-bold ${className}`}>{children}</div>;
}
