import {
  Check,
  Download,
  Edit,
  FileUp,
  FlaskConical,
  Plus,
  RotateCcw,
  Save,
  Search,
  Trash2,
  Truck,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
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
  createLookup,
  createRecebimento,
  deleteLookup,
  deleteRecebimento,
  exportRecebimentosCsv,
  findOrCreateLookup,
  listLookup,
  listRecebimentos,
  loadBalancasOptions,
  lookupTables,
  rejectRecebimento,
  toUserError,
  updateLookup,
  updateRecebimento,
} from '../services/balancasService.js';
import { parseNfeRecebimento } from '../lib/nfeRecebimento.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { dateBr, kg } from '../lib/formatters.js';

const tabs = [
  { key: 'dashboard', label: 'Dashboard' },
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
  tipo_veiculo: '',
  qtd_eixos: '',
  nf_numero: '',
  nf_chave_acesso: '',
  peso_bruto: '',
  tara: '',
  peso_nf: '',
  umidade: '',
  ticket_numero: '',
  liberado_por: '',
  observacao: '',
  valor_unitario: '',
  valor_total: '',
};

const defaultLaboratorioForm = {
  data: todayIso(),
  laboratorio_id: '',
  fornecedor_id: '',
  produto_id: '',
  veiculo_id: '',
  nf_numero: '',
  ticket_numero: '',
  umidade: '',
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
      {activeTab === 'recebimentos' && <RecebimentosTab rows={rows} options={options} can={can} loading={loading} reload={load} setError={setError} setMessage={setMessage} />}
      {activeTab === 'laboratorio' && <LaboratorioTab rows={rows} options={options} can={can} reload={load} setError={setError} setMessage={setMessage} />}
      {activeTab === 'cadastros' && <CadastrosTab activeCadastro={cadastroParam} onCadastroChange={selectCadastro} can={can} setError={setError} setMessage={setMessage} reloadMain={load} />}
      {activeTab === 'relatorios' && <RelatoriosTab rows={rows} options={options} filters={filters} setFilters={setFilters} applyFilters={applyFilters} clearFilters={clearFilters} can={can} />}
    </div>
  );
}

function DashboardTab({ rows, options, filters, setFilters, applyFilters, clearFilters, loading }) {
  const metrics = useMemo(() => {
    return {
      cargas: rows.length,
      kgRecebidos: rows.reduce((sum, row) => sum + Number(row.peso_liquido || 0), 0),
      fornecedores: new Set(rows.map((row) => row.fornecedor_id || row.fornecedor?.id).filter(Boolean)).size,
      pendentes: rows.filter((row) => row.status === 'pendente').length,
      aprovadas: rows.filter((row) => row.status === 'aprovada').length,
      reprovadas: rows.filter((row) => row.status === 'reprovada').length,
    };
  }, [rows]);

  const bySupplier = groupSum(rows, (row) => row.fornecedor?.nome || 'Sem fornecedor', 'peso_liquido').slice(0, 6);
  const byStatus = groupCount(rows, (row) => statusLabel(row.status));
  const productsDistribution = useMemo(() => buildProductsDistribution(rows), [rows]);
  const supplierDifferences = useMemo(() => buildSupplierDifferences(rows), [rows]);
  const supplierMoisture = useMemo(() => buildSupplierMoisture(rows), [rows]);
  const bestSuppliers = useMemo(() => buildBestSuppliersRanking(rows), [rows]);

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
            <Metric title="Cargas no periodo" value={metrics.cargas} icon={Truck} />
            <Metric title="KG recebidos no periodo" value={kg(metrics.kgRecebidos)} icon={Truck} />
            <Metric title="Fornecedores no periodo" value={metrics.fornecedores} icon={Users} />
            <Metric title="Pendentes laboratório" value={metrics.pendentes} icon={FlaskConical} />
          </section>

          <section className="grid gap-5 xl:grid-cols-2">
            <ChartCard title="Volume por fornecedor">
              <BarList data={bySupplier} valueFormatter={kg} />
            </ChartCard>
            <ChartCard title="Status dos recebimentos">
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

function RecebimentosTab({ rows, options, can, loading, reload, setError, setMessage }) {
  const [query, setQuery] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const filtered = filterRecebimentos(rows, query);
  const releasedForScale = rows.filter((row) =>
    row.status === 'aprovada'
    && row.veiculo_id
    && (!Number(row.peso_bruto || 0) || !Number(row.tara || 0) || !row.nf_numero)
  );

  function newForm() {
    setEditing(null);
    setFormOpen(true);
  }

  function edit(row) {
    setEditing(row);
    setFormOpen(true);
  }

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
        <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 shadow-panel">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-sm font-extrabold uppercase tracking-wide text-emerald-800">Aprovado laboratorio com pendencia de balanca</h2>
              <p className="mt-1 text-sm font-semibold text-emerald-700">Preencha o recebimento de acordo com a placa do veiculo liberado.</p>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-extrabold text-emerald-700">{releasedForScale.length} carga(s)</span>
          </div>
          <div className="mt-3 grid gap-2">
            {releasedForScale.map((row) => (
              <div key={row.id} className="flex flex-col gap-2 rounded-lg bg-white p-3 text-sm shadow-sm md:flex-row md:items-center md:justify-between">
                <div className="grid gap-1 font-semibold text-slate-700 md:grid-cols-5 md:gap-4">
                  <span>NF: <strong>{row.nf_numero || '-'}</strong></span>
                  <span>Placa: <strong>{row.veiculo?.placa || '-'}</strong></span>
                  <span>Produto: <strong>{row.produto?.nome || '-'}</strong></span>
                  <span>Fornecedor: <strong>{row.fornecedor?.nome || '-'}</strong></span>
                  <span>Umidade: <strong>{row.umidade ? `${Number(row.umidade).toFixed(2)}%` : '-'}</strong></span>
                </div>
                <button type="button" onClick={() => edit(row)} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-tijuca-600 px-3 text-xs font-bold text-white hover:bg-tijuca-700">
                  <Edit size={14} /> Preencher balança
                </button>
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
        <RecebimentoForm
          row={editing}
          options={options}
          onClose={() => setFormOpen(false)}
          onSaved={async () => {
            setFormOpen(false);
            setMessage(editing ? 'Recebimento atualizado com sucesso.' : 'Recebimento cadastrado com sucesso.');
            await reload();
          }}
          setError={setError}
        />
      )}

      <RecebimentosTable rows={filtered} loading={loading} can={can} onEdit={edit} onDelete={remove} />
    </div>
  );
}

function RecebimentoForm({ row, options, onClose, onSaved, setError }) {
  const [form, setForm] = useState(rowToForm(row));
  const [localOptions, setLocalOptions] = useState(options);
  const [xmlInfo, setXmlInfo] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLocalOptions(options);
  }, [options]);

  function updateField(name, value) {
    setForm((current) => {
      const next = { ...current, [name]: value };
      if (name === 'veiculo_id') {
        const vehicle = localOptions.veiculos.find((item) => item.id === value);
        if (vehicle) {
          next.tipo_veiculo = vehicle.tipo_veiculo || '';
          next.qtd_eixos = vehicle.qtd_eixos || '';
        }
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
      const mainItem = parsed.itens[0] || {};
      const [carrier, vehicle] = await Promise.all([
        parsed.transportadora.nome
          ? findOrCreateLookup('recebimento_transportadoras', 'nome', parsed.transportadora.nome, { nome: parsed.transportadora.nome, cnpj: parsed.transportadora.cnpj })
          : null,
        parsed.placaVeiculo
          ? findOrCreateLookup('recebimento_veiculos', 'placa', parsed.placaVeiculo, { placa: parsed.placaVeiculo })
          : null,
      ]);

      setLocalOptions((current) => ({
        ...current,
        transportadoras: mergeOption(current.transportadoras, carrier),
        veiculos: mergeOption(current.veiculos, vehicle),
      }));

      setForm((current) => ({
        ...current,
        nf_numero: parsed.numero || current.nf_numero,
        nf_chave_acesso: parsed.chaveAcesso || current.nf_chave_acesso,
        data: current.data || todayIso(),
        transportadora_id: carrier?.id || current.transportadora_id,
        veiculo_id: vehicle?.id || current.veiculo_id,
        peso_nf: parsed.pesoLiquidoNf ?? current.peso_nf,
        valor_unitario: mainItem.valorUnitario ?? current.valor_unitario,
        valor_total: parsed.valorTotalNota ?? current.valor_total,
      }));
      setXmlInfo(`XML importado: NF ${parsed.numero || '-'} | Fornecedor e produto devem ser selecionados manualmente.`);
    } catch (err) {
      setError(toUserError(err));
    }
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = normalizeRecebimentoPayload(form);
      if (row?.id) await updateRecebimento(row.id, payload);
      else await createRecebimento({ ...payload, status: 'pendente' });
      await onSaved();
    } catch (err) {
      setError(toUserError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-panel">
      <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-sm font-extrabold uppercase tracking-wide text-slate-700">{row ? 'Editar recebimento' : 'Novo recebimento'}</h2>
          <p className="mt-1 text-sm text-slate-500">Pesos calculados pelo banco: peso líquido, diferença em KG e diferença percentual.</p>
        </div>
        {!row && (
          <label className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50">
            <FileUp size={17} /> Importar XML da NF-e
            <input type="file" accept=".xml,text/xml,application/xml" onChange={importXml} className="sr-only" />
          </label>
        )}
      </div>

      {xmlInfo && <Alert tone="success" text={xmlInfo} />}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Input label="Data" type="date" value={form.data} onChange={(value) => updateField('data', value)} required />
        <Select label="Balança" value={form.balanca_id} onChange={(value) => updateField('balanca_id', value)} options={localOptions.balancas} />
        <Select label="Laboratório" value={form.laboratorio_id} onChange={(value) => updateField('laboratorio_id', value)} options={localOptions.laboratorios} />
        <Input label="Número da NF" value={form.nf_numero} onChange={(value) => updateField('nf_numero', value)} />
        <Select label="Fornecedor" value={form.fornecedor_id} onChange={(value) => updateField('fornecedor_id', value)} options={localOptions.fornecedores} />
        <Select label="Produto" value={form.produto_id} onChange={(value) => updateField('produto_id', value)} options={localOptions.produtos} />
        <Select label="Veículo" value={form.veiculo_id} onChange={(value) => updateField('veiculo_id', value)} options={localOptions.veiculos} labelKey="placa" />
        <Select label="Motorista" value={form.motorista_id} onChange={(value) => updateField('motorista_id', value)} options={localOptions.motoristas} />
        <Select label="Transportadora" value={form.transportadora_id} onChange={(value) => updateField('transportadora_id', value)} options={localOptions.transportadoras} />
        <Input label="Tipo de veículo" value={form.tipo_veiculo} onChange={(value) => updateField('tipo_veiculo', value)} />
        <Input label="Qtd. eixos" type="number" value={form.qtd_eixos} onChange={(value) => updateField('qtd_eixos', value)} />
        <Input label="Chave da NF-e" value={form.nf_chave_acesso} onChange={(value) => updateField('nf_chave_acesso', value)} />
        <Input label="Peso bruto KG" type="number" step="0.001" value={form.peso_bruto} onChange={(value) => updateField('peso_bruto', value)} required />
        <Input label="Tara KG" type="number" step="0.001" value={form.tara} onChange={(value) => updateField('tara', value)} required />
        <Input label="Peso NF KG" type="number" step="0.001" value={form.peso_nf} onChange={(value) => updateField('peso_nf', value)} />
        <Input label="Umidade %" type="number" step="0.001" value={form.umidade} onChange={(value) => updateField('umidade', value)} />
        <Input label="Ticket" value={form.ticket_numero} onChange={(value) => updateField('ticket_numero', value)} />
        <Input label="Liberado por" value={form.liberado_por} onChange={(value) => updateField('liberado_por', value)} />
        <Input label="Valor unitário" type="number" step="0.0000000001" value={form.valor_unitario} onChange={(value) => updateField('valor_unitario', value)} />
        <Input label="Valor total" type="number" step="0.01" value={form.valor_total} onChange={(value) => updateField('valor_total', value)} />
      </div>

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

function LaboratorioTab({ rows, options, can, reload, setError, setMessage }) {
  const [edits, setEdits] = useState({});
  const [reason, setReason] = useState({});
  const [labForm, setLabForm] = useState(defaultLaboratorioForm);
  const [savingLab, setSavingLab] = useState(false);
  const pending = rows.filter((row) => row.status === 'pendente');
  const approved = rows.filter((row) => row.status === 'aprovada');

  function updateEdit(id, field, value) {
    setEdits((current) => ({ ...current, [id]: { ...current[id], [field]: value } }));
  }

  async function process(row, action) {
    const edit = edits[row.id] || {};
    try {
      if (action === 'aprovar') {
        await approveRecebimento(row.id, {
          ticket_numero: edit.ticket_numero || row.ticket_numero,
          umidade: edit.umidade ?? row.umidade,
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
          ticket_numero: edit.ticket_numero || row.ticket_numero,
          umidade: edit.umidade ?? row.umidade,
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

  async function saveManualRelease(event) {
    event.preventDefault();
    setError('');

    if (!labForm.veiculo_id || !labForm.fornecedor_id || !labForm.produto_id) {
      setError('Informe veículo, fornecedor e produto para liberar a carga. Como corrigir: selecione os três campos obrigatórios e tente novamente.');
      return;
    }
    if (labForm.status === 'reprovada' && !labForm.motivo_reprovacao?.trim()) {
      setError('Informe o motivo da reprovacao. Como corrigir: preencha o motivo quando marcar o resultado como reprovado.');
      return;
    }

    setSavingLab(true);
    try {
      await createRecebimento({
        ...normalizeRecebimentoPayload({
          ...defaultRecebimento,
          ...labForm,
          peso_bruto: 0,
          tara: 0,
          peso_nf: '',
        }),
        status: labForm.status || 'aprovada',
        motivo_reprovacao: labForm.status === 'reprovada' ? labForm.motivo_reprovacao : null,
      });
      setLabForm({ ...defaultLaboratorioForm, data: todayIso() });
      setMessage(labForm.status === 'reprovada'
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
          <h2 className="text-sm font-extrabold uppercase tracking-wide text-slate-700">Nova liberação manual</h2>
          <p className="mt-1 text-sm text-slate-500">Use quando o grão chegar primeiro no laboratório. A balança completa NF-e, pesos e dados finais depois.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Input label="Data" type="date" value={labForm.data} onChange={(value) => updateLabForm('data', value)} required />
          <Select label="Laboratório" value={labForm.laboratorio_id} onChange={(value) => updateLabForm('laboratorio_id', value)} options={options.laboratorios} />
          <Select label="Fornecedor" value={labForm.fornecedor_id} onChange={(value) => updateLabForm('fornecedor_id', value)} options={options.fornecedores} required />
          <Select label="Produto" value={labForm.produto_id} onChange={(value) => updateLabForm('produto_id', value)} options={options.produtos} required />
          <Select label="Veículo / placa" value={labForm.veiculo_id} onChange={(value) => updateLabForm('veiculo_id', value)} options={options.veiculos} labelKey="placa" required />
          <Input label="Numero da nota" value={labForm.nf_numero} onChange={(value) => updateLabForm('nf_numero', value)} />
          <Input label="Ticket" value={labForm.ticket_numero} onChange={(value) => updateLabForm('ticket_numero', value)} />
          <Input label="Umidade %" type="number" step="0.001" value={labForm.umidade} onChange={(value) => updateLabForm('umidade', value)} />
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
        <div>
          <button disabled={savingLab} className="inline-flex h-11 items-center gap-2 rounded-lg bg-tijuca-600 px-5 text-sm font-extrabold text-white hover:bg-tijuca-700 disabled:opacity-60">
            <Save size={17} /> {savingLab ? 'Salvando...' : 'Salvar liberação do laboratório'}
          </button>
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
          <h2 className="text-sm font-extrabold uppercase tracking-wide text-slate-700">Cargas aprovadas ({approved.length})</h2>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">Liberadas</span>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-panel">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="text-xs font-bold uppercase text-slate-500">
              <tr>
                {['Data', 'NF', 'Fornecedor', 'Produto', 'Placa', 'Ticket', 'Umidade', 'Liberado por', 'Peso liquido', 'PDF'].map((head) => <th key={head} className="border-b px-3 py-3">{head}</th>)}
              </tr>
            </thead>
            <tbody>
              {approved.map((row) => (
                <tr key={row.id} className="border-b last:border-0">
                  <td className="px-3 py-3">{dateBr(row.data)}</td>
                  <td className="px-3 py-3">{row.nf_numero || '-'}</td>
                  <td className="px-3 py-3 font-semibold text-slate-800">{row.fornecedor?.nome || '-'}</td>
                  <td className="px-3 py-3">{row.produto?.nome || '-'}</td>
                  <td className="px-3 py-3">{row.veiculo?.placa || '-'}</td>
                  <td className="px-3 py-3">{row.ticket_numero || '-'}</td>
                  <td className="px-3 py-3">{row.umidade ? `${Number(row.umidade).toFixed(2)}%` : '-'}</td>
                  <td className="px-3 py-3">{row.liberado_por || '-'}</td>
                  <td className="px-3 py-3">{kg(row.peso_liquido)}</td>
                  <td className="px-3 py-3">
                    <button type="button" onClick={() => exportLaboratoryReleasePdf(row)} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 px-3 text-xs font-bold text-slate-700 hover:bg-slate-50">
                      <Download size={14} /> Baixar PDF
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!approved.length && <p className="p-6 text-center text-sm font-semibold text-slate-500">Nenhuma carga aprovada nos filtros atuais.</p>}
        </div>
      </section>
    </div>
  );
}

function LaboratoryReleaseCard({ row, edit, reason, can, onEdit, onReason, onProcess }) {
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
        <LabCell label="Produto" value={row.produto?.nome || '-'} />
        <LabCell label="Placa" value={row.veiculo?.placa || '-'} />
        <LabCell label="Fornecedor" value={row.fornecedor?.nome || '-'} />
      </div>

      <div className="grid gap-3 p-4 lg:grid-cols-4">
        <SmallField label="Ticket">
          <SmallInput value={edit.ticket_numero ?? row.ticket_numero ?? ''} onChange={(value) => onEdit(row.id, 'ticket_numero', value)} />
        </SmallField>
        <SmallField label="Umidade (%)">
          <SmallInput type="number" value={edit.umidade ?? row.umidade ?? ''} onChange={(value) => onEdit(row.id, 'umidade', value)} />
        </SmallField>
        <SmallField label="Liberado por">
          <SmallInput value={edit.liberado_por ?? row.liberado_por ?? ''} onChange={(value) => onEdit(row.id, 'liberado_por', value)} />
        </SmallField>
        <SmallField label="Peso liquido">
          <div className="flex h-9 items-center rounded-md border border-slate-200 bg-slate-50 px-2 text-xs font-bold text-slate-700">{kg(row.peso_liquido)}</div>
        </SmallField>
        <div className="lg:col-span-4">
          <label className="grid gap-1 text-xs font-bold text-slate-600">
            Motivo para reprovar ou cancelar
            <textarea value={reason} onChange={(event) => onReason(event.target.value)} rows={2} className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs outline-none focus:border-tijuca-500" placeholder="Obrigatorio para reprovar/cancelar" />
          </label>
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t bg-slate-50 p-4 sm:flex-row sm:justify-end">
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
    ['Produto', row.produto?.nome || '-'],
    ['Placa', row.veiculo?.placa || '-'],
    ['Fornecedor', row.fornecedor?.nome || '-'],
  ]);

  y += 56;
  drawPdfRow(doc, margin, y, width, [
    ['Ticket', row.ticket_numero || '-'],
    ['Umidade', row.umidade ? `${Number(row.umidade).toFixed(2)}%` : '-'],
    ['Peso liquido', kg(row.peso_liquido)],
    ['Peso NF', row.peso_nf ? kg(row.peso_nf) : '-'],
  ]);

  y += 56;
  drawPdfRow(doc, margin, y, width, [
    ['Liberado por', row.liberado_por || '-'],
    ['Status', statusLabel(row.status)],
    ['Diferenca', kg(row.diferenca_kg)],
    ['NF', row.nf_numero || '-'],
  ]);

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
          umidade: edit.umidade ?? row.umidade,
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
          umidade: edit.umidade ?? row.umidade,
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
              {['Data', 'Balança', 'Fornecedor', 'Produto', 'Placa', 'Peso líquido', 'Peso NF', 'Diferença', 'Ticket', 'Umidade', 'Liberado por', 'Motivo', 'Ações'].map((head) => <th key={head} className="border-b px-3 py-3">{head}</th>)}
            </tr>
          </thead>
          <tbody>
            {pending.map((row) => (
              <tr key={row.id} className={row.divergente ? 'border-b bg-rose-50 align-top' : 'border-b align-top'}>
                <td className="px-3 py-3">{dateBr(row.data)}</td>
                <td className="px-3 py-3">{row.balanca?.nome || '-'}</td>
                <td className="px-3 py-3">{row.fornecedor?.nome || '-'}</td>
                <td className="px-3 py-3">{row.produto?.nome || '-'}</td>
                <td className="px-3 py-3">{row.veiculo?.placa || '-'}</td>
                <td className="px-3 py-3">{kg(row.peso_liquido)}</td>
                <td className="px-3 py-3">{row.peso_nf ? kg(row.peso_nf) : '-'}</td>
                <td className="px-3 py-3">
                  <span className={differenceClass(row.diferenca_kg)}>{kg(row.diferenca_kg)}</span>
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

function RelatoriosTab({ rows, options, filters, setFilters, applyFilters, clearFilters, can }) {
  return (
    <div className="grid gap-4">
      <Filters options={options} filters={filters} setFilters={setFilters} onApply={applyFilters} onClear={clearFilters} />
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-panel">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-sm font-extrabold uppercase tracking-wide text-slate-700">Relatório de recebimentos</h2>
            <p className="mt-1 text-sm text-slate-500">{rows.length} registro(s) encontrados nos filtros atuais.</p>
          </div>
          {can('balancas', 'exportar') && (
            <button type="button" onClick={() => exportRecebimentosCsv(rows)} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50">
              <Download size={16} /> Exportar CSV
            </button>
          )}
        </div>
      </div>
      <RecebimentosTable rows={rows} can={() => false} />
    </div>
  );
}

function RecebimentosTable({ rows, loading, can, onEdit, onDelete }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-panel">
      <table className="w-full min-w-[1180px] text-left text-sm">
        <thead className="text-xs font-bold uppercase text-slate-500">
          <tr>
            {['Data', 'NF', 'Balança', 'Fornecedor', 'Produto', 'Placa', 'Bruto', 'Tara', 'Líquido', 'Peso NF', 'Diferença', 'Status', 'Ações'].map((head) => <th key={head} className="border-b px-4 py-3">{head}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b last:border-0">
              <td className="px-4 py-3">{dateBr(row.data)}</td>
              <td className="px-4 py-3 font-semibold">{row.nf_numero || '-'}</td>
              <td className="px-4 py-3">{row.balanca?.nome || '-'}</td>
              <td className="px-4 py-3">{row.fornecedor?.nome || '-'}</td>
              <td className="px-4 py-3">{row.produto?.nome || '-'}</td>
              <td className="px-4 py-3">{row.veiculo?.placa || '-'}</td>
              <td className="px-4 py-3">{kg(row.peso_bruto)}</td>
              <td className="px-4 py-3">{kg(row.tara)}</td>
              <td className="px-4 py-3 font-bold">{kg(row.peso_liquido)}</td>
              <td className="px-4 py-3">{row.peso_nf ? kg(row.peso_nf) : '-'}</td>
              <td className="px-4 py-3">
                <span className={differenceClass(row.diferenca_kg)}>{kg(row.diferenca_kg)}</span>
              </td>
              <td className="px-4 py-3"><StatusBadge row={row} /></td>
              <td className="px-4 py-3">
                <div className="flex gap-1">
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

function Filters({ options, filters, setFilters, onApply, onClear }) {
  return (
    <form onSubmit={onApply} className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-panel md:grid-cols-2 xl:grid-cols-6">
      <Input label="Data inicial" type="date" value={filters.dataInicial} onChange={(value) => setFilters((current) => ({ ...current, dataInicial: value }))} />
      <Input label="Data final" type="date" value={filters.dataFinal} onChange={(value) => setFilters((current) => ({ ...current, dataFinal: value }))} />
      <Select label="Balança" value={filters.balancaId} onChange={(value) => setFilters((current) => ({ ...current, balancaId: value }))} options={options.balancas} />
      <Select label="Fornecedor" value={filters.fornecedorId} onChange={(value) => setFilters((current) => ({ ...current, fornecedorId: value }))} options={options.fornecedores} />
      <Select label="Produto" value={filters.produtoId} onChange={(value) => setFilters((current) => ({ ...current, produtoId: value }))} options={options.produtos} />
      <Select label="Laboratório" value={filters.laboratorioId} onChange={(value) => setFilters((current) => ({ ...current, laboratorioId: value }))} options={options.laboratorios} />
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

function Metric({ title, value, icon: Icon, danger }) {
  return (
    <article className="flex min-h-24 items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{title}</p>
        <p className={`mt-2 text-2xl font-extrabold ${danger ? 'text-rose-700' : 'text-slate-950'}`}>{value}</p>
      </div>
      <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${danger ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
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
            <div className="h-full rounded-full" style={{ width: `${Math.max((item.value / max) * 100, 4)}%`, backgroundColor: chartColor(index) }} />
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
              <Cell key={item.name} fill={item.umidadeMedia > 14 ? '#d97706' : chartColor(index)} />
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
            <div className="h-full rounded-full bg-tijuca-600" style={{ width: `${Math.max(item.score, 6)}%` }} />
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

function Alert({ tone, text }) {
  const style = tone === 'error'
    ? 'border-rose-200 bg-rose-50 text-rose-700'
    : 'border-emerald-200 bg-emerald-50 text-emerald-700';
  return <div className={`rounded-lg border p-3 text-sm font-semibold ${style}`}>{text}</div>;
}

function Input({ label, value, onChange, type = 'text', required, step }) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-slate-700">
      {label}
      <input className="h-11 rounded-lg border border-slate-300 px-3 outline-none focus:border-tijuca-500 focus:ring-4 focus:ring-tijuca-100" value={value ?? ''} onChange={(event) => onChange(event.target.value)} type={type} required={required} step={step} />
    </label>
  );
}

function SmallInput({ value, onChange, type = 'text' }) {
  return <input type={type} value={value ?? ''} onChange={(event) => onChange(event.target.value)} className="h-8 w-28 rounded-md border border-slate-300 px-2 text-xs outline-none focus:border-tijuca-500" />;
}

function Select({ label, value, onChange, options, required, labelKey = 'nome' }) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-slate-700">
      {label}
      <select className="h-11 rounded-lg border border-slate-300 px-3 outline-none focus:border-tijuca-500 focus:ring-4 focus:ring-tijuca-100" value={value || ''} onChange={(event) => onChange(event.target.value)} required={required}>
        <option value="">Selecione</option>
        {(options || []).map((option) => <option key={option.id} value={option.id}>{option[labelKey] || option.nome}</option>)}
      </select>
    </label>
  );
}

function rowToForm(row) {
  if (!row) return { ...defaultRecebimento };
  return Object.fromEntries(Object.keys(defaultRecebimento).map((key) => [key, row[key] ?? '']));
}

function normalizeRecebimentoPayload(form) {
  return {
    ...form,
    qtd_eixos: nullableNumber(form.qtd_eixos),
    peso_bruto: Number(form.peso_bruto || 0),
    tara: Number(form.tara || 0),
    peso_nf: nullableNumber(form.peso_nf),
    umidade: nullableNumber(form.umidade),
    valor_unitario: nullableNumber(form.valor_unitario),
    valor_total: nullableNumber(form.valor_total),
  };
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

function mergeOption(rows, option) {
  if (!option?.id) return rows;
  if (rows.some((row) => row.id === option.id)) return rows;
  return [...rows, option];
}

function todayIso() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function nullableNumber(value) {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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
    row.fornecedor?.nome,
    row.produto?.nome,
    row.veiculo?.placa,
    row.balanca?.nome,
  ].filter(Boolean).some((value) => String(value).toLowerCase().includes(term)));
}

function groupSum(rows, getName, field) {
  const map = new Map();
  rows.forEach((row) => {
    const name = getName(row);
    map.set(name, (map.get(name) || 0) + Number(row[field] || 0));
  });
  return Array.from(map, ([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

function groupCount(rows, getName) {
  const map = new Map();
  rows.forEach((row) => {
    const name = getName(row);
    map.set(name, (map.get(name) || 0) + 1);
  });
  return Array.from(map, ([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

function buildProductsDistribution(rows) {
  const total = rows.reduce((sum, row) => sum + Number(row.peso_liquido || 0), 0);
  if (!total) return [];

  const map = new Map();
  rows.forEach((row) => {
    const name = row.produto?.nome || 'Sem produto';
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
    const name = row.fornecedor?.nome || 'Sem fornecedor';
    const current = map.get(name) || { name, kgNota: 0, kgRecebido: 0, diferencaKg: 0, percentualDiferenca: 0 };
    current.kgNota += Number(row.peso_nf || 0);
    current.kgRecebido += Number(row.peso_liquido || 0);
    current.diferencaKg = current.kgRecebido - current.kgNota;
    current.percentualDiferenca = current.kgNota ? (current.diferencaKg / current.kgNota) * 100 : 0;
    map.set(name, current);
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

    const name = row.fornecedor?.nome || 'Sem fornecedor';
    const kgRecebido = Number(row.peso_liquido || 0);
    const weight = kgRecebido > 0 ? kgRecebido : 1;
    const current = map.get(name) || { name, weightedMoisture: 0, weight: 0, registros: 0, kgRecebido: 0 };
    current.weightedMoisture += umidade * weight;
    current.weight += weight;
    current.registros += 1;
    current.kgRecebido += kgRecebido;
    map.set(name, current);
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
    const name = row.fornecedor?.nome || 'Sem fornecedor';
    const kgRecebido = Number(row.peso_liquido || 0);
    const kgNota = Number(row.peso_nf || 0);
    const current = map.get(name) || {
      name,
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
    map.set(name, current);
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
  return ['#12325f', '#0f7f89', '#24a6a0', '#4f9a59', '#d6a62b', '#d8783d', '#7c3aed', '#db2777', '#0891b2', '#65a30d', '#64748b'][index % 11];
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
