import {
  Check,
  Download,
  Edit,
  Eye,
  FileUp,
  FlaskConical,
  Plus,
  RotateCcw,
  Save,
  Search,
  Trash2,
  Truck,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  approveRecebimento,
  cancelRecebimento,
  createPortariaEntrada,
  createLookup,
  createNotaComplementar,
  createRecebimento,
  deleteLookup,
  deleteNotaComplementar,
  deletePortariaEntrada,
  deleteRecebimento,
  exportRecebimentosCsv,
  findDuplicateRecebimentoNotaFornecedor,
  listLookup,
  listPortariaEntradas,
  listRecebimentos,
  loadBalancasOptions,
  lookupTables,
  rejectRecebimento,
  toUserError,
  updateLookup,
  updateNotaComplementar,
  updatePortariaEntrada,
  updateRecebimento,
} from '../services/balancasService.js';
import { parseNfeRecebimento } from '../lib/nfeRecebimento.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { dateBr, kg } from '../lib/formatters.js';

const tabs = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'portaria', label: 'Portaria' },
  { key: 'laboratorio', label: 'Aprovação Laboratório' },
  { key: 'recebimentos', label: 'Recebimentos' },
  { key: 'relatorios', label: 'Relatórios' },
];

const tabKeys = new Set([...tabs.map((tab) => tab.key), 'cadastros']);

const defaultFilters = {
  dataInicial: '',
  dataFinal: '',
  balancaId: '',
  fornecedorId: '',
  produtoId: '',
  laboratorioId: '',
  status: '',
  origemPortaria: '',
};

const defaultRecebimento = {
  data: todayIso(),
  balanca_id: '',
  laboratorio_id: '',
  veiculo_id: '',
  motorista_id: '',
  transportadora_id: '',
  fornecedor_id: '',
  produto_id: '',
  fornecedor_nome_manual: '',
  produto_nome_manual: '',
  veiculo_placa_manual: '',
  tipo_veiculo: '',
  qtd_eixos: '',
  nf_numero: '',
  nf_chave_acesso: '',
  peso_bruto: '',
  tara: '',
  peso_nf: '',
  quantidade_nota: '',
  unidade_nota: 'KG',
  peso_por_saca: '60',
  umidade: '',
  umidade_01: '',
  umidade_02: '',
  ticket_numero: '',
  liberado_por: '',
  observacao: '',
  valor_unitario: '',
  valor_total: '',
};

const defaultPortariaForm = {
  data_entrada: todayIso(),
  hora_entrada: currentTime(),
  balanca_id: '',
  placa: '',
  veiculo_id: '',
  motorista_id: '',
  fornecedor_id: '',
  cnpj_fornecedor: '',
  produto_id: '',
  numero_nf: '',
  serie_nf: '',
  peso_nf_kg: '',
  transportadora_id: '',
  tipo_veiculo: '',
  qtd_eixos: '',
  observacao: '',
  status: 'AGUARDANDO_LABORATORIO',
};

const defaultLaboratorioForm = {
  data: todayIso(),
  laboratorio_id: '',
  fornecedor_nome_manual: '',
  produto_nome_manual: '',
  veiculo_placa_manual: '',
  nf_numero: '',
  ticket_numero: '',
  umidade: '',
  umidade_01: '',
  umidade_02: '',
  liberado_por: '',
  status: 'aprovada',
  motivo_reprovacao: '',
  observacao: '',
};

export default function BalancasPage() {
  const { can } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const cadastroParam = searchParams.get('cadastro');
  const [activeTab, setActiveTab] = useState(tabKeys.has(tabParam) ? tabParam : 'dashboard');
  const [rows, setRows] = useState([]);
  const [portariaRows, setPortariaRows] = useState([]);
  const [options, setOptions] = useState(emptyOptions());
  const [filters, setFilters] = useState(defaultFilters);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function load(customFilters = filters) {
    setLoading(true);
    setError('');
    try {
      const [nextOptions, nextRows] = await Promise.all([
        loadBalancasOptions(),
        listRecebimentos(customFilters),
      ]);
      setOptions(nextOptions);
      setRows(nextRows);
      setPortariaRows(await listPortariaEntradas());
    } catch (err) {
      setError(toUserError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (tabKeys.has(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  function selectTab(tabKey) {
    setActiveTab(tabKey);
    if (tabKey !== 'relatorios' && filters.origemPortaria) {
      const nextFilters = { ...filters, origemPortaria: '' };
      setFilters(nextFilters);
      load(nextFilters);
    }
    setSearchParams(tabKey === 'dashboard' ? {} : { tab: tabKey });
  }

  function selectCadastro(cadastroKey) {
    setSearchParams({ tab: 'cadastros', cadastro: cadastroKey });
  }

  function applyFilters(event) {
    event?.preventDefault();
    if (filters.dataInicial && filters.dataFinal && filters.dataInicial > filters.dataFinal) {
      setError('A data inicial não pode ser maior que a data final. Como corrigir: ajuste o período e tente novamente.');
      return;
    }
    load(filters);
  }

  function clearFilters() {
    setFilters(defaultFilters);
    load(defaultFilters);
  }

  return (
    <div className="grid gap-5">
      <header>
        <h1 className="text-2xl font-extrabold text-slate-950">Balanças</h1>
        <p className="mt-1 text-sm font-medium text-slate-500">
          Recebimento, pesagem, conferência de NF-e, laboratório e relatórios integrados ao AgroFlow.
        </p>
      </header>

      <div className="flex gap-2 overflow-x-auto rounded-lg border border-slate-200 bg-white p-2 shadow-panel">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => selectTab(tab.key)}
            className={[
              'h-10 shrink-0 rounded-md px-3 text-sm font-bold transition',
              activeTab === tab.key ? 'bg-tijuca-600 text-white' : 'text-slate-600 hover:bg-slate-100',
            ].join(' ')}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {message && <Alert tone="success" text={message} />}
      {error && <Alert tone="error" text={error} />}

      {activeTab === 'dashboard' && <DashboardTab rows={rows} options={options} filters={filters} setFilters={setFilters} applyFilters={applyFilters} clearFilters={clearFilters} loading={loading} />}
      {activeTab === 'portaria' && <PortariaTab rows={portariaRows} options={options} can={can} loading={loading} reload={load} setError={setError} setMessage={setMessage} />}
      {activeTab === 'recebimentos' && <RecebimentosTab rows={rows} options={options} can={can} loading={loading} reload={load} setError={setError} setMessage={setMessage} />}
      {activeTab === 'laboratorio' && <LaboratorioTab rows={rows} options={options} can={can} reload={load} setError={setError} setMessage={setMessage} />}
      {activeTab === 'cadastros' && <CadastrosTab activeCadastro={cadastroParam} onCadastroChange={selectCadastro} can={can} setError={setError} setMessage={setMessage} reloadMain={load} />}
      {activeTab === 'relatorios' && <RelatoriosTab rows={rows} options={options} filters={filters} setFilters={setFilters} applyFilters={applyFilters} clearFilters={clearFilters} can={can} />}
    </div>
  );
}

function DashboardTab({ rows, options, filters, setFilters, applyFilters, clearFilters, loading }) {
  const recebimentosBalanca = useMemo(() => rows.filter(isRecebimentoFinalizadoBalanca), [rows]);
  const aprovadasLaboratorio = useMemo(() => rows.filter(isAprovadaLaboratorio), [rows]);
  const pendentesFinalizar = useMemo(() => rows.filter(isLaboratorioPendenteBalanca), [rows]);
  const metrics = useMemo(() => {
    return {
      cargas: rows.length,
      aprovadasLaboratorio: aprovadasLaboratorio.length,
      kgRecebidos: recebimentosBalanca.reduce((sum, row) => sum + Number(row.peso_liquido || 0), 0),
      recebimentosBalanca: recebimentosBalanca.length,
      pendentesFinalizar: pendentesFinalizar.length,
      reprovadas: rows.filter((row) => row.status === 'reprovada').length,
    };
  }, [aprovadasLaboratorio, pendentesFinalizar, recebimentosBalanca, rows]);

  const bySupplier = groupSupplierSum(recebimentosBalanca, 'peso_liquido').filter((item) => item.value > 0).slice(0, 6);
  const byStatus = useMemo(() => buildDashboardStatus(aprovadasLaboratorio, recebimentosBalanca, pendentesFinalizar), [aprovadasLaboratorio, pendentesFinalizar, recebimentosBalanca]);
  const productsDistribution = useMemo(() => buildProductsDistribution(recebimentosBalanca), [recebimentosBalanca]);
  const supplierDifferences = useMemo(() => buildSupplierDifferences(recebimentosBalanca), [recebimentosBalanca]);
  const supplierMoisture = useMemo(() => buildSupplierMoisture(aprovadasLaboratorio), [aprovadasLaboratorio]);
  const bestSuppliers = useMemo(() => buildBestSuppliersRanking(recebimentosBalanca), [recebimentosBalanca]);

  return (
    <div className="grid gap-5">
      <Filters options={options} filters={filters} setFilters={setFilters} onApply={applyFilters} onClear={clearFilters} />

      {loading ? (
        <div className="grid min-h-40 place-items-center rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-500 shadow-panel">
          Carregando dados de balanças...
        </div>
      ) : (
        <>
          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Metric title="Aprovadas no laboratório" value={metrics.aprovadasLaboratorio} icon={FlaskConical} color={chartColor(1)} />
            <Metric title="Recebimentos na balança" value={metrics.recebimentosBalanca} icon={Truck} color={chartColor(3)} />
            <Metric title="KG recebidos no periodo" value={kg(metrics.kgRecebidos)} icon={Truck} color={chartColor(4)} />
            <Metric title="Pendentes finalizar recebimento" value={metrics.pendentesFinalizar} icon={FlaskConical} color={chartColor(2)} />
          </section>

          <section className="grid gap-5 xl:grid-cols-2">
            <ChartCard title="Volume por fornecedor">
              <BarList data={bySupplier} valueFormatter={kg} />
            </ChartCard>
            <ChartCard title="Status dos recebimentos na balança">
              <BarList data={byStatus} valueFormatter={(value) => `${value} carga(s)`} />
            </ChartCard>
          </section>

          <section className="grid gap-5 xl:grid-cols-2">
            <ChartCard title="Distribuição de Produtos por KG">
              <ProductsPieChart data={productsDistribution} />
            </ChartCard>
            <ChartCard title="Ranking de Diferença em KG por Fornecedor">
              <SupplierDifferenceChart data={supplierDifferences} />
            </ChartCard>
          </section>

          <section className="grid gap-5 xl:grid-cols-2">
            <ChartCard title="Umidade Média por Fornecedor">
              <SupplierMoistureChart data={supplierMoisture} />
            </ChartCard>
            <ChartCard title="Ranking de Melhores Fornecedores">
              <BestSuppliersChart data={bestSuppliers} />
            </ChartCard>
          </section>
        </>
      )}
    </div>
  );
}

function PortariaTab({ rows, options, can, loading, reload, setError, setMessage }) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [form, setForm] = useState(defaultPortariaForm);
  const [fieldErrors, setFieldErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const canCreate = can('balancas', 'cadastrar');
  const canEdit = can('balancas', 'editar');
  const canDelete = can('balancas', 'excluir') || can('balancas', 'cancelar');

  function openNew() {
    setEditing(null);
    setForm(defaultPortariaForm);
    setFieldErrors({});
    setFormOpen(true);
  }

  function openEdit(row) {
    setEditing(row);
    setForm(portariaRowToForm(row));
    setFieldErrors({});
    setFormOpen(true);
  }

  function updateField(name, value) {
    setFieldErrors((current) => {
      if (!current[name]) return current;
      const next = { ...current };
      delete next[name];
      return next;
    });

    setForm((current) => {
      const next = { ...current, [name]: value };
      if (name === 'placa') applyVehicleByPlate(next, value, options);
      if (name === 'fornecedor_id') applySupplier(next, value, options);
      return next;
    });
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    const validation = validatePortariaForm(form, rows, editing?.id);
    if (validation.message) {
      setFieldErrors(validation.fields);
      setError(validation.message);
      return;
    }

    setSaving(true);
    try {
      const payload = normalizePortariaPayload(form);
      if (editing?.id) await updatePortariaEntrada(editing.id, payload);
      else await createPortariaEntrada(payload);
      setMessage(editing?.id ? 'Entrada da portaria atualizada com sucesso.' : 'Entrada da portaria cadastrada com sucesso.');
      setFormOpen(false);
      setEditing(null);
      setForm(defaultPortariaForm);
      await reload();
    } catch (err) {
      setError(toUserError(err));
    } finally {
      setSaving(false);
    }
  }

  async function remove(row) {
    if (!window.confirm(`Excluir a entrada da portaria da NF ${row.numero_nf || row.id}?`)) return;
    try {
      await deletePortariaEntrada(row.id);
      setMessage('Entrada da portaria excluida com sucesso.');
      await reload();
    } catch (err) {
      setError(toUserError(err));
    }
  }

  async function sendToLab(row) {
    if (!window.confirm(`Disponibilizar a NF ${row.numero_nf} para o laboratorio?`)) return;
    try {
      await createRecebimento({
        portaria_id: row.id,
        data: row.data_entrada,
        balanca_id: row.balanca_id,
        veiculo_id: row.veiculo_id,
        motorista_id: row.motorista_id,
        transportadora_id: row.transportadora_id,
        fornecedor_id: row.fornecedor_id,
        produto_id: row.produto_id,
        tipo_veiculo: row.tipo_veiculo,
        qtd_eixos: row.qtd_eixos,
        nf_numero: row.numero_nf,
        peso_nf: row.peso_nf_kg,
        peso_bruto: 0,
        tara: 0,
        status: 'pendente',
        observacao: row.observacao,
      });
      await updatePortariaEntrada(row.id, { status: 'ENVIADO_LABORATORIO' });
      setMessage('Entrada disponibilizada para Aprovação Laboratório.');
      await reload();
    } catch (err) {
      setError(toUserError(err));
    }
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-slate-950">Portaria</h2>
          <p className="text-sm font-medium text-slate-500">Registre a chegada do veículo antes do laboratório e da balança.</p>
        </div>
        {canCreate && (
          <button type="button" onClick={openNew} className="inline-flex h-11 items-center gap-2 rounded-lg bg-tijuca-600 px-4 text-sm font-extrabold text-white hover:bg-tijuca-700">
            <Plus size={17} /> Nova entrada
          </button>
        )}
      </div>

      {formOpen && (
        <form onSubmit={submit} noValidate className="grid gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-panel">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Input label="Data de entrada" type="date" value={form.data_entrada} onChange={(value) => updateField('data_entrada', value)} error={fieldErrors.data_entrada} />
            <Input label="Hora de entrada" type="time" value={form.hora_entrada} onChange={(value) => updateField('hora_entrada', value)} error={fieldErrors.hora_entrada} />
            <Select label="Balança" value={form.balanca_id} onChange={(value) => updateField('balanca_id', value)} options={options.balancas} error={fieldErrors.balanca_id} />
            <Input label="Placa do veículo" value={form.placa} onChange={(value) => updateField('placa', normalizePlate(value))} error={fieldErrors.placa} />
            <Input label="Veículo" value={form.tipo_veiculo} onChange={() => {}} readOnly error={fieldErrors.veiculo_id} />
            <SearchableSelect label="Motorista" value={form.motorista_id} onChange={(value) => updateField('motorista_id', value)} options={options.motoristas} />
            <SearchableSelect label="Transportadora" value={form.transportadora_id} onChange={(value) => updateField('transportadora_id', value)} options={options.transportadoras} />
            <SearchableSelect label="Fornecedor" value={form.fornecedor_id} onChange={(value) => updateField('fornecedor_id', value)} options={options.fornecedores} error={fieldErrors.fornecedor_id} />
            <Input label="CNPJ do fornecedor" value={formatDocument(form.cnpj_fornecedor)} onChange={() => {}} readOnly error={fieldErrors.cnpj_fornecedor} />
            <SearchableSelect label="Produto" value={form.produto_id} onChange={(value) => updateField('produto_id', value)} options={options.produtos} error={fieldErrors.produto_id} />
            <Input label="Número da NF" value={form.numero_nf} onChange={(value) => updateField('numero_nf', onlyDigits(value))} error={fieldErrors.numero_nf} />
            <Input label="Série da NF" value={form.serie_nf} onChange={(value) => updateField('serie_nf', value.slice(0, 10).toUpperCase())} error={fieldErrors.serie_nf} />
            <Input label="Peso - Quantidade" value={form.peso_nf_kg} onChange={(value) => updateField('peso_nf_kg', sanitizeWeightInput(value))} error={fieldErrors.peso_nf_kg} />
            <Input label="Tipo de veículo" value={form.tipo_veiculo} onChange={(value) => updateField('tipo_veiculo', value)} />
            <Input label="Quantidade de eixos" type="number" value={form.qtd_eixos} onChange={(value) => updateField('qtd_eixos', value)} />
          </div>
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            Observação
            <textarea value={form.observacao || ''} onChange={(event) => updateField('observacao', event.target.value)} rows={3} className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-tijuca-500 focus:ring-4 focus:ring-tijuca-100" />
          </label>
          <div className="flex flex-wrap gap-2">
            <button disabled={saving} className="inline-flex h-11 items-center gap-2 rounded-lg bg-tijuca-600 px-5 text-sm font-extrabold text-white hover:bg-tijuca-700 disabled:opacity-60">
              <Save size={17} /> {saving ? 'Salvando...' : 'Salvar entrada'}
            </button>
            <button type="button" onClick={() => setFormOpen(false)} className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50">
              <X size={16} /> Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-panel">
        <table className="min-w-[1180px] w-full text-left text-sm">
          <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              {['Data/Hora', 'Balança', 'Placa', 'Veículo', 'Motorista', 'Fornecedor', 'Produto', 'NF/Série', 'Peso - Quantidade', 'Status', 'Ações'].map((column) => (
                <th key={column} className="px-3 py-3">{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={11} className="px-3 py-8 text-center font-semibold text-slate-500">Carregando portaria...</td></tr>
            ) : rows.length ? rows.map((row) => (
              <tr key={row.id} className="border-b last:border-0">
                <td className="px-3 py-3 font-semibold">{dateBr(row.data_entrada)} {row.hora_entrada?.slice(0, 5) || ''}</td>
                <td className="px-3 py-3">{balancaNome(row, options)}</td>
                <td className="px-3 py-3 font-extrabold">{row.placa}</td>
                <td className="px-3 py-3">{row.tipo_veiculo || row.veiculo?.tipo_veiculo || '-'}</td>
                <td className="px-3 py-3">{row.motorista?.nome || '-'}</td>
                <td className="px-3 py-3">{row.fornecedor?.nome || '-'}</td>
                <td className="px-3 py-3">{row.produto?.nome || '-'}</td>
                <td className="px-3 py-3">{row.numero_nf}/{row.serie_nf}</td>
                <td className="px-3 py-3">{kg(row.peso_nf_kg)}</td>
                <td className="px-3 py-3"><PortariaStatus status={row.status} /></td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setViewing(row)} className="text-slate-600 hover:text-tijuca-700" title="Visualizar"><Eye size={17} /></button>
                    {canEdit && <button type="button" onClick={() => openEdit(row)} className="text-slate-600 hover:text-tijuca-700" title="Editar"><Edit size={17} /></button>}
                    {canCreate && row.status === 'AGUARDANDO_LABORATORIO' && <button type="button" onClick={() => sendToLab(row)} className="text-tijuca-700 hover:text-tijuca-900" title="Enviar para laboratório"><Check size={17} /></button>}
                    {canDelete && <button type="button" onClick={() => remove(row)} className="text-rose-600 hover:text-rose-700" title="Excluir"><Trash2 size={17} /></button>}
                  </div>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={11} className="px-3 py-8 text-center font-semibold text-slate-500">Nenhuma entrada cadastrada.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {viewing && <PortariaViewModal row={viewing} options={options} onClose={() => setViewing(null)} />}
    </div>
  );
}

function PortariaViewModal({ row, options, onClose }) {
  const fields = [
    ['Data/Hora', `${dateBr(row.data_entrada)} ${row.hora_entrada?.slice(0, 5) || ''}`],
    ['Balança', balancaNome(row, options)],
    ['Placa', row.placa],
    ['Veículo', row.tipo_veiculo || row.veiculo?.tipo_veiculo || '-'],
    ['Motorista', row.motorista?.nome || '-'],
    ['Transportadora', row.transportadora?.nome || '-'],
    ['Fornecedor', row.fornecedor?.nome || '-'],
    ['CNPJ', formatDocument(row.cnpj_fornecedor)],
    ['Produto', row.produto?.nome || '-'],
    ['NF/Série', `${row.numero_nf || '-'}/${row.serie_nf || '-'}`],
    ['Peso - Quantidade', kg(row.peso_nf_kg)],
    ['Status', row.status || '-'],
    ['Observação', row.observacao || '-'],
  ];

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
      <div className="w-full max-w-3xl rounded-xl bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-lg font-extrabold text-slate-950">Entrada da Portaria</h2>
            <p className="text-sm font-semibold text-slate-500">NF {row.numero_nf || '-'} - {row.placa || '-'}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={18} /></button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {fields.map(([labelText, value]) => (
            <div key={labelText} className="rounded-lg bg-slate-50 p-3">
              <p className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">{labelText}</p>
              <p className="mt-1 break-words text-sm font-bold text-slate-800">{value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RecebimentosTab({ rows, options, can, loading, reload, setError, setMessage }) {
  const [query, setQuery] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const formRef = useRef(null);

  const filtered = sortRecebimentoRows(filterRecebimentos(rows, query));
  const releasedForScale = sortRecebimentoRows(rows.filter(isLaboratorioPendenteBalanca));

  function newForm() {
    setEditing(null);
    setFormOpen(true);
  }

  function edit(row) {
    setEditing(row);
    setFormOpen(true);
  }

  useEffect(() => {
    if (!formOpen) return;
    window.setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  }, [formOpen, editing?.id]);

  async function remove(row) {
    if (!window.confirm(`Excluir o recebimento da NF ${row.nf_numero || row.id}?`)) return;
    try {
      await deleteRecebimento(row.id);
      setMessage('Recebimento excluído com sucesso.');
      await reload();
    } catch (err) {
      setError(toUserError(err));
    }
  }

  return (
    <div className="grid gap-4">
      {releasedForScale.length > 0 && (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 shadow-panel">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-sm font-extrabold uppercase tracking-wide text-amber-900">Aprovado pelo laboratorio - pendente finalizar recebimento</h2>
              <p className="mt-1 text-sm font-semibold text-amber-800">Clique em preencher balanca para abrir o cadastro abaixo e concluir NF, pesos e balanca.</p>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-extrabold text-amber-800">{releasedForScale.length} carga(s)</span>
          </div>
          <div className="mt-3 grid gap-2">
            {releasedForScale.map((row) => (
              <div key={row.id} className="grid gap-3 rounded-lg border border-amber-100 bg-white p-3 text-sm shadow-sm lg:grid-cols-[1fr_auto] lg:items-center">
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                  <PendingScaleField label="NF" value={row.nf_numero || 'Pendente'} />
                  <PendingScaleField label="Placa" value={placaVeiculo(row)} strong />
                  <PendingScaleField label="Produto" value={produtoNome(row)} />
                  <PendingScaleField label="Fornecedor" value={fornecedorNome(row)} />
                  <PendingScaleField label="Umidade" value={row.umidade ? `${Number(row.umidade).toFixed(2)}%` : '-'} />
                </div>
                {can('balancas', 'editar') && (
                  <button type="button" onClick={() => edit(row)} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-tijuca-600 px-4 text-xs font-extrabold text-white shadow-sm hover:bg-tijuca-700">
                    <Edit size={14} /> Preencher balanca
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-panel md:flex-row md:items-center md:justify-between">
        <label className="flex h-11 min-w-0 items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm text-slate-500 md:min-w-80">
          <Search size={16} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full outline-none" placeholder="Buscar NF, fornecedor, produto ou placa..." />
        </label>
        {can('balancas', 'cadastrar') && (
          <button type="button" onClick={newForm} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-tijuca-600 px-4 text-sm font-extrabold text-white hover:bg-tijuca-700">
            <Plus size={17} /> Novo recebimento
          </button>
        )}
      </div>

      {formOpen && (
        <div ref={formRef} className="scroll-mt-4">
          <RecebimentoForm
            row={editing}
            rows={rows}
            options={options}
            can={can}
            onClose={() => setFormOpen(false)}
            onSaved={async () => {
              setFormOpen(false);
              setMessage(editing ? 'Recebimento atualizado com sucesso.' : 'Recebimento cadastrado com sucesso.');
              await reload();
            }}
            setError={setError}
          />
        </div>
      )}

      {viewing && <RecebimentoViewModal row={viewing} onClose={() => setViewing(null)} />}

      <RecebimentosTable rows={filtered} loading={loading} can={can} onView={setViewing} onEdit={edit} onDelete={remove} />
    </div>
  );
}

function PendingScaleField({ label, value, strong }) {
  return (
    <div className="rounded-md bg-slate-50 px-3 py-2">
      <p className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 break-words text-sm ${strong ? 'font-extrabold text-slate-950' : 'font-bold text-slate-800'}`}>{value || '-'}</p>
    </div>
  );
}

function HumidityReadings({ row }) {
  const first = formatPercent(row.umidade_01);
  const second = formatPercent(row.umidade_02);
  const fallback = formatPercent(row.umidade);
  if (!first && !second) return <span>{fallback || '-'}</span>;

  return (
    <div className="grid gap-1 text-xs font-extrabold text-slate-700">
      {first && <span className="whitespace-nowrap">01: {first}</span>}
      {second && <span className="whitespace-nowrap">02: {second}</span>}
    </div>
  );
}

function reportQuantity(row) {
  if ((row.complementos || []).length > 0 && pesoNotaAgregado(row) > 0) return formatWeightPt(pesoNotaAgregado(row));
  const quantity = row.quantidade_nota ?? row.peso_nf;
  return quantity === null || quantity === undefined || quantity === '' ? '-' : formatWeightPt(quantity);
}

function formatCurrencyCell(value, compact = false) {
  if (value === null || value === undefined || value === '') return '-';
  const decimals = compact ? Math.max(numberDecimalPlaces(value), 2) : 2;
  return `R$ ${compact ? formatMoneyPtCompact(value, decimals) : formatMoneyPt(value, decimals)}`;
}

function humidityText(row) {
  const first = formatPercent(row.umidade_01);
  const second = formatPercent(row.umidade_02);
  if (first && second) return `01: ${first} | 02: ${second}`;
  if (first) return `01: ${first}`;
  if (second) return `02: ${second}`;
  return formatPercent(row.umidade) || '-';
}

function complementosTotal(complementos = []) {
  return (complementos || []).reduce((sum, item) => sum + Number(item.valor_total || 0), 0);
}

function complementoPesoTotal(complementos = []) {
  return (complementos || []).reduce((sum, item) => sum + Number(item.peso_nf || 0), 0);
}

function pesoNotaAgregado(row) {
  return Number(row?.peso_nf || 0) + complementoPesoTotal(row?.complementos);
}

function diferencaAgregada(row) {
  return Number(row?.peso_liquido || 0) - pesoNotaAgregado(row);
}

function valorTotalAgregado(row) {
  return Number(row?.valor_total || 0) + complementosTotal(row?.complementos);
}

function complementosNumeros(row) {
  return (row?.complementos || []).map((item) => item.numero_nf).filter(Boolean).join(', ');
}

function complementoFornecedorNome(complemento) {
  return complemento?.fornecedor?.nome || complemento?.fornecedor_nome || '-';
}

function normalizeComplementoPayload(form) {
  return {
    recebimento_id: form.recebimento_id,
    numero_nf: String(form.numero_nf || '').trim(),
    serie: String(form.serie || '').trim() || null,
    chave_nfe: String(form.chave_nfe || '').trim() || null,
    data_emissao: form.data_emissao || null,
    fornecedor_id: form.fornecedor_id || null,
    fornecedor_nome: form.fornecedor_id ? null : String(form.fornecedor_nome || '').trim() || null,
    quantidade_nota: nullableLocaleNumber(form.quantidade_nota),
    unidade_nota: form.unidade_nota || 'KG',
    peso_por_saca: nullableLocaleNumber(form.peso_por_saca),
    peso_nf: nullableLocaleNumber(form.peso_nf),
    valor_unitario: nullableLocaleNumber(form.valor_unitario),
    valor_total: nullableLocaleNumber(form.valor_total) ?? 0,
    xml_nome_arquivo: form.xml_nome_arquivo || null,
    observacao: String(form.observacao || '').trim() || null,
  };
}

function emptyComplementoForm(recebimentoId = '') {
  return {
    recebimento_id: recebimentoId,
    numero_nf: '',
    serie: '',
    chave_nfe: '',
    data_emissao: todayIso(),
    fornecedor_id: '',
    fornecedor_nome: '',
    quantidade_nota: '',
    unidade_nota: 'KG',
    peso_por_saca: '60',
    peso_nf: '',
    valor_unitario: '',
    valor_total: '',
    xml_nome_arquivo: '',
    observacao: '',
  };
}

function complementoToForm(complemento) {
  return {
    recebimento_id: complemento.recebimento_id || '',
    numero_nf: complemento.numero_nf || '',
    serie: complemento.serie || '',
    chave_nfe: complemento.chave_nfe || '',
    data_emissao: complemento.data_emissao || todayIso(),
    fornecedor_id: complemento.fornecedor_id || '',
    fornecedor_nome: complemento.fornecedor_nome || '',
    quantidade_nota: complemento.quantidade_nota ?? complemento.peso_nf ?? '',
    unidade_nota: complemento.unidade_nota || 'KG',
    peso_por_saca: complemento.peso_por_saca ?? (isSacaUnit(complemento.unidade_nota) ? '60' : ''),
    peso_nf: complemento.peso_nf ?? '',
    valor_unitario: formatMoneyPtCompact(complemento.valor_unitario, Math.max(numberDecimalPlaces(complemento.valor_unitario), 2)),
    valor_total: formatMoneyPt(complemento.valor_total, 2),
    xml_nome_arquivo: complemento.xml_nome_arquivo || '',
    observacao: complemento.observacao || '',
  };
}

function RecebimentoForm({ row, rows = [], options, can, onClose, onSaved, setError }) {
  const [form, setForm] = useState(rowToForm(row));
  const [localOptions, setLocalOptions] = useState(options);
  const [complementos, setComplementos] = useState(row?.complementos || []);
  const [xmlInfo, setXmlInfo] = useState('');
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const canImportXml = !row || isLaboratorioPendenteBalanca(row);
  const canEditComplementos = !can || can('balancas', 'editar') || can('balancas', 'cadastrar');

  useEffect(() => {
    setLocalOptions(options);
  }, [options]);

  useEffect(() => {
    setForm(rowToForm(row));
    setComplementos(row?.complementos || []);
  }, [row]);

  function updateField(name, value) {
    setFieldErrors((current) => {
      if (!current[name]) return current;
      const nextErrors = { ...current };
      delete nextErrors[name];
      return nextErrors;
    });
    setForm((current) => {
      const next = { ...current, [name]: value };
      if (name === 'veiculo_id') {
        const vehicle = localOptions.veiculos.find((item) => item.id === value);
        if (vehicle) {
          next.tipo_veiculo = vehicle.tipo_veiculo || '';
          next.qtd_eixos = vehicle.qtd_eixos || '';
        }
      }
      if (name === 'fornecedor_id' && value) {
        next.fornecedor_nome_manual = '';
      }
      if (name === 'quantidade_nota' || name === 'unidade_nota' || name === 'peso_por_saca') {
        if (isSacaUnit(next.unidade_nota) && !next.peso_por_saca) next.peso_por_saca = '60';
        if (!isSacaUnit(next.unidade_nota)) next.peso_por_saca = '';
        const convertedWeight = normalizarQuantidadeParaKg(next.quantidade_nota, next.unidade_nota, next.peso_por_saca || 60);
        next.peso_nf = convertedWeight === null ? '' : String(convertedWeight);
      }
      if (name === 'peso_nf' || name === 'quantidade_nota' || name === 'unidade_nota' || name === 'peso_por_saca' || name === 'valor_unitario') {
        next.valor_total = calculateValorTotalNotaDisplay(next);
      }
      return next;
    });
  }

  async function importXml(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const parsed = parseNfeRecebimento(await file.text());
      const xmlProduct = resolveNfeProduct(parsed, localOptions.produtos);
      const matchedSupplier = findFornecedorFromNfe(parsed, localOptions.fornecedores);
      const matchedProduct = xmlProduct.product;
      const carrier = findTransportadoraFromNfe(parsed, localOptions.transportadoras);
      const vehicle = findVeiculoFromNfe(parsed, localOptions.veiculos);
      const xmlQuantity = xmlProduct.quantity;
      const xmlUnit = normalizeNotaUnidade(xmlProduct.unit || xmlProduct.item?.unidade || 'KG');
      const xmlPesoPorSaca = isSacaUnit(xmlUnit) ? 60 : '';
      const xmlPesoNotaKg = normalizarQuantidadeParaKg(xmlQuantity, xmlUnit, xmlPesoPorSaca || 60) ?? parsed.pesoLiquidoNf;
      const xmlTotal = xmlProduct.totalValue ?? parsed.valorTotalNota;
      const xmlUnitValue = xmlProduct.unitValue ?? calculateUnitValue(xmlTotal, xmlQuantity);
      const xmlUnitDecimals = xmlProduct.unitDecimalPlaces ?? numberDecimalPlaces(xmlUnitValue);

      setForm((current) => {
        const next = {
          ...current,
          nf_numero: parsed.numero || current.nf_numero,
          nf_chave_acesso: parsed.chaveAcesso || current.nf_chave_acesso,
          data: parsed.dataEmissao || current.data || todayIso(),
          transportadora_id: carrier?.id || current.transportadora_id,
          veiculo_id: vehicle?.id || current.veiculo_id,
          fornecedor_id: matchedSupplier?.id || current.fornecedor_id,
          fornecedor_nome_manual: matchedSupplier?.id ? '' : current.fornecedor_nome_manual,
          produto_id: matchedProduct?.id || '',
          produto_nome_manual: matchedProduct?.id ? '' : '',
          quantidade_nota: xmlQuantity ?? current.quantidade_nota,
          unidade_nota: xmlUnit || current.unidade_nota || 'KG',
          peso_por_saca: isSacaUnit(xmlUnit) ? String(xmlPesoPorSaca || 60) : current.peso_por_saca,
          peso_nf: xmlPesoNotaKg ?? current.peso_nf,
          valor_unitario: formatMoneyPtCompact(xmlUnitValue, displayDecimalPlaces(xmlUnitDecimals, 2)) || current.valor_unitario,
          valor_total: formatMoneyPt(xmlTotal, 2) || current.valor_total,
        };
        if (!next.valor_total) next.valor_total = calculateValorTotalNotaDisplay(next) || current.valor_total;
        return next;
      });
      setXmlInfo([
        `XML importado: NF ${parsed.numero || '-'}`,
        matchedSupplier ? `Fornecedor vinculado pelo CNPJ: ${matchedSupplier.nome}` : 'Fornecedor do XML nao encontrado pelo CNPJ. Selecione o fornecedor cadastrado antes de salvar.',
        matchedProduct ? `Produto vinculado: ${matchedProduct.nome}` : `Produto do XML nao encontrado com seguranca no cadastro (${xmlProduct.item?.nome || 'sem descricao'}). Selecione o produto antes de salvar.`,
        conversionMessage(xmlQuantity, xmlUnit, xmlPesoNotaKg, xmlPesoPorSaca),
        carrier ? `Transportadora vinculada: ${carrier.nome}` : 'Transportadora do XML nao foi cadastrada automaticamente.',
        vehicle ? `Veiculo vinculado pela placa: ${vehicle.placa}` : 'Veiculo do XML nao foi cadastrado automaticamente.',
      ].join(' | '));
    } catch (err) {
      setError(toUserError(err));
    }
  }

  async function submit(event) {
    event.preventDefault();
    const validation = validateRecebimentoForm(form);
    if (validation.message) {
      setFieldErrors(validation.fields);
      setFormError(validation.message);
      setError(validation.message);
      return;
    }

    setFormError('');
    setFieldErrors({});
    setSaving(true);
    try {
      const payload = normalizeRecebimentoPayload({
        ...form,
        ...resolveManualProductFields(form.produto_nome_manual, localOptions.produtos),
      });
      const localDuplicate = findDuplicateRecebimentoRows(rows, payload, row?.id, localOptions);
      if (localDuplicate) {
        const supplierName = localDuplicate.fornecedor?.nome || fornecedorNome(localDuplicate, 'este fornecedor');
        const message = `NF duplicada. Como corrigir: ja existe um recebimento com a NF ${payload.nf_numero} para ${supplierName}, inclusive se ele ainda estiver pendente. Edite o recebimento existente ou confira o numero da NF.`;
        setFieldErrors({ nf_numero: 'NF duplicada', fornecedor_id: 'Fornecedor ja possui esta NF' });
        setFormError(message);
        setError(message);
        setSaving(false);
        return;
      }
      const duplicate = await findDuplicateRecebimentoNotaFornecedor({
        fornecedor_id: payload.fornecedor_id,
        nf_numero: payload.nf_numero,
        excludeId: row?.id,
      });
      if (duplicate) {
        const supplierName = duplicate.fornecedor?.nome || 'este fornecedor';
        const message = `NF duplicada. Como corrigir: ja existe um recebimento com a NF ${payload.nf_numero} para ${supplierName}. Confira a numeracao da nota ou edite o recebimento existente.`;
        setFieldErrors({ nf_numero: 'NF duplicada', fornecedor_id: 'Fornecedor ja possui esta NF' });
        setFormError(message);
        setError(message);
        setSaving(false);
        return;
      }
      let saved;
      if (row?.id) saved = await updateRecebimento(row.id, payload);
      else saved = await createRecebimento({ ...payload, status: 'pendente' });
      const pendingComplementos = complementos.filter((item) => item.__local);
      if (pendingComplementos.length) {
        await Promise.all(pendingComplementos.map((item) => createNotaComplementar({
          ...normalizeComplementoPayload({ ...item, recebimento_id: saved.id }),
          recebimento_id: saved.id,
        })));
      }
      await onSaved();
    } catch (err) {
      setError(toUserError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-panel">
      <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-sm font-extrabold uppercase tracking-wide text-slate-700">{row ? 'Editar recebimento' : 'Novo recebimento'}</h2>
          <p className="mt-1 text-sm text-slate-500">Pesos calculados pelo banco: peso líquido, diferença em KG e diferença percentual.</p>
        </div>
        {canImportXml && (
          <label className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50">
            <FileUp size={17} /> Importar XML da NF-e
            <input type="file" accept=".xml,text/xml,application/xml" onChange={importXml} className="sr-only" />
          </label>
        )}
      </div>

      {xmlInfo && <Alert tone="success" text={xmlInfo} />}
      {formError && <Alert tone="error" text={formError} />}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Input label="Data" type="date" value={form.data} onChange={(value) => updateField('data', value)} required error={fieldErrors.data} />
        <Select label="Balanca" value={form.balanca_id} onChange={(value) => updateField('balanca_id', value)} options={localOptions.balancas} error={fieldErrors.balanca_id} />
        <Select label="Laboratório" value={form.laboratorio_id} onChange={(value) => updateField('laboratorio_id', value)} options={localOptions.laboratorios} />
        <Input label="Numero da NF" value={form.nf_numero} onChange={(value) => updateField('nf_numero', value)} error={fieldErrors.nf_numero} />
        <Select label="Fornecedor" value={form.fornecedor_id} onChange={(value) => updateField('fornecedor_id', value)} options={localOptions.fornecedores} error={fieldErrors.fornecedor_id} />
        <SearchableSelect label="Produto" value={form.produto_id} onChange={(value) => updateField('produto_id', value)} options={localOptions.produtos} fallbackValue={form.produto_nome_manual} error={fieldErrors.produto_id} />
        <SearchableSelect label="Veiculo" value={form.veiculo_id} onChange={(value) => updateField('veiculo_id', value)} options={localOptions.veiculos} labelKey="placa" fallbackValue={form.veiculo_placa_manual} error={fieldErrors.veiculo_id} />
        <SearchableSelect label="Motorista" value={form.motorista_id} onChange={(value) => updateField('motorista_id', value)} options={localOptions.motoristas} />
        <SearchableSelect label="Transportadora" value={form.transportadora_id} onChange={(value) => updateField('transportadora_id', value)} options={localOptions.transportadoras} />
        <Input label="Tipo de veículo" value={form.tipo_veiculo} onChange={(value) => updateField('tipo_veiculo', value)} />
        <Input label="Qtd. eixos" type="number" value={form.qtd_eixos} onChange={(value) => updateField('qtd_eixos', value)} />
        <Input label="Chave da NF-e" value={form.nf_chave_acesso} onChange={(value) => updateField('nf_chave_acesso', value)} />
        <Input label="Peso bruto KG" type="number" step="0.001" value={form.peso_bruto} onChange={(value) => updateField('peso_bruto', value)} required error={fieldErrors.peso_bruto} />
        <Input label="Tara KG" type="number" step="0.001" value={form.tara} onChange={(value) => updateField('tara', value)} required error={fieldErrors.tara} />
        <Input label="Quantidade da nota" type="number" step="0.001" value={form.quantidade_nota} onChange={(value) => updateField('quantidade_nota', value)} />
        <Select label="Unidade da nota" value={form.unidade_nota || 'KG'} onChange={(value) => updateField('unidade_nota', value)} options={[
          { id: 'KG', nome: 'KG' },
          { id: 'SC', nome: 'SC / Saca' },
          { id: 'TON', nome: 'TON / Tonelada' },
        ]} />
        {isSacaUnit(form.unidade_nota) && (
          <Input label="Peso por saca KG" type="number" step="0.001" value={form.peso_por_saca || '60'} onChange={(value) => updateField('peso_por_saca', value)} />
        )}
        <Input label="Peso convertido KG" type="number" step="0.001" value={form.peso_nf} onChange={(value) => updateField('peso_nf', value)} />
        <Input label="Umidade % 01" type="number" step="0.001" value={form.umidade_01} onChange={(value) => updateField('umidade_01', value)} />
        <Input label="Umidade % 02" type="number" step="0.001" value={form.umidade_02} onChange={(value) => updateField('umidade_02', value)} />
        <Input label="Ticket" value={form.ticket_numero} onChange={(value) => updateField('ticket_numero', value)} />
        <Input label="Liberado por" value={form.liberado_por} onChange={(value) => updateField('liberado_por', value)} />
        <MoneyInput label="Valor unitário" placeholder="Ex: 57,00" value={form.valor_unitario} onChange={(value) => updateField('valor_unitario', value)} />
        <MoneyInput label="Valor total" value={form.valor_total} onChange={(value) => updateField('valor_total', value)} />
      </div>

      <NotasComplementaresSection
        recebimentoId={row?.id || ''}
        valorPrincipal={nullableLocaleNumber(form.valor_total) || 0}
        complementos={complementos}
        setComplementos={setComplementos}
        fornecedores={localOptions.fornecedores}
        canEdit={canEditComplementos}
        setError={setError}
      />

      <label className="grid gap-2 text-sm font-semibold text-slate-700">
        Observação
        <textarea value={form.observacao || ''} onChange={(event) => updateField('observacao', event.target.value)} rows={3} className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-tijuca-500 focus:ring-4 focus:ring-tijuca-100" />
      </label>

      <div className="flex flex-wrap gap-2">
        <button disabled={saving} className="inline-flex h-11 items-center gap-2 rounded-lg bg-tijuca-600 px-5 text-sm font-extrabold text-white hover:bg-tijuca-700 disabled:opacity-60">
          <Save size={17} /> {saving ? 'Salvando...' : 'Salvar recebimento'}
        </button>
        <button type="button" onClick={onClose} className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50">
          <X size={16} /> Cancelar
        </button>
      </div>
    </form>
  );
}

function NotasComplementaresSection({ recebimentoId, valorPrincipal, complementos, setComplementos, fornecedores, canEdit, setError }) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyComplementoForm(recebimentoId));
  const [saving, setSaving] = useState(false);
  const [info, setInfo] = useState('');
  const totalComplementos = complementosTotal(complementos);
  const totalAgregado = Number(valorPrincipal || 0) + totalComplementos;

  useEffect(() => {
    setForm((current) => ({ ...current, recebimento_id: recebimentoId }));
  }, [recebimentoId]);

  function updateField(name, value) {
    setForm((current) => {
      const next = { ...current, [name]: value };
      if (name === 'quantidade_nota' || name === 'unidade_nota' || name === 'peso_por_saca') {
        if (isSacaUnit(next.unidade_nota) && !next.peso_por_saca) next.peso_por_saca = '60';
        if (!isSacaUnit(next.unidade_nota)) next.peso_por_saca = '';
        const convertedWeight = normalizarQuantidadeParaKg(next.quantidade_nota, next.unidade_nota, next.peso_por_saca || 60);
        next.peso_nf = convertedWeight === null ? '' : String(convertedWeight);
      }
      if (name === 'quantidade_nota' || name === 'unidade_nota' || name === 'peso_por_saca' || name === 'valor_unitario') {
        next.valor_total = calculateValorTotalNotaDisplay(next);
      }
      return next;
    });
  }

  function startNew() {
    setEditingId(null);
    setForm(emptyComplementoForm(recebimentoId));
    setInfo('');
    setOpen(true);
  }

  function startEdit(complemento) {
    setEditingId(complemento.id);
    setForm(complementoToForm(complemento));
    setInfo('');
    setOpen(true);
  }

  async function importComplementXml(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const parsed = parseNfeRecebimento(await file.text());
      const xmlProduct = resolveNfeProduct(parsed, []);
      const matchedSupplier = findFornecedorFromNfe(parsed, fornecedores);
      const totalValue = parsed.valorTotalNota ?? xmlProduct.totalValue;
      const quantity = xmlProduct.quantity ?? parsed.pesoLiquidoNf;
      const unit = normalizeNotaUnidade(xmlProduct.unit || xmlProduct.item?.unidade || 'KG');
      const pesoPorSaca = isSacaUnit(unit) ? 60 : '';
      const convertedWeight = normalizarQuantidadeParaKg(quantity, unit, pesoPorSaca || 60) ?? parsed.pesoLiquidoNf;
      const unitValue = xmlProduct.unitValue ?? calculateUnitValue(totalValue, quantity);
      setForm((current) => ({
        ...current,
        numero_nf: parsed.numero || current.numero_nf,
        serie: parsed.serie || current.serie,
        chave_nfe: parsed.chaveAcesso || current.chave_nfe,
        data_emissao: parsed.dataEmissao || current.data_emissao,
        fornecedor_id: matchedSupplier?.id || current.fornecedor_id,
        fornecedor_nome: matchedSupplier?.id ? '' : parsed.emitente?.nome || current.fornecedor_nome,
        quantidade_nota: quantity ?? current.quantidade_nota,
        unidade_nota: unit || current.unidade_nota || 'KG',
        peso_por_saca: isSacaUnit(unit) ? String(pesoPorSaca || 60) : '',
        peso_nf: convertedWeight ?? current.peso_nf,
        valor_unitario: formatMoneyPtCompact(unitValue, Math.max(numberDecimalPlaces(unitValue), 2)) || current.valor_unitario,
        valor_total: formatMoneyPt(totalValue, 2) || current.valor_total,
        xml_nome_arquivo: file.name,
      }));
      setInfo(`XML complementar importado: NF ${parsed.numero || '-'}${matchedSupplier ? ` | fornecedor: ${matchedSupplier.nome}` : ''}`);
    } catch (err) {
      setError(toUserError(err));
    }
  }

  async function saveComplemento() {
    const payload = normalizeComplementoPayload(form);
    if (!payload.numero_nf) {
      setError('Informe o numero da NF complementar. Como corrigir: preencha o campo Numero da NF complementar.');
      return;
    }
    if (payload.valor_total === null || payload.valor_total === undefined || payload.valor_total < 0) {
      setError('Informe um valor total valido para a NF complementar.');
      return;
    }

    setSaving(true);
    try {
      if (!recebimentoId) {
        const localItem = {
          ...payload,
          id: editingId || `local-${Date.now()}`,
          __local: true,
          fornecedor: fornecedores.find((item) => item.id === payload.fornecedor_id) || null,
        };
        setComplementos((current) => editingId
          ? current.map((item) => item.id === editingId ? localItem : item)
          : [...current, localItem]);
      } else if (editingId) {
        const saved = await updateNotaComplementar(editingId, { ...payload, recebimento_id: recebimentoId });
        setComplementos((current) => current.map((item) => item.id === editingId ? saved : item));
      } else {
        const saved = await createNotaComplementar({ ...payload, recebimento_id: recebimentoId });
        setComplementos((current) => [...current, saved]);
      }
      setOpen(false);
      setEditingId(null);
      setForm(emptyComplementoForm(recebimentoId));
      setInfo('');
    } catch (err) {
      setError(toUserError(err));
    } finally {
      setSaving(false);
    }
  }

  async function removeComplemento(complemento) {
    if (!window.confirm(`Excluir a NF complementar ${complemento.numero_nf || '-'}?`)) return;
    try {
      if (!complemento.__local) await deleteNotaComplementar(complemento.id);
      setComplementos((current) => current.filter((item) => item.id !== complemento.id));
    } catch (err) {
      setError(toUserError(err));
    }
  }

  return (
    <section className="grid gap-3 rounded-lg border border-amber-200 bg-amber-50/60 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="text-sm font-extrabold uppercase tracking-wide text-slate-800">Notas Complementares</h3>
          <p className="mt-1 text-sm text-slate-600">Vincule NFs de complemento sem alterar a NF principal, pesos, tara ou umidade.</p>
        </div>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={startNew} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-tijuca-600 px-4 text-sm font-extrabold text-white hover:bg-tijuca-700">
              <Plus size={16} /> Adicionar nota complementar
            </button>
            <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50">
              <FileUp size={16} /> Importar XML da nota complementar
              <input type="file" accept=".xml,text/xml,application/xml" onChange={(event) => { startNew(); importComplementXml(event); }} className="sr-only" />
            </label>
          </div>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <SummaryMiniCard label="Valor total principal" value={`R$ ${formatMoneyPt(valorPrincipal, 2)}`} />
        <SummaryMiniCard label="Total complementos" value={`R$ ${formatMoneyPt(totalComplementos, 2)}`} />
        <SummaryMiniCard label="Valor total agregado" value={`R$ ${formatMoneyPt(totalAgregado, 2)}`} strong />
      </div>

      {open && (
        <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-3">
          {info && <Alert tone="success" text={info} />}
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Input label="Numero da NF complementar" value={form.numero_nf} onChange={(value) => updateField('numero_nf', value)} required />
            <Input label="Serie" value={form.serie} onChange={(value) => updateField('serie', value)} />
            <Input label="Data de emissao" type="date" value={form.data_emissao} onChange={(value) => updateField('data_emissao', value)} />
            <Select label="Fornecedor" value={form.fornecedor_id} onChange={(value) => updateField('fornecedor_id', value)} options={fornecedores} />
            <Input label="Fornecedor do XML" value={form.fornecedor_nome} onChange={(value) => updateField('fornecedor_nome', value)} />
            <Input label="Chave da NF-e complementar" value={form.chave_nfe} onChange={(value) => updateField('chave_nfe', value)} />
            <Input label="Quantidade da NF complementar" type="number" step="0.001" value={form.quantidade_nota} onChange={(value) => updateField('quantidade_nota', value)} />
            <Select label="Unidade da NF complementar" value={form.unidade_nota || 'KG'} onChange={(value) => updateField('unidade_nota', value)} options={[
              { id: 'KG', nome: 'KG' },
              { id: 'SC', nome: 'SC / Saca' },
              { id: 'TON', nome: 'TON / Tonelada' },
            ]} />
            {isSacaUnit(form.unidade_nota) && (
              <Input label="Peso por saca KG" type="number" step="0.001" value={form.peso_por_saca || '60'} onChange={(value) => updateField('peso_por_saca', value)} />
            )}
            <Input label="Peso convertido KG" type="number" step="0.001" value={form.peso_nf} onChange={(value) => updateField('peso_nf', value)} />
            <MoneyInput label="Valor unitario" placeholder="Ex: 57,00" value={form.valor_unitario} onChange={(value) => updateField('valor_unitario', value)} />
            <MoneyInput label="Valor total da NF complementar" value={form.valor_total} onChange={(value) => updateField('valor_total', value)} />
          </div>
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            Observacao
            <textarea value={form.observacao || ''} onChange={(event) => updateField('observacao', event.target.value)} rows={2} className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-tijuca-500 focus:ring-4 focus:ring-tijuca-100" />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={saving} onClick={saveComplemento} className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-extrabold text-white hover:bg-slate-800 disabled:opacity-60">
              <Save size={16} /> {saving ? 'Salvando...' : 'Salvar complemento'}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50">
              <X size={16} /> Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full min-w-[920px] text-left text-sm">
          <thead className="text-xs font-bold uppercase text-slate-500">
            <tr>
              {['NF complementar', 'Serie', 'Emissao', 'Fornecedor', 'Peso', 'Valor unit.', 'Valor complemento', 'Chave NF-e', 'Observacao', 'Acoes'].map((head) => <th key={head} className="border-b px-3 py-2">{head}</th>)}
            </tr>
          </thead>
          <tbody>
            {complementos.map((item) => (
              <tr key={item.id} className="border-b last:border-b-0">
                <td className="px-3 py-2 font-bold">{item.numero_nf || '-'}</td>
                <td className="px-3 py-2">{item.serie || '-'}</td>
                <td className="px-3 py-2">{dateBr(item.data_emissao)}</td>
                <td className="px-3 py-2">{complementoFornecedorNome(item)}</td>
                <td className="px-3 py-2">{item.peso_nf ? kg(item.peso_nf) : '-'}</td>
                <td className="px-3 py-2">{formatCurrencyCell(item.valor_unitario, true)}</td>
                <td className="px-3 py-2 font-bold">{formatCurrencyCell(item.valor_total)}</td>
                <td className="max-w-[160px] truncate px-3 py-2" title={item.chave_nfe || ''}>{item.chave_nfe || '-'}</td>
                <td className="max-w-[180px] truncate px-3 py-2" title={item.observacao || ''}>{item.observacao || '-'}</td>
                <td className="px-3 py-2">
                  {canEdit && (
                    <div className="flex gap-1">
                      <button type="button" onClick={() => startEdit(item)} className="grid h-8 w-8 place-items-center rounded-lg text-slate-600 hover:bg-slate-100" title="Editar complemento"><Edit size={15} /></button>
                      <button type="button" onClick={() => removeComplemento(item)} className="grid h-8 w-8 place-items-center rounded-lg text-rose-600 hover:bg-rose-50" title="Excluir complemento"><Trash2 size={15} /></button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!complementos.length && <p className="p-4 text-center text-sm font-semibold text-slate-500">Nenhuma nota complementar vinculada.</p>}
      </div>
    </section>
  );
}

function SummaryMiniCard({ label, value, strong }) {
  return (
    <div className={`rounded-lg border p-3 ${strong ? 'border-tijuca-200 bg-tijuca-50' : 'border-slate-200 bg-white'}`}>
      <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-black text-slate-950">{value}</p>
    </div>
  );
}

function RecebimentoViewModal({ row, onClose }) {
  const details = [
    ['Data', dateBr(row.data)],
    ['Status', recebimentoStatusLabel(row)],
    ['NF', row.nf_numero || '-'],
    ['Chave NF-e', row.nf_chave_acesso || '-'],
    ['Balança', row.balanca?.nome || '-'],
    ['Laboratório', row.laboratorio?.nome || '-'],
    ['Fornecedor', fornecedorNome(row)],
    ['Produto', produtoNome(row)],
    ['Veículo / placa', placaVeiculo(row)],
    ['Motorista', row.motorista?.nome || '-'],
    ['Transportadora', row.transportadora?.nome || '-'],
    ['Tipo de veículo', row.tipo_veiculo || '-'],
    ['Qtd. eixos', row.qtd_eixos || '-'],
    ['Peso bruto', kg(row.peso_bruto)],
    ['Tara', kg(row.tara)],
    ['Peso líquido', kg(row.peso_liquido)],
    ['Peso - Quantidade', pesoNotaAgregado(row) ? kg(pesoNotaAgregado(row)) : '-'],
    ['Diferenca com complemento', kg(diferencaAgregada(row))],
    ['Diferença original', kg(row.diferenca_kg)],
    ['Diferença %', row.diferenca_pct !== null && row.diferenca_pct !== undefined ? `${Number(row.diferenca_pct).toFixed(2)}%` : '-'],
    ['Umidade 01', row.umidade_01 ? `${Number(row.umidade_01).toFixed(2)}%` : '-'],
    ['Umidade 02', row.umidade_02 ? `${Number(row.umidade_02).toFixed(2)}%` : '-'],
    ['Ticket', row.ticket_numero || '-'],
    ['Liberado por', row.liberado_por || '-'],
    ['Valor unitário', row.valor_unitario === null || row.valor_unitario === undefined ? '-' : `R$ ${formatMoneyPtCompact(row.valor_unitario, Math.max(numberDecimalPlaces(row.valor_unitario), 2))}`],
    ['Valor total principal', row.valor_total === null || row.valor_total === undefined ? '-' : `R$ ${formatMoneyPt(row.valor_total, 2)}`],
    ['Total complementos', `R$ ${formatMoneyPt(complementosTotal(row.complementos), 2)}`],
    ['Valor total agregado', `R$ ${formatMoneyPt(valorTotalAgregado(row), 2)}`],
    ['Motivo reprovação', row.motivo_reprovacao || '-'],
    ['Motivo cancelamento', row.motivo_cancelamento || '-'],
    ['Observação', row.observacao || '-'],
  ];

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
      <section className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-xl bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 p-4">
          <div>
            <h2 className="text-lg font-extrabold text-slate-950">Visualizar recebimento</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">NF {row.nf_numero || '-'} - {fornecedorNome(row, 'Fornecedor nao informado')}</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg text-slate-600 hover:bg-slate-100">
            <X size={18} />
          </button>
        </header>
        <div className="max-h-[72vh] overflow-y-auto p-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {details.map(([label, value]) => (
              <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">{label}</p>
                <p className="mt-1 break-words text-sm font-bold text-slate-900">{value}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-200 p-3">
              <h3 className="text-sm font-extrabold uppercase tracking-wide text-slate-700">Notas complementares</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="text-xs font-bold uppercase text-slate-500">
                  <tr>{['NF complementar', 'Serie', 'Emissao', 'Fornecedor', 'Valor', 'Chave', 'Observacao'].map((head) => <th key={head} className="border-b px-3 py-2">{head}</th>)}</tr>
                </thead>
                <tbody>
                  {(row.complementos || []).map((item) => (
                    <tr key={item.id} className="border-b last:border-b-0">
                      <td className="px-3 py-2 font-bold">{item.numero_nf || '-'}</td>
                      <td className="px-3 py-2">{item.serie || '-'}</td>
                      <td className="px-3 py-2">{dateBr(item.data_emissao)}</td>
                      <td className="px-3 py-2">{complementoFornecedorNome(item)}</td>
                      <td className="px-3 py-2 font-bold">{formatCurrencyCell(item.valor_total)}</td>
                      <td className="max-w-[160px] truncate px-3 py-2" title={item.chave_nfe || ''}>{item.chave_nfe || '-'}</td>
                      <td className="px-3 py-2">{item.observacao || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!(row.complementos || []).length && <p className="p-4 text-center text-sm font-semibold text-slate-500">Nenhuma nota complementar vinculada.</p>}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function LaboratorioTab({ rows, options, can, reload, setError, setMessage }) {
  const [edits, setEdits] = useState({});
  const [reason, setReason] = useState({});
  const [labForm, setLabForm] = useState(defaultLaboratorioForm);
  const [editingLabId, setEditingLabId] = useState(null);
  const [savingLab, setSavingLab] = useState(false);
  const pending = sortRecebimentoRows(rows.filter((row) => row.status === 'pendente'));
  const analyzed = sortRecebimentoRows(rows.filter((row) => row.status === 'aprovada' || row.status === 'reprovada'));

  function updateEdit(id, field, value) {
    setEdits((current) => ({ ...current, [id]: { ...current[id], [field]: value } }));
  }

  async function process(row, action) {
    const edit = edits[row.id] || {};
    try {
      if (action === 'aprovar') {
        await approveRecebimento(row.id, {
          nf_numero: edit.nf_numero || row.nf_numero,
          ticket_numero: edit.ticket_numero || row.ticket_numero,
          umidade_01: edit.umidade_01 ?? row.umidade_01,
          umidade_02: edit.umidade_02 ?? row.umidade_02,
          umidade: resolveHumidityValue(edit, row),
          liberado_por: edit.liberado_por || row.liberado_por,
        });
        setMessage('Carga aprovada pelo laboratorio.');
      }
      if (action === 'reprovar') {
        const motivo = reason[row.id]?.trim();
        if (!motivo) {
          setError('Informe o motivo da reprovacao. Como corrigir: escreva o motivo no campo Motivo e tente novamente.');
          return;
        }
        await rejectRecebimento(row.id, {
          motivo_reprovacao: motivo,
          nf_numero: edit.nf_numero || row.nf_numero,
          ticket_numero: edit.ticket_numero || row.ticket_numero,
          umidade_01: edit.umidade_01 ?? row.umidade_01,
          umidade_02: edit.umidade_02 ?? row.umidade_02,
          umidade: resolveHumidityValue(edit, row),
          liberado_por: edit.liberado_por || row.liberado_por,
        });
        setMessage('Carga reprovada com motivo registrado.');
      }
      if (action === 'cancelar') {
        const motivo = reason[row.id]?.trim();
        if (!motivo) {
          setError('Informe o motivo do cancelamento. Como corrigir: escreva o motivo no campo Motivo e tente novamente.');
          return;
        }
        await cancelRecebimento(row.id, motivo);
        setMessage('Carga cancelada com motivo registrado.');
      }
      await reload();
    } catch (err) {
      setError(toUserError(err));
    }
  }

  function updateLabForm(field, value) {
    setLabForm((current) => ({ ...current, [field]: value }));
  }

  function editLab(row) {
    setEditingLabId(row.id);
    setLabForm(rowToLaboratorioForm(row));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelLabEdit() {
    setEditingLabId(null);
    setLabForm({ ...defaultLaboratorioForm, data: todayIso() });
  }

  async function removeLab(row) {
    if (!window.confirm(`Excluir a liberacao do laboratorio da NF ${row.nf_numero || row.id}?`)) return;
    try {
      await deleteRecebimento(row.id);
      setMessage('Liberacao do laboratorio excluida com sucesso.');
      if (editingLabId === row.id) cancelLabEdit();
      await reload();
    } catch (err) {
      setError(toUserError(err));
    }
  }

  async function saveManualRelease(event) {
    event.preventDefault();
    setError('');

    if (!labForm.veiculo_placa_manual?.trim() || !labForm.fornecedor_nome_manual?.trim() || !labForm.produto_nome_manual?.trim()) {
      setError('Informe veiculo, fornecedor e produto para liberar a carga. Como corrigir: preencha os tres campos obrigatorios e tente novamente.');
      return;
    }
    if (labForm.status === 'reprovada' && !labForm.motivo_reprovacao?.trim()) {
      setError('Informe o motivo da reprovacao. Como corrigir: preencha o motivo quando marcar o resultado como reprovado.');
      return;
    }

    setSavingLab(true);
    try {
      const payload = {
        ...normalizeRecebimentoPayload({
          ...defaultRecebimento,
          ...labForm,
          ...resolveManualProductFields(labForm.produto_nome_manual, options.produtos),
          peso_bruto: 0,
          tara: 0,
          peso_nf: '',
        }),
        status: labForm.status || 'aprovada',
        motivo_reprovacao: labForm.status === 'reprovada' ? labForm.motivo_reprovacao : null,
      };
      if (editingLabId) await updateRecebimento(editingLabId, payload);
      else await createRecebimento(payload);
      setEditingLabId(null);
      setLabForm({ ...defaultLaboratorioForm, data: todayIso() });
      setMessage(editingLabId
        ? 'Liberacao do laboratorio atualizada com sucesso.'
        : labForm.status === 'reprovada'
          ? 'Reprovacao do laboratorio salva. A carga ficou registrada como reprovada.'
          : 'Aprovacao do laboratorio salva. A carga ja aparece em Recebimentos como pendencia de balanca.');
      await reload();
    } catch (err) {
      setError(toUserError(err));
    } finally {
      setSavingLab(false);
    }
  }

  if (!can('balancas', 'aprovar') && !can('balancas', 'cancelar')) {
    return <Alert tone="error" text="Voce nao tem permissao para aprovar, reprovar ou cancelar cargas de laboratorio." />;
  }

  return (
    <div className="grid gap-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-panel">
        <h2 className="text-sm font-extrabold uppercase tracking-wide text-slate-700">Liberacao de laboratorio</h2>
        <p className="mt-1 text-sm text-slate-500">
          Primeiro faca a analise do laboratorio. Depois de aprovada, a carga fica liberada para seguir o fluxo de balanca e pode gerar a etiqueta em PDF.
        </p>
      </div>

      <form onSubmit={saveManualRelease} className="grid gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-panel">
        <div>
          <h2 className="text-sm font-extrabold uppercase tracking-wide text-slate-700">{editingLabId ? 'Editar liberacao do laboratorio' : 'Nova liberacao manual'}</h2>
          <p className="mt-1 text-sm text-slate-500">Use quando o grão chegar primeiro no laboratório. A balança completa NF-e, pesos e dados finais depois.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Input label="Data" type="date" value={labForm.data} onChange={(value) => updateLabForm('data', value)} required />
          <Select label="Laboratório" value={labForm.laboratorio_id} onChange={(value) => updateLabForm('laboratorio_id', value)} options={options.laboratorios} />
          <Input label="Fornecedor" value={labForm.fornecedor_nome_manual} onChange={(value) => updateLabForm('fornecedor_nome_manual', value)} required />
          <Input label="Produto" value={labForm.produto_nome_manual} onChange={(value) => updateLabForm('produto_nome_manual', value)} required />
          <Input label="Veiculo / placa" value={labForm.veiculo_placa_manual} onChange={(value) => updateLabForm('veiculo_placa_manual', value)} required />
          <Input label="Número da NF (opcional)" value={labForm.nf_numero} onChange={(value) => updateLabForm('nf_numero', onlyDigits(value))} />
          <Input label="Ticket" value={labForm.ticket_numero} onChange={(value) => updateLabForm('ticket_numero', value)} />
          <Input label="Umidade % 01" type="number" step="0.001" value={labForm.umidade_01} onChange={(value) => updateLabForm('umidade_01', value)} />
          <Input label="Umidade % 02" type="number" step="0.001" value={labForm.umidade_02} onChange={(value) => updateLabForm('umidade_02', value)} />
          <Input label="Liberado por" value={labForm.liberado_por} onChange={(value) => updateLabForm('liberado_por', value)} />
          <Select label="Resultado" value={labForm.status} onChange={(value) => updateLabForm('status', value)} options={[
            { id: 'aprovada', nome: 'Aprovado' },
            { id: 'reprovada', nome: 'Reprovado' },
          ]} required />
        </div>
        {labForm.status === 'reprovada' && (
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            Motivo da reprovacao
            <textarea value={labForm.motivo_reprovacao || ''} onChange={(event) => updateLabForm('motivo_reprovacao', event.target.value)} rows={2} className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-tijuca-500 focus:ring-4 focus:ring-tijuca-100" />
          </label>
        )}
        <label className="grid gap-2 text-sm font-semibold text-slate-700">
          Observação do laboratório
          <textarea value={labForm.observacao || ''} onChange={(event) => updateLabForm('observacao', event.target.value)} rows={3} className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-tijuca-500 focus:ring-4 focus:ring-tijuca-100" />
        </label>
        <div className="flex flex-wrap gap-2">
          <button disabled={savingLab} className="inline-flex h-11 items-center gap-2 rounded-lg bg-tijuca-600 px-5 text-sm font-extrabold text-white hover:bg-tijuca-700 disabled:opacity-60">
            <Save size={17} /> {savingLab ? 'Salvando...' : editingLabId ? 'Atualizar liberacao do laboratorio' : 'Salvar liberacao do laboratorio'}
          </button>
          {editingLabId && (
            <button type="button" onClick={cancelLabEdit} className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50">
              <X size={16} /> Cancelar edicao
            </button>
          )}
        </div>
      </form>

      <section className="grid gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-extrabold uppercase tracking-wide text-slate-700">Cargas pendentes ({pending.length})</h2>
          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">Aguardando analise</span>
        </div>

        {pending.map((row) => (
          <LaboratoryReleaseCard
            key={row.id}
            row={row}
            edit={edits[row.id] || {}}
            reason={reason[row.id] || ''}
            can={can}
            onEdit={updateEdit}
            onReason={(value) => setReason((current) => ({ ...current, [row.id]: value }))}
            onProcess={process}
            onEditLab={editLab}
            onDeleteLab={removeLab}
          />
        ))}

        {!pending.length && (
          <div className="rounded-lg border border-slate-200 bg-white p-6 text-center text-sm font-semibold text-slate-500 shadow-panel">
            Nenhuma carga pendente para laboratorio.
          </div>
        )}
      </section>

      <section className="grid gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-extrabold uppercase tracking-wide text-slate-700">Cargas analisadas ({analyzed.length})</h2>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">Aprovadas e reprovadas</span>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-panel">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="text-xs font-bold uppercase text-slate-500">
              <tr>
                {['Data', 'NF', 'Fornecedor', 'Produto', 'Placa', 'Ticket', 'Umidade', 'Liberado por', 'Status', 'Peso liquido', 'PDF', 'Acoes'].map((head) => <th key={head} className="border-b px-3 py-3">{head}</th>)}
              </tr>
            </thead>
            <tbody>
              {analyzed.map((row) => (
                <tr key={row.id} className="border-b last:border-0">
                  <td className="px-3 py-3">{dateBr(row.data)}</td>
                  <td className="px-3 py-3">{row.nf_numero || '-'}</td>
                  <td className="px-3 py-3 font-semibold text-slate-800">{fornecedorNome(row)}</td>
                  <td className="px-3 py-3">{produtoNome(row)}</td>
                  <td className="px-3 py-3">{placaVeiculo(row)}</td>
                  <td className="px-3 py-3">{row.ticket_numero || '-'}</td>
                  <td className="px-3 py-3"><HumidityReadings row={row} /></td>
                  <td className="px-3 py-3">{row.liberado_por || '-'}</td>
                  <td className="px-3 py-3"><StatusBadge row={row} /></td>
                  <td className="px-3 py-3">{kg(row.peso_liquido)}</td>
                  <td className="px-3 py-3">
                    <button type="button" onClick={() => exportLaboratoryReleasePdf(row)} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 px-3 text-xs font-bold text-slate-700 hover:bg-slate-50">
                      <Download size={14} /> Baixar PDF
                    </button>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex gap-1">
                      {can('balancas', 'editar') && <button type="button" onClick={() => editLab(row)} className="grid h-9 w-9 place-items-center rounded-lg text-slate-600 hover:bg-slate-100" title="Editar"><Edit size={16} /></button>}
                      {can('balancas', 'excluir') && <button type="button" onClick={() => removeLab(row)} className="grid h-9 w-9 place-items-center rounded-lg text-rose-600 hover:bg-rose-50" title="Excluir"><Trash2 size={16} /></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!analyzed.length && <p className="p-6 text-center text-sm font-semibold text-slate-500">Nenhuma carga analisada nos filtros atuais.</p>}
        </div>
      </section>
    </div>
  );
}

function LaboratoryReleaseCard({ row, edit, reason, can, onEdit, onReason, onProcess, onEditLab, onDeleteLab }) {
  return (
    <article className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-panel">
      <div className="grid gap-3 border-b bg-slate-50 p-4 lg:grid-cols-[150px_1fr_190px] lg:items-center">
        <div className="rounded-lg bg-slate-900 px-4 py-3 text-center text-lg font-extrabold text-white">AgroFlow</div>
        <div className="text-center">
          <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">Procedimento operacional padrao</p>
          <h3 className="text-base font-extrabold uppercase text-slate-900">Controle de qualidade de materia-prima</h3>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-2 text-xs font-bold text-slate-600">
          <p>Etiqueta de liberacao</p>
          <p>Versao 05</p>
        </div>
      </div>

      <div className="grid border-b text-sm md:grid-cols-2 xl:grid-cols-4">
        <LabCell label="Data" value={dateBr(row.data)} />
        <LabCell label="Produto" value={produtoNome(row)} />
        <LabCell label="Placa" value={placaVeiculo(row)} />
        <LabCell label="Fornecedor" value={fornecedorNome(row)} />
      </div>

      <div className="grid gap-3 p-4 lg:grid-cols-6">
        <SmallField label="Número da NF">
          <SmallInput value={edit.nf_numero ?? row.nf_numero ?? ''} onChange={(value) => onEdit(row.id, 'nf_numero', onlyDigits(value))} />
        </SmallField>
        <SmallField label="Ticket">
          <SmallInput value={edit.ticket_numero ?? row.ticket_numero ?? ''} onChange={(value) => onEdit(row.id, 'ticket_numero', value)} />
        </SmallField>
        <SmallField label="Umidade 01 (%)">
          <SmallInput type="number" value={edit.umidade_01 ?? row.umidade_01 ?? ''} onChange={(value) => onEdit(row.id, 'umidade_01', value)} />
        </SmallField>
        <SmallField label="Umidade 02 (%)">
          <SmallInput type="number" value={edit.umidade_02 ?? row.umidade_02 ?? ''} onChange={(value) => onEdit(row.id, 'umidade_02', value)} />
        </SmallField>
        <SmallField label="Liberado por">
          <SmallInput value={edit.liberado_por ?? row.liberado_por ?? ''} onChange={(value) => onEdit(row.id, 'liberado_por', value)} />
        </SmallField>
        <SmallField label="Peso liquido">
          <div className="flex h-9 items-center rounded-md border border-slate-200 bg-slate-50 px-2 text-xs font-bold text-slate-700">{kg(row.peso_liquido)}</div>
        </SmallField>
        <div className="lg:col-span-5">
          <label className="grid gap-1 text-xs font-bold text-slate-600">
            Motivo para reprovar ou cancelar
            <textarea value={reason} onChange={(event) => onReason(event.target.value)} rows={2} className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs outline-none focus:border-tijuca-500" placeholder="Obrigatorio para reprovar/cancelar" />
          </label>
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t bg-slate-50 p-4 sm:flex-row sm:justify-end">
        {can('balancas', 'editar') && <button type="button" onClick={() => onEditLab(row)} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-bold text-slate-700 hover:bg-white"><Edit size={16} /> Editar</button>}
        {can('balancas', 'excluir') && <button type="button" onClick={() => onDeleteLab(row)} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-rose-300 px-4 text-sm font-bold text-rose-700 hover:bg-rose-50"><Trash2 size={16} /> Excluir</button>}
        {can('balancas', 'aprovar') && <button type="button" onClick={() => onProcess(row, 'aprovar')} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-bold text-white"><Check size={16} /> Aprovar e liberar</button>}
        {can('balancas', 'aprovar') && <button type="button" onClick={() => onProcess(row, 'reprovar')} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-amber-300 px-4 text-sm font-bold text-amber-700 hover:bg-amber-50"><X size={16} /> Reprovar</button>}
        {can('balancas', 'cancelar') && <button type="button" onClick={() => onProcess(row, 'cancelar')} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-rose-300 px-4 text-sm font-bold text-rose-700 hover:bg-rose-50"><X size={16} /> Cancelar</button>}
      </div>
    </article>
  );
}

function LabCell({ label, value }) {
  return (
    <div className="border-b border-r border-slate-200 p-3 last:border-r-0 md:border-b-0">
      <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 min-h-6 text-sm font-bold text-slate-900">{value}</p>
    </div>
  );
}

function SmallField({ label, children }) {
  return (
    <label className="grid gap-1 text-xs font-bold text-slate-600">
      {label}
      {children}
    </label>
  );
}

function exportLaboratoryReleasePdf(row) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a5' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 24;
  const width = pageWidth - margin * 2;
  let y = 24;

  doc.setDrawColor(30, 41, 59);
  doc.setLineWidth(1);
  doc.rect(margin, y, width, pageHeight - margin * 2);

  doc.setFillColor(15, 23, 42);
  doc.rect(margin, y, 100, 58, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('AgroFlow', margin + 12, y + 35);

  doc.setTextColor(17, 24, 39);
  doc.setFontSize(12);
  doc.text('PROCEDIMENTO OPERACIONAL PADRAO', margin + 120, y + 22);
  doc.setFontSize(9);
  doc.text('POP 01 - Qualificacao de fornecedores e controle de materia-prima', margin + 120, y + 38);

  doc.setFontSize(10);
  doc.text('ETIQUETA DE LIBERACAO', pageWidth - margin - 132, y + 22);
  doc.text('Versao 05', pageWidth - margin - 132, y + 38);

  y += 58;
  drawPdfRow(doc, margin, y, width, [
    ['Data', dateBr(row.data)],
    ['Produto', produtoNome(row)],
    ['Placa', placaVeiculo(row)],
    ['Fornecedor', fornecedorNome(row)],
  ]);

  y += 56;
  drawPdfRow(doc, margin, y, width, [
    ['Ticket', row.ticket_numero || '-'],
    ['Umidade 01', row.umidade_01 ? `${Number(row.umidade_01).toFixed(2)}%` : '-'],
    ['Umidade 02', row.umidade_02 ? `${Number(row.umidade_02).toFixed(2)}%` : '-'],
    ['Peso liquido', kg(row.peso_liquido)],
    ['Peso - Quantidade', pesoNotaAgregado(row) ? kg(pesoNotaAgregado(row)) : '-'],
  ]);

  y += 56;
  drawPdfRow(doc, margin, y, width, [
    ['Liberado por', row.liberado_por || '-'],
    ['Status', statusLabel(row.status)],
    ['Diferenca', kg(diferencaAgregada(row))],
    ['NF', row.nf_numero || '-'],
  ]);

  y += 64;
  drawPdfTextBox(doc, margin, y, width, 52, 'Observacao do laboratorio', row.observacao || '-');

  y += 68;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Controle de qualidade de materia-prima', margin + 12, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Carga aprovada pelo laboratorio e liberada para seguir o fluxo operacional de balanca.', margin + 12, y + 18);

  doc.setFont('helvetica', 'bold');
  doc.text('Aprovado por:', margin + 12, pageHeight - 44);
  doc.line(margin + 84, pageHeight - 45, margin + 250, pageHeight - 45);
  doc.text(row.liberado_por || '-', margin + 90, pageHeight - 52);

  const fileName = `liberacao-laboratorio-${row.nf_numero || row.ticket_numero || row.id}.pdf`.replace(/[^\w.-]+/g, '-');
  doc.save(fileName);
}

function drawPdfTextBox(doc, x, y, width, height, labelText, value) {
  doc.setDrawColor(30, 41, 59);
  doc.setTextColor(17, 24, 39);
  doc.rect(x, y, width, height);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(labelText, x + 8, y + 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const lines = doc.splitTextToSize(String(value || '-'), width - 16).slice(0, 3);
  doc.text(lines, x + 8, y + 30);
}

function drawPdfRow(doc, x, y, width, cells) {
  const colWidth = width / cells.length;
  doc.setDrawColor(30, 41, 59);
  doc.setTextColor(17, 24, 39);

  cells.forEach(([labelText, value], index) => {
    const cellX = x + index * colWidth;
    doc.rect(cellX, y, colWidth, 56);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(labelText, cellX + 8, y + 15);
    doc.setFontSize(12);
    const lines = doc.splitTextToSize(String(value || '-'), colWidth - 16).slice(0, 2);
    doc.text(lines, cellX + 8, y + 34);
  });
}

function LegacyLaboratorioTab({ rows, options, can, reload, setError, setMessage }) {
  const [edits, setEdits] = useState({});
  const [reason, setReason] = useState({});
  const pending = rows.filter((row) => row.status === 'pendente');

  function updateEdit(id, field, value) {
    setEdits((current) => ({ ...current, [id]: { ...current[id], [field]: value } }));
  }

  async function process(row, action) {
    const edit = edits[row.id] || {};
    try {
      if (action === 'aprovar') {
        await approveRecebimento(row.id, {
          ticket_numero: edit.ticket_numero || row.ticket_numero,
          umidade_01: edit.umidade_01 ?? row.umidade_01,
          umidade_02: edit.umidade_02 ?? row.umidade_02,
          umidade: resolveHumidityValue(edit, row),
          liberado_por: edit.liberado_por || row.liberado_por,
        });
        setMessage('Carga aprovada pelo laboratório.');
      }
      if (action === 'reprovar') {
        const motivo = reason[row.id]?.trim();
        if (!motivo) {
          setError('Informe o motivo da reprovação. Como corrigir: escreva o motivo no campo Motivo e tente novamente.');
          return;
        }
        await rejectRecebimento(row.id, {
          motivo_reprovacao: motivo,
          ticket_numero: edit.ticket_numero || row.ticket_numero,
          umidade_01: edit.umidade_01 ?? row.umidade_01,
          umidade_02: edit.umidade_02 ?? row.umidade_02,
          umidade: resolveHumidityValue(edit, row),
          liberado_por: edit.liberado_por || row.liberado_por,
        });
        setMessage('Carga reprovada com motivo registrado.');
      }
      if (action === 'cancelar') {
        const motivo = reason[row.id]?.trim();
        if (!motivo) {
          setError('Informe o motivo do cancelamento. Como corrigir: escreva o motivo no campo Motivo e tente novamente.');
          return;
        }
        await cancelRecebimento(row.id, motivo);
        setMessage('Carga cancelada com motivo registrado.');
      }
      await reload();
    } catch (err) {
      setError(toUserError(err));
    }
  }

  if (!can('balancas', 'aprovar') && !can('balancas', 'cancelar')) {
    return <Alert tone="error" text="Você não tem permissão para aprovar, reprovar ou cancelar cargas de laboratório." />;
  }

  return (
    <div className="grid gap-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-panel">
        <h2 className="text-sm font-extrabold uppercase tracking-wide text-slate-700">Cargas pendentes ({pending.length})</h2>
        <p className="mt-1 text-sm text-slate-500">Informe ticket, umidade, liberado por e aprove ou reprove com motivo.</p>
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-panel">
        <table className="w-full min-w-[1180px] text-left text-sm">
          <thead className="text-xs font-bold uppercase text-slate-500">
            <tr>
              {['Data', 'Balança', 'Fornecedor', 'Produto', 'Placa', 'Peso líquido', 'Peso - Quantidade', 'Diferença', 'Ticket', 'Umidade', 'Liberado por', 'Motivo', 'Ações'].map((head) => <th key={head} className="border-b px-3 py-3">{head}</th>)}
            </tr>
          </thead>
          <tbody>
            {pending.map((row) => (
              <tr key={row.id} className={row.divergente ? 'border-b bg-rose-50 align-top' : 'border-b align-top'}>
                <td className="px-3 py-3">{dateBr(row.data)}</td>
                <td className="px-3 py-3">{row.balanca?.nome || '-'}</td>
                <td className="px-3 py-3">{fornecedorNome(row)}</td>
                <td className="px-3 py-3">{produtoNome(row)}</td>
                <td className="px-3 py-3">{placaVeiculo(row)}</td>
                <td className="px-3 py-3">{kg(row.peso_liquido)}</td>
                <td className="px-3 py-3">{pesoNotaAgregado(row) ? kg(pesoNotaAgregado(row)) : '-'}</td>
                <td className="px-3 py-3">
                  <span className={differenceClass(diferencaAgregada(row))}>{kg(diferencaAgregada(row))}</span>
                </td>
                <td className="px-3 py-3"><SmallInput value={edits[row.id]?.ticket_numero ?? row.ticket_numero ?? ''} onChange={(value) => updateEdit(row.id, 'ticket_numero', value)} /></td>
                <td className="px-3 py-3"><SmallInput type="number" value={edits[row.id]?.umidade ?? row.umidade ?? ''} onChange={(value) => updateEdit(row.id, 'umidade', value)} /></td>
                <td className="px-3 py-3"><SmallInput value={edits[row.id]?.liberado_por ?? row.liberado_por ?? ''} onChange={(value) => updateEdit(row.id, 'liberado_por', value)} /></td>
                <td className="px-3 py-3">
                  <textarea value={reason[row.id] || ''} onChange={(event) => setReason((current) => ({ ...current, [row.id]: event.target.value }))} rows={2} className="w-52 rounded-md border border-slate-300 px-2 py-1 text-xs outline-none focus:border-tijuca-500" placeholder="Obrigatório para reprovar/cancelar" />
                </td>
                <td className="px-3 py-3">
                  <div className="flex flex-col gap-2">
                    {can('balancas', 'aprovar') && <button type="button" onClick={() => process(row, 'aprovar')} className="inline-flex h-8 items-center justify-center gap-1 rounded-md bg-emerald-600 px-3 text-xs font-bold text-white"><Check size={14} /> Aprovar</button>}
                    {can('balancas', 'aprovar') && <button type="button" onClick={() => process(row, 'reprovar')} className="inline-flex h-8 items-center justify-center gap-1 rounded-md border border-amber-300 px-3 text-xs font-bold text-amber-700 hover:bg-amber-50"><X size={14} /> Reprovar</button>}
                    {can('balancas', 'cancelar') && <button type="button" onClick={() => process(row, 'cancelar')} className="inline-flex h-8 items-center justify-center gap-1 rounded-md border border-rose-300 px-3 text-xs font-bold text-rose-700 hover:bg-rose-50"><X size={14} /> Cancelar</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!pending.length && <p className="p-6 text-center text-sm font-semibold text-slate-500">Nenhuma carga pendente para laboratório.</p>}
      </div>
    </div>
  );
}

function CadastrosTab({ activeCadastro, onCadastroChange, can, setError, setMessage, reloadMain }) {
  const [active, setActive] = useState(lookupTables[activeCadastro] ? activeCadastro : 'balancas');
  const config = lookupTables[active];

  useEffect(() => {
    if (lookupTables[activeCadastro]) {
      setActive(activeCadastro);
    }
  }, [activeCadastro]);

  return (
    <div className="grid gap-4">
      <div className="flex gap-2 overflow-x-auto rounded-lg border border-slate-200 bg-white p-2 shadow-panel">
        {Object.entries(lookupTables).map(([key, item]) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setActive(key);
              onCadastroChange(key);
            }}
            className={['h-10 shrink-0 rounded-md px-3 text-sm font-bold', active === key ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'].join(' ')}
          >
            {item.label}
          </button>
        ))}
      </div>
      <LookupCrud config={config} can={can} setError={setError} setMessage={setMessage} reloadMain={reloadMain} />
    </div>
  );
}

function LookupCrud({ config, can, setError, setMessage, reloadMain }) {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(defaultLookupForm(config.fields));
  const [editing, setEditing] = useState(null);
  const [query, setQuery] = useState('');

  async function load() {
    try {
      setRows(await listLookup(config.table, config.table === 'recebimento_veiculos' ? 'placa' : 'nome'));
    } catch (err) {
      setError(toUserError(err));
    }
  }

  useEffect(() => {
    setForm(defaultLookupForm(config.fields));
    setEditing(null);
    load();
  }, [config.table]);

  async function submit(event) {
    event.preventDefault();
    setError('');
    try {
      const duplicate = findDuplicateLookup(config, form, rows, editing?.id);
      if (duplicate) {
        setError(duplicate);
        return;
      }

      if (editing) await updateLookup(config.table, editing.id, form);
      else await createLookup(config.table, form);
      setForm(defaultLookupForm(config.fields));
      setEditing(null);
      setMessage('Cadastro salvo com sucesso.');
      await Promise.all([load(), reloadMain()]);
    } catch (err) {
      setError(toUserError(err));
    }
  }

  async function remove(row) {
    if (!window.confirm(`Excluir ${row.nome || row.placa}?`)) return;
    try {
      await deleteLookup(config.table, row.id);
      setMessage('Cadastro excluído com sucesso.');
      await Promise.all([load(), reloadMain()]);
    } catch (err) {
      setError(toUserError(err));
    }
  }

  const filtered = rows.filter((row) => {
    const term = query.toLowerCase().trim();
    if (!term) return true;
    return config.search.some((field) => String(row[field] || '').toLowerCase().includes(term));
  });

  return (
    <div className="grid gap-4">
      {can('balancas', editing ? 'editar' : 'cadastrar') && (
        <form onSubmit={submit} className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-panel md:grid-cols-3">
          {config.fields.map((field) => (
            <Input key={field.name} label={field.label} type={field.type} value={form[field.name]} required={field.required} onChange={(value) => setForm((current) => ({ ...current, [field.name]: value }))} />
          ))}
          <div className="flex items-end gap-2">
            <button className="inline-flex h-11 items-center gap-2 rounded-lg bg-tijuca-600 px-4 text-sm font-extrabold text-white"><Save size={16} /> Salvar</button>
            {editing && <button type="button" onClick={() => { setEditing(null); setForm(defaultLookupForm(config.fields)); }} className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-bold text-slate-700"><X size={16} /> Cancelar</button>}
          </div>
        </form>
      )}

      <div className="rounded-lg border border-slate-200 bg-white shadow-panel">
        <div className="flex flex-col gap-3 border-b p-4 md:flex-row md:items-center md:justify-between">
          <h2 className="font-extrabold">{config.label}</h2>
          <label className="flex h-10 min-w-0 items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm text-slate-500 md:min-w-72">
            <Search size={16} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full outline-none" placeholder="Buscar..." />
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs font-bold uppercase text-slate-500">
              <tr>{config.columns.map((column) => <th key={column} className="border-b px-4 py-3">{label(column)}</th>)}<th className="border-b px-4 py-3">Ações</th></tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id} className="border-b last:border-0">
                  {config.columns.map((column) => <td key={column} className="px-4 py-3">{formatGeneric(row[column])}</td>)}
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {can('balancas', 'editar') && <button type="button" onClick={() => { setEditing(row); setForm(defaultLookupForm(config.fields, row)); }} className="grid h-9 w-9 place-items-center rounded-lg text-slate-600 hover:bg-slate-100"><Edit size={16} /></button>}
                      {can('balancas', 'excluir') && <button type="button" onClick={() => remove(row)} className="grid h-9 w-9 place-items-center rounded-lg text-rose-600 hover:bg-rose-50"><Trash2 size={16} /></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length && <p className="p-6 text-center text-sm font-semibold text-slate-500">Nenhum cadastro encontrado.</p>}
        </div>
      </div>
    </div>
  );
}

function buildRecebimentoReportRows(rows, mode) {
  if (mode === 'principal') {
    return rows.map((row) => ({
      ...row,
      tipo_nota_relatorio: 'Principal',
      nf_principal_relatorio: row.nf_numero || '-',
      nf_complementar_relatorio: '-',
      valor_principal_relatorio: Number(row.valor_total || 0),
      valor_complemento_relatorio: 0,
      total_complementos_relatorio: complementosTotal(row.complementos),
      valor_agregado_relatorio: Number(row.valor_total || 0),
      valor_unitario_relatorio: row.valor_unitario,
      umidade_relatorio: humidityText(row),
      diferenca_relatorio: diferencaAgregada(row),
      chave_complementar_relatorio: '-',
      observacao_complementar_relatorio: '-',
    }));
  }

  if (mode === 'detalhado') {
    return rows.flatMap((row) => {
      const principal = {
        ...row,
        id: `${row.id}-principal`,
        tipo_nota_relatorio: 'Principal',
        nf_principal_relatorio: row.nf_numero || '-',
        nf_complementar_relatorio: '-',
        valor_principal_relatorio: Number(row.valor_total || 0),
        valor_complemento_relatorio: 0,
        total_complementos_relatorio: complementosTotal(row.complementos),
        valor_agregado_relatorio: valorTotalAgregado(row),
        valor_unitario_relatorio: row.valor_unitario,
        umidade_relatorio: humidityText(row),
        diferenca_relatorio: diferencaAgregada(row),
        chave_complementar_relatorio: '-',
        observacao_complementar_relatorio: '-',
      };
      const complementos = (row.complementos || []).map((item) => ({
        ...row,
        id: `${row.id}-comp-${item.id}`,
        tipo_nota_relatorio: `Complemento da NF ${row.nf_numero || '-'}`,
        nf_principal_relatorio: row.nf_numero || '-',
        nf_complementar_relatorio: item.numero_nf || '-',
        valor_principal_relatorio: Number(row.valor_total || 0),
        valor_complemento_relatorio: Number(item.valor_total || 0),
        total_complementos_relatorio: complementosTotal(row.complementos),
        valor_agregado_relatorio: valorTotalAgregado(row),
        valor_unitario_relatorio: item.valor_unitario ?? row.valor_unitario,
        umidade_relatorio: humidityText(row),
        diferenca_relatorio: diferencaAgregada(row),
        chave_complementar_relatorio: item.chave_nfe || '-',
        observacao_complementar_relatorio: item.observacao || '-',
      }));
      return [principal, ...complementos];
    });
  }

  return rows.map((row) => ({
    ...row,
    tipo_nota_relatorio: 'Principal + complementos',
    nf_principal_relatorio: row.nf_numero || '-',
    nf_complementar_relatorio: (row.complementos || []).map((item) => item.numero_nf).filter(Boolean).join(', ') || '-',
    valor_principal_relatorio: Number(row.valor_total || 0),
    valor_complemento_relatorio: complementosTotal(row.complementos),
    total_complementos_relatorio: complementosTotal(row.complementos),
    valor_agregado_relatorio: valorTotalAgregado(row),
    valor_unitario_relatorio: row.valor_unitario,
    umidade_relatorio: humidityText(row),
    diferenca_relatorio: diferencaAgregada(row),
    chave_complementar_relatorio: (row.complementos || []).map((item) => item.chave_nfe).filter(Boolean).join(', ') || '-',
    observacao_complementar_relatorio: (row.complementos || []).map((item) => item.observacao).filter(Boolean).join(' | ') || '-',
  }));
}

function RelatoriosTab({ rows, options, filters, setFilters, applyFilters, clearFilters, can }) {
  const [reportMode, setReportMode] = useState('consolidado');
  const reportRows = sortReportRows(rows.filter((row) => !isLaboratorioPendenteBalanca(row)));
  const displayRows = buildRecebimentoReportRows(reportRows, reportMode);
  const ignoredRows = rows.length - reportRows.length;

  return (
    <div className="grid gap-4">
      <Filters options={options} filters={filters} setFilters={setFilters} onApply={applyFilters} onClear={clearFilters} showPortariaFilter />
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-panel">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-sm font-extrabold uppercase tracking-wide text-slate-700">Relatório de recebimentos</h2>
            <p className="mt-1 text-sm text-slate-500">
              {reportRows.length} recebimento(s) finalizado(s) nos filtros atuais, em ordem alfabetica.
              {ignoredRows > 0 ? ` ${ignoredRows} pendente(s) de finalizar recebimento foram ocultados.` : ''}
            </p>
          </div>
          {can('balancas', 'exportar') && (
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => exportRecebimentosCsv(displayRows)} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50">
                <Download size={16} /> Exportar CSV
              </button>
              <button type="button" onClick={() => exportRecebimentosPdf(displayRows, filters)} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-bold text-white hover:bg-slate-800">
                <Download size={16} /> Baixar PDF
              </button>
            </div>
          )}
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          <Select label="Modelo do relatório" value={reportMode} onChange={setReportMode} options={[
            { id: 'principal', nome: 'Somente NF principal' },
            { id: 'consolidado', nome: 'Principal + complementos consolidado' },
            { id: 'detalhado', nome: 'Detalhado por nota fiscal' },
          ]} />
        </div>
      </div>
      <RelatorioRecebimentosTable rows={displayRows} />
    </div>
  );
}

function RelatorioRecebimentosTable({ rows }) {
  const headers = ['Data', 'Tipo da nota', 'NF principal', 'NF complementar', 'Fornecedor', 'Produto', 'Placa', 'Líquido', 'Qtd. NF', 'Valor unit.', 'Valor principal', 'Valor complemento', 'Total agregado', 'Umidade', 'Diferença', 'Chave complementar', 'Observação'];

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-panel">
      <table className="w-full min-w-[1820px] text-left text-sm">
        <thead className="text-xs font-bold uppercase text-slate-500">
          <tr>{headers.map((head) => <th key={head} className="border-b px-4 py-3">{head}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className={recebimentoRowClass(row)}>
              <td className="px-4 py-3">{dateBr(row.data)}</td>
              <td className="px-4 py-3 font-semibold">{row.tipo_nota_relatorio || 'Principal'}</td>
              <td className="px-4 py-3 font-semibold">{row.nf_principal_relatorio || row.nf_numero || '-'}</td>
              <td className="px-4 py-3 font-semibold">{row.nf_complementar_relatorio || '-'}</td>
              <td className="px-4 py-3">{fornecedorNome(row)}</td>
              <td className="px-4 py-3">{produtoNome(row)}</td>
              <td className="px-4 py-3"><PlateTag value={placaVeiculo(row)} /></td>
              <td className="px-4 py-3 font-bold">{kg(row.peso_liquido)}</td>
              <td className="px-4 py-3">{reportQuantity(row)}</td>
              <td className="px-4 py-3">{formatCurrencyCell(row.valor_unitario_relatorio, true)}</td>
              <td className="px-4 py-3">{formatCurrencyCell(row.valor_principal_relatorio)}</td>
              <td className="px-4 py-3">{formatCurrencyCell(row.valor_complemento_relatorio)}</td>
              <td className="px-4 py-3 font-bold">{formatCurrencyCell(row.valor_agregado_relatorio)}</td>
              <td className="px-4 py-3">{row.umidade_relatorio || '-'}</td>
              <td className="px-4 py-3"><span className={differenceClass(row.diferenca_relatorio)}>{kg(row.diferenca_relatorio)}</span></td>
              <td className="max-w-[180px] truncate px-4 py-3" title={row.chave_complementar_relatorio || ''}>{row.chave_complementar_relatorio || '-'}</td>
              <td className="max-w-[200px] truncate px-4 py-3" title={row.observacao_complementar_relatorio || ''}>{row.observacao_complementar_relatorio || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <p className="p-6 text-center text-sm font-semibold text-slate-500">Nenhum recebimento encontrado.</p>}
    </div>
  );
}

function exportRecebimentosPdf(rows, filters = {}) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 32;
  const generatedAt = new Date().toLocaleString('pt-BR');
  const period = filters.dataInicial || filters.dataFinal
    ? `${filters.dataInicial ? dateBr(filters.dataInicial) : 'inicio'} a ${filters.dataFinal ? dateBr(filters.dataFinal) : 'fim'}`
    : 'Todos os periodos';

  const totals = rows.reduce((acc, row) => {
    acc.liquido += Number(row.peso_liquido || 0);
    acc.nota += pesoNotaAgregado(row);
    acc.diferenca += diferencaAgregada(row);
    acc.valor += Number(row.valor_agregado_relatorio ?? row.valor_total ?? 0);
    return acc;
  }, { liquido: 0, nota: 0, diferenca: 0, valor: 0 });

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 58, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('AgroFlow', margin, 36);
  doc.setFontSize(13);
  doc.text('Relatorio gerencial de recebimentos', 170, 25);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Periodo: ${period} | Gerado em: ${generatedAt}`, 170, 42);

  doc.setTextColor(15, 23, 42);
  let y = 82;
  const summary = [
    ['Registros', String(rows.length)],
    ['KG liquido', kg(totals.liquido)],
    ['KG nota', kg(totals.nota)],
    ['Diferenca', kg(totals.diferenca)],
    ['Valor agregado', `R$ ${formatMoneyPt(totals.valor, 2)}`],
  ];
  const cardWidth = (pageWidth - margin * 2 - 32) / 5;
  summary.forEach(([label, value], index) => {
    const x = margin + index * (cardWidth + 8);
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(x, y, cardWidth, 48, 5, 5, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(label, x + 10, y + 16);
    doc.setFontSize(12);
    doc.text(String(value), x + 10, y + 35, { maxWidth: cardWidth - 20 });
  });

  y += 72;
  const columns = [
    ['Data', 54],
    ['Tipo', 68],
    ['NF princ.', 52],
    ['NF comp.', 54],
    ['Fornecedor', 92],
    ['Produto', 66],
    ['Valor unit.', 62],
    ['Valor princ.', 68],
    ['Valor comp.', 68],
    ['Agregado', 68],
    ['Umidade', 62],
    ['Dif.', 54],
  ];

  function drawHeader() {
    doc.setFillColor(15, 23, 42);
    doc.rect(margin, y, pageWidth - margin * 2, 24, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    let x = margin + 6;
    columns.forEach(([label, width]) => {
      doc.text(label, x, y + 15, { maxWidth: width - 6 });
      x += width;
    });
    y += 24;
    doc.setTextColor(15, 23, 42);
  }

  drawHeader();
  rows.forEach((row, index) => {
    if (y > 545) {
      doc.addPage();
      y = 42;
      drawHeader();
    }
    doc.setFillColor(index % 2 ? 255 : 248, index % 2 ? 255 : 250, index % 2 ? 255 : 252);
    doc.rect(margin, y, pageWidth - margin * 2, 30, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    const values = [
      dateBr(row.data),
      row.tipo_nota_relatorio || 'Principal',
      row.nf_principal_relatorio || row.nf_numero || '-',
      row.nf_complementar_relatorio || '-',
      fornecedorNome(row),
      produtoNome(row),
      formatCurrencyCell(row.valor_unitario_relatorio, true),
      formatCurrencyCell(row.valor_principal_relatorio),
      formatCurrencyCell(row.valor_complemento_relatorio),
      formatCurrencyCell(row.valor_agregado_relatorio),
      row.umidade_relatorio || '-',
      kg(row.diferenca_relatorio),
    ];
    let x = margin + 6;
    values.forEach((value, valueIndex) => {
      const width = columns[valueIndex][1];
      if (columns[valueIndex][0] === 'Dif.') {
        const diff = Number(row.diferenca_relatorio || 0);
        if (diff > 0) doc.setTextColor(29, 78, 216);
        else if (diff < 0) doc.setTextColor(190, 18, 60);
        else doc.setTextColor(51, 65, 85);
        doc.setFont('helvetica', 'bold');
      }
      doc.text(String(value || '-'), x, y + 12, { maxWidth: width - 6 });
      if (columns[valueIndex][0] === 'Dif.') {
        doc.setTextColor(15, 23, 42);
        doc.setFont('helvetica', 'normal');
      }
      x += width;
    });
    y += 30;
  });

  doc.save(`relatorio-recebimentos-${todayIso()}.pdf`);
}

function RecebimentosTable({ rows, loading, can, onView, onEdit, onDelete, showReportColumns = false }) {
  const headers = showReportColumns
    ? ['Data', 'NF', 'Balança', 'Fornecedor', 'Produto', 'Placa', 'Líquido', 'Qtd. NF', 'Unid.', 'Valor unit.', 'Valor total', 'Umidade', 'Diferença', 'Status']
    : ['Data', 'NF', 'Balança', 'Fornecedor', 'Produto', 'Placa', 'Bruto', 'Tara', 'Líquido', 'Peso - Quantidade', 'Diferença', 'Status', 'Ações'];

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-panel">
      <table className={`w-full text-left text-sm ${showReportColumns ? 'min-w-[1420px]' : 'min-w-[1180px]'}`}>
        <thead className="text-xs font-bold uppercase text-slate-500">
          <tr>
            {['Data', 'NF', 'Balança', 'Fornecedor', 'Produto', 'Placa', 'Bruto', 'Tara', 'Líquido', 'Peso - Quantidade', 'Diferença', 'Status', 'Ações'].map((head) => <th key={head} className="border-b px-4 py-3">{head}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className={recebimentoRowClass(row)}>
              <td className="px-4 py-3">{dateBr(row.data)}</td>
              <td className="px-4 py-3 font-semibold">
                <div className="flex flex-col gap-1">
                  <span>{row.nf_numero || '-'}</span>
                  {(row.complementos || []).length > 0 && (
                    <span className="inline-flex w-fit rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-extrabold uppercase text-amber-700">
                      Compl.: {complementosNumeros(row) || `${(row.complementos || []).length} nota(s)`}
                    </span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3">{row.balanca?.nome || '-'}</td>
              <td className="px-4 py-3">{fornecedorNome(row)}</td>
              <td className="px-4 py-3">{produtoNome(row)}</td>
              <td className="px-4 py-3"><PlateTag value={placaVeiculo(row)} /></td>
              <td className="px-4 py-3">{kg(row.peso_bruto)}</td>
              <td className="px-4 py-3">{kg(row.tara)}</td>
              <td className="px-4 py-3 font-bold">{kg(row.peso_liquido)}</td>
              <td className="px-4 py-3">
                <div className="flex flex-col gap-1">
                  <span>{pesoNotaAgregado(row) ? kg(pesoNotaAgregado(row)) : '-'}</span>
                  {complementoPesoTotal(row.complementos) > 0 && (
                    <span className="text-[11px] font-bold text-amber-700">Principal {kg(row.peso_nf)} + compl. {kg(complementoPesoTotal(row.complementos))}</span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3">
                <span className={differenceClass(diferencaAgregada(row))}>{kg(diferencaAgregada(row))}</span>
              </td>
              <td className="px-4 py-3"><StatusBadge row={row} /></td>
              <td className="px-4 py-3">
                <div className="flex gap-1">
                  {onView && <button type="button" onClick={() => onView(row)} className="grid h-9 w-9 place-items-center rounded-lg text-slate-600 hover:bg-slate-100" title="Visualizar"><Eye size={16} /></button>}
                  {can('balancas', 'editar') && onEdit && <button type="button" onClick={() => onEdit(row)} className="grid h-9 w-9 place-items-center rounded-lg text-slate-600 hover:bg-slate-100"><Edit size={16} /></button>}
                  {can('balancas', 'excluir') && onDelete && <button type="button" onClick={() => onDelete(row)} className="grid h-9 w-9 place-items-center rounded-lg text-rose-600 hover:bg-rose-50"><Trash2 size={16} /></button>}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {loading && <p className="p-6 text-center text-sm font-semibold text-slate-500">Carregando recebimentos...</p>}
      {!loading && !rows.length && <p className="p-6 text-center text-sm font-semibold text-slate-500">Nenhum recebimento encontrado.</p>}
    </div>
  );
}

function PlateTag({ value }) {
  const plate = formatPlateDisplay(value);
  if (!plate || plate === '-') return <span className="text-slate-400">-</span>;
  return (
    <span className="inline-flex min-w-[82px] justify-center rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-xs font-extrabold uppercase tracking-wide text-slate-800 shadow-sm">
      {plate}
    </span>
  );
}

function Filters({ options, filters, setFilters, onApply, onClear, showPortariaFilter = false }) {
  return (
    <form onSubmit={onApply} className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-panel md:grid-cols-2 xl:grid-cols-6">
      <Input label="Data inicial" type="date" value={filters.dataInicial} onChange={(value) => setFilters((current) => ({ ...current, dataInicial: value }))} />
      <Input label="Data final" type="date" value={filters.dataFinal} onChange={(value) => setFilters((current) => ({ ...current, dataFinal: value }))} />
      <Select label="Balança" value={filters.balancaId} onChange={(value) => setFilters((current) => ({ ...current, balancaId: value }))} options={options.balancas} />
      <Select label="Fornecedor" value={filters.fornecedorId} onChange={(value) => setFilters((current) => ({ ...current, fornecedorId: value }))} options={options.fornecedores} />
      <Select label="Produto" value={filters.produtoId} onChange={(value) => setFilters((current) => ({ ...current, produtoId: value }))} options={options.produtos} />
      <Select label="Laboratório" value={filters.laboratorioId} onChange={(value) => setFilters((current) => ({ ...current, laboratorioId: value }))} options={options.laboratorios} />
      {showPortariaFilter && (
        <Select label="Origem na Portaria" value={filters.origemPortaria} onChange={(value) => setFilters((current) => ({ ...current, origemPortaria: value }))} options={[
          { id: 'com_portaria', nome: 'Com Portaria' },
          { id: 'sem_portaria', nome: 'Sem Portaria' },
        ]} />
      )}
      <Select label="Status" value={filters.status} onChange={(value) => setFilters((current) => ({ ...current, status: value }))} options={[
        { id: 'pendente', nome: 'Pendente' },
        { id: 'aprovada', nome: 'Aprovada' },
        { id: 'reprovada', nome: 'Reprovada' },
        { id: 'cancelada', nome: 'Cancelada' },
      ]} />
      <div className="flex items-end gap-2 xl:col-span-5">
        <button className="inline-flex h-11 items-center gap-2 rounded-lg bg-tijuca-600 px-4 text-sm font-extrabold text-white"><Search size={16} /> Aplicar filtros</button>
        <button type="button" onClick={onClear} className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50"><RotateCcw size={16} /> Limpar</button>
      </div>
    </form>
  );
}

function Metric({ title, value, icon: Icon, danger, color }) {
  const iconStyle = danger
    ? undefined
    : { backgroundColor: `${color || chartColor(4)}1A`, color: color || chartColor(4) };
  return (
    <article className="flex min-h-24 items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{title}</p>
        <p className={`mt-2 text-2xl font-extrabold ${danger ? 'text-rose-700' : 'text-slate-950'}`}>{value}</p>
      </div>
      <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${danger ? 'bg-rose-50 text-rose-700' : ''}`} style={iconStyle}>
        <Icon size={20} />
      </div>
    </article>
  );
}

function ChartCard({ title, children }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-panel">
      <h2 className="text-sm font-extrabold uppercase tracking-wide text-slate-700">{title}</h2>
      <div className="mt-4">{children}</div>
    </article>
  );
}

function BarList({ data, valueFormatter }) {
  const max = Math.max(...data.map((item) => item.value), 1);
  if (!data.length) return <p className="py-10 text-center text-sm font-semibold text-slate-500">Sem dados para exibir.</p>;
  return (
    <div className="grid gap-3">
      {data.map((item, index) => (
        <div key={item.name} className="grid gap-1">
          <div className="flex items-center justify-between gap-3 text-xs font-bold text-slate-600">
            <span className="truncate">{item.name}</span>
            <span>{valueFormatter(item.value)}</span>
          </div>
          <div className="h-3 rounded-full bg-slate-100">
            <div className="h-full rounded-full" style={{ width: `${Math.max((item.value / max) * 100, 4)}%`, backgroundColor: item.color || chartColor(index) }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function ProductsPieChart({ data }) {
  if (!data.length) return <p className="py-10 text-center text-sm font-semibold text-slate-500">Sem dados para exibir.</p>;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-center">
      <div className="h-72 min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="kgTotal"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={54}
              outerRadius={96}
              paddingAngle={2}
            >
              {data.map((item, index) => (
                <Cell key={item.name} fill={item.color || chartColor(index)} />
              ))}
            </Pie>
            <Tooltip content={<ProductPieTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="grid max-h-72 gap-2 overflow-y-auto pr-1">
        {data.map((item, index) => (
          <div key={item.name} className="flex items-center justify-between gap-3 rounded-md bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700">
            <span className="flex min-w-0 items-center gap-2">
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: item.color || chartColor(index) }} />
              <span className="truncate">{item.name}</span>
            </span>
            <span className="shrink-0 text-slate-500">{item.percent.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SupplierDifferenceChart({ data }) {
  if (!data.length) return <p className="py-10 text-center text-sm font-semibold text-slate-500">Sem dados para exibir.</p>;

  return (
    <div className="h-80 min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, bottom: 62, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="name"
            interval={0}
            tick={{ fontSize: 11, fontWeight: 700 }}
            angle={-32}
            textAnchor="end"
            height={74}
          />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={(value) => compactKg(value)} width={54} />
          <Tooltip content={<SupplierDifferenceTooltip />} />
          <Bar dataKey="diferencaKg" radius={[6, 6, 0, 0]}>
            {data.map((item) => (
              <Cell key={item.name} fill={item.diferencaKg < 0 ? '#dc2626' : item.diferencaKg > 0 ? '#2563eb' : '#94a3b8'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function SupplierMoistureChart({ data }) {
  if (!data.length) return <p className="py-10 text-center text-sm font-semibold text-slate-500">Sem umidade registrada no período.</p>;

  return (
    <div className="h-80 min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 20, bottom: 8, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(value) => `${Number(value).toFixed(1)}%`} />
          <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11, fontWeight: 700 }} />
          <Tooltip content={<SupplierMoistureTooltip />} />
          <Bar dataKey="umidadeMedia" radius={[0, 6, 6, 0]}>
            {data.map((item, index) => (
              <Cell key={item.name} fill={item.umidadeMedia > 14 ? chartColor(index + 2) : chartColor(index)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function BestSuppliersChart({ data }) {
  if (!data.length) return <p className="py-10 text-center text-sm font-semibold text-slate-500">Sem dados suficientes para gerar ranking.</p>;

  return (
    <div className="grid gap-3">
      {data.map((item, index) => (
        <div key={item.name} className="grid gap-1 rounded-lg bg-slate-50 p-3">
          <div className="flex items-center justify-between gap-3 text-xs font-bold text-slate-700">
            <span className="min-w-0 truncate">
              {index + 1}. {item.name}
            </span>
            <span className="shrink-0 text-tijuca-700">{item.score.toFixed(0)} pts</span>
          </div>
          <div className="h-3 rounded-full bg-white">
            <div className="h-full rounded-full" style={{ width: `${Math.max(item.score, 6)}%`, backgroundColor: chartColor(index) }} />
          </div>
          <div className="grid gap-1 text-[11px] font-semibold text-slate-500 sm:grid-cols-3">
            <span>{kg(item.kgRecebido)}</span>
            <span>{item.taxaAprovacao.toFixed(0)}% aprovação</span>
            <span>{item.divergenciaPercentualAbs.toFixed(2)}% diverg.</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function ProductPieTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs shadow-panel">
      <p className="font-extrabold text-slate-900">{item.name}</p>
      <p className="mt-1 font-semibold text-slate-600">Total: {kg(item.kgTotal)}</p>
      <p className="font-semibold text-slate-600">Participação: {item.percent.toFixed(2)}%</p>
    </div>
  );
}

function SupplierDifferenceTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs shadow-panel">
      <p className="font-extrabold text-slate-900">{item.name}</p>
      <p className="mt-1 font-semibold text-slate-600">KG da nota: {kg(item.kgNota)}</p>
      <p className="font-semibold text-slate-600">KG recebido: {kg(item.kgRecebido)}</p>
      <p className={item.diferencaKg < 0 ? 'font-extrabold text-rose-700' : item.diferencaKg > 0 ? 'font-extrabold text-blue-700' : 'font-extrabold text-slate-600'}>
        Diferença: {kg(item.diferencaKg)}
      </p>
      <p className="font-semibold text-slate-600">Percentual: {item.percentualDiferenca.toFixed(2)}%</p>
    </div>
  );
}

function SupplierMoistureTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs shadow-panel">
      <p className="font-extrabold text-slate-900">{item.name}</p>
      <p className="mt-1 font-semibold text-slate-600">Umidade média: {item.umidadeMedia.toFixed(2)}%</p>
      <p className="font-semibold text-slate-600">Registros com umidade: {item.registros}</p>
      <p className="font-semibold text-slate-600">KG recebido: {kg(item.kgRecebido)}</p>
    </div>
  );
}

function StatusBadge({ row }) {
  if (isLaboratorioPendenteBalanca(row)) {
    return (
      <span className="inline-flex max-w-64 rounded-md bg-amber-100 px-2 py-1 text-xs font-bold leading-snug text-amber-800 ring-1 ring-amber-200">
        Aprovado pelo Laboratório - Pendente finalizar recebimento
      </span>
    );
  }

  const classes = {
    pendente: 'bg-amber-100 text-amber-800 ring-amber-200',
    aprovada: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
    reprovada: 'bg-rose-100 text-rose-700 ring-rose-200',
    cancelada: 'bg-slate-100 text-slate-700 ring-slate-200',
  };
  return (
    <span className={`rounded-md px-2 py-1 text-xs font-bold capitalize ring-1 ${classes[row.status] || classes.pendente}`} title={row.motivo_reprovacao || row.motivo_cancelamento || ''}>
      {statusLabel(row.status)}
    </span>
  );
}

function PortariaStatus({ status }) {
  const labels = {
    AGUARDANDO_LABORATORIO: 'Aguardando laboratório',
    ENVIADO_LABORATORIO: 'Enviado ao laboratório',
    CANCELADA: 'Cancelada',
  };
  const classes = {
    AGUARDANDO_LABORATORIO: 'bg-amber-100 text-amber-700 ring-amber-200',
    ENVIADO_LABORATORIO: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
    CANCELADA: 'bg-slate-100 text-slate-700 ring-slate-200',
  };
  return (
    <span className={`rounded-md px-2 py-1 text-xs font-bold ring-1 ${classes[status] || classes.AGUARDANDO_LABORATORIO}`}>
      {labels[status] || status || '-'}
    </span>
  );
}

function Alert({ tone, text }) {
  const style = tone === 'error'
    ? 'border-rose-200 bg-rose-50 text-rose-700'
    : 'border-emerald-200 bg-emerald-50 text-emerald-700';
  return <div className={`rounded-lg border p-3 text-sm font-semibold ${style}`}>{text}</div>;
}

function Input({ label, value, onChange, type = 'text', required, step, error, readOnly }) {
  const inputClass = error
    ? 'h-11 rounded-lg border border-rose-500 bg-rose-50 px-3 outline-none ring-4 ring-rose-100 animate-pulse'
    : 'h-11 rounded-lg border border-slate-300 px-3 outline-none focus:border-tijuca-500 focus:ring-4 focus:ring-tijuca-100 read-only:bg-slate-100 read-only:text-slate-600';
  return (
    <label className="grid gap-2 text-sm font-semibold text-slate-700">
      {label}
      <input className={inputClass} value={value ?? ''} onChange={(event) => onChange(event.target.value)} type={type} required={required} step={step} readOnly={readOnly} />
      {error && <span className="text-xs font-bold text-rose-700">{error}</span>}
    </label>
  );
}

function MoneyInput({ label, value, onChange, placeholder = '0,00', readOnly = false, error }) {
  const inputClass = error
    ? 'h-11 w-full rounded-lg border border-rose-500 bg-rose-50 pl-10 pr-3 outline-none ring-4 ring-rose-100 animate-pulse'
    : 'h-11 w-full rounded-lg border border-slate-300 pl-10 pr-3 outline-none focus:border-tijuca-500 focus:ring-4 focus:ring-tijuca-100 disabled:bg-slate-100 disabled:text-slate-600';

  function handleChange(rawValue) {
    if (readOnly) return;
    onChange(sanitizeMoneyInput(rawValue));
  }

  function handleBlur() {
    if (readOnly) return;
    const numeric = nullableLocaleNumber(value);
    if (numeric === null) {
      onChange('');
      return;
    }
    onChange(formatMoneyPt(numeric, Math.max(inputDecimalPlaces(value), 2)));
  }

  return (
    <label className="grid gap-2 text-sm font-semibold text-slate-700">
      {label}
      <span className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-extrabold text-slate-500">R$</span>
        <input
          className={inputClass}
          value={value ?? ''}
          onChange={(event) => handleChange(event.target.value)}
          onBlur={handleBlur}
          type="text"
          inputMode="decimal"
          placeholder={placeholder}
          readOnly={readOnly}
        />
      </span>
      {error && <span className="text-xs font-bold text-rose-700">{error}</span>}
    </label>
  );
}

function SmallInput({ value, onChange, type = 'text' }) {
  return <input type={type} value={value ?? ''} onChange={(event) => onChange(event.target.value)} className="h-8 w-28 rounded-md border border-slate-300 px-2 text-xs outline-none focus:border-tijuca-500" />;
}

function Select({ label, value, onChange, options, required, labelKey = 'nome', error }) {
  const selectClass = error
    ? 'h-11 rounded-lg border border-rose-500 bg-rose-50 px-3 outline-none ring-4 ring-rose-100 animate-pulse'
    : 'h-11 rounded-lg border border-slate-300 px-3 outline-none focus:border-tijuca-500 focus:ring-4 focus:ring-tijuca-100';
  return (
    <label className="grid gap-2 text-sm font-semibold text-slate-700">
      {label}
      <select className={selectClass} value={value || ''} onChange={(event) => onChange(event.target.value)} required={required}>
        <option value="">Selecione</option>
        {(options || []).map((option) => <option key={option.id} value={option.id}>{option[labelKey] || option.nome}</option>)}
      </select>
      {error && <span className="text-xs font-bold text-rose-700">{error}</span>}
    </label>
  );
}

function SearchableSelect({ label, value, onChange, options, labelKey = 'nome', fallbackValue = '', error }) {
  const selected = (options || []).find((option) => option.id === value);
  const [text, setText] = useState(selected?.[labelKey] || selected?.nome || fallbackValue || '');
  const listId = useMemo(() => `list-${label.replace(/\W+/g, '-').toLowerCase()}-${Math.random().toString(36).slice(2)}`, [label]);
  const inputClass = error
    ? 'h-11 rounded-lg border border-rose-500 bg-rose-50 px-3 outline-none ring-4 ring-rose-100 animate-pulse'
    : 'h-11 rounded-lg border border-slate-300 px-3 outline-none focus:border-tijuca-500 focus:ring-4 focus:ring-tijuca-100';

  useEffect(() => {
    const current = (options || []).find((option) => option.id === value);
    setText(current?.[labelKey] || current?.nome || fallbackValue || '');
  }, [value, options, labelKey, fallbackValue]);

  function handleChange(nextText) {
    setText(nextText);
    const found = (options || []).find((option) => normalizeName(option[labelKey] || option.nome) === normalizeName(nextText));
    onChange(found?.id || '');
  }

  function handleBlur() {
    const normalizedText = normalizeName(text);
    if (!normalizedText) {
      onChange('');
      return;
    }
    const found = (options || []).find((option) => {
      const optionText = option[labelKey] || option.nome;
      return normalizeName(optionText) === normalizedText || normalizeName(optionText).startsWith(normalizedText);
    });
    if (found) {
      setText(found[labelKey] || found.nome || '');
      onChange(found.id);
    }
  }

  return (
    <label className="grid gap-2 text-sm font-semibold text-slate-700">
      {label}
      <input
        className={inputClass}
        value={text}
        onChange={(event) => handleChange(event.target.value)}
        onBlur={handleBlur}
        list={listId}
        placeholder="Digite para buscar..."
      />
      <datalist id={listId}>
        {(options || []).map((option) => <option key={option.id} value={option[labelKey] || option.nome || ''} />)}
      </datalist>
      {error && <span className="text-xs font-bold text-rose-700">{error}</span>}
    </label>
  );
}

function validateRecebimentoForm(form) {
  const missing = [];
  const fields = {};

  function requireField(key, label, valid = Boolean(form[key])) {
    if (valid) return;
    fields[key] = 'Campo obrigatorio';
    missing.push(label);
  }

  requireField('data', 'Data');
  requireField('balanca_id', 'Balanca');
  requireField('nf_numero', 'Numero da NF');
  requireField('fornecedor_id', 'Fornecedor cadastrado', Boolean(form.fornecedor_id));
  requireField('produto_id', 'Produto', Boolean(form.produto_id || form.produto_nome_manual));
  requireField('veiculo_id', 'Veiculo', Boolean(form.veiculo_id || form.veiculo_placa_manual));
  requireField('peso_bruto', 'Peso bruto KG', form.peso_bruto !== '' && form.peso_bruto !== null && form.peso_bruto !== undefined);
  requireField('tara', 'Tara KG', form.tara !== '' && form.tara !== null && form.tara !== undefined);

  if (!missing.length) return { fields: {}, message: '' };

  return {
    fields,
    message: `Falta preencher: ${missing.join(', ')}. Como corrigir: preencha os campos destacados em vermelho e tente salvar novamente.`,
  };
}

function findDuplicateRecebimentoRows(rows, payload, editingId, options = {}) {
  const nfDigits = onlyDigits(payload.nf_numero);
  if (!nfDigits || !payload.fornecedor_id) return null;

  const selectedSupplier = (options.fornecedores || []).find((item) => item.id === payload.fornecedor_id);
  const selectedSupplierDoc = onlyDigits(selectedSupplier?.cnpj);
  const selectedSupplierName = normalizeName(selectedSupplier?.nome);

  return (rows || []).find((row) => {
    if (row.id === editingId) return false;
    if (String(row.status || '').toLowerCase() === 'cancelada') return false;
    if (onlyDigits(row.nf_numero) !== nfDigits) return false;
    if (row.fornecedor_id && row.fornecedor_id === payload.fornecedor_id) return true;

    const rowSupplierDoc = onlyDigits(row.fornecedor?.cnpj);
    if (selectedSupplierDoc && rowSupplierDoc && rowSupplierDoc === selectedSupplierDoc) return true;

    const rowSupplierName = normalizeName(row.fornecedor?.nome || row.fornecedor_nome_manual);
    return Boolean(selectedSupplierName && rowSupplierName && rowSupplierName === selectedSupplierName);
  }) || null;
}

function validatePortariaForm(form, rows, editingId) {
  const missing = [];
  const fields = {};

  function requireField(key, label, valid = Boolean(form[key])) {
    if (valid) return;
    fields[key] = 'Campo obrigatorio';
    missing.push(label);
  }

  requireField('data_entrada', 'Data de entrada');
  requireField('hora_entrada', 'Hora de entrada');
  requireField('placa', 'Placa do veiculo', isValidPlate(form.placa));
  requireField('veiculo_id', 'Veiculo cadastrado');
  requireField('fornecedor_id', 'Fornecedor');
  requireField('cnpj_fornecedor', 'CNPJ do fornecedor', isValidCnpj(form.cnpj_fornecedor));
  requireField('produto_id', 'Produto');
  requireField('numero_nf', 'Numero da NF', Boolean(onlyDigits(form.numero_nf)));
  requireField('serie_nf', 'Serie da NF');
  requireField('peso_nf_kg', 'Peso - Quantidade', nullableLocaleNumber(form.peso_nf_kg) !== null && nullableLocaleNumber(form.peso_nf_kg) > 0);

  if (form.placa && !form.veiculo_id) {
    fields.placa = 'Veiculo nao cadastrado';
    missing.push('Veiculo cadastrado');
  }

  const duplicate = rows.some((row) => row.id !== editingId
    && row.fornecedor_id === form.fornecedor_id
    && onlyDigits(row.numero_nf) === onlyDigits(form.numero_nf)
    && normalizeName(row.serie_nf) === normalizeName(form.serie_nf)
    && row.status !== 'CANCELADA');
  if (duplicate) {
    fields.numero_nf = 'NF duplicada';
    fields.serie_nf = 'NF duplicada';
    missing.push('NF ja cadastrada para este fornecedor e serie');
  }

  if (!missing.length) return { fields: {}, message: '' };
  const hasVehicleError = fields.placa === 'Veiculo nao cadastrado';
  return {
    fields,
    message: hasVehicleError
      ? 'Veículo não cadastrado. Verifique a placa ou cadastre o veículo antes de continuar.'
      : `Falta preencher ou corrigir: ${[...new Set(missing)].join(', ')}. Como corrigir: preencha os campos destacados em vermelho e tente salvar novamente.`,
  };
}

function rowToForm(row) {
  if (!row) return { ...defaultRecebimento };
  const form = Object.fromEntries(Object.keys(defaultRecebimento).map((key) => [key, row[key] ?? '']));
  form.quantidade_nota = row.quantidade_nota ?? row.peso_nf ?? '';
  form.unidade_nota = row.unidade_nota || 'KG';
  form.peso_por_saca = row.peso_por_saca ?? (isSacaUnit(form.unidade_nota) ? '60' : '');
  form.valor_unitario = formatMoneyPtCompact(row.valor_unitario, Math.max(numberDecimalPlaces(row.valor_unitario), 2));
  form.valor_total = formatMoneyPt(row.valor_total, 2);
  return form;
}

function portariaRowToForm(row) {
  if (!row) return { ...defaultPortariaForm };
  return {
    ...defaultPortariaForm,
    data_entrada: row.data_entrada || todayIso(),
    hora_entrada: row.hora_entrada?.slice(0, 5) || currentTime(),
    balanca_id: row.balanca_id || '',
    placa: row.placa || '',
    veiculo_id: row.veiculo_id || '',
    motorista_id: row.motorista_id || '',
    fornecedor_id: row.fornecedor_id || '',
    cnpj_fornecedor: row.cnpj_fornecedor || row.fornecedor?.cnpj || '',
    produto_id: row.produto_id || '',
    numero_nf: row.numero_nf || '',
    serie_nf: row.serie_nf || '',
    peso_nf_kg: formatWeightPt(row.peso_nf_kg),
    transportadora_id: row.transportadora_id || '',
    tipo_veiculo: row.tipo_veiculo || row.veiculo?.tipo_veiculo || '',
    qtd_eixos: row.qtd_eixos ?? row.veiculo?.qtd_eixos ?? '',
    observacao: row.observacao || '',
    status: row.status || 'AGUARDANDO_LABORATORIO',
  };
}

function rowToLaboratorioForm(row) {
  return {
    ...defaultLaboratorioForm,
    data: row.data || todayIso(),
    laboratorio_id: row.laboratorio_id || '',
    fornecedor_nome_manual: fornecedorNome(row, ''),
    produto_nome_manual: produtoNome(row, ''),
    veiculo_placa_manual: placaVeiculo(row, ''),
    nf_numero: row.nf_numero || '',
    ticket_numero: row.ticket_numero || '',
    umidade: row.umidade ?? '',
    umidade_01: row.umidade_01 ?? '',
    umidade_02: row.umidade_02 ?? '',
    liberado_por: row.liberado_por || '',
    status: row.status || 'aprovada',
    motivo_reprovacao: row.motivo_reprovacao || '',
    observacao: row.observacao || '',
  };
}

function normalizeRecebimentoPayload(form) {
  return {
    ...form,
    qtd_eixos: nullableNumber(form.qtd_eixos),
    peso_bruto: Number(form.peso_bruto || 0),
    tara: Number(form.tara || 0),
    peso_nf: nullableNumber(form.peso_nf),
    quantidade_nota: nullableNumber(form.quantidade_nota),
    unidade_nota: form.unidade_nota || 'KG',
    peso_por_saca: nullableNumber(form.peso_por_saca),
    umidade_01: nullableNumber(form.umidade_01),
    umidade_02: nullableNumber(form.umidade_02),
    umidade: resolveHumidityValue(form),
    valor_unitario: nullableLocaleNumber(form.valor_unitario),
    valor_total: nullableLocaleNumber(form.valor_total),
    fornecedor_nome_manual: form.fornecedor_id ? null : form.fornecedor_nome_manual,
  };
}

function normalizePortariaPayload(form) {
  const payload = {
    data_entrada: form.data_entrada,
    hora_entrada: form.hora_entrada,
    placa: normalizePlate(form.placa),
    veiculo_id: form.veiculo_id,
    motorista_id: form.motorista_id || null,
    fornecedor_id: form.fornecedor_id,
    cnpj_fornecedor: onlyDigits(form.cnpj_fornecedor),
    produto_id: form.produto_id,
    numero_nf: onlyDigits(form.numero_nf),
    serie_nf: String(form.serie_nf || '').trim().toUpperCase(),
    peso_nf_kg: nullableLocaleNumber(form.peso_nf_kg),
    transportadora_id: form.transportadora_id || null,
    tipo_veiculo: form.tipo_veiculo || null,
    qtd_eixos: nullableNumber(form.qtd_eixos),
    observacao: form.observacao || null,
    status: form.status || 'AGUARDANDO_LABORATORIO',
  };

  if (form.balanca_id) payload.balanca_id = form.balanca_id;

  return payload;
}

function defaultLookupForm(fields, row = {}) {
  return Object.fromEntries(fields.map((field) => [field.name, row[field.name] ?? '']));
}

function emptyOptions() {
  return {
    balancas: [],
    veiculos: [],
    motoristas: [],
    transportadoras: [],
    fornecedores: [],
    produtos: [],
    laboratorios: [],
  };
}

function todayIso() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function currentTime() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function applyVehicleByPlate(next, value, options) {
  const plate = normalizePlate(value);
  next.placa = plate;
  next.veiculo_id = '';
  next.tipo_veiculo = '';
  next.qtd_eixos = '';
  const vehicle = (options.veiculos || []).find((item) => normalizePlate(item.placa) === plate);
  if (!vehicle) return;
  next.veiculo_id = vehicle.id;
  next.tipo_veiculo = vehicle.tipo_veiculo || '';
  next.qtd_eixos = vehicle.qtd_eixos || '';
  if (vehicle.motorista_id) next.motorista_id = vehicle.motorista_id;
  if (vehicle.transportadora_id) next.transportadora_id = vehicle.transportadora_id;
}

function applySupplier(next, value, options) {
  const supplier = (options.fornecedores || []).find((item) => item.id === value);
  next.cnpj_fornecedor = supplier?.cnpj || '';
}

function nullableNumber(value) {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function nullableLocaleNumber(value) {
  if (value === '' || value === null || value === undefined) return null;
  const normalized = normalizeLocaleNumber(value);
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function sanitizeWeightInput(value) {
  return String(value || '').replace(/[^\d,.]/g, '');
}

function formatWeightPt(value) {
  if (value === '' || value === null || value === undefined) return '';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '';
  return numeric.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 });
}

function isValidPlate(value) {
  return /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(normalizePlate(value));
}

function isValidCnpj(value) {
  const cnpj = onlyDigits(value);
  if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false;
  const calc = (base) => {
    const weights = base.length === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = base.split('').reduce((acc, digit, index) => acc + Number(digit) * weights[index], 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  const first = calc(cnpj.slice(0, 12));
  const second = calc(cnpj.slice(0, 12) + first);
  return cnpj.endsWith(`${first}${second}`);
}

function formatDocument(value) {
  const digits = onlyDigits(value);
  if (digits.length <= 11) return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, (_, a, b, c, d) => `${a}.${b}.${c}${d ? `-${d}` : ''}`).replace(/[.-]$/, '');
  return digits.slice(0, 14).replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/, (_, a, b, c, d, e) => `${a}.${b}.${c}/${d}${e ? `-${e}` : ''}`).replace(/[./-]$/, '');
}

function normalizeLocaleNumber(value) {
  const clean = String(value || '').trim().replace(/[^\d,.-]/g, '');
  if (!clean) return '';
  const lastComma = clean.lastIndexOf(',');
  const lastDot = clean.lastIndexOf('.');
  const decimalIndex = Math.max(lastComma, lastDot);
  if (decimalIndex === -1) return clean.replace(/[^\d-]/g, '');
  const integer = clean.slice(0, decimalIndex).replace(/[^\d-]/g, '');
  const decimal = clean.slice(decimalIndex + 1).replace(/\D/g, '');
  return `${integer || '0'}.${decimal}`;
}

function sanitizeMoneyInput(value) {
  return String(value || '').replace(/[^\d,.]/g, '');
}

function calculateValorTotalDisplay(pesoNf, valorUnitario) {
  const peso = nullableLocaleNumber(pesoNf);
  const unitario = nullableLocaleNumber(valorUnitario);
  if (peso === null || unitario === null) return '';
  return formatMoneyPt(peso * unitario, 2);
}

function calculateValorTotalNotaDisplay(form) {
  const quantity = nullableLocaleNumber(form.quantidade_nota) ?? nullableLocaleNumber(form.peso_nf);
  const unitario = nullableLocaleNumber(form.valor_unitario);
  if (quantity === null || unitario === null) return '';
  return formatMoneyPt(quantity * unitario, 2);
}

function normalizarQuantidadeParaKg(quantidade, unidade, pesoPorSaca = 60) {
  const numericQuantity = nullableLocaleNumber(quantidade);
  if (numericQuantity === null) return null;
  const normalizedUnit = normalizeNotaUnidade(unidade);
  if (isSacaUnit(normalizedUnit)) {
    const sackWeight = nullableLocaleNumber(pesoPorSaca) ?? 60;
    return Number((numericQuantity * sackWeight).toFixed(3));
  }
  if (isTonUnit(normalizedUnit)) {
    return Number((numericQuantity * 1000).toFixed(3));
  }
  return Number(numericQuantity.toFixed(3));
}

function normalizeNotaUnidade(unidade) {
  const value = String(unidade || 'KG').trim().toUpperCase();
  if (isSacaUnit(value)) return 'SC';
  if (isTonUnit(value)) return 'TON';
  return 'KG';
}

function isSacaUnit(unidade) {
  return ['SACA', 'SACAS', 'SC', 'SCS'].includes(String(unidade || '').trim().toUpperCase());
}

function isTonUnit(unidade) {
  return ['T', 'TON', 'TONS', 'TONELADA', 'TONELADAS'].includes(String(unidade || '').trim().toUpperCase());
}

function conversionMessage(quantity, unit, convertedWeight, sackWeight = 60) {
  const normalizedUnit = normalizeNotaUnidade(unit);
  if (isSacaUnit(normalizedUnit)) {
    return `Quantidade convertida: ${quantity || 0} SC x ${sackWeight || 60} KG = ${formatWeightPt(convertedWeight)} KG`;
  }
  if (isTonUnit(normalizedUnit)) {
    return `Quantidade convertida: ${quantity || 0} TON x 1.000 KG = ${formatWeightPt(convertedWeight)} KG`;
  }
  return `Quantidade da nota em KG: ${formatWeightPt(convertedWeight)}`;
}

function resolveHumidityValue(primary = {}, fallback = {}) {
  const first = nullableNumber(primary.umidade_01 ?? fallback.umidade_01);
  const second = nullableNumber(primary.umidade_02 ?? fallback.umidade_02);
  if (first !== null && second !== null) return Number(((first + second) / 2).toFixed(3));
  if (first !== null) return first;
  if (second !== null) return second;
  return nullableNumber(primary.umidade ?? fallback.umidade);
}

function calculateHumidityAverageDisplay(firstValue, secondValue, fallbackValue) {
  const average = resolveHumidityValue({ umidade_01: firstValue, umidade_02: secondValue, umidade: fallbackValue });
  return average === null ? '' : String(average);
}

function inputDecimalPlaces(value) {
  const text = String(value || '');
  const lastComma = text.lastIndexOf(',');
  const lastDot = text.lastIndexOf('.');
  const decimalIndex = Math.max(lastComma, lastDot);
  if (decimalIndex === -1) return 0;
  return text.slice(decimalIndex + 1).replace(/\D/g, '').length;
}

function numberDecimalPlaces(value) {
  const text = String(value ?? '');
  const decimal = text.includes('e-')
    ? Number(value).toFixed(Number(text.split('e-')[1] || 6)).replace(/0+$/, '').split('.')[1]
    : text.split('.')[1];
  return decimal?.length || 0;
}

function formatMoneyPt(value, decimals = 2) {
  if (value === '' || value === null || value === undefined) return '';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '';
  const scale = Math.max(0, Number(decimals) || 0);
  const [integer, decimal = ''] = numeric.toFixed(scale).split('.');
  const formattedInteger = formatThousandsPt(integer);
  return scale ? `${formattedInteger},${decimal}` : formattedInteger;
}

function formatMoneyPtCompact(value, decimals = 6, minDecimals = 2) {
  const formatted = formatMoneyPt(value, decimals);
  if (!formatted || !formatted.includes(',')) return formatted;
  const [integer, decimal = ''] = formatted.split(',');
  const min = Math.max(0, Number(minDecimals) || 0);
  const trimmed = decimal.replace(/0+$/, '');
  const finalDecimal = trimmed.length < min ? decimal.slice(0, min) : trimmed;
  return finalDecimal ? `${integer},${finalDecimal}` : integer;
}

function formatThousandsPt(value) {
  const clean = String(value || '0').replace(/^0+(?=\d)/, '') || '0';
  return clean.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function displayDecimalPlaces(value, fallback = 2) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
  return Math.min(Math.max(Math.trunc(numeric), 2), 6);
}

function findDuplicateLookup(config, form, rows, editingId) {
  const duplicate = rows.find((row) => {
    if (row.id === editingId) return false;
    if (config.table === 'recebimento_veiculos') return normalizePlate(row.placa) === normalizePlate(form.placa);
    if (config.table === 'recebimento_motoristas') {
      const currentCpf = onlyDigits(form.cpf);
      return (currentCpf && onlyDigits(row.cpf) === currentCpf) || normalizeName(row.nome) === normalizeName(form.nome);
    }
    if (config.table === 'recebimento_transportadoras') {
      const currentCnpj = onlyDigits(form.cnpj);
      return (currentCnpj && onlyDigits(row.cnpj) === currentCnpj) || normalizeName(row.nome) === normalizeName(form.nome);
    }
    if (config.table === 'recebimento_laboratorios') return normalizeName(row.nome) === normalizeName(form.nome);
    return false;
  });

  if (!duplicate) return '';

  const label = config.table === 'recebimento_veiculos'
    ? 'placa'
    : config.table === 'recebimento_transportadoras' && onlyDigits(form.cnpj) && onlyDigits(duplicate.cnpj) === onlyDigits(form.cnpj)
      ? 'CNPJ'
      : config.table === 'recebimento_motoristas' && onlyDigits(form.cpf) && onlyDigits(duplicate.cpf) === onlyDigits(form.cpf)
        ? 'CPF'
        : 'nome';

  return `${config.label} ja possui cadastro com este ${label}. Como corrigir: use o cadastro existente ou edite o registro ja salvo.`;
}

function normalizeName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w]+/g, '')
    .toLowerCase();
}

function normalizePlate(value) {
  return String(value || '').replace(/[^a-z0-9]/gi, '').toUpperCase();
}

function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function filterRecebimentos(rows, query) {
  const term = query.toLowerCase().trim();
  if (!term) return rows;
  return rows.filter((row) => [
    row.nf_numero,
    fornecedorNome(row, ''),
    produtoNome(row, ''),
    placaVeiculo(row, ''),
    row.balanca?.nome,
  ].filter(Boolean).some((value) => String(value).toLowerCase().includes(term)));
}

function fornecedorNome(row, fallback = '-') {
  return row.fornecedor?.nome || row.fornecedor_nome_manual || fallback;
}

function balancaNome(row, options, fallback = '-') {
  return row.balanca?.nome || options?.balancas?.find((item) => item.id === row.balanca_id)?.nome || fallback;
}

function fornecedorGroupKey(row) {
  if (row.fornecedor_id || row.fornecedor?.id) return `id:${row.fornecedor_id || row.fornecedor.id}`;
  const normalized = normalizeSupplierName(row.fornecedor_nome_manual || row.fornecedor?.nome || '');
  return normalized ? `manual:${normalized}` : 'manual:sem-fornecedor';
}

function normalizeSupplierName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\bs\/a\b/g, ' sa ')
    .replace(/[^\w\s]+/g, ' ')
    .replace(/\b(ltda|limitada|sa|s|a|eireli|me|epp|do|da|de|dos|das)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeProductName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\w\s]+/g, ' ')
    .replace(/\b(em|grao|graos|granel)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function productTokens(value) {
  return normalizeProductName(value).split(/\s+/).filter(Boolean);
}

function findFornecedorFromNfe(parsed, fornecedores = []) {
  const documentoXml = onlyDigits(parsed?.emitente?.documento);
  if (!documentoXml) return null;
  return (fornecedores || []).find((fornecedor) => onlyDigits(fornecedor.cnpj) === documentoXml) || null;
}

function findTransportadoraFromNfe(parsed, transportadoras = []) {
  const documentoXml = onlyDigits(parsed?.transportadora?.cnpj);
  if (documentoXml) {
    const byDocument = (transportadoras || []).find((item) => onlyDigits(item.cnpj) === documentoXml);
    if (byDocument) return byDocument;
  }
  const normalizedName = normalizeSupplierName(parsed?.transportadora?.nome);
  if (!normalizedName) return null;
  return (transportadoras || []).find((item) => normalizeSupplierName(item.nome) === normalizedName) || null;
}

function findVeiculoFromNfe(parsed, veiculos = []) {
  const plate = normalizePlate(parsed?.placaVeiculo);
  if (!plate) return null;
  return (veiculos || []).find((item) => normalizePlate(item.placa) === plate) || null;
}

function findProdutoFromNfe(item, produtos = []) {
  const normalizedXmlName = normalizeProductName(item?.nome);
  if (!normalizedXmlName) return null;
  const candidates = (produtos || [])
    .map((produto) => {
      const normalizedProduct = normalizeProductName(produto.nome);
      return { produto, score: productMatchScore(normalizedXmlName, normalizedProduct) };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  if (!candidates.length) return null;
  const [best, second] = candidates;
  if (second && second.score === best.score) return null;
  return best.produto;
}

function findProductByManualName(name, produtos = []) {
  const normalizedManualName = normalizeProductName(name);
  if (!normalizedManualName) return null;
  const candidates = (produtos || [])
    .map((produto) => {
      const normalizedProduct = normalizeProductName(produto.nome);
      return { produto, score: productMatchScore(normalizedManualName, normalizedProduct) };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  if (!candidates.length) return null;
  const [best, second] = candidates;
  if (second && second.score === best.score) return null;
  return best.produto;
}

function resolveManualProductFields(name, produtos = []) {
  const product = findProductByManualName(name, produtos);
  if (!product) return {};
  return { produto_id: product.id, produto_nome_manual: '' };
}

function productMatchScore(normalizedXmlName, normalizedProduct) {
  if (!normalizedXmlName || !normalizedProduct) return 0;
  if (normalizedProduct === normalizedXmlName) return 100;

  const xmlTokens = productTokens(normalizedXmlName);
  const productTokenList = productTokens(normalizedProduct);
  if (!xmlTokens.length || !productTokenList.length) return 0;

  const xmlSet = new Set(xmlTokens);
  const productSet = new Set(productTokenList);
  const sameTokenSet = xmlSet.size === productSet.size && [...xmlSet].every((token) => productSet.has(token));
  if (sameTokenSet) return 95;

  const xmlHasAllProductTokens = [...productSet].every((token) => xmlSet.has(token));
  const productHasAllXmlTokens = [...xmlSet].every((token) => productSet.has(token));

  if (xmlHasAllProductTokens && xmlTokens.length === productTokenList.length) return 90;
  if (productHasAllXmlTokens && xmlTokens.length === productTokenList.length) return 90;

  return 0;
}

function resolveNfeProduct(parsed, produtos = []) {
  const itens = parsed?.itens || [];
  const matchedItems = itens
    .map((item) => ({ item, product: findProdutoFromNfe(item, produtos) }))
    .filter((entry) => entry.product);

  if (!matchedItems.length) {
    const totalQuantity = sumNfeItems(itens, 'quantidade');
    const totalValue = sumNfeItems(itens, 'valorTotal') ?? parsed?.valorTotalNota;
    return {
      item: itens[0] || null,
      product: null,
      quantity: totalQuantity ?? parsed?.pesoLiquidoNf,
      unit: itens[0]?.unidade || 'KG',
      totalValue,
      unitValue: calculateUnitValue(totalValue, totalQuantity ?? parsed?.pesoLiquidoNf),
      unitDecimalPlaces: 2,
    };
  }

  const grouped = new Map();
  for (const { item, product } of matchedItems) {
    const current = grouped.get(product.id) || {
      item,
      product,
      quantity: 0,
      totalValue: 0,
      unitDecimalPlaces: item.valorUnitarioDecimais || 2,
      unit: item.unidade || 'KG',
    };
    current.quantity += Number(item.quantidade || 0);
    current.totalValue += Number(item.valorTotal || 0);
    current.unitDecimalPlaces = Math.max(current.unitDecimalPlaces, item.valorUnitarioDecimais || 0);
    grouped.set(product.id, current);
  }

  const sorted = [...grouped.values()].sort((a, b) => Number(b.totalValue || b.quantity || 0) - Number(a.totalValue || a.quantity || 0));
  const selected = sorted[0];
  const quantity = selected.quantity || parsed?.pesoLiquidoNf;
  const totalValue = selected.totalValue || parsed?.valorTotalNota;
  const unitValueFromXml = grouped.size === 1 && selected.item?.valorUnitario ? selected.item.valorUnitario : null;

  return {
    ...selected,
    quantity,
    totalValue,
    unitValue: unitValueFromXml ?? calculateUnitValue(totalValue, quantity),
    unit: selected.unit || selected.item?.unidade || 'KG',
  };
}

function sumNfeItems(items, key) {
  const values = (items || []).map((item) => Number(item?.[key] || 0)).filter((value) => Number.isFinite(value) && value > 0);
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0);
}

function calculateUnitValue(totalValue, quantity) {
  const total = Number(totalValue || 0);
  const qty = Number(quantity || 0);
  if (!Number.isFinite(total) || !Number.isFinite(qty) || qty <= 0) return null;
  return total / qty;
}

function produtoNome(row, fallback = '-') {
  return row.produto?.nome || row.produto_nome_manual || fallback;
}

function placaVeiculo(row, fallback = '-') {
  return row.veiculo_placa_manual || row.veiculo?.placa || fallback;
}

function formatPlateDisplay(value) {
  const cleaned = String(value || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  if (!cleaned) return '-';
  if (cleaned.length === 7) return `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`;
  return String(value || '').trim().toUpperCase().replace(/\s+/g, ' ') || '-';
}

function formatPercent(value) {
  const number = nullableNumber(value);
  if (number === null) return '';
  return `${number.toFixed(2)}%`;
}

function sortRecebimentoRows(rows) {
  return [...rows].sort((a, b) => {
    const priorityDiff = recebimentoSortPriority(a) - recebimentoSortPriority(b);
    if (priorityDiff) return priorityDiff;
    return rowDateTimeValue(b) - rowDateTimeValue(a);
  });
}

function sortReportRows(rows) {
  return [...rows].sort((a, b) => {
    const supplierDiff = normalizeName(fornecedorNome(a)).localeCompare(normalizeName(fornecedorNome(b)), 'pt-BR');
    if (supplierDiff) return supplierDiff;
    const productDiff = normalizeName(produtoNome(a)).localeCompare(normalizeName(produtoNome(b)), 'pt-BR');
    if (productDiff) return productDiff;
    const dateDiff = String(a.data || '').localeCompare(String(b.data || ''));
    if (dateDiff) return dateDiff;
    return String(a.nf_numero || '').localeCompare(String(b.nf_numero || ''), 'pt-BR', { numeric: true });
  });
}

function recebimentoSortPriority(row) {
  if (isLaboratorioPendenteBalanca(row)) return 0;
  if (row.status === 'aprovada') return 1;
  return 2;
}

function rowDateTimeValue(row) {
  const dateValue = row.data ? new Date(`${row.data}T00:00:00`).getTime() : 0;
  const tieBreaker = row.created_at ? new Date(row.created_at).getTime() / 100000000 : 0;
  const value = dateValue + tieBreaker;
  return Number.isFinite(value) ? value : 0;
}

function isLaboratorioPendenteBalanca(row) {
  return row.status === 'aprovada'
    && (row.veiculo_id || row.veiculo_placa_manual)
    && (!Number(row.peso_bruto || 0) || !Number(row.tara || 0) || !row.nf_numero || !row.balanca_id);
}

function isAprovadaLaboratorio(row) {
  return row.status === 'aprovada';
}

function isRecebimentoFinalizadoBalanca(row) {
  return row.status === 'aprovada' && !isLaboratorioPendenteBalanca(row);
}

function recebimentoRowClass(row) {
  const base = 'border-b last:border-0';
  if (isLaboratorioPendenteBalanca(row)) return `${base} bg-amber-50/80 hover:bg-amber-100/80`;
  return base;
}

function recebimentoStatusLabel(row) {
  if (isLaboratorioPendenteBalanca(row)) return 'Aprovado pelo Laboratório - Pendente finalizar recebimento';
  if (isRecebimentoFinalizadoBalanca(row)) return 'Aprovada balança';
  return statusLabel(row.status);
}

function groupSum(rows, getName, field) {
  const map = new Map();
  rows.forEach((row) => {
    const name = getName(row);
    map.set(name, (map.get(name) || 0) + Number(row[field] || 0));
  });
  return Array.from(map, ([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

function groupSupplierSum(rows, field) {
  const map = new Map();
  rows.forEach((row) => {
    const key = fornecedorGroupKey(row);
    const current = map.get(key) || { name: fornecedorNome(row, 'Sem fornecedor'), value: 0 };
    current.value += Number(row[field] || 0);
    map.set(key, current);
  });
  return Array.from(map.values()).sort((a, b) => b.value - a.value);
}

function groupCount(rows, getName) {
  const map = new Map();
  rows.forEach((row) => {
    const name = getName(row);
    map.set(name, (map.get(name) || 0) + 1);
  });
  return Array.from(map, ([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

function buildDashboardStatus(aprovadasLaboratorio, recebimentosBalanca, pendentesFinalizar) {
  return [
    { name: 'Aprovadas no Laboratório', value: aprovadasLaboratorio.length, color: chartColor(1) },
    { name: 'Finalizadas na Balança', value: recebimentosBalanca.length, color: chartColor(3) },
    { name: 'Pendentes de Recebimento', value: pendentesFinalizar.length, color: chartColor(2) },
  ];
}

function buildProductsDistribution(rows) {
  const total = rows.reduce((sum, row) => sum + Number(row.peso_liquido || 0), 0);
  if (!total) return [];

  const map = new Map();
  rows.forEach((row) => {
    const name = produtoNome(row, 'Sem produto');
    map.set(name, (map.get(name) || 0) + Number(row.peso_liquido || 0));
  });

  const ranked = Array.from(map, ([name, kgTotal]) => ({ name, kgTotal }))
    .filter((item) => item.kgTotal > 0)
    .sort((a, b) => b.kgTotal - a.kgTotal);

  const main = ranked.slice(0, 10);
  const othersTotal = ranked.slice(10).reduce((sum, item) => sum + item.kgTotal, 0);
  const data = othersTotal > 0 ? [...main, { name: 'Outros', kgTotal: othersTotal }] : main;

  return data.map((item, index) => ({
    ...item,
    percent: total ? (item.kgTotal / total) * 100 : 0,
    color: chartColor(index),
  }));
}

function buildSupplierDifferences(rows) {
  const map = new Map();

  rows.forEach((row) => {
    const key = fornecedorGroupKey(row);
    const current = map.get(key) || { name: fornecedorNome(row, 'Sem fornecedor'), kgNota: 0, kgRecebido: 0, diferencaKg: 0, percentualDiferenca: 0 };
    current.kgNota += pesoNotaAgregado(row);
    current.kgRecebido += Number(row.peso_liquido || 0);
    current.diferencaKg = current.kgRecebido - current.kgNota;
    current.percentualDiferenca = current.kgNota ? (current.diferencaKg / current.kgNota) * 100 : 0;
    map.set(key, current);
  });

  return Array.from(map.values())
    .filter((item) => item.kgNota || item.kgRecebido || item.diferencaKg)
    .sort((a, b) => Math.abs(b.diferencaKg) - Math.abs(a.diferencaKg))
    .slice(0, 10);
}

function buildSupplierMoisture(rows) {
  const map = new Map();

  rows.forEach((row) => {
    const umidade = Number(row.umidade);
    if (!Number.isFinite(umidade) || umidade <= 0) return;

    const key = fornecedorGroupKey(row);
    const kgRecebido = Number(row.peso_liquido || 0);
    const weight = kgRecebido > 0 ? kgRecebido : 1;
    const current = map.get(key) || { name: fornecedorNome(row, 'Sem fornecedor'), weightedMoisture: 0, weight: 0, registros: 0, kgRecebido: 0 };
    current.weightedMoisture += umidade * weight;
    current.weight += weight;
    current.registros += 1;
    current.kgRecebido += kgRecebido;
    map.set(key, current);
  });

  return Array.from(map.values())
    .map((item) => ({
      name: item.name,
      umidadeMedia: item.weight ? item.weightedMoisture / item.weight : 0,
      registros: item.registros,
      kgRecebido: item.kgRecebido,
    }))
    .sort((a, b) => b.umidadeMedia - a.umidadeMedia)
    .slice(0, 10);
}

function buildBestSuppliersRanking(rows) {
  const map = new Map();

  rows.forEach((row) => {
    const key = fornecedorGroupKey(row);
    const kgRecebido = Number(row.peso_liquido || 0);
    const kgNota = pesoNotaAgregado(row);
    const current = map.get(key) || {
      name: fornecedorNome(row, 'Sem fornecedor'),
      cargas: 0,
      aprovadas: 0,
      kgRecebido: 0,
      kgNota: 0,
      diferencaAbsKg: 0,
    };

    current.cargas += 1;
    current.aprovadas += row.status === 'aprovada' ? 1 : 0;
    current.kgRecebido += kgRecebido;
    current.kgNota += kgNota;
    current.diferencaAbsKg += Math.abs(kgRecebido - kgNota);
    map.set(key, current);
  });

  const suppliers = Array.from(map.values()).filter((item) => item.cargas > 0);
  const maxKg = Math.max(...suppliers.map((item) => item.kgRecebido), 1);

  return suppliers
    .map((item) => {
      const taxaAprovacao = item.cargas ? (item.aprovadas / item.cargas) * 100 : 0;
      const divergenciaPercentualAbs = item.kgNota ? (item.diferencaAbsKg / item.kgNota) * 100 : 0;
      const qualidadeDivergencia = Math.max(0, 100 - Math.min(divergenciaPercentualAbs * 4, 100));
      const volumeScore = Math.min((item.kgRecebido / maxKg) * 100, 100);
      const score = (taxaAprovacao * 0.45) + (qualidadeDivergencia * 0.4) + (volumeScore * 0.15);

      return {
        ...item,
        taxaAprovacao,
        divergenciaPercentualAbs,
        score,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
}

function statusLabel(status) {
  return {
    pendente: 'Pendente',
    aprovada: 'Aprovada',
    reprovada: 'Reprovada',
    cancelada: 'Cancelada',
  }[status] || status || '-';
}

function differenceClass(value) {
  const numeric = Number(value || 0);
  if (numeric > 0) return 'font-extrabold text-blue-700';
  if (numeric < 0) return 'font-extrabold text-rose-700';
  return 'font-semibold text-slate-700';
}

function chartColor(index) {
  const chartColors = [
    '#0F172A',
    '#0F766E',
    '#D97706',
    '#2563EB',
    '#16A34A',
    '#DC2626',
    '#7C3AED',
    '#DB2777',
    '#0891B2',
    '#65A30D',
    '#EA580C',
    '#4F46E5',
  ];
  return chartColors[index % chartColors.length];
}

function compactKg(value) {
  const numeric = Number(value || 0);
  if (Math.abs(numeric) >= 1000) return `${Math.round(numeric / 1000)}t`;
  return `${Math.round(numeric)}kg`;
}

function label(value) {
  return String(value).replace(/_/g, ' ');
}

function formatGeneric(value) {
  if (value === true) return 'Ativo';
  if (value === false) return 'Inativo';
  return value ?? '-';
}
