import {
  AlertTriangle,
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
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  { key: 'recebimentos', label: 'Recebimentos' },
  { key: 'laboratorio', label: 'Aprovação Laboratório' },
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
    const today = todayIso();
    const todayRows = rows.filter((row) => row.data === today);
    return {
      cargas: todayRows.length,
      kgRecebidos: todayRows.reduce((sum, row) => sum + Number(row.peso_liquido || 0), 0),
      divergencias: todayRows.filter((row) => row.divergente).length,
      pendentes: rows.filter((row) => row.status === 'pendente').length,
      aprovadas: rows.filter((row) => row.status === 'aprovada').length,
      reprovadas: rows.filter((row) => row.status === 'reprovada').length,
    };
  }, [rows]);

  const bySupplier = groupSum(rows, (row) => row.fornecedor?.nome || 'Sem fornecedor', 'peso_liquido').slice(0, 6);
  const byStatus = groupCount(rows, (row) => statusLabel(row.status));

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
            <Metric title="Cargas do dia" value={metrics.cargas} icon={Truck} />
            <Metric title="KG recebidos hoje" value={kg(metrics.kgRecebidos)} icon={Truck} />
            <Metric title="Divergências hoje" value={metrics.divergencias} icon={AlertTriangle} danger={metrics.divergencias > 0} />
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
      const [supplier, carrier, vehicle, product] = await Promise.all([
        parsed.emitente.nome
          ? findOrCreateLookup('fornecedores', 'nome', parsed.emitente.nome, { nome: parsed.emitente.nome, cnpj: parsed.emitente.documento })
          : null,
        parsed.transportadora.nome
          ? findOrCreateLookup('recebimento_transportadoras', 'nome', parsed.transportadora.nome, { nome: parsed.transportadora.nome, cnpj: parsed.transportadora.cnpj })
          : null,
        parsed.placaVeiculo
          ? findOrCreateLookup('recebimento_veiculos', 'placa', parsed.placaVeiculo, { placa: parsed.placaVeiculo })
          : null,
        mainItem.nome
          ? findOrCreateLookup('produtos', 'nome', mainItem.nome, { nome: mainItem.nome, unidade: mainItem.unidade || 'KG' })
          : null,
      ]);

      setLocalOptions((current) => ({
        ...current,
        fornecedores: mergeOption(current.fornecedores, supplier),
        transportadoras: mergeOption(current.transportadoras, carrier),
        veiculos: mergeOption(current.veiculos, vehicle),
        produtos: mergeOption(current.produtos, product),
      }));

      setForm((current) => ({
        ...current,
        nf_numero: parsed.numero || current.nf_numero,
        nf_chave_acesso: parsed.chaveAcesso || current.nf_chave_acesso,
        data: parsed.dataEmissao || current.data,
        fornecedor_id: supplier?.id || current.fornecedor_id,
        transportadora_id: carrier?.id || current.transportadora_id,
        veiculo_id: vehicle?.id || current.veiculo_id,
        produto_id: product?.id || current.produto_id,
        peso_nf: parsed.pesoLiquidoNf ?? current.peso_nf,
        valor_unitario: mainItem.valorUnitario ?? current.valor_unitario,
        valor_total: parsed.valorTotalNota ?? current.valor_total,
      }));
      setXmlInfo(`XML importado: NF ${parsed.numero || '-'} | Fornecedor ${parsed.emitente.nome || '-'} | Produto ${mainItem.nome || '-'}`);
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
                  <span className={row.divergente ? 'font-extrabold text-rose-700' : 'font-semibold text-slate-700'}>{kg(row.diferenca_kg)}</span>
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
    try {
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
                <span className={row.divergente ? 'font-extrabold text-rose-700' : 'font-semibold text-slate-700'}>{kg(row.diferenca_kg)}</span>
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
  return new Date().toISOString().slice(0, 10);
}

function nullableNumber(value) {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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

function statusLabel(status) {
  return {
    pendente: 'Pendente',
    aprovada: 'Aprovada',
    reprovada: 'Reprovada',
    cancelada: 'Cancelada',
  }[status] || status || '-';
}

function chartColor(index) {
  return ['#12325f', '#0f7f89', '#24a6a0', '#4f9a59', '#d6a62b', '#d8783d'][index % 6];
}

function label(value) {
  return String(value).replace(/_/g, ' ');
}

function formatGeneric(value) {
  if (value === true) return 'Ativo';
  if (value === false) return 'Inativo';
  return value ?? '-';
}
