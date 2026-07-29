import { ArrowLeft, ExternalLink, Newspaper } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { formatDate } from '../components/noticias/NewsCard.jsx';
import { getCategoryLabel, getPublishedNews } from '../services/noticiasService.js';

export default function NewsDetailPage() {
  const { id } = useParams();
  const [news, setNews] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');

    getPublishedNews(id)
      .then((item) => {
        if (!active) return;
        setNews(item);
        if (!item) setError('Notícia não encontrada ou não está publicada.');
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
  }, [id]);

  if (loading) {
    return <div className="mx-auto w-full max-w-4xl rounded-3xl border border-slate-200 bg-white px-6 py-12 text-center text-sm font-bold text-slate-600">Carregando notícia...</div>;
  }

  if (error || !news) {
    return (
      <div className="mx-auto w-full max-w-4xl rounded-3xl border border-red-200 bg-red-50 px-6 py-12 text-center">
        <p className="font-bold text-red-800">{error || 'Notícia não encontrada.'}</p>
        <Link to="/noticias" className="mt-4 inline-flex items-center gap-2 text-sm font-black text-red-800 underline">
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          Voltar às notícias
        </Link>
      </div>
    );
  }

  return (
    <article className="mx-auto w-full max-w-4xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_18px_55px_rgba(15,23,42,0.09)]">
      <header className="bg-gradient-to-br from-emerald-50 via-white to-amber-50 px-5 py-7 sm:px-9 sm:py-10">
        <Link to="/noticias" className="inline-flex items-center gap-2 text-sm font-black text-emerald-700 hover:text-emerald-800">
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          Voltar às notícias
        </Link>
        <div className="mt-6 flex items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-600 text-white">
            <Newspaper aria-hidden="true" className="h-6 w-6" />
          </span>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">{getCategoryLabel(news.categoria)}</p>
            <h1 className="mt-2 text-3xl font-black leading-tight tracking-tight text-slate-950 sm:text-4xl">{news.titulo}</h1>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-slate-500">
              <span>Fonte: {news.fonte}</span>
              <time dateTime={news.data_publicacao}>{formatDate(news.data_publicacao)}</time>
            </div>
          </div>
        </div>
      </header>

      <div className="px-5 py-7 sm:px-9 sm:py-10">
        <p className="border-l-4 border-emerald-500 pl-4 text-lg font-bold leading-7 text-slate-700">{news.resumo}</p>
        <div className="mt-8 whitespace-pre-wrap text-base font-medium leading-8 text-slate-700">{news.conteudo}</div>

        {news.fonte_url ? (
          <a
            href={news.fonte_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-9 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-black text-white transition hover:bg-slate-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-slate-300"
          >
            Acessar fonte original
            <ExternalLink aria-hidden="true" className="h-4 w-4" />
          </a>
        ) : null}
      </div>
    </article>
  );
}
