import {
  Archive,
  CalendarCheck,
  Download,
  Edit,
  Eye,
  FileSpreadsheet,
  LockKeyhole,
  PackageCheck,
  Plus,
  Printer,
  RotateCcw,
  Save,
  Search,
  Trash2,
  Warehouse,
  X,
} from 'lucide-react';
import { cloneElement, isValidElement, useCallback, useEffect, useMemo, useState } from 'react';
import { jsPDF } from 'jspdf';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import * as XLSX from 'xlsx';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useSupabaseRealtimeRefresh } from '../../hooks/useSupabaseRealtimeRefresh.js';
import { dateBr, kg } from '../../lib/formatters.js';
import {
  cancelarArmazenagem,
  fecharMesArmazenagem,
  iniciarArmazenagem,
  listArmazenagemData,
  mergeRecebimentosArmazenagens,
  reabrirMesArmazenagem,
  salvarArmazenagem,
  toArmazenagemError,
} from '../../services/armazenagemService.js';

const REALTIME_TABLES = [
  'recebimentos',
  'recebimento_itens',
  'armazenagens_materia_prima',
  'armazenagem_itens',
  'armazenagem_distribuicoes',
  'fechamentos_armazenagem',
];

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const STATUS_OPTIONS = [
  ['', 'Todos'],
  ['PENDENTE', 'Pendente'],
  ['PARCIALMENTE_ARMAZENADO', 'Parcialmente armazenado'],
  ['ARMAZENADO', 'Armazenado'],
  ['CANCELADO', 'Cancelado'],
];

const INITIAL_FILTERS = {
  ano: String(new Date().getFullYear()),
  mes: '',
  dataInicial: '',
  dataFinal: '',
  nf: '',
  placa: '',
  produto: '',
  fornecedor: '',
  transportadora: '',
  silo: '',
  baia: '',
  status: '',
  busca: '',
};

const BUTTON_PRIMARY = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-tijuca-600 px-4 text-sm font-extrabold text-white transition hover:bg-tijuca-700 disabled:cursor-not-allowed disabled:opacity-60';
const BUTTON_SECONDARY = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-extrabold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60';
const FIELD_CLASS = 'min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 outline-none transition focus:border-tijuca-500 focus:ring-2 focus:ring-tijuca-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500';

export default function ArmazenagemTab({ can }) {
  const { profile } = useAuth();
  const [source, setSource] = useState({ recebimentos: [], armazenagens: [], fechamentos: [] });
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(INITIAL_FILTERS);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [modal, setModal] = useState(null);
  const [closing, setClosing] = useState(false);
  const isAdmin = profile === 'admin';

  const load = useCallback(async ({ silent = false } = {}) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await listArmazenagemData();
      setSource(data);
      if (!silent) setError('');
    } catch (loadError) {
      if (!silent) setError(toArmazenagemError(loadError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useSupabaseRealtimeRefresh(REALTIME_TABLES, () => load({ silent: true }), {
    channelName: 'agroflow-armazenagem-mp',
    debounceMs: 800,
    pollIntervalMs: 60000,
  });

  const rows = useMemo(
    () => mergeRecebimentosArmazenagens(source.recebimentos, source.armazenagens),
    [source],
  );
  const filteredRows = useMemo(() => filterRows(rows, appliedFilters), [rows, appliedFilters]);
  const activeRows = useMemo(
    () => filteredRows.filter((row) => row.status !== 'CANCELADO'),
    [filteredRows],
  );
  const metrics = useMemo(() => calculateMetrics(activeRows, appliedFilters), [activeRows, appliedFilters]);
  const charts = useMemo(() => buildCharts(activeRows), [activeRows]);
  const closureRows = useMemo(
    () => buildMonthlyClosures(rows, source.fechamentos, Number(filters.ano) || new Date().getFullYear()),
    [rows, source.fechamentos, filters.ano],
  );

  function applyFilters(event) {
    event?.preventDefault();
    if (filters.dataInicial && filters.dataFinal && filters.dataInicial > filters.dataFinal) {
      setError('A data inicial não pode ser maior que a data final. Ajuste o período e tente novamente.');
      return;
    }
    setError('');
    setAppliedFilters(filters);
  }

  function clearFilters() {
    setFilters(INITIAL_FILTERS);
    setAppliedFilters(INITIAL_FILTERS);
    setError('');
  }

  async function openStorage(row, readOnly = false) {
    setError('');
    try {
      const isNew = !row.id;
      const record = readOnly && isNew
        ? row
        : row.id ? row : await iniciarArmazenagem(row.recebimento_id);
      setModal({
        type: readOnly ? 'view' : 'form',
        record,
        form: storageForm(record),
        isNew,
      });
      if (!readOnly && isNew) await load({ silent: true });
    } catch (openError) {
      setError(toArmazenagemError(openError));
    }
  }

  async function handleCancel(row) {
    const motivo = window.prompt('Informe o motivo do cancelamento da armazenagem:');
    if (!motivo?.trim()) return;
    if (!window.confirm('Confirma o cancelamento? O histórico será preservado para auditoria.')) return;
    try {
      await cancelarArmazenagem(row.id, motivo.trim());
      setMessage('Armazenagem cancelada com sucesso.');
      await load({ silent: true });
    } catch (cancelError) {
      setError(toArmazenagemError(cancelError));
    }
  }

  async function handleCloseMonth(month) {
    const pending = Number(month.saldo || 0) > 0;
    let justification = '';
    if (pending) {
      if (!isAdmin) {
        setError('Existem saldos pendentes. Somente o Admin pode autorizar o fechamento com justificativa.');
        return;
      }
      justification = window.prompt('Informe a justificativa para fechar o mês com pendências:') || '';
      if (!justification.trim()) return;
    }
    if (!window.confirm(`Confirma o fechamento de ${month.nome}/${month.ano}?`)) return;
    setClosing(true);
    try {
      await fecharMesArmazenagem({
        ano: month.ano,
        mes: month.mes,
        autorizarPendencias: pending,
        justificativa: justification,
      });
      setMessage(`${month.nome}/${month.ano} fechado com sucesso.`);
      await load({ silent: true });
    } catch (closeError) {
      setError(toArmazenagemError(closeError));
    } finally {
      setClosing(false);
    }
  }

  async function handleReopenMonth(month) {
    const justification = window.prompt('Informe a justificativa obrigatória para reabrir o mês:') || '';
    if (!justification.trim()) return;
    setClosing(true);
    try {
      await reabrirMesArmazenagem({ ano: month.ano, mes: month.mes, justificativa: justification });
      setMessage(`${month.nome}/${month.ano} reaberto com sucesso.`);
      await load({ silent: true });
    } catch (reopenError) {
      setError(toArmazenagemError(reopenError));
    } finally {
      setClosing(false);
    }
  }

  if (loading) {
    return (
      <div className="grid min-h-48 place-items-center rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-500 shadow-panel">
        Carregando Armazenagem M.P...
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      {message && <Notice tone="success" text={message} onClose={() => setMessage('')} />}
      {error && <Notice tone="error" text={error} onClose={() => setError('')} />}

      <section className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
        <div className="flex items-start gap-3">
          <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
          <div>
            <h2 className="text-sm font-extrabold uppercase text-emerald-900">Peso controlado pela Nota Fiscal</h2>
            <p className="mt-1 text-sm font-medium text-emerald-800">
              O peso da NF é bloqueado nesta tela e separado por produto. Bruto, tara, líquido da balança e diferença não alteram a armazenagem.
            </p>
          </div>
        </div>
      </section>

      <StorageFilters
        filters={filters}
        setFilters={setFilters}
        onApply={applyFilters}
        onClear={clearFilters}
        refreshing={refreshing}
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
        <MetricCard title="Peso da NF no período" value={kg(metrics.pesoNota)} icon={Archive} />
        <MetricCard title="Peso armazenado" value={kg(metrics.armazenado)} icon={PackageCheck} />
        <MetricCard title="Saldo pendente" value={kg(metrics.saldo)} icon={Warehouse} tone={metrics.saldo > 0 ? 'amber' : 'green'} />
        <MetricCard title="Cargas" value={metrics.cargas} icon={FileSpreadsheet} />
        <MetricCard title="Silos utilizados" value={metrics.silos} icon={Warehouse} />
        <MetricCard title="Baias utilizadas" value={metrics.baias} icon={Warehouse} />
        <MetricCard title="Registros pendentes" value={metrics.pendentes} icon={CalendarCheck} tone={metrics.pendentes ? 'amber' : 'green'} />
      </section>

      <StorageCharts charts={charts} />

      <section className="rounded-lg border border-slate-200 bg-white shadow-panel">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-extrabold uppercase text-slate-800">Controle de Armazenagem M.P.</h2>
            <p className="mt-1 text-sm text-slate-500">{filteredRows.length} recebimento(s) finalizado(s) disponível(is).</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {can('balancas', 'exportar') && (
              <>
                <button type="button" className={BUTTON_SECONDARY} onClick={() => exportExcel(filteredRows)}>
                  <FileSpreadsheet className="h-4 w-4" /> Excel
                </button>
                <button type="button" className={BUTTON_SECONDARY} onClick={() => exportPdf(filteredRows, appliedFilters)}>
                  <Download className="h-4 w-4" /> PDF
                </button>
              </>
            )}
          </div>
        </div>
        <StorageTable
          rows={filteredRows}
          can={can}
          onView={(row) => openStorage(row, true)}
          onEdit={(row) => openStorage(row, false)}
          onCancel={handleCancel}
          onPrint={printReceipt}
        />
      </section>

      <MonthlyClosing
        year={Number(filters.ano) || new Date().getFullYear()}
        rows={closureRows}
        can={can}
        isAdmin={isAdmin}
        busy={closing}
        onClose={handleCloseMonth}
        onReopen={handleReopenMonth}
      />

      {modal && (
        <StorageModal
          key={modal.record.id || modal.record.recebimento_id}
          modal={modal}
          can={can}
          onClose={() => setModal(null)}
          onSaved={async () => {
            setModal(null);
            setMessage('Distribuição da armazenagem salva com sucesso.');
            await load({ silent: true });
          }}
          onError={(modalError) => setError(toArmazenagemError(modalError))}
        />
      )}
    </div>
  );
}

function StorageFilters({ filters, setFilters, onApply, onClear, refreshing }) {
  const update = (field) => (event) => setFilters((current) => ({ ...current, [field]: event.target.value }));
  return (
    <form onSubmit={onApply} className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-panel md:grid-cols-2 xl:grid-cols-6">
      <Filter label="Ano"><input type="number" min="2000" max="2200" value={filters.ano} onChange={update('ano')} /></Filter>
      <Filter label="Mês">
        <select value={filters.mes} onChange={update('mes')}>
          <option value="">Todos</option>
          {MONTHS.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}
        </select>
      </Filter>
      <Filter label="Data inicial"><input type="date" value={filters.dataInicial} onChange={update('dataInicial')} /></Filter>
      <Filter label="Data final"><input type="date" value={filters.dataFinal} onChange={update('dataFinal')} /></Filter>
      <Filter label="Número da NF"><input value={filters.nf} onChange={update('nf')} placeholder="Ex: 1459" /></Filter>
      <Filter label="Placa"><input value={filters.placa} onChange={update('placa')} placeholder="Ex: ABC1D23" /></Filter>
      <Filter label="Produto"><input value={filters.produto} onChange={update('produto')} placeholder="Digite o produto" /></Filter>
      <Filter label="Fornecedor"><input value={filters.fornecedor} onChange={update('fornecedor')} placeholder="Digite o fornecedor" /></Filter>
      <Filter label="Transportadora"><input value={filters.transportadora} onChange={update('transportadora')} placeholder="Digite a transportadora" /></Filter>
      <Filter label="Silo"><input value={filters.silo} onChange={update('silo')} placeholder="Ex: 06" /></Filter>
      <Filter label="Baia"><input value={filters.baia} onChange={update('baia')} placeholder="Ex: 02" /></Filter>
      <Filter label="Status">
        <select value={filters.status} onChange={update('status')}>
          {STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </Filter>
      <label className="relative md:col-span-2 xl:col-span-4">
        <span className="sr-only">Busca geral</span>
        <Search className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-slate-400" />
        <input className="w-full pl-10" value={filters.busca} onChange={update('busca')} placeholder="Buscar NF, placa, produto, fornecedor, Silo ou Baia" />
      </label>
      <div className="flex gap-2 md:col-span-2">
        <button type="submit" className={`${BUTTON_PRIMARY} flex-1`}><Search className="h-4 w-4" /> Aplicar filtros</button>
        <button type="button" className={BUTTON_SECONDARY} onClick={onClear}><RotateCcw className="h-4 w-4" /> Limpar</button>
      </div>
      {refreshing && <p className="text-xs font-medium text-slate-400 md:col-span-2 xl:col-span-6">Atualizando dados em segundo plano...</p>}
    </form>
  );
}

function Filter({ label, children }) {
  const field = isValidElement(children)
    ? cloneElement(children, { className: `${FIELD_CLASS} ${children.props.className || ''}`.trim() })
    : children;
  return <label className="grid gap-1 text-sm font-bold text-slate-700"><span>{label}</span>{field}</label>;
}

function MetricCard({ title, value, icon: Icon, tone = 'default' }) {
  const colors = tone === 'amber' ? 'bg-amber-50 text-amber-700' : tone === 'green' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-700';
  return (
    <article className="flex min-h-24 items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-panel">
      <div className="min-w-0"><p className="text-xs font-extrabold uppercase text-slate-500">{title}</p><p className="mt-2 break-words text-xl font-extrabold text-slate-950">{value}</p></div>
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-md ${colors}`}><Icon className="h-5 w-5" /></span>
    </article>
  );
}

function StorageCharts({ charts }) {
  const definitions = [
    ['Peso armazenado por produto', charts.products, '#0f766e'],
    ['Peso armazenado por Silo', charts.silos, '#2563eb'],
    ['Peso armazenado por mês', charts.months, '#d97706'],
  ];
  return (
    <section className="grid gap-4 xl:grid-cols-3">
      {definitions.map(([title, data, color]) => (
        <article key={title} className="rounded-lg border border-slate-200 bg-white p-4 shadow-panel">
          <h2 className="text-sm font-extrabold uppercase text-slate-800">{title}</h2>
          <div className="mt-4 h-64">
            {data.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} layout="vertical" margin={{ left: 12, right: 24 }}>
                  <CartesianGrid horizontal={false} stroke="#e2e8f0" />
                  <XAxis type="number" tickFormatter={compactWeight} />
                  <YAxis type="category" dataKey="name" width={105} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value) => kg(value)} />
                  <Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <Empty text="Sem peso armazenado para os filtros atuais." />}
          </div>
        </article>
      ))}
    </section>
  );
}

function StorageTable({ rows, can, onView, onEdit, onCancel, onPrint }) {
  if (!rows.length) return <Empty text="Nenhum recebimento finalizado encontrado para os filtros atuais." />;
  return (
    <div className="overflow-x-auto">
      <table className="min-w-[1540px] w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>{['Data', 'NF', 'Placa', 'Fornecedor', 'Produto', 'Peso da NF', 'Distribuído', 'Saldo', 'Transporte', 'Silo', 'Baia', 'Status', 'Responsável', 'Registro', 'Ações'].map((item) => <th key={item} className="px-3 py-3">{item}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const products = productNames(row);
            const silos = distributionValues(row, 'silo');
            const bays = distributionValues(row, 'baia');
            return (
              <tr key={row.id || row.recebimento_id} className="border-t border-slate-200 align-top hover:bg-slate-50">
                <td className="px-3 py-3 whitespace-nowrap">{dateBr(row.data_armazenagem || row.recebimento?.data)}</td>
                <td className="px-3 py-3 font-bold">{row.recebimento?.nf_numero || '-'}</td>
                <td className="px-3 py-3 font-semibold">{row.recebimento?.veiculo?.placa || row.recebimento?.veiculo_placa_manual || '-'}</td>
                <td className="max-w-52 px-3 py-3">{row.recebimento?.fornecedor?.nome || row.recebimento?.fornecedor_nome_manual || '-'}</td>
                <td className="max-w-48 px-3 py-3">{products}</td>
                <td className="px-3 py-3 font-bold">{kg(row.peso_nota)}</td>
                <td className="px-3 py-3 text-emerald-700 font-bold">{kg(row.peso_distribuido)}</td>
                <td className="px-3 py-3 text-amber-700 font-bold">{kg(row.saldo_distribuir)}</td>
                <td className="max-w-44 px-3 py-3">{row.recebimento?.transportadora?.nome || row.recebimento?.tipo_veiculo || '-'}</td>
                <td className="px-3 py-3">{silos}</td>
                <td className="px-3 py-3">{bays}</td>
                <td className="px-3 py-3"><StatusBadge status={row.status} /></td>
                <td className="max-w-36 px-3 py-3">{row.updated_by_nome || row.created_by_nome || '-'}</td>
                <td className="px-3 py-3 whitespace-nowrap">{dateTimeBr(row.updated_at || row.created_at)}</td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-1">
                    <IconButton title="Visualizar" onClick={() => onView(row)}><Eye className="h-4 w-4" /></IconButton>
                    {can('balancas', row.id ? 'editar' : 'cadastrar') && row.status !== 'CANCELADO' && <IconButton title={row.id ? 'Editar' : 'Distribuir'} onClick={() => onEdit(row)}><Edit className="h-4 w-4" /></IconButton>}
                    {row.id && can('balancas', 'exportar') && <IconButton title="Imprimir comprovante" onClick={() => onPrint(row)}><Printer className="h-4 w-4" /></IconButton>}
                    {row.id && row.status !== 'CANCELADO' && (can('balancas', 'cancelar') || can('balancas', 'excluir')) && <IconButton title="Cancelar" tone="danger" onClick={() => onCancel(row)}><Trash2 className="h-4 w-4" /></IconButton>}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function StorageModal({ modal, can, onClose, onSaved, onError }) {
  const readOnly = modal.type === 'view';
  const [form, setForm] = useState(modal.form);
  const [saving, setSaving] = useState(false);
  const record = modal.record;

  function updateDistribution(index, field, value) {
    setForm((current) => ({
      ...current,
      distribuicoes: current.distribuicoes.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item),
    }));
  }

  function addDistribution() {
    setForm((current) => ({
      ...current,
      distribuicoes: [...current.distribuicoes, emptyDistribution(record.itens?.[0]?.id)],
    }));
  }

  function removeDistribution(index) {
    setForm((current) => ({ ...current, distribuicoes: current.distribuicoes.filter((_, itemIndex) => itemIndex !== index) }));
  }

  async function submit(event) {
    event.preventDefault();
    const validation = validateStorageForm(form, record);
    if (validation) {
      onError(new Error(validation));
      return;
    }
    setSaving(true);
    try {
      await salvarArmazenagem({
        id: record.id,
        dataArmazenagem: form.data_armazenagem,
        observacao: form.observacao,
        distribuicoes: form.distribuicoes,
      });
      await onSaved();
    } catch (saveError) {
      onError(saveError);
    } finally {
      setSaving(false);
    }
  }

  const draftTotals = distributionTotals(form.distribuicoes, record.itens || []);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-3" role="dialog" aria-modal="true">
      <form onSubmit={submit} className="max-h-[94vh] w-full max-w-6xl overflow-y-auto rounded-lg bg-white shadow-2xl">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white p-4">
          <div><h2 className="text-lg font-extrabold text-slate-950">{readOnly ? 'Visualizar armazenagem' : 'Distribuir peso da NF'}</h2><p className="text-sm text-slate-500">NF {record.recebimento?.nf_numero || '-'} · {productNames(record)}</p></div>
          <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-md text-slate-600 transition hover:bg-slate-100" title="Fechar"><X className="h-5 w-5" /></button>
        </header>
        <div className="grid gap-5 p-4">
          <section className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <ReadOnly label="Peso da NF" value={kg(record.peso_nota)} strong />
            <ReadOnly label="Origem do peso" value={originLabel(record.origem_peso)} />
            <ReadOnly label="Já distribuído" value={kg(record.peso_distribuido)} />
            <ReadOnly label="Saldo atual" value={kg(record.saldo_distribuir)} />
            <ReadOnly label="Fornecedor" value={record.recebimento?.fornecedor?.nome || record.recebimento?.fornecedor_nome_manual || '-'} />
            <ReadOnly label="Placa" value={record.recebimento?.veiculo?.placa || record.recebimento?.veiculo_placa_manual || '-'} />
            <ReadOnly label="Transportadora" value={record.recebimento?.transportadora?.nome || record.recebimento?.tipo_veiculo || '-'} />
            <Filter label="Data da armazenagem"><input type="date" disabled={readOnly} value={form.data_armazenagem} onChange={(event) => setForm((current) => ({ ...current, data_armazenagem: event.target.value }))} /></Filter>
          </section>

          <section>
            <div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-extrabold uppercase text-slate-800">Distribuição entre Silos e Baias</h3><p className="text-sm text-slate-500">Informe pelo menos um Silo ou uma Baia. O total nunca pode ultrapassar o peso da NF de cada produto.</p></div>{!readOnly && <button type="button" className={BUTTON_SECONDARY} onClick={addDistribution}><Plus className="h-4 w-4" /> Adicionar local</button>}</div>
            <div className="mt-3 grid gap-3">
              {readOnly && !(record.itens || []).length ? (
                <Empty text="Este recebimento ainda não possui distribuição de armazenagem." />
              ) : form.distribuicoes.map((distribution, index) => {
                const item = record.itens?.find((entry) => entry.id === distribution.armazenagem_item_id);
                return (
                  <article key={`${distribution.id || 'new'}-${index}`} className="grid gap-3 rounded-lg border border-slate-200 p-3 md:grid-cols-2 xl:grid-cols-[1.5fr_1fr_1fr_1fr_1.5fr_auto]">
                    <Filter label="Produto / item">
                      <select disabled={readOnly} value={distribution.armazenagem_item_id} onChange={(event) => updateDistribution(index, 'armazenagem_item_id', event.target.value)}>
                        {(record.itens || []).map((entry) => <option key={entry.id} value={entry.id}>{entry.produto?.nome || record.recebimento?.produto_nome_manual || `Item ${entry.ordem}`} · NF {kg(entry.peso_nota)} · saldo {kg(entry.saldo_distribuir)}</option>)}
                      </select>
                    </Filter>
                    <Filter label="Silo"><input disabled={readOnly} value={distribution.silo} onChange={(event) => updateDistribution(index, 'silo', event.target.value)} placeholder="Ex: 06" /></Filter>
                    <Filter label="Baia"><input disabled={readOnly} value={distribution.baia} onChange={(event) => updateDistribution(index, 'baia', event.target.value)} placeholder="Ex: 02" /></Filter>
                    <Filter label="Peso armazenado KG"><input disabled={readOnly} inputMode="decimal" value={distribution.peso_armazenado} onChange={(event) => updateDistribution(index, 'peso_armazenado', event.target.value)} placeholder="0" /></Filter>
                    <Filter label="Observação"><input disabled={readOnly} value={distribution.observacao} onChange={(event) => updateDistribution(index, 'observacao', event.target.value)} /></Filter>
                    <div className="flex items-end">{!readOnly && form.distribuicoes.length > 1 && <IconButton title="Remover local" tone="danger" onClick={() => removeDistribution(index)}><Trash2 className="h-4 w-4" /></IconButton>}</div>
                    {item && <p className="text-xs font-semibold text-slate-500 md:col-span-2 xl:col-span-6">Limite do item: {kg(item.peso_nota)} · total informado para este produto: {kg(draftTotals.byItem[item.id] || 0)}</p>}
                  </article>
                );
              })}
            </div>
          </section>

          <section className="grid gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 sm:grid-cols-3">
            <ReadOnly label="Peso total da NF" value={kg(record.peso_nota)} strong />
            <ReadOnly label="Total informado" value={kg(draftTotals.total)} strong />
            <ReadOnly label="Saldo após salvar" value={kg(Math.max(Number(record.peso_nota) - draftTotals.total, 0))} strong />
          </section>
          <Filter label="Observação geral"><textarea disabled={readOnly} rows="3" value={form.observacao} onChange={(event) => setForm((current) => ({ ...current, observacao: event.target.value }))} /></Filter>
        </div>
        <footer className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-200 bg-white p-4">
          <button type="button" className={BUTTON_SECONDARY} onClick={onClose}>Fechar</button>
          {!readOnly && can('balancas', modal.isNew ? 'cadastrar' : 'editar') && <button type="submit" className={BUTTON_PRIMARY} disabled={saving}><Save className="h-4 w-4" /> {saving ? 'Salvando...' : 'Salvar distribuição'}</button>}
        </footer>
      </form>
    </div>
  );
}

function MonthlyClosing({ year, rows, can, isAdmin, busy, onClose, onReopen }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-panel">
      <div><h2 className="text-base font-extrabold uppercase text-slate-800">Fechamento mensal · {year}</h2><p className="mt-1 text-sm text-slate-500">O fechamento bloqueia alterações no período. Reabertura somente pelo Admin, com justificativa auditada.</p></div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {rows.map((month) => (
          <article key={month.mes} className="rounded-lg border border-slate-200 p-3">
            <div className="flex items-start justify-between gap-2"><h3 className="font-extrabold text-slate-900">{month.nome}</h3><span className={`rounded px-2 py-1 text-xs font-extrabold ${month.status === 'FECHADO' ? 'bg-slate-800 text-white' : 'bg-emerald-100 text-emerald-700'}`}>{month.status === 'FECHADO' ? 'Fechado' : 'Aberto'}</span></div>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs"><Summary label="Cargas" value={month.cargas} /><Summary label="Produtos" value={month.produtos} /><Summary label="Peso NF" value={kg(month.pesoNota)} /><Summary label="Armazenado" value={kg(month.armazenado)} /><Summary label="Saldo" value={kg(month.saldo)} /><Summary label="Silos / Baias" value={`${month.silos} / ${month.baias}`} /></dl>
            {month.status === 'FECHADO' && <p className="mt-3 text-xs text-slate-500">Fechado por {month.fechamento?.fechado_por_nome || '-'} em {dateTimeBr(month.fechamento?.fechado_em)}</p>}
            <div className="mt-3">
              {month.status !== 'FECHADO' && can('balancas', 'aprovar') && <button type="button" className={`${BUTTON_SECONDARY} w-full`} disabled={busy} onClick={() => onClose(month)}><CalendarCheck className="h-4 w-4" /> Fechar mês</button>}
              {month.status === 'FECHADO' && isAdmin && <button type="button" className={`${BUTTON_SECONDARY} w-full`} disabled={busy} onClick={() => onReopen(month)}><RotateCcw className="h-4 w-4" /> Reabrir mês</button>}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ReadOnly({ label, value, strong = false }) {
  return <div><p className="text-xs font-extrabold uppercase text-slate-500">{label}</p><p className={`mt-1 break-words text-slate-900 ${strong ? 'text-lg font-extrabold' : 'text-sm font-bold'}`}>{value}</p></div>;
}

function Summary({ label, value }) {
  return <div className="rounded bg-slate-50 p-2"><dt className="font-bold uppercase text-slate-500">{label}</dt><dd className="mt-1 font-extrabold text-slate-900">{value}</dd></div>;
}

function StatusBadge({ status }) {
  const labels = { PENDENTE: 'Pendente', PARCIALMENTE_ARMAZENADO: 'Parcial', ARMAZENADO: 'Armazenado', CANCELADO: 'Cancelado' };
  const colors = { PENDENTE: 'bg-amber-100 text-amber-800', PARCIALMENTE_ARMAZENADO: 'bg-blue-100 text-blue-800', ARMAZENADO: 'bg-emerald-100 text-emerald-800', CANCELADO: 'bg-rose-100 text-rose-800' };
  return <span className={`inline-flex rounded px-2 py-1 text-xs font-extrabold ${colors[status] || 'bg-slate-100 text-slate-700'}`}>{labels[status] || status}</span>;
}

function IconButton({ title, children, onClick, tone = 'default' }) {
  return <button type="button" title={title} onClick={onClick} className={`grid h-9 w-9 shrink-0 place-items-center rounded-md transition ${tone === 'danger' ? 'text-rose-600 hover:bg-rose-50' : 'text-slate-600 hover:bg-slate-100'}`}>{children}</button>;
}

function Empty({ text }) {
  return <div className="grid min-h-32 place-items-center p-6 text-center text-sm font-semibold text-slate-500">{text}</div>;
}

function Notice({ tone, text, onClose }) {
  return <div className={`flex items-start justify-between gap-3 rounded-lg border p-3 text-sm font-bold ${tone === 'error' ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}><span>{text}</span><button type="button" title="Fechar aviso" onClick={onClose}><X className="h-4 w-4" /></button></div>;
}

function storageForm(record) {
  const distributions = (record.itens || []).flatMap((item) => (item.distribuicoes || []).map((entry) => ({
    id: entry.id,
    armazenagem_item_id: item.id,
    silo: entry.silo || '',
    baia: entry.baia || '',
    peso_armazenado: localeNumberText(entry.peso_armazenado),
    observacao: entry.observacao || '',
  })));
  return {
    data_armazenagem: record.data_armazenagem || record.recebimento?.data || todayIso(),
    observacao: record.observacao || '',
    distribuicoes: distributions.length ? distributions : [emptyDistribution(record.itens?.[0]?.id)],
  };
}

function emptyDistribution(itemId = '') {
  return { armazenagem_item_id: itemId || '', silo: '', baia: '', peso_armazenado: '', observacao: '' };
}

function validateStorageForm(form, record) {
  if (!form.data_armazenagem) return 'Informe a data da armazenagem.';
  if (!form.distribuicoes.length) return 'Adicione pelo menos uma distribuição.';
  const invalid = form.distribuicoes.find((item) => !item.armazenagem_item_id || (!item.silo.trim() && !item.baia.trim()) || localeNumber(item.peso_armazenado) <= 0);
  if (invalid) return 'Preencha o produto, pelo menos um Silo ou Baia e um peso maior que zero em cada distribuição.';
  const totals = distributionTotals(form.distribuicoes, record.itens || []);
  const over = (record.itens || []).find((item) => Number(totals.byItem[item.id] || 0) > Number(item.peso_nota || 0) + 0.001);
  if (over) return `O peso distribuído para ${over.produto?.nome || `Item ${over.ordem}`} ultrapassa o peso da NF.`;
  return '';
}

function distributionTotals(distributions, items) {
  const byItem = {};
  distributions.forEach((item) => {
    byItem[item.armazenagem_item_id] = (byItem[item.armazenagem_item_id] || 0) + localeNumber(item.peso_armazenado);
  });
  return { byItem, total: Object.values(byItem).reduce((sum, value) => sum + value, 0), items };
}

function filterRows(rows, filters) {
  const contains = (value, search) => normalize(value).includes(normalize(search));
  return rows.filter((row) => {
    const date = row.data_armazenagem || row.recebimento?.data || '';
    const products = productNames(row);
    const supplier = row.recebimento?.fornecedor?.nome || row.recebimento?.fornecedor_nome_manual || '';
    const plate = row.recebimento?.veiculo?.placa || row.recebimento?.veiculo_placa_manual || '';
    const carrier = row.recebimento?.transportadora?.nome || row.recebimento?.tipo_veiculo || '';
    const silos = distributionValues(row, 'silo');
    const bays = distributionValues(row, 'baia');
    const all = [row.recebimento?.nf_numero, plate, products, supplier, silos, bays].join(' ');
    return (!filters.ano || date.startsWith(`${filters.ano}-`))
      && (!filters.mes || Number(date.slice(5, 7)) === Number(filters.mes))
      && (!filters.dataInicial || date >= filters.dataInicial)
      && (!filters.dataFinal || date <= filters.dataFinal)
      && (!filters.nf || contains(row.recebimento?.nf_numero, filters.nf))
      && (!filters.placa || contains(plate, filters.placa))
      && (!filters.produto || contains(products, filters.produto))
      && (!filters.fornecedor || contains(supplier, filters.fornecedor))
      && (!filters.transportadora || contains(carrier, filters.transportadora))
      && (!filters.silo || contains(silos, filters.silo))
      && (!filters.baia || contains(bays, filters.baia))
      && (!filters.status || row.status === filters.status)
      && (!filters.busca || contains(all, filters.busca));
  });
}

function calculateMetrics(rows) {
  const silos = new Set();
  const bays = new Set();
  rows.forEach((row) => (row.itens || []).forEach((item) => (item.distribuicoes || []).forEach((distribution) => {
    if (distribution.silo) silos.add(normalize(distribution.silo));
    if (distribution.baia) bays.add(normalize(distribution.baia));
  })));
  return {
    pesoNota: sum(rows, 'peso_nota'),
    armazenado: sum(rows, 'peso_distribuido'),
    saldo: sum(rows, 'saldo_distribuir'),
    cargas: rows.length,
    silos: silos.size,
    baias: bays.size,
    pendentes: rows.filter((row) => ['PENDENTE', 'PARCIALMENTE_ARMAZENADO'].includes(row.status)).length,
  };
}

function buildCharts(rows) {
  const products = new Map();
  const silos = new Map();
  const months = new Map();
  rows.forEach((row) => {
    const date = row.data_armazenagem || row.recebimento?.data || '';
    const month = date ? `${date.slice(5, 7)}/${date.slice(0, 4)}` : 'Sem data';
    months.set(month, (months.get(month) || 0) + Number(row.peso_distribuido || 0));
    (row.itens || []).forEach((item) => (item.distribuicoes || []).forEach((distribution) => {
      const weight = Number(distribution.peso_armazenado || 0);
      const product = item.produto?.nome || row.recebimento?.produto?.nome || row.recebimento?.produto_nome_manual || 'Sem produto';
      products.set(product, (products.get(product) || 0) + weight);
      if (distribution.silo) silos.set(distribution.silo, (silos.get(distribution.silo) || 0) + weight);
    }));
  });
  return {
    products: mapChart(products),
    silos: mapChart(silos),
    months: mapChart(months, false),
  };
}

function buildMonthlyClosures(rows, closures, year) {
  return MONTHS.map((name, index) => {
    const month = index + 1;
    const monthRows = rows.filter((row) => {
      const date = row.data_armazenagem || row.recebimento?.data || '';
      return Number(date.slice(0, 4)) === year && Number(date.slice(5, 7)) === month && row.status !== 'CANCELADO';
    });
    const metrics = calculateMetrics(monthRows);
    const products = new Set(monthRows.flatMap((row) => (row.itens || []).map((item) => item.produto_id || item.produto?.nome).filter(Boolean)));
    const closure = closures.find((item) => Number(item.ano) === year && Number(item.mes) === month);
    return { ano: year, mes: month, nome: name, ...metrics, produtos: products.size, fechamento: closure, status: closure?.status === 'FECHADO' ? 'FECHADO' : 'ABERTO' };
  });
}

function printReceipt(row) {
  const doc = new jsPDF();
  doc.setFontSize(16); doc.text('AgroFlow - Comprovante de Armazenagem M.P.', 14, 18);
  doc.setFontSize(10);
  const lines = reportLines(row);
  lines.forEach((line, index) => doc.text(line, 14, 32 + index * 7));
  doc.save(`armazenagem-${row.recebimento?.nf_numero || row.id}.pdf`);
}

function exportPdf(rows, filters) {
  const doc = new jsPDF({ orientation: 'landscape' });
  doc.setFontSize(15); doc.text('AgroFlow - Relatorio de Armazenagem M.P.', 12, 14);
  doc.setFontSize(8); doc.text(`Periodo/filtros: ${filters.dataInicial || '-'} a ${filters.dataFinal || '-'} | Ano ${filters.ano || 'todos'} | Mes ${filters.mes || 'todos'}`, 12, 21);
  let y = 31;
  rows.forEach((row) => {
    if (y > 190) { doc.addPage(); y = 15; }
    doc.text(`${dateBr(row.data_armazenagem)} | NF ${row.recebimento?.nf_numero || '-'} | ${productNames(row)} | NF ${kg(row.peso_nota)} | Armazenado ${kg(row.peso_distribuido)} | Saldo ${kg(row.saldo_distribuir)} | Silo ${distributionValues(row, 'silo')} | Baia ${distributionValues(row, 'baia')} | ${statusText(row.status)}`, 12, y, { maxWidth: 270 });
    y += 10;
  });
  doc.setFontSize(10); doc.text(`Peso total da NF: ${kg(sum(rows, 'peso_nota'))} | Total armazenado: ${kg(sum(rows, 'peso_distribuido'))} | Saldo: ${kg(sum(rows, 'saldo_distribuir'))}`, 12, Math.min(y + 4, 198));
  doc.save('relatorio-armazenagem-mp.pdf');
}

function exportExcel(rows) {
  const data = rows.map((row) => ({
    Data: dateBr(row.data_armazenagem), NF: row.recebimento?.nf_numero || '', Placa: row.recebimento?.veiculo?.placa || row.recebimento?.veiculo_placa_manual || '',
    Fornecedor: row.recebimento?.fornecedor?.nome || row.recebimento?.fornecedor_nome_manual || '', Produto: productNames(row),
    'Peso da NF KG': Number(row.peso_nota || 0), 'Peso distribuido KG': Number(row.peso_distribuido || 0), 'Saldo KG': Number(row.saldo_distribuir || 0),
    Transportadora: row.recebimento?.transportadora?.nome || row.recebimento?.tipo_veiculo || '', Silo: distributionValues(row, 'silo'), Baia: distributionValues(row, 'baia'),
    Status: statusText(row.status), Responsavel: row.updated_by_nome || row.created_by_nome || '', Registro: dateTimeBr(row.updated_at || row.created_at),
  }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(data), 'Armazenagem MP');
  XLSX.writeFile(workbook, 'relatorio-armazenagem-mp.xlsx');
}

function reportLines(row) {
  return [
    `Data: ${dateBr(row.data_armazenagem)}`,
    `NF: ${row.recebimento?.nf_numero || '-'}`,
    `Placa: ${row.recebimento?.veiculo?.placa || row.recebimento?.veiculo_placa_manual || '-'}`,
    `Fornecedor: ${row.recebimento?.fornecedor?.nome || row.recebimento?.fornecedor_nome_manual || '-'}`,
    `Produto(s): ${productNames(row)}`,
    `Peso da NF: ${kg(row.peso_nota)} (${originLabel(row.origem_peso)})`,
    `Peso distribuido: ${kg(row.peso_distribuido)} | Saldo: ${kg(row.saldo_distribuir)}`,
    `Silo(s): ${distributionValues(row, 'silo')} | Baia(s): ${distributionValues(row, 'baia')}`,
    `Status: ${statusText(row.status)}`,
    `Responsavel: ${row.updated_by_nome || row.created_by_nome || '-'}`,
  ];
}

function productNames(row) {
  const names = (row.itens || []).map((item) => item.produto?.nome).filter(Boolean);
  if (names.length) return [...new Set(names)].join(', ');
  const receivingItems = row.recebimento?.itens || [];
  const receivingNames = receivingItems.map((item) => item.produto?.nome).filter(Boolean);
  const fallback = row.recebimento?.produto?.nome || row.recebimento?.produto_nome_manual;
  return [...new Set(receivingNames.length ? receivingNames : [fallback].filter(Boolean))].join(', ') || '-';
}

function distributionValues(row, field) {
  const values = (row.itens || []).flatMap((item) => (item.distribuicoes || []).map((entry) => entry[field]).filter(Boolean));
  return [...new Set(values)].join(', ') || '-';
}

function mapChart(map, sort = true) {
  const rows = Array.from(map, ([name, value]) => ({ name, value })).filter((item) => item.value > 0);
  return sort ? rows.sort((a, b) => b.value - a.value).slice(0, 10) : rows;
}

function normalize(value) { return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(); }
function sum(rows, field) { return rows.reduce((total, row) => total + Number(row[field] || 0), 0); }
function localeNumber(value) { const text = String(value ?? '').trim(); if (!text) return 0; const parsed = Number(text.includes(',') ? text.replace(/\./g, '').replace(',', '.') : text); return Number.isFinite(parsed) ? parsed : 0; }
function localeNumberText(value) { return Number(value || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 }); }
function compactWeight(value) { const number = Number(value || 0); return Math.abs(number) >= 1000 ? `${(number / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}t` : `${Math.round(number)}kg`; }
function todayIso() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Fortaleza' }).format(new Date()); }
function dateTimeBr(value) { if (!value) return '-'; return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Fortaleza', dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)); }
function originLabel(value) { return ({ XML: 'XML da NF-e', NOTA: 'Nota Fiscal', RECEBIMENTO: 'Nota registrada no recebimento' })[value] || value || '-'; }
function statusText(value) { return ({ PENDENTE: 'Pendente', PARCIALMENTE_ARMAZENADO: 'Parcialmente armazenado', ARMAZENADO: 'Armazenado', CANCELADO: 'Cancelado' })[value] || value || '-'; }
