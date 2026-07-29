import {
  ArrowRight,
  BarChart3,
  Building2,
  Clock3,
  Database,
  History,
  Leaf,
  Scale,
  ShieldCheck,
  Wheat,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { CONTRATOS_GRAOS_TABS } from '../components/ContratosGraosLayout.jsx';
import { UNIDADES, rotaInicialDaUnidade } from '../config/unidades.js';
import { useAuth } from '../contexts/AuthContext.jsx';

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

  return (
    <div className="mx-auto grid w-full max-w-[1500px] gap-5 sm:gap-6">
      <section className="relative isolate min-h-[390px] overflow-hidden rounded-3xl border border-slate-800/50 bg-[#071822] text-white shadow-[0_24px_60px_rgba(15,23,42,0.22)] sm:min-h-[430px]">
        <div className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_78%_18%,rgba(239,159,39,0.22),transparent_30%),radial-gradient(circle_at_15%_90%,rgba(32,201,151,0.20),transparent_36%),linear-gradient(118deg,#071822_5%,#0b2832_52%,#15372e_100%)]" />
        <FarmBackdrop />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#071822] via-[#071822]/95 to-[#071822]/25 sm:via-[#071822]/80" />

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

function FarmBackdrop() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 900 520"
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-y-0 right-0 -z-10 h-full w-full opacity-55 sm:w-[72%] sm:opacity-75"
    >
      <defs>
        <linearGradient id="homeField" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#2a6b48" />
          <stop offset="1" stopColor="#102e2a" />
        </linearGradient>
        <linearGradient id="homeSilo" x1="0" x2="1">
          <stop offset="0" stopColor="#8aa39a" stopOpacity=".55" />
          <stop offset=".55" stopColor="#d5d4b8" stopOpacity=".72" />
          <stop offset="1" stopColor="#647f75" stopOpacity=".5" />
        </linearGradient>
      </defs>
      <path d="M0 395C180 330 350 345 520 385C675 420 790 410 900 360V520H0Z" fill="url(#homeField)" />
      <path d="M0 445C170 380 350 395 540 440C685 475 800 460 900 420" fill="none" stroke="#56d49c" strokeOpacity=".34" strokeWidth="2" />
      <g opacity=".82">
        <path d="M510 145H685" stroke="#9cb5aa" strokeWidth="8" />
        <path d="M530 145L610 84L688 145" fill="none" stroke="#9cb5aa" strokeWidth="6" />
        <rect x="538" y="148" width="58" height="213" rx="9" fill="url(#homeSilo)" />
        <ellipse cx="567" cy="148" rx="29" ry="11" fill="#d3d7c5" fillOpacity=".62" />
        <path d="M552 136L567 110L582 136" fill="#aebcaf" fillOpacity=".7" />
        <rect x="607" y="148" width="67" height="213" rx="10" fill="url(#homeSilo)" />
        <ellipse cx="640.5" cy="148" rx="33.5" ry="12" fill="#d3d7c5" fillOpacity=".65" />
        <path d="M622 136L640 103L659 136" fill="#aebcaf" fillOpacity=".72" />
        <rect x="695" y="184" width="84" height="177" rx="10" fill="url(#homeSilo)" />
        <ellipse cx="737" cy="184" rx="42" ry="14" fill="#d3d7c5" fillOpacity=".62" />
        <path d="M714 169L737 127L760 169" fill="#aebcaf" fillOpacity=".7" />
        <path d="M500 361H806" stroke="#6b8d7c" strokeWidth="12" />
        <path d="M790 91V361M776 91H804M783 123H797M783 157H797M783 191H797M783 225H797" stroke="#9cb5aa" strokeWidth="5" />
        <path d="M798 106L864 152" stroke="#9cb5aa" strokeWidth="7" />
      </g>
      <g fill="#55d39a" opacity=".35">
        <path d="M190 445c35-74 74-75 115 0c-42-35-77-35-115 0Z" />
        <path d="M320 438c30-63 64-64 101 0c-36-30-67-30-101 0Z" />
        <path d="M62 462c25-53 54-53 85 0c-31-26-57-26-85 0Z" />
      </g>
    </svg>
  );
}
