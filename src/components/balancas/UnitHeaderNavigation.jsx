import {
  BarChart3,
  Check,
  ClipboardCheck,
  FlaskConical,
  LayoutDashboard,
  Truck,
  Warehouse,
} from 'lucide-react';

const MODULE_STYLES = {
  dashboard: {
    icon: LayoutDashboard,
    iconClass: 'bg-blue-500 text-white shadow-blue-200',
    cardClass: 'border-blue-100 hover:border-blue-300 hover:bg-blue-50/50',
    activeClass: 'border-blue-200 bg-blue-50/70 ring-blue-100',
    lineClass: 'bg-blue-500',
    indicatorClass: 'bg-blue-500 text-white',
  },
  portaria: {
    icon: Truck,
    iconClass: 'bg-teal-500 text-white shadow-teal-200',
    cardClass: 'border-teal-100 hover:border-teal-300 hover:bg-teal-50/50',
    activeClass: 'border-teal-200 bg-teal-50/70 ring-teal-100',
    lineClass: 'bg-teal-500',
    indicatorClass: 'bg-teal-500 text-white',
  },
  laboratorio: {
    icon: FlaskConical,
    iconClass: 'bg-orange-500 text-white shadow-orange-200',
    cardClass: 'border-orange-100 hover:border-orange-300 hover:bg-orange-50/50',
    activeClass: 'border-orange-200 bg-orange-50/70 ring-orange-100',
    lineClass: 'bg-orange-500',
    indicatorClass: 'bg-orange-500 text-white',
  },
  recebimentos: {
    icon: ClipboardCheck,
    iconClass: 'bg-violet-500 text-white shadow-violet-200',
    cardClass: 'border-violet-100 hover:border-violet-300 hover:bg-violet-50/50',
    activeClass: 'border-violet-200 bg-violet-50/70 ring-violet-100',
    lineClass: 'bg-violet-500',
    indicatorClass: 'bg-violet-500 text-white',
  },
  armazenagem: {
    icon: Warehouse,
    iconClass: 'bg-cyan-600 text-white shadow-cyan-200',
    cardClass: 'border-cyan-100 hover:border-cyan-300 hover:bg-cyan-50/50',
    activeClass: 'border-cyan-200 bg-cyan-50/70 ring-cyan-100',
    lineClass: 'bg-cyan-600',
    indicatorClass: 'bg-cyan-600 text-white',
  },
  relatorios: {
    icon: BarChart3,
    iconClass: 'bg-emerald-600 text-white shadow-emerald-200',
    cardClass: 'border-emerald-100 hover:border-emerald-300 hover:bg-emerald-50/50',
    activeClass: 'border-emerald-200 bg-emerald-50/70 ring-emerald-100',
    lineClass: 'bg-emerald-600',
    indicatorClass: 'bg-emerald-600 text-white',
  },
};

const FALLBACK_STYLE = MODULE_STYLES.dashboard;

export default function UnitHeaderNavigation({
  unidade,
  tabs,
  activeTab,
  onSelectTab,
}) {
  const UnitIcon = unidade.icone;

  return (
    <div className="grid gap-4">
      <header className="relative isolate overflow-hidden rounded-2xl border border-emerald-100 bg-gradient-to-r from-white via-white to-emerald-50 px-5 py-5 shadow-sm sm:px-7 sm:py-6">
        <UnitBackground />

        <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4 sm:gap-5">
            <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full border-[7px] border-emerald-50 bg-gradient-to-br from-emerald-400 to-emerald-700 text-white shadow-lg shadow-emerald-200/70 sm:h-20 sm:w-20">
              <UnitIcon aria-hidden="true" className="h-8 w-8 sm:h-10 sm:w-10" strokeWidth={2.2} />
            </span>

            <div className="min-w-0">
              <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl lg:text-4xl">
                {unidade.nome}
              </h1>
              <p className="mt-1.5 max-w-2xl text-sm font-medium leading-relaxed text-slate-600 sm:text-base">
                {unidade.descricao}
              </p>
            </div>
          </div>

          <span className="inline-flex w-fit shrink-0 items-center gap-2 self-start rounded-full border border-emerald-300 bg-white/90 px-4 py-2 text-sm font-extrabold text-emerald-700 shadow-sm backdrop-blur sm:self-center">
            <Warehouse aria-hidden="true" className="h-4 w-4" />
            {unidade.rotulo}
          </span>
        </div>
      </header>

      <nav
        aria-label={`Módulos de ${unidade.nome}`}
        className="rounded-2xl border border-slate-200 bg-white p-2.5 shadow-panel sm:p-3"
      >
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
          {tabs.map((tab) => {
            const style = MODULE_STYLES[tab.key] || FALLBACK_STYLE;
            const Icon = style.icon;
            const isActive = activeTab === tab.key;

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => onSelectTab(tab.key)}
                aria-current={isActive ? 'page' : undefined}
                className={[
                  'group relative flex min-h-32 min-w-0 flex-col items-center justify-center overflow-hidden rounded-xl border px-2 py-4 text-center transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 sm:min-h-36 sm:px-3',
                  style.cardClass,
                  isActive ? `ring-2 ${style.activeClass}` : 'bg-white',
                ].join(' ')}
              >
                <span className={`grid h-11 w-11 place-items-center rounded-xl shadow-md ${style.iconClass}`}>
                  <Icon aria-hidden="true" className="h-6 w-6" strokeWidth={2.2} />
                </span>

                <span className="mt-3 text-sm font-extrabold leading-snug text-slate-900 sm:text-base">
                  {tab.label}
                </span>

                {isActive && (
                  <span className={`absolute right-2.5 top-2.5 grid h-5 w-5 place-items-center rounded-full ${style.indicatorClass}`}>
                    <Check aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={3} />
                    <span className="sr-only">Módulo selecionado</span>
                  </span>
                )}

                <span className={`absolute inset-x-0 bottom-0 h-1 ${style.lineClass}`} />
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function UnitBackground() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 560 150"
      className="pointer-events-none absolute bottom-0 right-0 -z-10 h-full w-auto max-w-[58%] text-emerald-600 opacity-[0.09]"
      fill="none"
    >
      <path d="M30 140h510M85 140V83l54-45 55 45v57M108 140V91h62v49" stroke="currentColor" strokeWidth="5" />
      <path d="M230 140V42c0-16 14-29 31-29s31 13 31 29v98M230 44h62M230 62h62M230 80h62" stroke="currentColor" strokeWidth="5" />
      <path d="M315 140V70c0-13 12-24 27-24s27 11 27 24v70M315 72h54M315 89h54" stroke="currentColor" strokeWidth="5" />
      <path d="M401 140V78h112v62M391 78h132M420 78V50h76v28M431 140v-39h52v39" stroke="currentColor" strokeWidth="5" strokeLinejoin="round" />
      <circle cx="448" cy="119" r="13" stroke="currentColor" strokeWidth="5" />
      <circle cx="496" cy="119" r="13" stroke="currentColor" strokeWidth="5" />
    </svg>
  );
}
