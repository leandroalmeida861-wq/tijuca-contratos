import {
  ArrowRight,
  BadgeDollarSign,
  FileText,
  Leaf,
  Wheat,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { getCategoryLabel } from '../../services/noticiasService.js';

const CATEGORY_STYLES = {
  reforma_tributaria: {
    badge: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    icon: 'bg-emerald-100 text-emerald-700',
    action: 'text-emerald-700',
    border: 'hover:border-emerald-200',
    Icon: FileText,
  },
  financeiro_economia: {
    badge: 'border-blue-200 bg-blue-50 text-blue-700',
    icon: 'bg-blue-100 text-blue-700',
    action: 'text-blue-700',
    border: 'hover:border-blue-200',
    Icon: BadgeDollarSign,
  },
  mercado_graos: {
    badge: 'border-orange-200 bg-orange-50 text-orange-700',
    icon: 'bg-orange-100 text-orange-700',
    action: 'text-orange-700',
    border: 'hover:border-orange-200',
    Icon: Wheat,
  },
  agronegocio: {
    badge: 'border-violet-200 bg-violet-50 text-violet-700',
    icon: 'bg-violet-100 text-violet-700',
    action: 'text-violet-700',
    border: 'hover:border-violet-200',
    Icon: Leaf,
  },
};

export default function NewsCard({ news }) {
  const style = CATEGORY_STYLES[news.categoria] || CATEGORY_STYLES.agronegocio;
  const Icon = style.Icon;

  return (
    <Link
      to={`/noticias/${news.id}`}
      className={`group flex min-h-72 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-xl focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200 ${style.border}`}
      aria-label={`Ler notícia: ${news.titulo}`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.08em] ${style.badge}`}>
          {getCategoryLabel(news.categoria)}
        </span>
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${style.icon}`}>
          <Icon aria-hidden="true" className="h-5 w-5" />
        </span>
      </div>

      <h3 className="mt-4 text-lg font-black leading-6 text-slate-950">{news.titulo}</h3>
      <p className="mt-3 flex-1 text-sm font-medium leading-5 text-slate-600">{news.resumo}</p>

      <div className="mt-5 border-t border-slate-100 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-slate-500">
          <span>Fonte: {news.fonte}</span>
          <time dateTime={news.data_publicacao}>{formatDate(news.data_publicacao)}</time>
        </div>
        <span className={`mt-4 inline-flex items-center gap-2 text-sm font-black ${style.action}`}>
          Ler notícia
          <ArrowRight aria-hidden="true" className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </span>
      </div>
    </Link>
  );
}

export function formatDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));
}
