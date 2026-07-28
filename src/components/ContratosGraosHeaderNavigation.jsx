import { Check, FileCheck2 } from 'lucide-react';
import { NavLink } from 'react-router-dom';

const TAB_STYLES = {
  dashboard: {
    iconClass: 'bg-blue-500 text-white shadow-blue-200',
    cardClass: 'border-blue-100 hover:border-blue-300 hover:bg-blue-50/50',
    activeClass: 'border-blue-200 bg-blue-50/70 ring-blue-100',
    lineClass: 'bg-blue-500',
    indicatorClass: 'bg-blue-500 text-white',
  },
  contratos: {
    iconClass: 'bg-emerald-600 text-white shadow-emerald-200',
    cardClass: 'border-emerald-100 hover:border-emerald-300 hover:bg-emerald-50/50',
    activeClass: 'border-emerald-200 bg-emerald-50/70 ring-emerald-100',
    lineClass: 'bg-emerald-600',
    indicatorClass: 'bg-emerald-600 text-white',
  },
  notas_fiscais: {
    iconClass: 'bg-orange-500 text-white shadow-orange-200',
    cardClass: 'border-orange-100 hover:border-orange-300 hover:bg-orange-50/50',
    activeClass: 'border-orange-200 bg-orange-50/70 ring-orange-100',
    lineClass: 'bg-orange-500',
    indicatorClass: 'bg-orange-500 text-white',
  },
  fretes: {
    iconClass: 'bg-cyan-600 text-white shadow-cyan-200',
    cardClass: 'border-cyan-100 hover:border-cyan-300 hover:bg-cyan-50/50',
    activeClass: 'border-cyan-200 bg-cyan-50/70 ring-cyan-100',
    lineClass: 'bg-cyan-600',
    indicatorClass: 'bg-cyan-600 text-white',
  },
  documentos: {
    iconClass: 'bg-violet-600 text-white shadow-violet-200',
    cardClass: 'border-violet-100 hover:border-violet-300 hover:bg-violet-50/50',
    activeClass: 'border-violet-200 bg-violet-50/70 ring-violet-100',
    lineClass: 'bg-violet-600',
    indicatorClass: 'bg-violet-600 text-white',
  },
  financeiro: {
    iconClass: 'bg-blue-950 text-white shadow-blue-200',
    cardClass: 'border-blue-100 hover:border-blue-300 hover:bg-blue-50/50',
    activeClass: 'border-blue-300 bg-blue-50/70 ring-blue-100',
    lineClass: 'bg-blue-950',
    indicatorClass: 'bg-blue-950 text-white',
  },
};

const FALLBACK_STYLE = TAB_STYLES.dashboard;

export default function ContratosGraosHeaderNavigation({ tabs }) {
  return (
    <div className="grid gap-4">
      <header className="relative isolate overflow-hidden rounded-2xl border border-emerald-100 bg-gradient-to-r from-white via-emerald-50/30 to-emerald-100/70 px-5 py-5 shadow-sm sm:px-7 sm:py-6">
        <ContratosBackground />

        <div className="relative z-10 flex min-w-0 items-center gap-4 sm:gap-5">
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full border-[7px] border-emerald-50 bg-gradient-to-br from-emerald-400 to-emerald-700 text-white shadow-lg shadow-emerald-200/70 sm:h-20 sm:w-20">
            <FileCheck2 aria-hidden="true" className="h-8 w-8 sm:h-10 sm:w-10" strokeWidth={2.1} />
          </span>

          <div className="min-w-0">
            <h1 className="text-2xl font-black tracking-tight text-emerald-950 sm:text-3xl lg:text-4xl">
              Contratos de Grãos
            </h1>
            <p className="mt-1.5 max-w-3xl text-sm font-medium leading-relaxed text-slate-600 sm:text-base">
              Gestão integrada de contratos, notas fiscais, fretes, documentos e informações financeiras.
            </p>
          </div>
        </div>
      </header>

      {tabs.length > 0 && (
        <nav
          aria-label="Módulos de Contratos de Grãos"
          className="rounded-2xl border border-slate-200 bg-white p-2.5 shadow-panel sm:p-3"
        >
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
            {tabs.map((tab) => {
              const style = TAB_STYLES[tab.menu] || FALLBACK_STYLE;
              const Icon = tab.icon;

              return (
                <NavLink
                  key={tab.to}
                  to={tab.to}
                  end={tab.to === '/'}
                  className={({ isActive }) => [
                    'group relative flex min-h-28 min-w-0 flex-col items-center justify-center overflow-hidden rounded-xl border px-2 py-4 text-center transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 sm:min-h-32 sm:px-3',
                    style.cardClass,
                    isActive ? `ring-2 ${style.activeClass}` : 'bg-white',
                  ].join(' ')}
                >
                  {({ isActive }) => (
                    <>
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
                    </>
                  )}
                </NavLink>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}

function ContratosBackground() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 660 170"
      className="pointer-events-none absolute bottom-0 right-0 -z-10 h-full w-auto max-w-[64%] text-emerald-700 opacity-[0.1]"
      fill="none"
    >
      <path d="M10 156c86-54 169-53 250-9 76-55 164-58 264-13 45 20 85 24 126 8v28H10v-14Z" fill="currentColor" opacity=".35" />
      <path d="M30 154c90-66 178-61 262 0M170 164c89-73 182-79 280-16M355 164c76-57 166-65 275-22" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      <path d="M216 136V75c0-14 12-25 27-25s27 11 27 25v61M216 77h54M216 94h54M288 136V91c0-12 11-22 25-22s25 10 25 22v45M288 93h50" stroke="currentColor" strokeWidth="5" />
      <path d="M397 38h111l42 42v81H397V38Z" fill="white" fillOpacity=".6" stroke="currentColor" strokeWidth="6" strokeLinejoin="round" />
      <path d="M508 38v43h42M422 99h101M422 119h82M422 139h58" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
      <circle cx="531" cy="138" r="23" fill="white" fillOpacity=".8" stroke="currentColor" strokeWidth="6" />
      <path d="m520 138 8 8 15-18" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M118 147V92l46-35 46 35M137 147v-46h53v46" stroke="currentColor" strokeWidth="5" />
    </svg>
  );
}
