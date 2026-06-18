import {
  AlertTriangle,
  ClipboardList,
  Download,
  Edit,
  Eye,
  FileSpreadsheet,
  Package,
  Search,
  Trash2,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { deleteRow, exportContractsCsv, exportContractsExcel, listContracts, listFreights, listTable } from '../lib/api.js';
import { currency, dateBr, kg, percent, statusClass } from '../lib/formatters.js';

const chartColors = ['#12325f', '#0f7f89', '#24a6a0', '#4f9a59', '#e2b849', '#d8783d'];

export default function Dashboard() {
  const { can } = useAuth();
  const [contracts, setContracts] = useState([]);
  const [freights, setFreights] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [contractRows, supplierRows, freightRows] = await Promise.all([listContracts(), listTable('fornecedores'), listFreights()]);
      setContracts(contractRows);
      setSuppliers(supplierRows);
      setFreights(freightRows);
    } catch (err) {
      setError(err.message || 'Erro ao carregar dashboard.');
    } finally {
      setLoading(false);
    }
  }

  async function removeContract(id) {
    if (!window.confirm('Excluir este contrato?')) return;
    try {
      await deleteRow('contratos', id);
      await load();
    } catch (err) {
      setError(err.message || 'Não foi possível excluir.');
    }
  }

  const filteredContracts = useMemo(() => {
    const term = query.toLowerCase().trim();
    if (!term) return contracts;
    return contracts.filter((contract) =>
      [contract.numero_contrato, contract.fornecedor?.nome, contract.produto?.nome]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(term)),
    );
  }, [contracts, query]);

  const stats = useMemo(() => {
    const contratado = contracts.reduce((sum, item) => sum + Number(item.quantidade_contratada || 0), 0);
    const recebido = contracts.reduce((sum, item) => sum + Number(item.quantidade_recebida || 0), 0);
    const custoContratos = contracts.reduce((sum, item) => sum + Number(item.custo_kg || 0) * Number(item.quantidade_contratada || 0), 0);
    const custoFretes = freights
      .filter((freight) => freight.contrato_id)
      .reduce((sum, freight) => sum + Number(freight.valor || 0), 0);
    const custoTotal = custoContratos + custoFretes;
    return {
      contratado,
      recebido,
      saldo: Math.max(contratado - recebido, 0),
      custoMedio: contratado > 0 ? custoTotal / contratado : 0,
      ativos: contracts.filter((item) => item.status_calculado === 'Ativo').length,
      fornecedores: suppliers.length,
      vencidos: contracts.filter((item) => item.vencido).length,
      venceEm30: contracts.filter((item) => item.venceEm30).length,
    };
  }, [contracts, suppliers, freights]);

  const supplierChart = useMemo(() => {
    const grouped = new Map();
    contracts.forEach((contract) => {
      const key = contract.fornecedor?.nome || 'Sem fornecedor';
      grouped.set(key, (grouped.get(key) || 0) + Number(contract.quantidade_contratada || 0));
    });
    return Array.from(grouped, ([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 7);
  }, [contracts]);

  const productChart = useMemo(() => {
    const grouped = new Map();
    contracts.forEach((contract) => {
      const key = contract.produto?.nome || 'Sem produto';
      grouped.set(key, (grouped.get(key) || 0) + Number(contract.quantidade_contratada || 0));
    });
    return Array.from(grouped, ([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [contracts]);

  const contractChart = useMemo(() => (
    contracts
      .map((contract) => ({
        name: contract.numero_contrato || 'Sem número',
        value: Math.round(contract.percentual || 0),
        fornecedor: contract.fornecedor?.nome || '-',
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
  ), [contracts]);

  const cards = [
    { label: 'Contratado', value: kg(stats.contratado), icon: ClipboardList },
    { label: 'Recebido', value: kg(stats.recebido), icon: FileSpreadsheet },
    { label: 'Saldo', value: kg(stats.saldo), icon: TrendingUp },
    { label: 'Custo médio c/ frete', value: `${unitCurrency(stats.custoMedio, 4)}/KG`, icon: Package },
    { label: 'Contratos ativos', value: stats.ativos, icon: ClipboardList },
    { label: 'Fornecedores', value: stats.fornecedores, icon: Users },
    { label: 'Vencidos', value: stats.vencidos, icon: AlertTriangle },
    { label: 'Vencem em 30d', value: stats.venceEm30, icon: AlertTriangle },
  ];

  if (loading) return <div className="grid min-h-[70vh] place-items-center text-sm font-semibold text-slate-500">Carregando dashboard...</div>;

  return (
    <div className="grid gap-6">
      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</div>}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <article key={card.label} className="flex min-h-24 items-start justify-between rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{card.label}</p>
              <p className="mt-2 text-2xl font-extrabold tracking-tight text-slate-950">{card.value}</p>
            </div>
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
              <card.icon size={20} />
            </div>
          </article>
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-3">
        <ChartPanel title="Volume por fornecedor">
          <SupplierVolumeChart data={supplierChart} />
        </ChartPanel>
        <ChartPanel title="Distribuição por produto">
          <ProductDonutChart data={productChart} />
        </ChartPanel>
        <ChartPanel title="Execução por contrato">
          <ContractExecutionChart data={contractChart} />
        </ChartPanel>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white shadow-panel">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-center lg:justify-between">
          <h2 className="text-sm font-extrabold uppercase tracking-wide text-slate-600">Todos os contratos ({filteredContracts.length})</h2>
          <div className="flex flex-col gap-2 sm:flex-row">
            {can('contratos', 'exportar') && <button onClick={() => exportContractsCsv(filteredContracts)} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
              <Download size={16} /> CSV
            </button>}
            {can('contratos', 'exportar') && <button onClick={() => exportContractsExcel(filteredContracts)} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
              <Download size={16} /> Excel
            </button>}
            <label className="flex h-10 min-w-64 items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm text-slate-500">
              <Search size={16} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full border-0 outline-none" placeholder="Buscar contratos..." />
            </label>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-left text-sm">
            <thead className="text-xs font-bold uppercase text-slate-500">
              <tr>
                {['Contrato', 'Fornecedor', 'Produto', 'Fábrica', 'Execução', 'Vencimento', 'Status', 'Ações'].map((head) => (
                  <th key={head} className="border-b border-slate-200 px-4 py-3">{head}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredContracts.map((contract) => (
                <tr key={contract.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-4 font-extrabold text-slate-900">{contract.numero_contrato}</td>
                  <td className="px-4 py-4 text-slate-700">{contract.fornecedor?.nome || '-'}</td>
                  <td className="px-4 py-4 font-semibold text-slate-800">{contract.produto?.nome || '-'}</td>
                  <td className="px-4 py-4 text-slate-500">{contract.fabrica?.nome || '-'}</td>
                  <td className="px-4 py-4">
                    <div className="flex items-end justify-between gap-3 text-xs font-semibold text-slate-500">
                      <span>{kg(contract.quantidade_recebida)}</span>
                      <span>{percent(contract.percentual)}</span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-emerald-100">
                      <div className="h-full rounded-full bg-emerald-600" style={{ width: `${contract.percentual}%` }} />
                    </div>
                    <p className="mt-1 text-xs text-slate-500">de {kg(contract.quantidade_contratada)}</p>
                  </td>
                  <td className="px-4 py-4 text-slate-600">{dateBr(contract.data_vencimento)}</td>
                  <td className="px-4 py-4">
                    <span className={`rounded-md px-3 py-1 text-xs font-bold ring-1 ${statusClass(contract.status_calculado)}`}>
                      {contract.status_calculado}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex gap-1">
                      <Link to="/contratos" className="grid h-9 w-9 place-items-center rounded-lg text-slate-600 hover:bg-slate-100" title="Visualizar">
                        <Eye size={17} />
                      </Link>
                      {can('contratos', 'editar') && <Link to="/contratos" className="grid h-9 w-9 place-items-center rounded-lg text-slate-600 hover:bg-slate-100" title="Editar">
                        <Edit size={17} />
                      </Link>}
                      {can('contratos', 'excluir') && <button onClick={() => removeContract(contract.id)} className="grid h-9 w-9 place-items-center rounded-lg text-rose-600 hover:bg-rose-50" title="Excluir">
                        <Trash2 size={17} />
                      </button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filteredContracts.length && <p className="p-6 text-center text-sm font-semibold text-slate-500">Nenhum contrato encontrado.</p>}
        </div>
      </section>
    </div>
  );
}

function ChartPanel({ title, children }) {
  return (
    <article className="relative overflow-hidden rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
      <HexPattern />
      <h2 className="relative z-10 mb-3 text-sm font-extrabold uppercase tracking-wide text-slate-900">{title}</h2>
      {children}
    </article>
  );
}

function SupplierVolumeChart({ data }) {
  if (!data.length) return <EmptyChart message="Cadastre contratos para visualizar o volume." />;
  const max = Math.max(...data.map((item) => item.value), 1);
  const ticks = [0, max / 2, max];

  return (
    <div className="relative z-10 h-[270px] overflow-hidden rounded-md px-1 pb-7 pt-2">
      <div className="pointer-events-none absolute bottom-8 left-[39%] right-4 top-2 grid grid-cols-2 border-l border-slate-200/80">
        <span className="border-r border-dashed border-slate-200" />
        <span className="border-r border-dashed border-slate-200" />
      </div>
      <div className="absolute inset-y-4 right-4 w-[48%] rounded-full bg-cyan-100/70 blur-2xl" />
      <div className="relative z-10 flex h-full flex-col justify-center gap-2.5">
        {data.map((item, index) => {
          const width = Math.max((item.value / max) * 100, 8);
          return (
            <div key={item.name} className="grid grid-cols-[38%_1fr] items-center gap-2">
              <p className="truncate text-right text-[11px] font-semibold uppercase text-slate-700" title={item.name}>
                {compactName(item.name)} ({shortWeight(item.value)})
              </p>
              <div className="relative h-5 rounded-r-md bg-slate-100">
                <div
                  className="h-full rounded-r-md shadow-[0_4px_9px_rgba(15,23,42,0.18)]"
                  style={{
                    width: `${width}%`,
                    background: `linear-gradient(90deg, ${chartColors[index % chartColors.length]}, #25b7ae)`,
                  }}
                />
                <span
                  className="absolute top-1/2 -translate-y-1/2 rounded bg-teal-700 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-sm"
                  style={{ left: `min(calc(${width}% - 30px), calc(100% - 38px))` }}
                >
                  {shortWeight(item.value)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="absolute bottom-0 left-[39%] right-4 flex justify-between text-[11px] font-semibold text-slate-600">
        {ticks.map((tick) => <span key={tick}>{shortWeight(tick)}</span>)}
      </div>
    </div>
  );
}

function ProductDonutChart({ data }) {
  if (!data.length) return <EmptyChart message="Cadastre produtos nos contratos para visualizar a distribuição." />;

  const total = data.reduce((sum, item) => sum + Number(item.value || 0), 0);
  if (total <= 0) return <EmptyChart message="Cadastre volumes nos contratos para visualizar a distribuição." />;
  let current = 0;
  const segments = data.map((item, index) => {
    const value = Number(item.value || 0);
    const percentValue = total > 0 ? value / total : 0;
    const start = current;
    const end = Math.min(current + percentValue * 360, 359.99);
    current = end;
    return { ...item, start, end, color: chartColors[index % chartColors.length] };
  }).filter((item) => item.end > item.start);

  return (
    <div className="relative z-10 grid h-[270px] place-items-center">
      <div className="relative h-[230px] w-[230px]">
        <svg viewBox="0 0 240 240" className="h-full w-full drop-shadow-[0_10px_12px_rgba(15,23,42,0.22)]">
          <defs>
            <linearGradient id="donutShade" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0.18" />
            </linearGradient>
          </defs>
          {segments.map((segment) => (
            <path key={segment.name} d={donutArc(120, 120, 92, 50, segment.start, segment.end)} fill={segment.color} stroke="#ffffff" strokeWidth="2" />
          ))}
          <circle cx="120" cy="120" r="49" fill="#f8fafc" stroke="#d8dee7" strokeWidth="3" />
          <circle cx="120" cy="120" r="92" fill="url(#donutShade)" opacity="0.28" />
          <circle cx="120" cy="120" r="58" fill="none" stroke="#eef2f7" strokeWidth="8" opacity="0.9" />
          <path d="M120 109a12 12 0 1 0 0-24 12 12 0 0 0 0 24Zm-24 40c3-17 14-27 24-27s21 10 24 27" fill="none" stroke="#111827" strokeLinecap="round" strokeWidth="5" />
        </svg>
        {segments.map((segment) => {
          const middle = segment.start + ((segment.end - segment.start) / 2);
          const pos = polarToCartesian(115, 115, 69, middle);
          return (
            <div
              key={segment.name}
              className="absolute -translate-x-1/2 -translate-y-1/2 text-center text-[10px] font-extrabold uppercase leading-tight text-white drop-shadow"
              style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
            >
              <span>{compactName(segment.name)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ContractExecutionChart({ data }) {
  if (!data.length) return <EmptyChart message="Cadastre contratos para visualizar a execução." />;

  return (
    <div className="relative z-10 h-[270px] pb-7 pt-3">
      <div className="pointer-events-none absolute bottom-7 left-[18%] right-3 top-0 grid grid-cols-4">
        {[0, 1, 2, 3].map((tick) => <span key={tick} className="border-l border-dashed border-slate-200" />)}
        <span className="border-l border-dashed border-slate-200" />
      </div>
      <div className="relative z-10 flex h-full flex-col justify-center gap-4">
        {data.map((item, index) => {
          const value = Math.max(0, Math.min(Number(item.value || 0), 100));
          const highlighted = index === 0;
          return (
            <div key={item.name} className={`grid grid-cols-[16%_1fr] items-center gap-3 rounded-md py-1 ${highlighted ? 'bg-gradient-to-r from-slate-200/80 to-teal-100/70 pr-2' : ''}`}>
              <p className="text-xs font-semibold text-slate-700">{item.name}</p>
              <div className="relative h-6 rounded-full bg-slate-200 shadow-inner ring-1 ring-slate-300/70">
                <div
                  className="h-full rounded-full shadow-[0_4px_9px_rgba(15,23,42,0.18)]"
                  style={{
                    width: `${Math.max(value, 9)}%`,
                    background: 'linear-gradient(90deg, #16325f 0%, #0f8d8d 64%, #34c1b3 100%)',
                  }}
                />
                <span
                  className="absolute top-1/2 -translate-y-1/2 rounded-full bg-teal-700 px-2 py-0.5 text-[11px] font-extrabold text-white shadow"
                  style={{ left: `min(calc(${Math.max(value, 9)}% - 28px), calc(100% - 46px))` }}
                >
                  {value}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="absolute bottom-0 left-[18%] right-3 flex justify-between text-[11px] font-semibold text-slate-600">
        {[0, 25, 50, 75, 100].map((tick) => <span key={tick}>{tick}%</span>)}
      </div>
    </div>
  );
}

function HexPattern() {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full text-slate-200/70" aria-hidden="true">
      <defs>
        <pattern id="hex-pattern" width="44" height="38" patternUnits="userSpaceOnUse" patternTransform="translate(10 2)">
          <path d="M11 1h22l11 18-11 18H11L0 19 11 1Z" fill="none" stroke="currentColor" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#hex-pattern)" opacity="0.28" />
    </svg>
  );
}

function EmptyChart({ message }) {
  return (
    <div className="grid h-[270px] place-items-center rounded-lg border border-dashed border-slate-200 bg-slate-50 px-6 text-center text-sm font-semibold text-slate-500">
      {message}
    </div>
  );
}

function unitCurrency(value, decimals = 4) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Number(value || 0));
}

function compactName(value) {
  const name = String(value || '-').trim();
  if (name.length <= 13) return name;
  return `${name.slice(0, 12).trim()}...`;
}

function shortWeight(value) {
  const number = Number(value || 0);
  if (number >= 1000) {
    const tons = number / 1000;
    return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: tons >= 10 ? 0 : 1 }).format(tons)}t`;
  }
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(number)}kg`;
}

function polarToCartesian(centerX, centerY, radius, angleInDegrees) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180;
  return {
    x: centerX + (radius * Math.cos(angleInRadians)),
    y: centerY + (radius * Math.sin(angleInRadians)),
  };
}

function donutArc(cx, cy, outerRadius, innerRadius, startAngle, endAngle) {
  const startOuter = polarToCartesian(cx, cy, outerRadius, endAngle);
  const endOuter = polarToCartesian(cx, cy, outerRadius, startAngle);
  const startInner = polarToCartesian(cx, cy, innerRadius, startAngle);
  const endInner = polarToCartesian(cx, cy, innerRadius, endAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';

  return [
    'M', startOuter.x, startOuter.y,
    'A', outerRadius, outerRadius, 0, largeArcFlag, 0, endOuter.x, endOuter.y,
    'L', startInner.x, startInner.y,
    'A', innerRadius, innerRadius, 0, largeArcFlag, 1, endInner.x, endInner.y,
    'Z',
  ].join(' ');
}
