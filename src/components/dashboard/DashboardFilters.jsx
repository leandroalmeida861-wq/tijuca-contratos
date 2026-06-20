import { Check, ChevronDown, Filter, RotateCcw, Search, X } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';

export default function DashboardFilters({
  filters,
  options,
  onChange,
  onApply,
  onClear,
  error,
  loading,
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-panel">
      <div className="mb-4 flex items-center gap-2">
        <Filter size={18} className="text-emerald-700" />
        <div>
          <h2 className="text-sm font-extrabold uppercase text-slate-800">Filtros do dashboard</h2>
          <p className="text-xs text-slate-500">O período considera a data de vencimento dos contratos.</p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <DateField
          label="Data inicial"
          value={filters.dataInicial}
          onChange={(value) => onChange('dataInicial', value)}
        />
        <DateField
          label="Data final"
          value={filters.dataFinal}
          onChange={(value) => onChange('dataFinal', value)}
        />
        <SearchableSelect
          label="Fornecedor"
          placeholder="Todos os fornecedores"
          options={options.suppliers.map((item) => ({ value: item.id, label: item.nome }))}
          value={filters.fornecedorId}
          onChange={(value) => onChange('fornecedorId', value)}
        />
        <SearchableSelect
          label="Produto"
          placeholder="Todos os produtos"
          options={options.products.map((item) => ({ value: item.id, label: item.nome }))}
          value={filters.produtoId}
          onChange={(value) => onChange('produtoId', value)}
        />
        <SearchableSelect
          label="Contrato"
          placeholder="Todos os contratos"
          options={options.contracts.map((item) => ({ value: item.id, label: item.label }))}
          value={filters.contratoId}
          onChange={(value) => onChange('contratoId', value)}
        />
      </div>

      {error && <p className="mt-3 text-sm font-semibold text-rose-700" role="alert">{error}</p>}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onClear}
          disabled={loading}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RotateCcw size={16} />
          Limpar filtros
        </button>
        <button
          type="button"
          onClick={onApply}
          disabled={loading}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Check size={16} />
          {loading ? 'Aplicando...' : 'Aplicar filtros'}
        </button>
      </div>
    </section>
  );
}

function DateField({ label, value, onChange }) {
  return (
    <label className="grid gap-1.5 text-sm font-bold text-slate-700">
      {label}
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 rounded-lg border border-slate-300 bg-white px-3 font-normal text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
      />
    </label>
  );
}

function SearchableSelect({ label, placeholder, options, value, onChange }) {
  const id = useId();
  const rootRef = useRef(null);
  const keepTypedQueryRef = useRef(false);
  const selected = options.find((option) => option.value === value);
  const [query, setQuery] = useState(selected?.label || '');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (selected?.label) {
      setQuery(selected.label);
      return;
    }
    if (keepTypedQueryRef.current) {
      keepTypedQueryRef.current = false;
      return;
    }
    setQuery('');
  }, [selected?.label, value]);

  useEffect(() => {
    function closeOnOutsideClick(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, []);

  const filteredOptions = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('pt-BR');
    if (!term || selected?.label === query) return options;
    return options.filter((option) => option.label.toLocaleLowerCase('pt-BR').includes(term));
  }, [options, query, selected?.label]);

  function handleInput(event) {
    setQuery(event.target.value);
    setOpen(true);
    if (value) {
      keepTypedQueryRef.current = true;
      onChange('');
    }
  }

  function choose(option) {
    onChange(option.value);
    setQuery(option.label);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative grid gap-1.5 text-sm font-bold text-slate-700">
      <label htmlFor={id}>{label}</label>
      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          id={id}
          value={query}
          onChange={handleInput}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-16 font-normal text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              onChange('');
              setOpen(true);
            }}
            className="absolute right-8 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center text-slate-400 hover:text-slate-700"
            title={`Limpar ${label.toLowerCase()}`}
          >
            <X size={15} />
          </button>
        )}
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className="absolute right-1 top-1/2 grid h-9 w-7 -translate-y-1/2 place-items-center text-slate-500"
          title={`Abrir opções de ${label.toLowerCase()}`}
        >
          <ChevronDown size={16} />
        </button>
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-xl">
          <button
            type="button"
            onClick={() => {
              onChange('');
              setQuery('');
              setOpen(false);
            }}
            className="w-full rounded-md px-3 py-2 text-left text-sm font-semibold text-slate-500 hover:bg-slate-50"
          >
            {placeholder}
          </button>
          {filteredOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => choose(option)}
              className="w-full rounded-md px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-800"
            >
              {option.label}
            </button>
          ))}
          {!filteredOptions.length && (
            <p className="px-3 py-3 text-center text-xs font-semibold text-slate-500">
              Nenhuma opção encontrada.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
