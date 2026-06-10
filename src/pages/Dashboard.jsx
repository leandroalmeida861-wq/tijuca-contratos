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
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { deleteRow, exportContractsCsv, exportContractsExcel, listContracts, listFreights, listTable } from '../lib/api.js';
import { currency, dateBr, kg, percent, statusClass } from '../lib/formatters.js';

const colors = ['#f59e0b', '#229653', '#0ea5e9', '#6366f1', '#ef4444'];

export default function Dashboard() {
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
    return Array.from(grouped, ([name, value]) => ({ name, value }));
  }, [contracts]);

  const productChart = useMemo(() => {
    const grouped = new Map();
    contracts.forEach((contract) => {
      const key = contract.produto?.nome || 'Sem produto';
      grouped.set(key, (grouped.get(key) || 0) + Number(contract.quantidade_contratada || 0));
    });
    return Array.from(grouped, ([name, value]) => ({ name, value }));
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
          <ResponsiveContainer width="100%" height={270}>
            <BarChart data={supplierChart} layout="vertical" margin={{ left: 44, right: 22 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tickFormatter={(value) => `${value / 1000}t`} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={110} />
              <Tooltip formatter={(value) => kg(value)} />
              <Bar dataKey="value" radius={[0, 5, 5, 0]}>
                {supplierChart.map((entry, index) => (
                  <Cell key={entry.name} fill={colors[index % colors.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
        <ChartPanel title="Distribuição por produto">
          <ResponsiveContainer width="100%" height={270}>
            <PieChart>
              <Pie data={productChart} dataKey="value" nameKey="name" innerRadius={62} outerRadius={94} paddingAngle={1}>
                {productChart.map((entry, index) => (
                  <Cell key={entry.name} fill={colors[index % colors.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value, name) => [kg(value), name]} />
            </PieChart>
          </ResponsiveContainer>
        </ChartPanel>
        <ChartPanel title="Execução por contrato">
          {contractChart.length ? (
            <ResponsiveContainer width="100%" height={270}>
              <BarChart data={contractChart} layout="vertical" margin={{ left: 34, right: 24 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tickFormatter={(value) => `${value}%`} domain={[0, 100]} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={84} />
                <Tooltip formatter={(value, name, props) => [`${value}%`, props.payload.fornecedor]} />
                <Bar dataKey="value" minPointSize={4} radius={[0, 5, 5, 0]}>
                  {contractChart.map((entry, index) => (
                    <Cell key={entry.name} fill={colors[index % colors.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart message="Cadastre contratos para visualizar a execução." />
          )}
        </ChartPanel>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white shadow-panel">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-center lg:justify-between">
          <h2 className="text-sm font-extrabold uppercase tracking-wide text-slate-600">Todos os contratos ({filteredContracts.length})</h2>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button onClick={() => exportContractsCsv(filteredContracts)} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
              <Download size={16} /> CSV
            </button>
            <button onClick={() => exportContractsExcel(filteredContracts)} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
              <Download size={16} /> Excel
            </button>
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
                      <Link to="/contratos" className="grid h-9 w-9 place-items-center rounded-lg text-slate-600 hover:bg-slate-100" title="Editar">
                        <Edit size={17} />
                      </Link>
                      <button onClick={() => removeContract(contract.id)} className="grid h-9 w-9 place-items-center rounded-lg text-rose-600 hover:bg-rose-50" title="Excluir">
                        <Trash2 size={17} />
                      </button>
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
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
      <h2 className="mb-3 text-sm font-extrabold uppercase tracking-wide text-slate-600">{title}</h2>
      {children}
    </article>
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
