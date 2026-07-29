import {
  ArrowRight,
  BarChart3,
  Building2,
  Clock3,
  Database,
  History,
  Leaf,
  Newspaper,
  Scale,
  ShieldCheck,
  Wheat,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CONTRATOS_GRAOS_TABS } from '../components/ContratosGraosLayout.jsx';
import NewsCard from '../components/noticias/NewsCard.jsx';
import { UNIDADES, rotaInicialDaUnidade } from '../config/unidades.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { listPublishedNews } from '../services/noticiasService.js';

const CADASTRO_LINKS = [
  { to: '/fornecedores', label: 'Fornecedores', menu: 'fornecedores' },
  { to: '/fabricas', label: 'Fábricas', menu: 'fabricas' },
  { to: '/produtos', label: 'Produtos', menu: 'produtos' },
  { to: '/balancas?tab=cadastros&cadastro=veiculos', label: 'Veículos', menu: 'balancas' },
  { to: '/balancas?tab=cadastros&cadastro=motoristas', label: 'Motoristas', menu: 'balancas' },
  { to: '/balancas?tab=cadastros&cadastro=transportadoras', label: 'Transportadoras', menu: 'balancas' },
  { to: '/balancas?tab=cadastros&cadastro=laboratorios', label: 'Laboratórios', menu: 'balancas' },
];

const DIRECT_MODULES = [
  {
    id: 'backup',
    to: '/backup',
    label: 'Backup',
    description: 'Proteção e recuperação das informações do sistema.',
    menu: 'backup',
    icon: Database,
    tone: 'slate',
  },
  {
    id: 'usuarios',
    to: '/admin/acessos',
    label: 'Usuários e permissões',
    description: 'Administração segura de perfis e acessos.',
    menu: 'usuarios',
    icon: ShieldCheck,
    tone: 'violet',
  },
  {
    id: 'auditoria',
    to: '/admin/auditoria',
    label: 'Auditoria',
    description: 'Histórico das ações importantes realizadas no AgroFlow.',
    menu: 'auditoria',
    icon: History,
    tone: 'amber',
  },
];

const CARD_TONES = {
  emerald: {
    icon: 'bg-emerald-100 text-emerald-700',
    accent: 'bg-emerald-500',
    hover: 'hover:border-emerald-200 hover:shadow-emerald-950/10',
    link: 'text-emerald-700',
  },
  teal: {
    icon: 'bg-teal-100 text-teal-700',
    accent: 'bg-teal-500',
    hover: 'hover:border-teal-200 hover:shadow-teal-950/10',
    link: 'text-teal-700',
  },
  blue: {
    icon: 'bg-blue-100 text-blue-700',
    accent: 'bg-blue-500',
    hover: 'hover:border-blue-200 hover:shadow-blue-950/10',
    link: 'text-blue-700',
  },
  slate: {
    icon: 'bg-slate-200 text-slate-700',
    accent: 'bg-slate-500',
    hover: 'hover:border-slate-300 hover:shadow-slate-950/10',
    link: 'text-slate-700',
  },
  violet: {
    icon: 'bg-violet-100 text-violet-700',
    accent: 'bg-violet-500',
    hover: 'hover:border-violet-200 hover:shadow-violet-950/10',
    link: 'text-violet-700',
  },
  amber: {
    icon: 'bg-amber-100 text-amber-700',
    accent: 'bg-amber-500',
    hover: 'hover:border-amber-200 hover:shadow-amber-950/10',
    link: 'text-amber-700',
  },
};

const FEATURES = [
  { label: 'Gestão integrada', icon: Leaf },
  { label: 'Informações confiáveis', icon: BarChart3 },
  { label: 'Segurança dos dados', icon: ShieldCheck },
  { label: 'Agilidade operacional', icon: Clock3 },
];

export default function HomePage() {
  const { can, podeAcessarUnidade, profileData } = useAuth();
  const shortcuts = buildAllowedShortcuts(can, podeAcessarUnidade);
  const firstName = getFirstName(profileData?.nome || profileData?.email);
  const [news, setNews] = useState([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [newsError, setNewsError] = useState('');

  useEffect(() => {
    let active = true;

    listPublishedNews({ limit: 4, featuredFirst: true })
      .then((items) => {
        if (active) setNews(items);
      })
      .catch((error) => {
        if (active) setNewsError(error.message);
      })
      .finally(() => {
        if (active) setNewsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="mx-auto grid w-full max-w-[1500px] gap-5 sm:gap-6">
      <section className="relative isolate min-h-[390px] overflow-hidden rounded-3xl border border-slate-800/50 bg-[#071822] text-white shadow-[0_24px_60px_rgba(15,23,42,0.22)] sm:min-h-[430px]">
        <img
          src="/agroflow-home-silos.png"
          alt=""
          className="absolute inset-0 -z-20 h-full w-full object-cover object-[70%_center] sm:object-center"
        />
        <div className="absolute inset-0 -z-10 bg-[#071822]/50 sm:bg-gradient-to-r sm:from-[#071822]/95 sm:via-[#071822]/62 sm:to-[#071822]/10" />
        <div className="absolute inset-x-0 bottom-0 -z-10 h-2/5 bg-gradient-to-t from-[#06151e]/70 to-transparent" />

        <div className="flex min-h-[390px] max-w-3xl flex-col justify-center px-5 py-8 sm:min-h-[430px] sm:px-9 sm:py-10 lg:px-12">
          <div className="flex items-center gap-4 sm:gap-5">
            <div className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl border border-emerald-300/20 bg-slate-950/25 shadow-[0_14px_35px_rgba(0,0,0,0.24)] backdrop-blur-sm sm:h-24 sm:w-24">
              <img src="/agroflow-symbol.png" alt="" className="h-16 w-16 object-contain sm:h-20 sm:w-20" />
            </div>
            <div>
              <p className="text-4xl font-black leading-none tracking-wide drop-shadow-lg sm:text-5xl">
                <span className="text-[#5dcaa5]">Agro</span>
                <span className="text-[#ef9f27]">Flow</span>
              </p>
              <p className="mt-2 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-200 sm:text-xs">
                Gestão inteligente do agronegócio
              </p>
            </div>
          </div>

          <div className="mt-8 max-w-2xl border-l-4 border-[#5dcaa5] pl-4 sm:pl-5">
            <p className="text-sm font-black uppercase tracking-[0.14em] text-emerald-300">
              Bem-vindo{firstName ? `, ${firstName}` : ''}
            </p>
            <h1 className="mt-2 text-2xl font-black leading-tight text-white sm:text-4xl">
              Informação e controle para decisões mais seguras no campo.
            </h1>
            <p className="mt-4 max-w-xl text-sm font-medium leading-6 text-slate-200 sm:text-base sm:leading-7">
              O AgroFlow integra contratos, operações de balança, cadastros e controles administrativos em um ambiente seguro, organizado e preparado para a rotina do agronegócio.
            </p>
          </div>

          <div className="mt-8 grid max-w-2xl grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
            {FEATURES.map((feature) => (
              <div key={feature.label} className="flex min-h-20 flex-col justify-center rounded-xl border border-white/10 bg-white/[0.06] px-3 py-3 backdrop-blur-sm">
                <feature.icon aria-hidden="true" className="h-5 w-5 text-emerald-300" />
                <span className="mt-2 text-[11px] font-bold leading-4 text-slate-100">{feature.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_16px_45px_rgba(15,23,42,0.08)] sm:p-6 lg:p-7">
        <div className="flex flex-col gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-700">
              <Newspaper aria-hidden="true" className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Conteúdo selecionado</p>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">Informações e Notícias</h2>
            </div>
          </div>
          <Link
            to="/noticias"
            className="inline-flex min-h-10 items-center gap-2 self-start rounded-xl px-3 py-2 text-sm font-black text-emerald-700 transition hover:bg-emerald-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-100 sm:self-auto"
          >
            Ver todas as notícias
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </Link>
        </div>

        {newsLoading ? (
          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-8 text-center text-sm font-bold text-slate-500">
            Carregando notícias...
          </div>
        ) : null}
        {newsError ? (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-5 text-sm font-bold text-amber-900">
            {newsError}
          </div>
        ) : null}
        {!newsLoading && !newsError && !news.length ? (
          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-8 text-center text-sm font-bold text-slate-500">
            Nenhuma notícia publicada no momento.
          </div>
        ) : null}
        {news.length ? (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {news.map((item) => <NewsCard key={item.id} news={item} />)}
          </div>
        ) : null}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_16px_45px_rgba(15,23,42,0.08)] sm:p-6 lg:p-7">
        <div className="flex flex-col gap-2 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Seu ambiente de trabalho</p>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">Módulos liberados para você</h2>
          </div>
          <p className="max-w-md text-sm font-medium leading-5 text-slate-500">
            Escolha por onde deseja começar. Os atalhos abaixo seguem exatamente as permissões do seu usuário.
          </p>
        </div>

        {shortcuts.length ? (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {shortcuts.map((shortcut) => (
              <ModuleShortcut key={shortcut.id} shortcut={shortcut} />
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-6 text-sm font-semibold text-amber-900">
            Seu acesso está ativo, mas nenhum módulo foi liberado. Solicite ao administrador a permissão necessária.
          </div>
        )}
      </section>

      <footer className="px-4 pb-2 text-center text-xs font-semibold text-slate-500">
        AgroFlow © {new Date().getFullYear()} — Gestão inteligente do agronegócio.
      </footer>
    </div>
  );
}

function ModuleShortcut({ shortcut }) {
  const tone = CARD_TONES[shortcut.tone] || CARD_TONES.emerald;
  const Icon = shortcut.icon;

  return (
    <Link
      to={shortcut.to}
      className={`group relative flex min-h-44 overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-xl focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200 ${tone.hover}`}
      aria-label={`Abrir ${shortcut.label}`}
    >
      <span aria-hidden="true" className={`absolute inset-x-0 bottom-0 h-1 ${tone.accent}`} />
      <div className="flex w-full flex-col">
        <div className={`grid h-12 w-12 place-items-center rounded-xl ${tone.icon}`}>
          <Icon aria-hidden="true" className="h-6 w-6" />
        </div>
        <h3 className="mt-4 text-lg font-black text-slate-950">{shortcut.label}</h3>
        <p className="mt-1 flex-1 text-sm font-medium leading-5 text-slate-500">{shortcut.description}</p>
        <span className={`mt-4 inline-flex items-center gap-2 text-sm font-black ${tone.link}`}>
          Acessar módulo
          <ArrowRight aria-hidden="true" className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </span>
      </div>
    </Link>
  );
}

function buildAllowedShortcuts(can, podeAcessarUnidade) {
  const shortcuts = [];
  const firstContractTab = CONTRATOS_GRAOS_TABS.find((tab) => can(tab.menu, 'visualizar'));

  if (firstContractTab) {
    shortcuts.push({
      id: 'contratos-graos',
      to: firstContractTab.to,
      label: 'Contratos de Grãos',
      description: 'Contratos, notas fiscais, fretes, documentos e informações financeiras.',
      icon: Wheat,
      tone: 'emerald',
    });
  }

  UNIDADES.forEach((unidade) => {
    if (!can(unidade.permissaoBase, 'visualizar') || !podeAcessarUnidade(unidade.codigo)) return;
    shortcuts.push({
      id: `unidade-${unidade.codigo}`,
      to: rotaInicialDaUnidade(unidade),
      label: unidade.nome,
      description: unidade.descricao,
      icon: unidade.icone || Scale,
      tone: 'teal',
    });
  });

  const firstCadastro = CADASTRO_LINKS.find((item) => can(item.menu, 'visualizar'));
  if (firstCadastro) {
    const visibleLabels = CADASTRO_LINKS
      .filter((item) => can(item.menu, 'visualizar'))
      .map((item) => item.label);
    shortcuts.push({
      id: 'cadastros',
      to: firstCadastro.to,
      label: 'Cadastros',
      description: `Acesso a ${formatList(visibleLabels)}.`,
      icon: Building2,
      tone: 'blue',
    });
  }

  DIRECT_MODULES.forEach((module) => {
    if (can(module.menu, 'visualizar')) shortcuts.push(module);
  });

  return shortcuts;
}

function formatList(items) {
  if (items.length <= 1) return items[0] || 'cadastros permitidos';
  if (items.length === 2) return items.join(' e ');
  return `${items.slice(0, -1).join(', ')} e ${items.at(-1)}`;
}

function getFirstName(value = '') {
  return String(value).trim().split(/\s+/)[0] || '';
}
