import { CalendarDays, ChevronDown, Info, LockKeyhole } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  PERIOD_MONTHS,
  PERIOD_YEARS,
  countRowsByPeriod,
  currentPeriod,
  filterRowsByPeriod,
} from '../../lib/periodHistory.js';

export function usePeriodHistory(rows, getDate, searchActive = false) {
  const [period, setPeriod] = useState(currentPeriod);
  const previousSearch = useRef(searchActive);

  useEffect(() => {
    if (previousSearch.current && !searchActive) setPeriod(currentPeriod());
    previousSearch.current = searchActive;
  }, [searchActive]);

  const counts = useMemo(() => countRowsByPeriod(rows, getDate), [rows, getDate]);
  const periodRows = useMemo(
    () => filterRowsByPeriod(rows, getDate, period, searchActive),
    [rows, getDate, period, searchActive],
  );

  return { period, setPeriod, counts, periodRows };
}

export default function PeriodHistory({
  period,
  onChange,
  counts,
  searchActive = false,
  collapsible = false,
  defaultExpanded = true,
}) {
  const [sectionOpen, setSectionOpen] = useState(defaultExpanded);
  const [openYears, setOpenYears] = useState(() => new Set([period.year]));

  useEffect(() => {
    setOpenYears((current) => {
      if (current.has(period.year)) return current;
      return new Set([...current, period.year]);
    });
  }, [period.year]);

  function toggleYear(year) {
    setOpenYears((current) => {
      const next = new Set(current);
      if (next.has(year)) next.delete(year);
      else next.add(year);
      return next;
    });
  }

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-panel" aria-label="Histórico por período">
      <button
        type="button"
        disabled={!collapsible}
        onClick={() => collapsible && setSectionOpen((open) => !open)}
        aria-expanded={sectionOpen}
        className="flex w-full flex-col gap-2 border-b border-slate-200 px-4 py-3 text-left sm:flex-row sm:items-center sm:justify-between disabled:cursor-default"
      >
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-emerald-700" aria-hidden="true" />
          <h2 className="text-base font-extrabold text-slate-900">Histórico por período</h2>
          {collapsible && <ChevronDown className={`h-4 w-4 text-emerald-700 transition-transform ${sectionOpen ? '' : '-rotate-90'}`} aria-hidden="true" />}
        </div>
        <div className="flex flex-col gap-1 text-xs font-semibold text-slate-500 lg:flex-row lg:gap-4">
          <span className="inline-flex items-center gap-1.5"><Info className="h-4 w-4" /> Busca ativa consulta todo o histórico da unidade.</span>
          <span className="inline-flex items-center gap-1.5"><LockKeyhole className="h-4 w-4" /> Períodos anteriores mantêm as permissões atuais.</span>
        </div>
      </button>

      {sectionOpen && searchActive && (
        <p className="border-b border-sky-100 bg-sky-50 px-4 py-2 text-xs font-bold text-sky-800">
          Busca global ativa: o mês selecionado está temporariamente ignorado.
        </p>
      )}

      {sectionOpen && <div className="divide-y divide-slate-200">
        {PERIOD_YEARS.map((year) => {
          const open = openYears.has(year);
          return (
            <div key={year}>
              <button
                type="button"
                className="flex min-h-11 w-full items-center gap-2 px-4 text-left text-sm font-extrabold text-slate-800 transition hover:bg-slate-50"
                onClick={() => toggleYear(year)}
                aria-expanded={open}
              >
                <ChevronDown className={`h-4 w-4 text-emerald-700 transition-transform ${open ? '' : '-rotate-90'}`} aria-hidden="true" />
                {year}
              </button>
              {open && (
                <div className="overflow-x-auto px-4 pb-3" tabIndex="0" aria-label={`Meses de ${year}`}>
                  <div className="flex min-w-max gap-2">
                    {PERIOD_MONTHS.map((label, index) => {
                      const month = index + 1;
                      const active = period.year === year && period.month === month && !searchActive;
                      const count = counts.get(`${year}-${String(month).padStart(2, '0')}`) || 0;
                      return (
                        <button
                          key={label}
                          type="button"
                          onClick={() => onChange({ year, month })}
                          aria-pressed={active}
                          className={`inline-flex min-h-10 min-w-[68px] items-center justify-center gap-2 rounded-md border px-3 text-xs font-extrabold transition ${active ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm' : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:bg-emerald-50'}`}
                        >
                          {label}
                          {count > 0 && <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${active ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-700'}`}>{count}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>}
    </section>
  );
}
