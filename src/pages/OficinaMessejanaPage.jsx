import {
  BarChart3, Boxes, Check, ClipboardList, Download, Edit3, Eye, FileDown,
  FileInput, FileOutput, Plus, RefreshCw, Search, Trash2, Truck, Warehouse, XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import BasePeriodHistory from '../components/balancas/PeriodHistory.jsx';
import { ComplementoModal, ConfirmModal, EntradaModal, SaidaModal } from '../components/oficina/OficinaFormModal.jsx';
import OficinaMovimentacaoModal, { MOVEMENT_TYPES } from '../components/oficina/OficinaMovimentacaoModal.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { exportSimplePdf } from '../lib/pdf.js';
import { currentPeriod } from '../lib/periodHistory.js';
import {
  OFICINA_PAGE_SIZE, cancelEntrada, cancelMovimentacao, cancelSaida, deleteDeposito, getEntrada, getOficinaDashboard,
  listAllForExport, listEntradas, listMovimentacoes, listOficinaLookups, listSaidas, oficinaUserError,
  saveDeposito, saveEntrada, saveMovimentacao, saveNotaComplementar, saveSaida,
} from '../services/oficinaMessejanaService.js';

const TABS = [
  { key: 'dashboard', label: 'Dashboard', icon: Boxes, menu: 'oficina_messejana', tone: 'blue' },
  { key: 'entradas', label: 'Entrada de Notas', icon: FileInput, menu: 'oficina_messejana_entradas', tone: 'teal' },
  { key: 'saidas', label: 'Registro de saída', icon: FileOutput, menu: 'oficina_messejana_saidas', tone: 'orange' },
  { key: 'relatorios', label: 'Relatórios', icon: BarChart3, menu: 'oficina_messejana_relatorios', tone: 'emerald' },
];

const EMPTY_LOOKUPS = { depositos: [], fornecedores: [], produtos: [], motoristas: [], veiculos: [], unidades: [] };
const EMPTY_FILTERS = { search: '', fornecedor: '', fornecedorDestino: '', produto: '', placa: '', motorista: '', destino: '', status: '' };
const EMPTY_MOVEMENT_FILTERS = { search: '', tipo: '', produtoId: '', proprietarioId: '', localId: '', destinatarioId: '' };

function PeriodHistory(props) {
  return <BasePeriodHistory {...props} collapsible defaultExpanded={false} />;
}

export default function OficinaMessejanaPage() {
  const { can, profileData } = useAuth();
  const [params, setParams] = useSearchParams();
  const visibleTabs = TABS.filter((tab) => can(tab.menu, 'visualizar'));
  const requestedTab = params.get('tab') || 'dashboard';
  const activeTab = visibleTabs.some((tab) => tab.key === requestedTab) ? requestedTab : visibleTabs[0]?.key || 'dashboard';
  const [period, setPeriod] = useState(currentPeriod);
  const [lookups, setLookups] = useState(EMPTY_LOOKUPS);
  const [entries, setEntries] = useState([]);
  const [exits, setExits] = useState([]);
  const [movements, setMovements] = useState([]);
  const [entryCount, setEntryCount] = useState(0);
  const [exitCount, setExitCount] = useState(0);
  const [entryPage, setEntryPage] = useState(1);
  const [exitPage, setExitPage] = useState(1);
  const [entryFilters, setEntryFilters] = useState(EMPTY_FILTERS);
  const [exitFilters, setExitFilters] = useState(EMPTY_FILTERS);
  const [movementFilters, setMovementFilters] = useState(EMPTY_MOVEMENT_FILTERS);
  const [dashboard, setDashboard] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [modal, setModal] = useState(null);

  const loadLookups = useCallback(async () => setLookups(await listOficinaLookups()), []);
  const loadEntries = useCallback(async () => {
    const result = await listEntradas({ page: entryPage, period, filters: entryFilters });
    setEntries(result.rows); setEntryCount(result.count);
  }, [entryPage, period, entryFilters]);
  const loadExits = useCallback(async () => {
    const result = await listSaidas({ page: exitPage, period, filters: exitFilters });
    setExits(result.rows); setExitCount(result.count);
  }, [exitPage, period, exitFilters]);
  const loadMovements = useCallback(async () => setMovements(await listMovimentacoes({ period, filters: movementFilters })), [period, movementFilters]);
  const loadDashboard = useCallback(async () => setDashboard(await getOficinaDashboard(period)), [period]);
  const updateEntryFilters = useCallback((next) => {
    if (entryFilters.search && !next.search) setPeriod(currentPeriod());
    setEntryFilters(next);
  }, [entryFilters.search]);
  const updateExitFilters = useCallback((next) => {
    if (exitFilters.search && !next.search) setPeriod(currentPeriod());
    setExitFilters(next);
  }, [exitFilters.search]);

  const reload = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const tasks = [];
      if (activeTab === 'dashboard' || activeTab === 'relatorios') tasks.push(loadDashboard());
      if (activeTab === 'entradas') tasks.push(loadLookups(), loadEntries());
      if (activeTab === 'saidas') tasks.push(loadLookups(), loadExits(), loadMovements());
      await Promise.all(tasks);
    } catch (loadError) { setError(oficinaUserError(loadError)); }
    finally { setLoading(false); }
  }, [activeTab, loadDashboard, loadEntries, loadExits, loadLookups, loadMovements]);

  useEffect(() => { reload(); }, [reload]);
  useEffect(() => { setEntryPage(1); }, [period, entryFilters]);
  useEffect(() => { setExitPage(1); }, [period, exitFilters]);

  function selectTab(key) { setParams(key === 'dashboard' ? {} : { tab: key }); setMessage(''); setError(''); }
  async function handleSaveEntry(data) {
    try { await saveEntrada(modal?.entry?.id, data); setModal(null); setMessage('Entrada salva com sucesso.'); await Promise.all([loadEntries(), loadDashboard(), loadLookups()]); }
    catch (saveError) { setError(oficinaUserError(saveError)); throw saveError; }
  }
  async function startExit(entry) { setModal({ type: 'exit', entry, exit: null, idempotencyKey: crypto.randomUUID() }); }
  async function editExit(row) {
    try { const entry = await getEntrada(row.entrada_id); setModal({ type: 'exit', entry, exit: row, idempotencyKey: row.idempotency_key }); }
    catch (openError) { setError(oficinaUserError(openError)); }
  }
  async function handleSaveExit(data) {
    try { await saveSaida(modal?.exit?.id, modal.entry.id, modal.idempotencyKey, data); setModal(null); setMessage('Saída salva e saldo recalculado com sucesso.'); await Promise.all([loadExits(), loadDashboard()]); }
    catch (saveError) { setError(oficinaUserError(saveError)); throw saveError; }
  }
  async function handleSaveMovement(data) {
    try {
      await saveMovimentacao(modal?.movement?.id, modal.idempotencyKey, data);
      setModal(null); setMessage('Movimentação salva e estoque recalculado com sucesso.');
      await Promise.all([loadMovements(), loadDashboard()]);
    } catch (saveError) { setError(oficinaUserError(saveError)); throw new Error(oficinaUserError(saveError)); }
  }
  async function handleSaveComplement(data) {
    try { await saveNotaComplementar(modal.entry.id, data); setModal(null); setMessage('NF complementar vinculada sem alterar peso ou saldo.'); }
    catch (saveError) { setError(oficinaUserError(saveError)); throw saveError; }
  }
  async function handleConfirm(reason) {
    try {
      if (modal.type === 'cancel-entry') await cancelEntrada(modal.row.id, reason);
      else if (modal.type === 'cancel-movement') await cancelMovimentacao(modal.row.id, reason);
      else await cancelSaida(modal.row.id, reason);
      setModal(null); setMessage('Cancelamento registrado e saldo recalculado.'); await Promise.all([loadEntries(), loadExits(), loadMovements(), loadDashboard()]);
    } catch (cancelError) { setError(oficinaUserError(cancelError)); throw cancelError; }
  }

  if (!visibleTabs.length) return <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm font-bold text-amber-900">Você não possui permissão para acessar a Central de Grãos Messejana.</div>;

  return (
    <div className="mx-auto grid max-w-[1600px] gap-4">
      <Header />
      <TabNavigation tabs={visibleTabs} active={activeTab} onSelect={selectTab} />
      {message && <Notice tone="success" text={message} onClose={() => setMessage('')} />}
      {error && <Notice tone="error" text={error} onClose={() => setError('')} />}
      {loading && <div className="flex min-h-48 items-center justify-center rounded-xl border border-slate-200 bg-white"><RefreshCw className="mr-2 animate-spin text-emerald-600" /> Carregando dados...</div>}
      {!loading && activeTab === 'dashboard' && <Dashboard dashboard={dashboard} period={period} lookups={lookups} can={() => false} onSaved={loadLookups} onError={(value) => setError(oficinaUserError(value))} />}
      {!loading && activeTab === 'entradas' && <EntriesTab rows={entries} total={entryCount} page={entryPage} onPage={setEntryPage} filters={entryFilters} onFilters={updateEntryFilters} period={period} onPeriod={setPeriod} lookups={lookups} can={can} onNew={() => setModal({ type: 'entry', entry: null })} onView={(row) => setModal({ type: 'view-entry', row })} onEdit={(entry) => setModal({ type: 'entry', entry })} onExit={startExit} onComplement={(entry) => setModal({ type: 'complement', entry })} onCancel={(row) => setModal({ type: 'cancel-entry', row })} />}
      {!loading && activeTab === 'saidas' && <ExitsTab rows={exits} movements={movements} movementFilters={movementFilters} onMovementFilters={setMovementFilters} total={exitCount} page={exitPage} onPage={setExitPage} filters={exitFilters} onFilters={updateExitFilters} period={period} onPeriod={setPeriod} lookups={lookups} can={can} onView={(row) => setModal({ type: 'view-exit', row })} onEdit={editExit} onCancel={(row) => setModal({ type: 'cancel-exit', row })} onNewMovement={(initialType) => setModal({ type: 'movement', movement: null, initialType, idempotencyKey: crypto.randomUUID() })} onViewMovement={(row) => setModal({ type: 'view-movement', row })} onEditMovement={(row) => setModal({ type: 'movement', movement: row, idempotencyKey: row.idempotency_key })} onCancelMovement={(row) => setModal({ type: 'cancel-movement', row })} />}
      {!loading && activeTab === 'depositos' && <DepositsTab lookups={lookups} can={can} onSaved={async (text) => { setMessage(text); await loadLookups(); }} onError={(value) => setError(oficinaUserError(value))} />}
      {!loading && activeTab === 'relatorios' && <ReportsTab dashboard={dashboard} period={period} onPeriod={setPeriod} can={can} onError={(value) => setError(oficinaUserError(value))} />}
      {modal?.type === 'entry' && <EntradaModal entry={modal.entry} lookups={lookups} responsibleName={profileData?.nome || profileData?.email} onClose={() => setModal(null)} onSave={handleSaveEntry} />}
      {modal?.type === 'exit' && <SaidaModal entry={modal.entry} exit={modal.exit} responsibleName={profileData?.nome || profileData?.email} onClose={() => setModal(null)} onSave={handleSaveExit} />}
      {modal?.type === 'movement' && <OficinaMovimentacaoModal movement={modal.movement} initialType={modal.initialType} lookups={lookups} onClose={() => setModal(null)} onSave={handleSaveMovement} />}
      {modal?.type === 'complement' && <ComplementoModal entry={modal.entry} onClose={() => setModal(null)} onSave={handleSaveComplement} />}
      {modal?.type === 'view-entry' && <RecordViewModal title="Detalhes da entrada" row={modal.row} type="entry" onClose={() => setModal(null)} />}
      {modal?.type === 'view-exit' && <RecordViewModal title="Detalhes da saída" row={modal.row} type="exit" onClose={() => setModal(null)} />}
      {modal?.type === 'view-movement' && <MovementViewModal row={modal.row} onClose={() => setModal(null)} />}
      {modal?.type === 'cancel-entry' && <ConfirmModal title="Cancelar entrada" text="A entrada será preservada no histórico. Não é possível cancelar uma entrada com saídas confirmadas." confirmLabel="Cancelar entrada" onClose={() => setModal(null)} onConfirm={handleConfirm} />}
      {modal?.type === 'cancel-exit' && <ConfirmModal title="Cancelar saída" text="O peso desta saída será devolvido automaticamente ao saldo da entrada." confirmLabel="Cancelar saída" onClose={() => setModal(null)} onConfirm={handleConfirm} />}
      {modal?.type === 'cancel-movement' && <ConfirmModal title="Cancelar movimentação" text="O registro será preservado e a movimentação será retirada do cálculo do estoque." confirmLabel="Cancelar movimentação" onClose={() => setModal(null)} onConfirm={handleConfirm} />}
    </div>
  );
}

function Header() {
  return <header className="relative overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-r from-white via-white to-emerald-50 p-5 shadow-sm sm:p-7"><div className="relative z-10 flex items-center gap-5"><div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-200"><Warehouse size={34} /></div><div><h1 className="text-2xl font-black text-slate-950 sm:text-4xl">Central de Grãos Messejana</h1><p className="mt-1 max-w-3xl text-sm font-medium text-slate-600 sm:text-base">Controle de entradas, saídas e saldos de notas fiscais de grãos por fornecedor.</p></div></div><Warehouse className="absolute -bottom-10 right-8 h-40 w-40 text-emerald-100" strokeWidth={1} /></header>;
}

const TAB_STYLES = {
  blue: { card: 'border-blue-100 hover:border-blue-300 hover:bg-blue-50/50', active: 'border-blue-200 bg-blue-50/70 ring-blue-100', icon: 'bg-blue-500 shadow-blue-200', line: 'bg-blue-500', check: 'bg-blue-500' },
  teal: { card: 'border-teal-100 hover:border-teal-300 hover:bg-teal-50/50', active: 'border-teal-200 bg-teal-50/70 ring-teal-100', icon: 'bg-teal-500 shadow-teal-200', line: 'bg-teal-500', check: 'bg-teal-500' },
  orange: { card: 'border-orange-100 hover:border-orange-300 hover:bg-orange-50/50', active: 'border-orange-200 bg-orange-50/70 ring-orange-100', icon: 'bg-orange-500 shadow-orange-200', line: 'bg-orange-500', check: 'bg-orange-500' },
  cyan: { card: 'border-cyan-100 hover:border-cyan-300 hover:bg-cyan-50/50', active: 'border-cyan-200 bg-cyan-50/70 ring-cyan-100', icon: 'bg-cyan-600 shadow-cyan-200', line: 'bg-cyan-600', check: 'bg-cyan-600' },
  emerald: { card: 'border-emerald-100 hover:border-emerald-300 hover:bg-emerald-50/50', active: 'border-emerald-200 bg-emerald-50/70 ring-emerald-100', icon: 'bg-emerald-600 shadow-emerald-200', line: 'bg-emerald-600', check: 'bg-emerald-600' },
};

function TabNavigation({ tabs, active, onSelect }) {
  return <nav aria-label="Menus da Central de Grãos Messejana" className="rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm sm:p-3"><div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">{tabs.map((tab) => { const style = TAB_STYLES[tab.tone] || TAB_STYLES.blue; const isActive = active === tab.key; const Icon = tab.icon; return <button key={tab.key} type="button" onClick={() => onSelect(tab.key)} aria-current={isActive ? 'page' : undefined} className={`group relative flex min-h-32 min-w-0 flex-col items-center justify-center overflow-hidden rounded-xl border px-2 py-4 text-center transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 sm:min-h-36 sm:px-3 ${style.card} ${isActive ? `ring-2 ${style.active}` : 'bg-white'}`}><span className={`grid h-11 w-11 place-items-center rounded-xl text-white shadow-md ${style.icon}`}><Icon className="h-6 w-6" strokeWidth={2.2} /></span><span className="mt-3 text-sm font-extrabold leading-snug text-slate-900 sm:text-base">{tab.label}</span>{isActive && <span className={`absolute right-2.5 top-2.5 grid h-5 w-5 place-items-center rounded-full text-white ${style.check}`}><Check className="h-3.5 w-3.5" strokeWidth={3} /><span className="sr-only">Menu selecionado</span></span>}<span className={`absolute inset-x-0 bottom-0 h-1 ${style.line}`} /></button>; })}</div></nav>;
}

function Dashboard({ dashboard, period, lookups, can, onSaved, onError }) {
  const [depositForm, setDepositForm] = useState(null);
  async function submitDeposit(event) { event.preventDefault(); try { await saveDeposito(depositForm.id, depositForm); setDepositForm(null); await onSaved(); } catch (error) { onError(error); } }
  const cards = [
    ['Notas de entrada', dashboard.quantidade_entradas, ClipboardList], ['Peso total de entrada', `${formatKg(dashboard.peso_entradas)} KG`, FileInput],
    ['Notas de saída', dashboard.quantidade_saidas, Truck], ['Peso total de saída', `${formatKg(dashboard.peso_saidas)} KG`, FileOutput],
    ['Saldo total disponível', `${formatKg(dashboard.saldo_total)} KG`, Boxes], ['Notas sem saída', dashboard.sem_saida, FileInput],
    ['Saídas parciais', dashboard.saida_parcial, FileOutput], ['Saídas totais', dashboard.saida_total, FileDown],
    ['Saldo inicial', `${formatKg(dashboard.saldo_inicial)} KG`, Boxes], ['Transferências', `${formatKg(dashboard.transferencias)} KG`, Truck],
    ['Vendas/refaturamentos', `${formatKg(dashboard.vendas)} KG`, FileOutput], ['Operações diretas', `${formatKg(dashboard.operacoes_diretas)} KG`, FileDown],
  ];
  return <div className="grid gap-4"><SectionTitle title="Dashboard" subtitle={`Indicadores do período ${String(period.month).padStart(2, '0')}/${period.year}.`} /><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([label, value, Icon]) => <article key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><Icon className="h-7 w-7 text-emerald-600" /><p className="mt-3 text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-2xl font-black text-slate-950">{value ?? 0}</p></article>)}</div><div className="grid gap-4 xl:grid-cols-2"><SummaryList title="Saldo por produto" rows={dashboard.saldo_por_produto || []} labelKey="produto" valueKey="saldo" /><SummaryList title="Saldo por fornecedor" rows={dashboard.saldo_por_deposito || []} labelKey="deposito" valueKey="saldo" /></div>{can('oficina_messejana_depositos', 'visualizar') && <section className="rounded-xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-200 p-4"><div><h2 className="font-black">Depósitos da Central</h2><p className="text-xs text-slate-500">Cadastros armazenados no banco, sem nomes fixos no frontend.</p></div>{can('oficina_messejana_depositos', 'cadastrar') && <button type="button" onClick={() => setDepositForm({ nome: '', ativo: true })} className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-600 px-3 text-sm font-bold text-white"><Plus size={16} /> Novo</button>}</div><div className="divide-y divide-slate-100">{lookups.depositos.map((item) => <div key={item.id} className="flex items-center justify-between px-4 py-3"><span className="font-bold text-slate-800">{item.nome}</span><div className="flex items-center gap-3"><span className={`rounded-full px-2 py-1 text-xs font-bold ${item.ativo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{item.ativo ? 'Ativo' : 'Inativo'}</span>{can('oficina_messejana_depositos', 'editar') && <button type="button" onClick={() => setDepositForm(item)} className="text-slate-500 hover:text-emerald-700" aria-label={`Editar ${item.nome}`}><Edit3 size={17} /></button>}</div></div>)}</div></section>}{depositForm && <div className="rounded-xl border border-emerald-200 bg-white p-4 shadow-sm"><form onSubmit={submitDeposit} className="flex flex-col gap-3 sm:flex-row sm:items-end"><label className="grid flex-1 gap-1 text-sm font-bold">Nome<input required maxLength={100} className="h-11 rounded-lg border border-slate-300 px-3" value={depositForm.nome} onChange={(e) => setDepositForm((current) => ({ ...current, nome: e.target.value }))} /></label><label className="flex h-11 items-center gap-2 text-sm font-bold"><input type="checkbox" checked={depositForm.ativo} onChange={(e) => setDepositForm((current) => ({ ...current, ativo: e.target.checked }))} /> Ativo</label><button type="button" onClick={() => setDepositForm(null)} className="h-11 rounded-lg border px-4 font-bold">Cancelar</button><button type="submit" className="h-11 rounded-lg bg-emerald-600 px-4 font-bold text-white">Salvar</button></form></div>}</div>;
}

function DepositsTab({ lookups, can, onSaved, onError }) {
  const [form, setForm] = useState(null);
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [statusDraft, setStatusDraft] = useState('');
  const [status, setStatus] = useState('');
  const [deleting, setDeleting] = useState(null);
  const [saving, setSaving] = useState(false);

  const normalizedSearch = normalizeText(search);
  const rows = lookups.depositos.filter((item) => {
    if (status === 'ativo' && !item.ativo) return false;
    if (status === 'inativo' && item.ativo) return false;
    if (!normalizedSearch) return true;
    return normalizeText([item.nome, item.fornecedor?.nome, item.fornecedor?.cnpj].filter(Boolean).join(' ')).includes(normalizedSearch);
  });

  function openForm(item = null) {
    setForm(item ? { ...item, fornecedor_id: item.fornecedor_id || '' } : { nome: '', fornecedor_id: '', ativo: true });
  }

  function selectSupplier(fornecedorId) {
    const fornecedor = lookups.fornecedores.find((item) => item.id === fornecedorId);
    setForm((current) => ({
      ...current,
      fornecedor_id: fornecedorId,
      nome: fornecedor ? fornecedor.nome : current.nome,
    }));
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    try {
      await saveDeposito(form.id, form);
      setForm(null);
      await onSaved(form.id ? 'Depósito atualizado com sucesso.' : 'Depósito criado com sucesso.');
    } catch (error) {
      onError(error);
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    setSaving(true);
    try {
      await deleteDeposito(deleting.id);
      setDeleting(null);
      await onSaved('Depósito excluído. O fornecedor cadastrado foi preservado.');
    } catch (error) {
      onError(error);
    } finally {
      setSaving(false);
    }
  }

  const selectedSupplier = lookups.fornecedores.find((item) => item.id === form?.fornecedor_id);

  return <div className="grid gap-4">
    <SectionTitle title="Depósitos da Central" subtitle="Vincule fornecedores já cadastrados e administre os depósitos da Central de Grãos Messejana." action={can('oficina_messejana_depositos', 'cadastrar') && <button type="button" onClick={() => openForm()} className="primary"><Plus size={17} /> Novo depósito</button>} />
    <section className="rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50/70 to-cyan-50/50 p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-600 text-white"><Search size={22} /></span><div><h2 className="text-sm font-black">FILTROS DE BUSCA</h2><p className="text-xs text-slate-500">Pesquise por depósito, fornecedor cadastrado ou CNPJ.</p></div></div>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px_auto] sm:items-end">
        <FilterInput label="Depósito, fornecedor ou CNPJ" value={searchDraft} onChange={setSearchDraft} />
        <label className="grid gap-1 text-xs font-bold">Status<select className="filter" value={statusDraft} onChange={(event) => setStatusDraft(event.target.value)}><option value="">Todos</option><option value="ativo">Ativos</option><option value="inativo">Inativos</option></select></label>
        <div className="flex gap-2"><button type="button" className="secondary" onClick={() => { setSearchDraft(''); setSearch(''); setStatusDraft(''); setStatus(''); }}>Limpar</button><button type="button" className="primary" onClick={() => { setSearch(searchDraft); setStatus(statusDraft); }}><Search size={16} /> Aplicar filtros</button></div>
      </div>
      <p className="mt-3 text-xs font-bold text-slate-600">Exibindo <span className="text-emerald-700">{rows.length}</span> de {lookups.depositos.length} depósito(s)</p>
    </section>

    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm"><table className="min-w-[900px] w-full text-left text-sm"><thead><tr>{['Depósito','Fornecedor vinculado','CNPJ','Status','Ações'].map((value) => <Th key={value}>{value}</Th>)}</tr></thead><tbody>{rows.map((item) => <tr key={item.id} className="border-t border-slate-100"><Td><span className="font-black text-slate-900">{item.nome}</span></Td><Td>{item.fornecedor?.nome || 'Sem fornecedor vinculado'}</Td><Td>{formatCnpj(item.fornecedor?.cnpj)}</Td><Td><span className={`inline-flex rounded-full px-2 py-1 text-xs font-black ${item.ativo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{item.ativo ? 'Ativo' : 'Inativo'}</span></Td><Td><div className="flex gap-1">{can('oficina_messejana_depositos', 'editar') && <IconButton label={`Editar ${item.nome}`} onClick={() => openForm(item)}><Edit3 size={17} /></IconButton>}{can('oficina_messejana_depositos', 'excluir') && <IconButton label={`Excluir ${item.nome}`} onClick={() => setDeleting(item)} danger><Trash2 size={17} /></IconButton>}</div></Td></tr>)}{!rows.length && <EmptyRow cols={5} />}</tbody></table></div>

    {form && <div className="fixed inset-0 z-[70] overflow-y-auto bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-label={form.id ? 'Editar depósito' : 'Novo depósito'}><form onSubmit={submit} className="mx-auto my-8 max-w-2xl rounded-2xl bg-white shadow-2xl"><header className="flex items-center justify-between border-b border-slate-200 p-5"><div><h2 className="text-xl font-black">{form.id ? 'Editar depósito' : 'Novo depósito'}</h2><p className="mt-1 text-sm text-slate-500">Selecione um fornecedor existente ou informe somente o nome do depósito.</p></div><button type="button" onClick={() => setForm(null)} aria-label="Fechar"><XCircle /></button></header><div className="grid gap-4 p-5"><label className="grid gap-1 text-sm font-bold">Fornecedor cadastrado (opcional)<select className="filter" value={form.fornecedor_id} onChange={(event) => selectSupplier(event.target.value)}><option value="">Sem fornecedor vinculado</option>{lookups.fornecedores.map((item) => <option key={item.id} value={item.id}>{item.nome}{item.cnpj ? ` — ${formatCnpj(item.cnpj)}` : ''}</option>)}</select></label>{!lookups.fornecedores.length && <p className="rounded-lg bg-amber-50 p-3 text-sm font-bold text-amber-800">Nenhum fornecedor disponível. Cadastre-o primeiro no menu Cadastros → Fornecedores.</p>}<label className="grid gap-1 text-sm font-bold">Nome do depósito<input required maxLength={100} className="filter" value={form.nome} onChange={(event) => setForm((current) => ({ ...current, nome: event.target.value }))} /></label>{selectedSupplier && <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-sm"><b>Fornecedor vinculado:</b> {selectedSupplier.nome}<br /><b>CNPJ:</b> {formatCnpj(selectedSupplier.cnpj)}</div>}<label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={form.ativo} onChange={(event) => setForm((current) => ({ ...current, ativo: event.target.checked }))} /> Depósito ativo</label></div><footer className="flex justify-end gap-2 border-t border-slate-200 p-4"><button type="button" className="secondary" onClick={() => setForm(null)}>Cancelar</button><button type="submit" className="primary" disabled={saving}>{saving ? 'Salvando...' : 'Salvar depósito'}</button></footer></form></div>}

    {deleting && <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-label="Excluir depósito"><div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl"><div className="p-5"><h2 className="text-xl font-black text-slate-950">Excluir depósito?</h2><p className="mt-3 text-sm text-slate-600">O depósito <b>{deleting.nome}</b> será excluído somente se não possuir movimentações. O fornecedor cadastrado não será apagado.</p></div><div className="flex justify-end gap-2 border-t border-slate-200 p-4"><button type="button" className="secondary" onClick={() => setDeleting(null)}>Cancelar</button><button type="button" disabled={saving} onClick={confirmDelete} className="inline-flex h-11 items-center gap-2 rounded-lg bg-red-600 px-4 font-bold text-white disabled:opacity-60"><Trash2 size={17} /> {saving ? 'Excluindo...' : 'Excluir depósito'}</button></div></div></div>}
  </div>;
}

function EntriesTab(props) {
  const { rows, total, page, onPage, filters, onFilters, period, onPeriod, lookups, can, onNew, onView, onEdit, onExit, onComplement, onCancel } = props;
  return <div className="grid gap-4"><SectionTitle title="Entrada de Notas" subtitle="Registre as notas fiscais usando fornecedores e produtos já cadastrados." action={can('oficina_messejana_entradas', 'cadastrar') && <button type="button" onClick={onNew} className="primary"><Plus size={17} /> Nova entrada</button>} /><Filters type="entradas" value={filters} onChange={onFilters} lookups={lookups} /><PeriodHistory period={period} onChange={onPeriod} counts={new Map()} searchActive={Boolean(filters.search)} /><DataTable><thead><tr>{['Data/hora','NF/série','Fornecedor/origem','Fornecedor destino','Produto','Valor total','Placa','Motorista','Peso entrada','Retirado','Saldo','Status','Responsável','Ações'].map((value) => <Th key={value}>{value}</Th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-t border-slate-100"><Td>{dateTime(row.data_entrada)}</Td><Td>{row.nf_numero}/{row.nf_serie}</Td><Td>{row.fornecedor_nome}</Td><Td>{row.fornecedor_destino_nome || '-'}</Td><Td>{row.produto_nome}</Td><Td>{formatMoney(row.valor_total_nota)}</Td><Td>{row.placa || '-'}</Td><Td>{row.motorista || '-'}</Td><Td>{formatKg(row.peso_nf)} KG</Td><Td>{formatKg(row.peso_retirado)} KG</Td><Td strong>{formatKg(row.saldo_disponivel)} KG</Td><Td><Status value={row.status_saldo} /></Td><Td>{row.responsavel_nome}</Td><Td sticky><Actions onView={() => onView(row)} onEdit={can('oficina_messejana_entradas','editar') ? () => onEdit(row) : null} onExit={can('oficina_messejana_saidas','cadastrar') && row.status_registro !== 'CANCELADA' && Number(row.saldo_disponivel)>0 ? () => onExit(row) : null} onComplement={can('oficina_messejana_entradas','cadastrar') && row.status_registro !== 'CANCELADA' ? () => onComplement(row) : null} onCancel={can('oficina_messejana_entradas','cancelar') && row.status_registro !== 'CANCELADA' ? () => onCancel(row) : null} /></Td></tr>)}{!rows.length && <EmptyRow cols={14} />}</tbody></DataTable><Pagination page={page} total={total} onPage={onPage} /></div>;
}

function ExitsTab(props) {
  const { rows, movements, movementFilters, onMovementFilters, total, page, onPage, filters, onFilters, period, onPeriod, lookups, can, onView, onEdit, onCancel, onNewMovement, onViewMovement, onEditMovement, onCancelMovement } = props;
  return <div className="grid gap-5">
    <SectionTitle title="Registro de saída e estoque" subtitle="Registre transferências, vendas, operações diretas, saldo inicial e ajustes com rastreabilidade." action={can('oficina_messejana_saidas','cadastrar') && <div className="flex flex-wrap gap-2"><button type="button" onClick={() => onNewMovement('SALDO_INICIAL')} className="secondary"><Plus size={17}/> Registrar saldo inicial</button><button type="button" onClick={() => onNewMovement('AJUSTE_ESTOQUE')} className="secondary"><Plus size={17}/> Ajuste de estoque</button><button type="button" onClick={() => onNewMovement('TRANSFERENCIA_ESTOQUE_PROPRIO')} className="primary"><Plus size={17}/> Nova destinação</button></div>} />
    <MovementFilters value={movementFilters} onChange={onMovementFilters} lookups={lookups} />
    <PeriodHistory period={period} onChange={onPeriod} counts={new Map()} searchActive={Boolean(movementFilters.search)} collapsible defaultExpanded={false} />
    <DataTable><thead><tr>{['Data','Tipo','Proprietário/origem','Local atual','Destino','Produto','Quantidade','NF compra','NF venda','Valor venda','Status','Ações'].map((value) => <Th key={value}>{value}</Th>)}</tr></thead><tbody>{movements.map((row) => <tr key={row.id} className="border-t border-slate-100"><Td>{dateTime(row.data_movimentacao)}</Td><Td>{movementLabel(row.tipo)}</Td><Td>{row.proprietario_nome}</Td><Td>{row.local_origem_nome || row.local_destino_nome || '-'}</Td><Td>{row.destinatario_nome || row.unidade_destino_nome || row.local_destino_nome || '-'}</Td><Td>{row.produto_nome}</Td><Td strong>{formatKg(row.quantidade)} KG</Td><Td>{row.documento_compra || '-'}</Td><Td>{row.documento_venda || '-'}</Td><Td>{formatMoney(row.valor_total_venda)}</Td><Td><Status value={row.status_registro} /></Td><Td sticky><Actions onView={() => onViewMovement(row)} onEdit={can('oficina_messejana_saidas','editar') && row.status_registro !== 'CANCELADA' ? () => onEditMovement(row) : null} onCancel={can('oficina_messejana_saidas','cancelar') && row.status_registro !== 'CANCELADA' ? () => onCancelMovement(row) : null} /></Td></tr>)}{!movements.length && <EmptyRow cols={12} />}</tbody></DataTable>
    <section className="grid gap-4 border-t border-slate-200 pt-5"><SectionTitle title="Saídas vinculadas às entradas antigas" subtitle="Histórico anterior preservado e disponível para consulta." /><Filters type="saidas" value={filters} onChange={onFilters} lookups={lookups} /><DataTable><thead><tr>{['Data/hora','NF origem','NF saída','Fornecedor','Produto','Destino','Peso entrada','Peso saída','Saldo restante','Placa','Motorista','Status','Responsável','Ações'].map((value) => <Th key={value}>{value}</Th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-t border-slate-100"><Td>{dateTime(row.data_saida)}</Td><Td>{row.nf_origem_numero}/{row.nf_origem_serie}</Td><Td>{row.nf_saida_numero}/{row.nf_saida_serie}</Td><Td>{row.fornecedor_nome}</Td><Td>{row.produto_nome}</Td><Td>{row.destino}</Td><Td>{formatKg(row.peso_entrada)} KG</Td><Td>{formatKg(row.peso_saida)} KG</Td><Td strong>{formatKg(row.saldo_apos_saida)} KG</Td><Td>{row.placa || '-'}</Td><Td>{row.motorista || '-'}</Td><Td><Status value={row.status_registro} /></Td><Td>{row.responsavel_nome}</Td><Td sticky><Actions onView={() => onView(row)} onEdit={can('oficina_messejana_saidas','editar') && row.status_registro !== 'CANCELADA' ? () => onEdit(row) : null} onCancel={can('oficina_messejana_saidas','cancelar') && row.status_registro !== 'CANCELADA' ? () => onCancel(row) : null} /></Td></tr>)}{!rows.length && <EmptyRow cols={14} />}</tbody></DataTable><Pagination page={page} total={total} onPage={onPage} /></section>
  </div>;
}

function ReportsTab({ dashboard, period, onPeriod, can, onError }) {
  const [exporting, setExporting] = useState(false);
  async function exportReport(format) {
    setExporting(true);
    try {
      const [entradas, saidas, movimentacoes] = await Promise.all([listAllForExport('entradas',{period}), listAllForExport('saidas',{period}), listMovimentacoes({ period })]);
      const rows = entradas.map((row) => ({ Tipo:'Entrada', Data:dateTime(row.data_entrada), NF:`${row.nf_numero}/${row.nf_serie}`, Fornecedor:row.fornecedor_nome, FornecedorDestino:row.fornecedor_destino_nome || '', CnpjDestino:row.fornecedor_destino_cnpj || '', Produto:row.produto_nome, Destino:'', Peso:Number(row.peso_nf), ValorUnitario:Number(row.valor_unitario||0), ValorTotal:Number(row.valor_total_nota||0), Saldo:Number(row.saldo_disponivel), Status:statusLabel(row.status_saldo) })).concat(saidas.map((row) => ({ Tipo:'Saída', Data:dateTime(row.data_saida), NF:`${row.nf_saida_numero}/${row.nf_saida_serie}`, Fornecedor:row.fornecedor_nome, FornecedorDestino:'', CnpjDestino:'', Produto:row.produto_nome, Destino:row.destino, Peso:Number(row.peso_saida), ValorUnitario:0, ValorTotal:0, Saldo:Number(row.saldo_apos_saida), Status:statusLabel(row.status_registro) })));
      rows.push(...movimentacoes.map((row) => ({ Tipo:movementLabel(row.tipo), Data:dateTime(row.data_movimentacao), NF:row.documento_venda || row.documento_compra || '', Fornecedor:row.proprietario_nome, FornecedorDestino:row.destinatario_nome || row.local_destino_nome || row.unidade_destino_nome || '', CnpjDestino:row.destinatario_documento || row.local_destino_documento || '', Produto:row.produto_nome, Destino:row.destinatario_nome || row.unidade_destino_nome || row.local_destino_nome || '', Peso:Number(row.quantidade), ValorUnitario:Number(row.valor_unitario_venda || row.valor_unitario_compra || 0), ValorTotal:Number(row.valor_total_venda || row.valor_total_compra || 0), Saldo:0, Status:statusLabel(row.status_registro) })));
      if (format === 'xlsx') { const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows.length?rows:[{Aviso:'Nenhum registro'}]),'Movimentações'); XLSX.writeFile(wb,`central-graos-messejana-${period.year}-${String(period.month).padStart(2,'0')}.xlsx`); }
      else exportSimplePdf({ title:'Central de Grãos Messejana', subtitle:`Movimentações ${String(period.month).padStart(2,'0')}/${period.year}`, fileName:`central-graos-messejana-${period.year}-${period.month}.pdf`, columns:[{key:'Tipo',label:'Tipo'},{key:'Data',label:'Data'},{key:'NF',label:'NF'},{key:'Fornecedor',label:'Fornecedor/origem'},{key:'FornecedorDestino',label:'Fornecedor destino'},{key:'Produto',label:'Produto'},{key:'Destino',label:'Destino'},{key:'Peso',label:'Peso'},{key:'ValorUnitario',label:'Valor unit.'},{key:'ValorTotal',label:'Valor total'},{key:'Saldo',label:'Saldo'},{key:'Status',label:'Status'}], rows, totals:[{label:'Entradas',value:`${formatKg(dashboard.peso_entradas)} KG`},{label:'Saídas',value:`${formatKg(dashboard.peso_saidas)} KG`},{label:'Saldo',value:`${formatKg(dashboard.saldo_total)} KG`}] });
    } catch (error) { onError(error); } finally { setExporting(false); }
  }
  return <div className="grid gap-4"><SectionTitle title="Relatórios" subtitle="Totais calculados no banco e exportações com os mesmos filtros do período." action={can('oficina_messejana_relatorios','exportar') && <div className="flex gap-2"><button disabled={exporting} type="button" className="secondary" onClick={()=>exportReport('xlsx')}><Download size={17}/> Excel</button><button disabled={exporting} type="button" className="primary" onClick={()=>exportReport('pdf')}><FileDown size={17}/> PDF</button></div>} /><PeriodHistory period={period} onChange={onPeriod} counts={new Map()} /><div className="grid gap-4 md:grid-cols-2"><SummaryList title="Saldo por produto" rows={dashboard.saldo_por_produto || []} labelKey="produto" valueKey="saldo" /><SummaryList title="Saldo por fornecedor" rows={dashboard.saldo_por_deposito || []} labelKey="deposito" valueKey="saldo" /><SummaryList title="Entradas por fornecedor destino" rows={dashboard.entradas_por_fornecedor_destino || []} labelKey="fornecedor_destino" valueKey="peso" /><SummaryList title="Movimentações por destino" rows={dashboard.saidas_por_destino || []} labelKey="destino" valueKey="peso" /><SummaryList title="Movimentações por fornecedor" rows={dashboard.entradas_por_fornecedor || []} labelKey="fornecedor" valueKey="peso" /><SummaryList title="Movimentações por placa" rows={dashboard.movimentacoes_por_placa || []} labelKey="placa" valueKey="peso" /><SummaryList title="Notas complementares de valor" rows={dashboard.notas_complementares || []} labelKey="nota" valueKey="quantidade" suffix="nota" /><SummaryList title="Movimentações canceladas" rows={dashboard.movimentacoes_canceladas || []} labelKey="tipo" valueKey="quantidade" suffix="registro" /><MonthlyMovement rows={dashboard.movimentacao_mensal || []} /></div></div>;
}

function RecordViewModal({ title, row, type, onClose }) {
  const fields = type === 'entry' ? [
    ['Data/hora', dateTime(row.data_entrada)], ['NF/série', `${row.nf_numero}/${row.nf_serie}`],
    ['Fornecedor', row.fornecedor_nome], ['CNPJ', row.fornecedor_cnpj], ['Fornecedor destino', row.fornecedor_destino_nome], ['CNPJ do destino', formatCnpj(row.fornecedor_destino_cnpj)], ['Produto', row.produto_nome],
    ['Origem/fornecedor', row.fornecedor_nome], ['Peso da entrada', `${formatKg(row.peso_nf)} KG`],
    ['Valor unitário', formatMoney(row.valor_unitario)], ['Valor total da nota', formatMoney(row.valor_total_nota)],
    ['Peso retirado', `${formatKg(row.peso_retirado)} KG`], ['Saldo', `${formatKg(row.saldo_disponivel)} KG`],
    ['Placa', row.placa], ['Veículo', row.veiculo], ['Motorista', row.motorista],
    ['Transportadora', row.transportadora], ['Origem', row.origem], ['Responsável', row.responsavel_nome],
    ['Status', statusLabel(row.status_saldo)], ['Observação', row.observacao],
  ] : [
    ['Data/hora', dateTime(row.data_saida)], ['NF de origem', `${row.nf_origem_numero}/${row.nf_origem_serie}`],
    ['NF de saída', `${row.nf_saida_numero}/${row.nf_saida_serie}`], ['Fornecedor', row.fornecedor_nome],
    ['Produto', row.produto_nome], ['Depósito', row.deposito_origem], ['Destino', row.destino],
    ['Peso da saída', `${formatKg(row.peso_saida)} KG`], ['Saldo restante', `${formatKg(row.saldo_apos_saida)} KG`],
    ['Placa', row.placa], ['Veículo', row.veiculo], ['Motorista', row.motorista],
    ['Transportadora', row.transportadora], ['Responsável', row.responsavel_nome],
    ['Status', statusLabel(row.status_registro)], ['Observação', row.observacao],
  ];
  return <div className="fixed inset-0 z-[70] overflow-y-auto bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-label={title}><div className="mx-auto my-8 max-w-4xl rounded-2xl bg-white shadow-2xl"><header className="flex items-center justify-between border-b border-slate-200 p-5"><h2 className="text-xl font-black">{title}</h2><button type="button" onClick={onClose} aria-label="Fechar"><XCircle /></button></header><dl className="grid gap-px bg-slate-200 sm:grid-cols-2">{fields.map(([label,value])=><div key={label} className="bg-white p-4"><dt className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 font-bold text-slate-900">{value||'-'}</dd></div>)}</dl><div className="flex justify-end p-4"><button type="button" className="secondary" onClick={onClose}>Fechar</button></div></div></div>;
}

function MovementFilters({ value, onChange, lookups }) {
  const update = (key, next) => onChange({ ...value, [key]: next });
  return <section className="rounded-xl border border-emerald-200 bg-white p-4 shadow-sm"><div className="mb-3 flex items-center gap-2"><Search className="text-emerald-600"/><div><h2 className="text-sm font-black">FILTROS DAS MOVIMENTAÇÕES</h2><p className="text-xs text-slate-500">Filtre por período, produto, proprietário, local, destinatário, tipo ou NF.</p></div></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"><FilterInput label="Nome, CNPJ ou NF" value={value.search} onChange={(next) => update('search',next)}/><FilterSelect label="Tipo" value={value.tipo} onChange={(next) => update('tipo',next)} rows={MOVEMENT_TYPES.map(([id,nome])=>({id,nome}))}/><FilterSelect label="Produto" value={value.produtoId} onChange={(next) => update('produtoId',next)} rows={lookups.produtos}/><FilterSelect label="Fornecedor proprietário/origem" value={value.proprietarioId} onChange={(next) => update('proprietarioId',next)} rows={lookups.fornecedores}/><FilterSelect label="Local de armazenagem" value={value.localId} onChange={(next) => update('localId',next)} rows={lookups.fornecedores}/><FilterSelect label="Destinatário" value={value.destinatarioId} onChange={(next) => update('destinatarioId',next)} rows={lookups.fornecedores}/></div><div className="mt-3 flex justify-end"><button type="button" className="secondary" onClick={() => onChange(EMPTY_MOVEMENT_FILTERS)}>Limpar filtros</button></div></section>;
}

function FilterSelect({ label, value, onChange, rows }) {
  return <label className="grid gap-1 text-xs font-bold">{label}<select className="filter" value={value} onChange={(e)=>onChange(e.target.value)}><option value="">Todos</option>{rows.map((row)=><option key={row.id} value={row.id}>{row.nome}</option>)}</select></label>;
}

function MovementViewModal({ row, onClose }) {
  const fields = [
    ['Tipo',movementLabel(row.tipo)],['Data',dateTime(row.data_movimentacao)],
    ['Fornecedor proprietário/origem',row.proprietario_nome],['Local atual',row.local_origem_nome],
    ['Local de armazenagem',row.local_destino_nome],['Unidade de destino',row.unidade_destino_nome],
    ['Destinatário',row.destinatario_nome],['Produto',row.produto_nome],
    ['Quantidade',`${formatKg(row.quantidade)} KG`],['NF/documento da compra',row.documento_compra],
    ['NF/documento da venda',row.documento_venda],['Valor unitário da compra',formatMoney(row.valor_unitario_compra)],
    ['Valor total da compra',formatMoney(row.valor_total_compra)],['Valor unitário da venda',formatMoney(row.valor_unitario_venda)],
    ['Valor total da venda',formatMoney(row.valor_total_venda)],['Justificativa',row.justificativa],
    ['Status',statusLabel(row.status_registro)],['Motivo do cancelamento',row.motivo_cancelamento],['Observação',row.observacao],
  ];
  return <div className="fixed inset-0 z-[80] overflow-y-auto bg-slate-950/60 p-4" role="dialog" aria-modal="true"><div className="mx-auto my-8 max-w-4xl rounded-2xl bg-white shadow-2xl"><header className="flex items-center justify-between border-b p-5"><h2 className="text-xl font-black">Detalhes da movimentação</h2><button type="button" onClick={onClose} aria-label="Fechar"><XCircle/></button></header><dl className="grid gap-px bg-slate-200 sm:grid-cols-2">{fields.map(([label,value])=><div key={label} className="bg-white p-4"><dt className="text-xs font-black uppercase text-slate-500">{label}</dt><dd className="mt-1 font-bold">{value||'-'}</dd></div>)}</dl><div className="flex justify-end p-4"><button type="button" className="secondary" onClick={onClose}>Fechar</button></div></div></div>;
}

function movementLabel(value) { return MOVEMENT_TYPES.find(([key])=>key===value)?.[1] || value || '-'; }

function Filters({ type, value, onChange }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const update=(key,next)=>setDraft((current)=>({...current,[key]:next}));
  return (
    <section className="rounded-xl border border-emerald-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <Search className="text-emerald-600" />
        <div><h2 className="text-sm font-black">FILTROS DE BUSCA</h2><p className="text-xs text-slate-500">A busca principal consulta todo o histórico.</p></div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <FilterInput label="NF, fornecedores, produto ou placa" value={draft.search} onChange={(v) => update('search', v)} />
        <FilterInput label="Fornecedor" value={draft.fornecedor} onChange={(v) => update('fornecedor', v)} />
        {type === 'entradas' && <FilterInput label="Fornecedor destino" value={draft.fornecedorDestino} onChange={(v) => update('fornecedorDestino', v)} />}
        <FilterInput label="Produto" value={draft.produto} onChange={(v) => update('produto', v)} />
        {type === 'saidas' && <FilterInput label="Destino" value={draft.destino} onChange={(v) => update('destino', v)} />}
        <FilterInput label="Placa" value={draft.placa} onChange={(v) => update('placa', v)} />
        <FilterInput label="Motorista" value={draft.motorista} onChange={(v) => update('motorista', v)} />
        <label className="grid gap-1 text-xs font-bold">Status
          <select className="filter" value={draft.status} onChange={(e) => update('status', e.target.value)}>
            <option value="">Todos</option>
            {type === 'entradas' ? <><option value="SEM_SAIDA">Sem saída</option><option value="SAIDA_PARCIAL">Saída parcial</option><option value="SAIDA_TOTAL">Saída total</option><option value="CANCELADA">Cancelada</option></> : <><option value="CONFIRMADA">Confirmada</option><option value="CANCELADA">Cancelada</option></>}
          </select>
        </label>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" className="secondary" onClick={() => { setDraft(EMPTY_FILTERS); onChange(EMPTY_FILTERS); }}>Limpar</button>
        <button type="button" className="primary" onClick={() => onChange(draft)}><Search size={16} /> Aplicar filtros</button>
      </div>
    </section>
  );
}

function FilterInput({ label, value, onChange }) { return <label className="grid gap-1 text-xs font-bold">{label}<input className="filter" maxLength={80} value={value} onChange={(e)=>onChange(e.target.value)} /></label>; }
function SectionTitle({ title, subtitle, action }) { return <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-2xl font-black text-slate-950">{title}</h2><p className="text-sm text-slate-600">{subtitle}</p></div>{action}</div>; }
function SummaryList({ title, rows, labelKey, valueKey, suffix='KG' }) { return <section className="rounded-xl border border-slate-200 bg-white shadow-sm"><h3 className="border-b border-slate-200 p-4 font-black">{title}</h3><div className="divide-y divide-slate-100">{rows.map((row,index)=><div key={`${row[labelKey]}-${index}`} className="flex items-center justify-between px-4 py-3 text-sm"><span className="font-bold text-slate-700">{row[labelKey]||'Não informado'}</span><span className="font-black text-emerald-700">{formatSummaryValue(row[valueKey],suffix)}</span></div>)}{!rows.length&&<p className="p-4 text-sm text-slate-500">Nenhum movimento no período.</p>}</div></section>; }
function MonthlyMovement({ rows }) { return <section className="rounded-xl border border-slate-200 bg-white shadow-sm"><h3 className="border-b border-slate-200 p-4 font-black">Movimentação mensal</h3><div className="max-h-96 divide-y divide-slate-100 overflow-y-auto">{rows.map((row)=><div key={row.mes} className="grid grid-cols-3 gap-2 px-4 py-3 text-sm"><span className="font-black text-slate-700">{row.mes}</span><span className="text-emerald-700">Entrada: <b>{formatKg(row.entradas)} KG</b></span><span className="text-orange-700">Saída: <b>{formatKg(row.saidas)} KG</b></span></div>)}</div></section>; }
function DataTable({ children }) { return <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm"><table className="min-w-[1500px] w-full text-left text-xs">{children}</table></div>; }
function Th({ children }) { return <th className="whitespace-nowrap bg-slate-50 px-3 py-3 font-black uppercase tracking-wide text-slate-600">{children}</th>; }
function Td({ children, strong=false, sticky=false }) { return <td className={`px-3 py-3 align-middle ${strong?'font-black text-emerald-700':'font-medium text-slate-700'} ${sticky?'sticky right-0 bg-white shadow-[-8px_0_12px_-12px_rgba(15,23,42,.5)]':''}`}>{children}</td>; }
function EmptyRow({ cols }) { return <tr><td colSpan={cols} className="p-10 text-center text-sm text-slate-500">Nenhum registro encontrado.</td></tr>; }
function Actions({ onView, onEdit, onExit, onComplement, onCancel }) { return <div className="flex min-w-max items-center gap-1"><IconButton label="Visualizar" onClick={onView}><Eye size={17}/></IconButton>{onEdit&&<IconButton label="Editar" onClick={onEdit}><Edit3 size={17}/></IconButton>}{onExit&&<IconButton label="Registrar saída vinculada" onClick={onExit}><Truck size={17}/></IconButton>}{onComplement&&<IconButton label="Vincular NF complementar de valor" onClick={onComplement}><ClipboardList size={17}/></IconButton>}{onCancel&&<IconButton label="Cancelar" onClick={onCancel} danger><XCircle size={17}/></IconButton>}</div>; }
function IconButton({ label, onClick, danger=false, children }) { return <button type="button" title={label} aria-label={label} onClick={onClick} className={`grid h-9 w-9 place-items-center rounded-lg ${danger?'text-red-600 hover:bg-red-50':'text-slate-600 hover:bg-slate-100'}`}>{children}</button>; }
function Status({ value }) { return <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-black ${statusClass(value)}`}>{statusLabel(value)}</span>; }
function Pagination({ page, total, onPage }) { const pages=Math.max(1,Math.ceil(total/OFICINA_PAGE_SIZE)); return <div className="flex items-center justify-between text-sm text-slate-600"><span>Exibindo {total?((page-1)*OFICINA_PAGE_SIZE)+1:0} a {Math.min(page*OFICINA_PAGE_SIZE,total)} de {total}</span><div className="flex gap-2"><button type="button" className="secondary" disabled={page<=1} onClick={()=>onPage(page-1)}>Anterior</button><span className="grid min-w-11 place-items-center rounded-lg bg-emerald-600 px-3 font-black text-white">{page}</span><button type="button" className="secondary" disabled={page>=pages} onClick={()=>onPage(page+1)}>Próxima</button></div></div>; }
function Notice({ tone, text, onClose }) { return <div className={`flex items-center justify-between rounded-xl border p-4 text-sm font-bold ${tone==='error'?'border-red-200 bg-red-50 text-red-800':'border-emerald-200 bg-emerald-50 text-emerald-800'}`}><span>{text}</span><button type="button" onClick={onClose} aria-label="Fechar"><XCircle size={18}/></button></div>; }
function dateTime(value) { if(!value)return '-'; return new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Fortaleza'}).format(new Date(value)); }
function normalizeText(value) { return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(); }
function formatCnpj(value) { const digits=String(value||'').replace(/\D/g,''); return digits.length===14?digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,'$1.$2.$3/$4-$5'):(value||'-'); }
function formatKg(value) { return new Intl.NumberFormat('pt-BR',{minimumFractionDigits:0,maximumFractionDigits:3}).format(Number(value||0)); }
function formatMoney(value) { return value === null || value === undefined || value === '' ? '-' : new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(value)); }
function formatSummaryValue(value, suffix) { const number=Number(value||0); return `${formatKg(number)} ${suffix}${suffix==='KG'||number===1?'':'s'}`; }
function statusLabel(value) { return ({SEM_SAIDA:'Sem saída',SAIDA_PARCIAL:'Saída parcial',SAIDA_TOTAL:'Saída total',CANCELADA:'Cancelada',CONFIRMADA:'Confirmada'})[value]||value||'-'; }
function statusClass(value) { if(value==='CANCELADA')return 'bg-red-100 text-red-700'; if(value==='SAIDA_PARCIAL')return 'bg-amber-100 text-amber-700'; if(value==='SEM_SAIDA')return 'bg-sky-100 text-sky-700'; return 'bg-emerald-100 text-emerald-700'; }
