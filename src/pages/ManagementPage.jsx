import { Download, Edit, FileUp, Plus, Save, Search, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { auditAction, createNote, createRow, deleteNote, deleteRow, listContracts, listFreights, listNotes, listTable, updateRow } from '../lib/api.js';
import { deleteDocumentPdf, openDocumentPdf, uploadDocumentPdf } from '../lib/documentStorage.js';
import { currency, dateBr, kg, percent, statusClass } from '../lib/formatters.js';
import { exportSimplePdf } from '../lib/pdf.js';

const pageConfig = {
  fornecedores: {
    title: 'Fornecedores',
    table: 'fornecedores',
    search: ['nome', 'cnpj'],
    fields: [
      { name: 'nome', label: 'Nome', required: true },
      { name: 'cnpj', label: 'CNPJ' },
      { name: 'telefone', label: 'Telefone' },
      { name: 'email', label: 'E-mail', type: 'email' },
      { name: 'cidade', label: 'Cidade' },
      { name: 'uf', label: 'UF' },
    ],
    columns: ['nome', 'cnpj', 'telefone', 'email', 'cidade', 'uf'],
  },
  fabricas: {
    title: 'Fábricas',
    table: 'fabricas',
    search: ['nome', 'cnpj', 'cidade'],
    fields: [
      { name: 'nome', label: 'Nome', required: true },
      { name: 'cnpj', label: 'CNPJ' },
      { name: 'cidade', label: 'Cidade' },
      { name: 'uf', label: 'UF' },
      { name: 'responsavel', label: 'Responsável' },
    ],
    columns: ['nome', 'cnpj', 'cidade', 'uf', 'responsavel'],
  },
  produtos: {
    title: 'Produtos',
    table: 'produtos',
    search: ['nome', 'unidade'],
    fields: [
      { name: 'nome', label: 'Nome', required: true },
      { name: 'unidade', label: 'Unidade', defaultValue: 'KG' },
      { name: 'descricao', label: 'Descrição' },
    ],
    columns: ['nome', 'unidade', 'descricao'],
  },
  documentos: {
    title: 'Documentos',
    table: 'documentos',
    search: ['nome', 'tipo'],
    fields: [
      { name: 'nome', label: 'Nome', required: true },
      { name: 'observacoes', label: 'Observações' },
    ],
    columns: ['nome', 'tipo', 'url', 'observacoes'],
  },
  fretes: {
    title: 'Frete',
    table: 'fretes',
    search: ['numero_cte', 'transportadora', 'placa'],
    fields: [
      { name: 'contrato_id', label: 'Contrato vinculado', type: 'select', optionsKey: 'contracts' },
      { name: 'numero_cte', label: 'Número do CTE' },
      { name: 'transportadora', label: 'Transportadora', required: true },
      { name: 'placa', label: 'Placa' },
      { name: 'motorista', label: 'Motorista' },
      { name: 'valor', label: 'Valor', type: 'number', step: '0.01' },
      { name: 'data_frete', label: 'Data', type: 'date' },
    ],
    columns: ['contrato.numero_contrato', 'numero_cte', 'transportadora', 'placa', 'motorista', 'valor', 'data_frete'],
  },
};

export default function ManagementPage({ type }) {
  if (type === 'contratos') return <ContractsPage />;
  if (type === 'notas_fiscais') return <NotesPage />;
  if (type === 'financeiro') return <FinancePage />;
  return <GenericPage config={pageConfig[type]} />;
}

function GenericPage({ config }) {
  const { can } = useAuth();
  const menu = config.table === 'fretes' ? 'fretes' : config.table;
  const [rows, setRows] = useState([]);
  const [selectOptions, setSelectOptions] = useState({});
  const [form, setForm] = useState(defaultForm(config.fields));
  const [editingId, setEditingId] = useState(null);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');

  async function load() {
    if (config.table === 'fretes') {
      const [freightRows, contractRows] = await Promise.all([listFreights(), listContracts()]);
      setRows(freightRows);
      setSelectOptions({ contracts: contractRows.map((contract) => ({ id: contract.id, nome: contract.numero_contrato })) });
      return;
    }
    setRows(await listTable(config.table));
  }

  useEffect(() => {
    load().catch((err) => setError(toUserError('carregar-cadastro', err)));
  }, [config.table]);

  const filtered = filterRows(rows, config.search, query);

  async function submit(event) {
    event.preventDefault();
    setError('');
    let uploadedUrl = '';
    try {
      if (config.table === 'documentos' && !form.url && !form.pdfFile) {
        setError('Importe um arquivo PDF antes de salvar. Como corrigir: clique em "Importar PDF" e selecione um documento em PDF.');
        return;
      }

      if (config.table === 'documentos' && form.pdfFile) {
        uploadedUrl = await uploadDocumentPdf(form.pdfFile);
      }

      const payload = config.table === 'documentos'
        ? cleanPayload({ ...form, tipo: 'PDF', url: uploadedUrl || form.url }, ['nome', 'tipo', 'url', 'observacoes'])
        : cleanPayload(form, config.fields.map((field) => field.name));

      const duplicate = findDuplicateCadastro(config.table, payload, rows, editingId);
      if (duplicate) {
        setError(duplicate.message);
        return;
      }

      if (editingId) await updateRow(config.table, editingId, payload);
      else await createRow(config.table, payload);

      if (config.table === 'documentos' && uploadedUrl && form.url && form.url !== uploadedUrl) {
        deleteDocumentPdf(form.url).catch(() => undefined);
      }

      setForm(defaultForm(config.fields));
      setEditingId(null);
      await load();
    } catch (err) {
      if (uploadedUrl) await deleteDocumentPdf(uploadedUrl).catch(() => undefined);
      setError(toUserError('salvar-cadastro', err));
    }
  }

  function edit(row) {
    setEditingId(row.id);
    setForm(config.table === 'documentos'
      ? { ...defaultForm(config.fields, row), tipo: 'PDF', url: row.url || '' }
      : defaultForm(config.fields, row));
  }

  async function removeRow(id) {
    if (!window.confirm(`Excluir este registro de ${config.title}?`)) return;
    setError('');
    try {
      const row = rows.find((item) => item.id === id);
      await deleteRow(config.table, id);
      if (config.table === 'documentos' && row?.url) {
        await deleteDocumentPdf(row.url);
      }
      await load();
    } catch (err) {
      setError(toUserError('excluir-cadastro', err));
    }
  }

  async function importFreightXml(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setError('');
    if (!form.contrato_id) {
      setError('Selecione o contrato antes de importar o XML do frete. Como corrigir: escolha o número do contrato no campo "Contrato vinculado" e depois clique em "Importar XML".');
      return;
    }

    try {
      const parsed = parseFreightXml(await file.text());
      const duplicate = rows.some((row) =>
        normalizeKey(row.numero_cte) === normalizeKey(parsed.numero_cte)
        && row.contrato_id === form.contrato_id,
      );
      if (duplicate) {
        setError(`O CTE ${parsed.numero_cte || 'sem número'} já foi registrado para este contrato. Como corrigir: confira o contrato selecionado ou exclua o frete antigo antes de importar novamente.`);
        return;
      }
      setForm((current) => ({
        ...current,
        numero_cte: parsed.numero_cte || current.numero_cte,
        transportadora: parsed.transportadora || current.transportadora,
        valor: parsed.valor || current.valor,
        data_frete: parsed.data_frete || current.data_frete,
      }));
    } catch (err) {
      setError(toUserError('importar-xml-frete', err));
    }
  }

  async function importDocumentPdf(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setError('');
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Apenas PDF é aceito em Documentos. Como corrigir: selecione um arquivo com extensão .pdf.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('PDF muito grande para salvar no sistema. Como corrigir: use um arquivo PDF com até 10 MB.');
      return;
    }

    setForm((current) => ({
      ...current,
      nome: current.nome || file.name.replace(/\.pdf$/i, ''),
      tipo: 'PDF',
      pdfFile: file,
      pdfFileName: file.name,
    }));
  }

  async function openDocument(url) {
    setError('');
    try {
      await openDocumentPdf(url);
    } catch (err) {
      setError(toUserError('abrir-documento', err));
    }
  }

  return (
    <CrudShell title={config.title} query={query} setQuery={setQuery} error={error}>
      {config.table === 'fretes' && can(menu, 'cadastrar') && (
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-panel">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-sm font-extrabold uppercase tracking-wide text-slate-600">Importar XML do CT-e</h2>
              <p className="mt-1 text-sm font-medium text-slate-500">Selecione o contrato vinculado; o XML preenche CTE, transportadora, valor e data.</p>
            </div>
            <label className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50">
              <FileUp size={17} />
              Importar XML
              <input type="file" accept=".xml,text/xml,application/xml" onChange={importFreightXml} className="sr-only" />
            </label>
          </div>
        </section>
      )}
      {can(menu, editingId ? 'editar' : 'cadastrar') && (config.table === 'documentos' ? (
        <DocumentForm
          form={form}
          setForm={setForm}
          editing={Boolean(editingId)}
          onCancel={() => { setEditingId(null); setForm(defaultForm(config.fields)); }}
          onSubmit={submit}
          onFileChange={importDocumentPdf}
        />
      ) : (
        <EntityForm fields={config.fields} form={form} setForm={setForm} editing={Boolean(editingId)} onCancel={() => { setEditingId(null); setForm(defaultForm(config.fields)); }} onSubmit={submit} selectOptions={selectOptions} />
      ))}
      <DataTable
        rows={filtered}
        columns={config.columns}
        onEdit={can(menu, 'editar') ? edit : undefined}
        onDelete={can(menu, 'excluir') ? removeRow : undefined}
        onOpenDocument={config.table === 'documentos' ? openDocument : undefined}
      />
    </CrudShell>
  );
}

function ContractsPage() {
  const { can } = useAuth();
  const [contracts, setContracts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [factories, setFactories] = useState([]);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(defaultContractForm());
  const [editingId, setEditingId] = useState(null);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');

  async function load() {
    const [contractRows, supplierRows, factoryRows, productRows] = await Promise.all([
      listContracts(),
      listTable('fornecedores'),
      listTable('fabricas'),
      listTable('produtos'),
    ]);
    setContracts(contractRows);
    setSuppliers(supplierRows);
    setFactories(factoryRows);
    setProducts(productRows);
  }

  useEffect(() => {
    load().catch((err) => setError(toUserError('carregar-contratos', err)));
  }, []);

  const filtered = filterRows(contracts, ['numero_contrato', 'fornecedor.nome', 'produto.nome'], query);

  async function submit(event) {
    event.preventDefault();
    setError('');
    const payload = {
      ...cleanPayload(form),
      quantidade_contratada: Number(form.quantidade_contratada || 0),
      quantidade_recebida: Number(form.quantidade_recebida || 0),
      custo_kg: Number(form.custo_kg || 0),
    };
    try {
      if (editingId) await updateRow('contratos', editingId, payload);
      else await createRow('contratos', payload);
      setForm(defaultContractForm());
      setEditingId(null);
      await load();
    } catch (err) {
      setError(toUserError('salvar-contrato', err));
    }
  }

  return (
    <CrudShell title="Contratos" query={query} setQuery={setQuery} error={error}>
      {can('contratos', editingId ? 'editar' : 'cadastrar') && <form onSubmit={submit} className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-panel md:grid-cols-2 xl:grid-cols-4">
        <Input label="Número do contrato" value={form.numero_contrato} onChange={(value) => setForm({ ...form, numero_contrato: value })} required />
        <Select label="Fornecedor" value={form.fornecedor_id} onChange={(value) => setForm({ ...form, fornecedor_id: value })} options={suppliers} required />
        <Select label="Produto" value={form.produto_id} onChange={(value) => setForm({ ...form, produto_id: value })} options={products} required />
        <Select label="Fábrica" value={form.fabrica_id} onChange={(value) => setForm({ ...form, fabrica_id: value })} options={factories} />
        <Input label="Quantidade contratada" type="number" value={form.quantidade_contratada} onChange={(value) => setForm({ ...form, quantidade_contratada: value })} required />
        <Input label="Quantidade recebida" type="number" value={form.quantidade_recebida} onChange={(value) => setForm({ ...form, quantidade_recebida: value })} />
        <Input label="Custo R$/KG" type="number" step="0.01" value={form.custo_kg} onChange={(value) => setForm({ ...form, custo_kg: value })} />
        <Input label="Data de vencimento" type="date" value={form.data_vencimento} onChange={(value) => setForm({ ...form, data_vencimento: value })} />
        <div className="flex items-end gap-2 xl:col-span-4">
          <button className="inline-flex h-11 items-center gap-2 rounded-lg bg-tijuca-600 px-5 text-sm font-extrabold text-white hover:bg-tijuca-700">
            <Save size={17} /> {editingId ? 'Salvar alterações' : 'Cadastrar contrato'}
          </button>
          {editingId && <CancelButton onClick={() => { setEditingId(null); setForm(defaultContractForm()); }} />}
        </div>
      </form>}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-panel">
        <table className="w-full min-w-[1120px] text-left text-sm">
          <thead className="text-xs font-bold uppercase text-slate-500">
            <tr>{['Contrato', 'Fornecedor', 'Produto', 'Fábrica', 'Contratado', 'Recebido', 'Saldo', 'Execução', 'Vencimento', 'Status', 'Ações'].map((h) => <th key={h} className="border-b px-4 py-3">{h}</th>)}</tr>
          </thead>
          <tbody>
            {filtered.map((contract) => (
              <tr key={contract.id} className="border-b border-slate-100">
                <td className="px-4 py-3 font-extrabold">{contract.numero_contrato}</td>
                <td className="px-4 py-3">{contract.fornecedor?.nome}</td>
                <td className="px-4 py-3">{contract.produto?.nome}</td>
                <td className="px-4 py-3">{contract.fabrica?.nome || '-'}</td>
                <td className="px-4 py-3">{kg(contract.quantidade_contratada)}</td>
                <td className="px-4 py-3">{kg(contract.quantidade_recebida)}</td>
                <td className="px-4 py-3">{kg(contract.saldo)}</td>
                <td className="px-4 py-3">{percent(contract.percentual)}</td>
                <td className="px-4 py-3">{dateBr(contract.data_vencimento)}</td>
                <td className="px-4 py-3"><span className={`rounded-md px-2 py-1 text-xs font-bold ring-1 ${statusClass(contract.status_calculado)}`}>{contract.status_calculado}</span></td>
                <td className="px-4 py-3"><RowActions onEdit={can('contratos', 'editar') ? () => { setEditingId(contract.id); setForm(defaultContractForm(contract)); } : undefined} onDelete={can('contratos', 'excluir') ? () => deleteRow('contratos', contract.id).then(load).catch((err) => setError(toUserError('excluir-contrato', err))) : undefined} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </CrudShell>
  );
}

function NotesPage() {
  const { can } = useAuth();
  const [notes, setNotes] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [form, setForm] = useState(defaultNoteForm());
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [xmlInfo, setXmlInfo] = useState('');
  const [reportFilters, setReportFilters] = useState({ contrato_id: '', fornecedor_id: '' });
  const [unitConversion, setUnitConversion] = useState({ origem: '', destino: '', peso_saca: '60' });

  async function load() {
    const [noteRows, contractRows, supplierRows] = await Promise.all([listNotes(), listContracts(), listTable('fornecedores')]);
    setNotes(noteRows);
    setContracts(contractRows);
    setSuppliers(supplierRows);
  }

  useEffect(() => {
    load().catch((err) => setError(toUserError('carregar-notas', err)));
  }, []);

  const filtered = filterRows(notes, ['numero_nf', 'contrato.numero_contrato', 'fornecedor.nome'], query);
  const reportRows = filtered.filter((note) =>
    (!reportFilters.contrato_id || note.contrato_id === reportFilters.contrato_id)
    && (!reportFilters.fornecedor_id || note.fornecedor_id === reportFilters.fornecedor_id),
  );

  async function submit(event) {
    event.preventDefault();
    setError('');
    const duplicate = notes.some((note) =>
      normalizeKey(note.numero_nf) === normalizeKey(form.numero_nf)
      && note.fornecedor_id === form.fornecedor_id,
    );
    if (duplicate) {
      setError('Esta nota fiscal já foi registrada para este fornecedor. Como corrigir: confira o número da NF e o fornecedor selecionado antes de tentar salvar novamente.');
      return;
    }
    try {
      await createNote({
        ...cleanPayload(form),
        quantidade_recebida: Number(form.quantidade_recebida || 0),
        valor_total: Number(form.valor_total || 0),
        valor_unitario: form.valor_unitario === '' ? null : Number(form.valor_unitario || 0),
        valor_unitario_decimais: form.valor_unitario_decimais === '' ? null : Number(form.valor_unitario_decimais || 0),
      });
      setForm(defaultNoteForm());
      setXmlInfo('');
      await load();
    } catch (err) {
      setError(toUserError('salvar-nota', err));
    }
  }

  async function removeNote(note) {
    if (!window.confirm(`Excluir a nota fiscal ${note.numero_nf}?`)) return;
    setError('');
    try {
      await deleteNote(note);
      await load();
    } catch (err) {
      setError(toUserError('excluir-nota', err));
    }
  }

  async function importXml(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setError('');
    setXmlInfo('');

    try {
      if (!form.contrato_id) {
        setError('Selecione o contrato antes de importar o XML. Como corrigir: escolha o número do contrato no campo "Contrato" e depois clique em "Importar XML".');
        return;
      }
      const parsed = parseInvoiceXml(await file.text());
      const converted = convertInvoiceUnit(parsed, unitConversion);
      const matchedSupplier = findSupplierForXml(parsed, suppliers);
      const supplierIdForDuplicate = matchedSupplier?.id || form.fornecedor_id;
      const duplicate = notes.some((note) =>
        normalizeKey(note.numero_nf) === normalizeKey(parsed.numero_nf)
        && supplierIdForDuplicate
        && note.fornecedor_id === supplierIdForDuplicate,
      );
      if (duplicate) {
        const supplierName = matchedSupplier?.nome || suppliers.find((supplier) => supplier.id === form.fornecedor_id)?.nome || 'selecionado';
        setError(`A NF ${parsed.numero_nf || 'sem número'} já foi importada para o fornecedor ${supplierName}. Como corrigir: exclua a nota antiga se ela estiver errada ou importe uma NF diferente.`);
        return;
      }
      setForm((current) => ({
        ...current,
        numero_nf: parsed.numero_nf || current.numero_nf,
        fornecedor_id: matchedSupplier?.id || current.fornecedor_id,
        quantidade_recebida: converted.quantidade_recebida || current.quantidade_recebida,
        valor_total: parsed.valor_total || current.valor_total,
        valor_unitario: converted.valor_unitario || current.valor_unitario,
        valor_unitario_decimais: converted.valor_unitario_decimais || current.valor_unitario_decimais,
        data_recebimento: parsed.data_recebimento || current.data_recebimento,
      }));
      setXmlInfo([
        `XML importado: NF ${parsed.numero_nf || 'sem número'}`,
        matchedSupplier ? `Fornecedor cadastrado: ${matchedSupplier.nome}` : parsed.fornecedor_nome ? `Fornecedor no XML: ${parsed.fornecedor_nome}` : '',
        parsed.fornecedor_cnpj ? `CNPJ: ${formatCnpj(parsed.fornecedor_cnpj)}` : '',
        !matchedSupplier ? 'Fornecedor não encontrado no cadastro' : '',
        converted.unidade_aplicada ? `Conversão: ${converted.unidade_aplicada}` : '',
        converted.valor_unitario ? `Valor unit. ${quantityUnitLabel(converted.unidade_exibicao)}: ${unitCurrency(converted.valor_unitario, converted.valor_unitario_decimais)}` : '',
        quantityWithUnit(converted.quantidade_recebida, converted.unidade_exibicao),
        currency(parsed.valor_total),
      ].filter(Boolean).join(' | '));
    } catch (err) {
      setError(toUserError('importar-xml-nota', err));
    }
  }

  function exportNotesPdf() {
    auditAction('exportar', 'notas_fiscais', null, { formato: 'pdf', total: reportRows.length });
    exportSimplePdf({
      title: 'AgroFlow - Relatorio de Notas Fiscais',
      subtitle: 'Notas filtradas por contrato e fornecedor',
      fileName: 'relatorio-notas-fiscais.pdf',
      columns: [
        { key: 'numero_nf', label: 'NF' },
        { key: 'contrato', label: 'Contrato' },
        { key: 'fornecedor', label: 'Fornecedor' },
        { key: 'quantidade', label: 'Quantidade' },
        { key: 'valor_unitario', label: 'Valor unit.' },
        { key: 'valor_total', label: 'Valor total' },
        { key: 'data', label: 'Data' },
      ],
      rows: reportRows.map((note) => ({
        numero_nf: note.numero_nf,
        contrato: note.contrato?.numero_contrato,
        fornecedor: note.fornecedor?.nome,
        quantidade: kg(note.quantidade_recebida),
        valor_unitario: currency(note.valor_unitario),
        valor_total: currency(note.valor_total),
        data: dateBr(note.data_recebimento),
      })),
      totals: [
        { label: 'Notas', value: reportRows.length },
        { label: 'Quantidade total', value: kg(reportRows.reduce((sum, note) => sum + Number(note.quantidade_recebida || 0), 0)) },
        { label: 'Valor total', value: currency(reportRows.reduce((sum, note) => sum + Number(note.valor_total || 0), 0)) },
      ],
    });
  }

  return (
    <CrudShell title="Notas Fiscais" query={query} setQuery={setQuery} error={error}>
      <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-panel md:grid-cols-[1fr_1fr_auto]">
        <Select label="Relatorio por contrato" value={reportFilters.contrato_id} onChange={(value) => setReportFilters({ ...reportFilters, contrato_id: value })} options={contracts.map((item) => ({ id: item.id, nome: item.numero_contrato }))} />
        <Select label="Relatorio por fornecedor" value={reportFilters.fornecedor_id} onChange={(value) => setReportFilters({ ...reportFilters, fornecedor_id: value })} options={suppliers} />
        {can('notas_fiscais', 'exportar') && <button type="button" onClick={exportNotesPdf} className="mt-auto inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50">
          <Download size={17} /> PDF
        </button>}
      </section>
      {can('notas_fiscais', 'cadastrar') && <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-panel">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-sm font-extrabold uppercase tracking-wide text-slate-600">Importar XML da NF-e</h2>
            <p className="mt-1 text-sm font-medium text-slate-500">Escolha o contrato; o XML preenche fornecedor, número, quantidade, valor e data.</p>
          </div>
          <label className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50">
            <FileUp size={17} />
            Importar XML
            <input type="file" accept=".xml,text/xml,application/xml" onChange={importXml} className="sr-only" />
          </label>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_180px]">
          <Select
            label="Unidade do XML"
            value={unitConversion.origem}
            onChange={(value) => setUnitConversion({ ...unitConversion, origem: value })}
            options={[
              { id: '', nome: 'Sem conversão' },
              { id: 'KG', nome: 'KG' },
              { id: 'TON', nome: 'Tonelada' },
              { id: 'SAC', nome: 'Saca' },
            ]}
          />
          <Select
            label="Converter para"
            value={unitConversion.destino}
            onChange={(value) => setUnitConversion({ ...unitConversion, destino: value })}
            options={[
              { id: '', nome: 'Sem conversão' },
              { id: 'KG', nome: 'KG' },
              { id: 'TON', nome: 'Tonelada' },
              { id: 'SAC', nome: 'Saca' },
            ]}
          />
          <Input
            label="KG por saca"
            type="number"
            step="0.001"
            value={unitConversion.peso_saca}
            onChange={(value) => setUnitConversion({ ...unitConversion, peso_saca: value })}
          />
        </div>
        {xmlInfo && <p className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{xmlInfo}</p>}
      </section>}
      {can('notas_fiscais', 'cadastrar') && <form onSubmit={submit} className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-panel md:grid-cols-2 xl:grid-cols-3">
        <Input label="Número da NF" value={form.numero_nf} onChange={(value) => setForm({ ...form, numero_nf: value })} required />
        <Select label="Contrato" value={form.contrato_id} onChange={(value) => setForm({ ...form, contrato_id: value })} options={contracts.map((item) => ({ id: item.id, nome: item.numero_contrato }))} required />
        <Select label="Fornecedor" value={form.fornecedor_id} onChange={(value) => setForm({ ...form, fornecedor_id: value })} options={suppliers} required />
        <Input label="Quantidade recebida" type="number" value={form.quantidade_recebida} onChange={(value) => setForm({ ...form, quantidade_recebida: value })} required />
        <Input label="Valor total" type="number" step="0.01" value={form.valor_total} onChange={(value) => setForm({ ...form, valor_total: value })} />
        <Input label="Data de recebimento" type="date" value={form.data_recebimento} onChange={(value) => setForm({ ...form, data_recebimento: value })} />
        <button className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-tijuca-600 px-5 text-sm font-extrabold text-white hover:bg-tijuca-700 xl:col-span-3">
          <Save size={17} /> Registrar nota fiscal
        </button>
      </form>}
      <DataTable rows={filtered} columns={['numero_nf', 'contrato.numero_contrato', 'fornecedor.nome', 'quantidade_recebida', 'valor_unitario', 'valor_total', 'data_recebimento']} onDelete={can('notas_fiscais', 'excluir') ? (id, row) => removeNote(row) : undefined} />
    </CrudShell>
  );
}

function FinancePage() {
  const { can } = useAuth();
  const [contracts, setContracts] = useState([]);
  const [freights, setFreights] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [filters, setFilters] = useState({ fornecedor_id: '', contrato_id: '' });
  useEffect(() => {
    Promise.all([listContracts(), listTable('fornecedores'), listFreights()])
      .then(([contractRows, supplierRows, freightRows]) => {
        setContracts(contractRows);
        setSuppliers(supplierRows);
        setFreights(freightRows);
      })
      .catch(() => {
        setContracts([]);
        setSuppliers([]);
        setFreights([]);
      });
  }, []);

  const filteredContracts = contracts.filter((contract) =>
    (!filters.fornecedor_id || contract.fornecedor_id === filters.fornecedor_id)
    && (!filters.contrato_id || contract.id === filters.contrato_id),
  );
  const filteredContractIds = new Set(filteredContracts.map((contract) => contract.id));
  const filteredFreights = freights.filter((freight) => filteredContractIds.has(freight.contrato_id));
  const freightByContract = filteredFreights.reduce((map, freight) => {
    map.set(freight.contrato_id, (map.get(freight.contrato_id) || 0) + Number(freight.valor || 0));
    return map;
  }, new Map());
  const total = filteredContracts.reduce((sum, item) => sum + Number(item.quantidade_contratada || 0) * Number(item.custo_kg || 0), 0);
  const freightTotal = filteredFreights.reduce((sum, freight) => sum + Number(freight.valor || 0), 0);
  const totalWithFreight = total + freightTotal;
  const received = filteredContracts.reduce((sum, item) => sum + Number(item.quantidade_recebida || 0) * Number(item.custo_kg || 0), 0);
  const totalKg = filteredContracts.reduce((sum, item) => sum + Number(item.quantidade_contratada || 0), 0);
  const averageWithFreight = totalKg > 0 ? totalWithFreight / totalKg : 0;

  function exportFinancePdf() {
    auditAction('exportar', 'financeiro', null, { formato: 'pdf', total: filteredContracts.length });
    exportSimplePdf({
      title: 'AgroFlow - Relatorio Financeiro',
      subtitle: 'Relatorio filtrado por fornecedor e contrato',
      fileName: 'relatorio-financeiro.pdf',
      columns: [
        { key: 'contrato', label: 'Contrato' },
        { key: 'fornecedor', label: 'Fornecedor' },
        { key: 'produto', label: 'Produto' },
        { key: 'contratado', label: 'Contratado' },
        { key: 'recebido', label: 'Recebido' },
        { key: 'custo', label: 'Custo KG' },
        { key: 'valor', label: 'Valor contratado' },
        { key: 'frete', label: 'Frete' },
        { key: 'total', label: 'Total c/ frete' },
        { key: 'saldo', label: 'Saldo financeiro' },
      ],
      rows: filteredContracts.map((contract) => {
        const valorContratado = Number(contract.quantidade_contratada || 0) * Number(contract.custo_kg || 0);
        const valorRecebido = Number(contract.quantidade_recebida || 0) * Number(contract.custo_kg || 0);
        const valorFrete = freightByContract.get(contract.id) || 0;
        return {
          contrato: contract.numero_contrato,
          fornecedor: contract.fornecedor?.nome,
          produto: contract.produto?.nome,
          contratado: kg(contract.quantidade_contratada),
          recebido: kg(contract.quantidade_recebida),
          custo: unitCurrency(contract.custo_kg, 4),
          valor: currency(valorContratado),
          frete: currency(valorFrete),
          total: currency(valorContratado + valorFrete),
          saldo: currency(Math.max(valorContratado - valorRecebido, 0)),
        };
      }),
      totals: [
        { label: 'Valor contratado', value: currency(total) },
        { label: 'Frete vinculado', value: currency(freightTotal) },
        { label: 'Custo total com frete', value: currency(totalWithFreight) },
        { label: 'Custo medio com frete', value: `${unitCurrency(averageWithFreight, 4)}/KG` },
        { label: 'Valor recebido estimado', value: currency(received) },
        { label: 'Saldo financeiro', value: currency(Math.max(total - received, 0)) },
      ],
    });
  }

  return (
    <CrudShell title="Rel. Financeiro" query="" setQuery={null}>
      <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-panel md:grid-cols-[1fr_1fr_auto]">
        <Select label="Fornecedor" value={filters.fornecedor_id} onChange={(value) => setFilters({ ...filters, fornecedor_id: value, contrato_id: '' })} options={suppliers} />
        <Select label="Contrato" value={filters.contrato_id} onChange={(value) => setFilters({ ...filters, contrato_id: value })} options={contracts.filter((contract) => !filters.fornecedor_id || contract.fornecedor_id === filters.fornecedor_id).map((contract) => ({ id: contract.id, nome: contract.numero_contrato }))} />
        {can('financeiro', 'exportar') && <button type="button" onClick={exportFinancePdf} className="mt-auto inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50">
          <Download size={17} /> PDF
        </button>}
      </section>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric label="Valor contratado" value={currency(total)} />
        <Metric label="Frete vinculado" value={currency(freightTotal)} />
        <Metric label="Custo total com frete" value={currency(totalWithFreight)} />
        <Metric label="Custo médio com frete" value={`${unitCurrency(averageWithFreight, 4)}/KG`} />
      </section>
      <DataTable rows={filteredContracts.map((contract) => {
        const valorContratado = Number(contract.quantidade_contratada || 0) * Number(contract.custo_kg || 0);
        const valorRecebido = Number(contract.quantidade_recebida || 0) * Number(contract.custo_kg || 0);
        const valorFrete = freightByContract.get(contract.id) || 0;
        const custoMedioComFrete = Number(contract.quantidade_contratada || 0) > 0
          ? (valorContratado + valorFrete) / Number(contract.quantidade_contratada || 0)
          : 0;
        return {
          id: contract.id,
          numero_contrato: contract.numero_contrato,
          fornecedor: contract.fornecedor,
          produto: contract.produto,
          quantidade_contratada: contract.quantidade_contratada,
          quantidade_recebida: contract.quantidade_recebida,
          custo_kg: contract.custo_kg,
          valor_contratado: valorContratado,
          valor_frete: valorFrete,
          valor_total_com_frete: valorContratado + valorFrete,
          custo_medio_com_frete: custoMedioComFrete,
          saldo_financeiro: Math.max(valorContratado - valorRecebido, 0),
        };
      })} columns={['numero_contrato', 'fornecedor.nome', 'produto.nome', 'quantidade_contratada', 'quantidade_recebida', 'custo_kg', 'valor_frete', 'valor_total_com_frete', 'custo_medio_com_frete', 'saldo_financeiro']} />
    </CrudShell>
  );
}

function CrudShell({ title, query, setQuery, error, children }) {
  return (
    <div className="grid gap-5">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-950">{title}</h1>
          <p className="mt-1 text-sm font-medium text-slate-500">Cadastro, consulta e manutenção dos dados operacionais.</p>
        </div>
        {setQuery && (
          <label className="flex h-11 w-full items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-500 md:w-80">
            <Search size={16} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full outline-none" placeholder="Buscar..." />
          </label>
        )}
      </header>
      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</div>}
      {children}
    </div>
  );
}

function DocumentForm({ form, setForm, editing, onCancel, onSubmit, onFileChange }) {
  return (
    <form onSubmit={onSubmit} className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-panel md:grid-cols-2 xl:grid-cols-3">
      <Input label="Nome" value={form.nome || ''} required onChange={(value) => setForm({ ...form, nome: value })} />
      <label className="grid gap-2 text-sm font-semibold text-slate-700">
        Arquivo PDF
        <span className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50">
          <FileUp size={17} />
          {form.pdfFileName || (form.url ? 'PDF anexado' : 'Importar PDF')}
          <input type="file" accept="application/pdf,.pdf" onChange={onFileChange} className="sr-only" />
        </span>
      </label>
      <Input label="Observações" value={form.observacoes || ''} onChange={(value) => setForm({ ...form, observacoes: value })} />
      <div className="flex items-end gap-2 xl:col-span-3">
        <button className="inline-flex h-11 items-center gap-2 rounded-lg bg-tijuca-600 px-5 text-sm font-extrabold text-white hover:bg-tijuca-700">
          {editing ? <Save size={17} /> : <Plus size={17} />} {editing ? 'Salvar alterações' : 'Cadastrar PDF'}
        </button>
        {editing && <CancelButton onClick={onCancel} />}
      </div>
    </form>
  );
}

function EntityForm({ fields, form, setForm, editing, onCancel, onSubmit, selectOptions = {} }) {
  return (
    <form onSubmit={onSubmit} className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-panel md:grid-cols-2 xl:grid-cols-3">
      {fields.map((field) => (
        field.type === 'select'
          ? (
            <Select
              key={field.name}
              label={field.label}
              value={form[field.name] || ''}
              onChange={(value) => setForm({ ...form, [field.name]: value })}
              options={selectOptions[field.optionsKey] || []}
              required={field.required}
            />
          )
          : <Input key={field.name} label={field.label} type={field.type} step={field.step} value={form[field.name] || ''} required={field.required} onChange={(value) => setForm({ ...form, [field.name]: value })} />
      ))}
      <div className="flex items-end gap-2 xl:col-span-3">
        <button className="inline-flex h-11 items-center gap-2 rounded-lg bg-tijuca-600 px-5 text-sm font-extrabold text-white hover:bg-tijuca-700">
          {editing ? <Save size={17} /> : <Plus size={17} />} {editing ? 'Salvar alterações' : 'Cadastrar'}
        </button>
        {editing && <CancelButton onClick={onCancel} />}
      </div>
    </form>
  );
}

function DataTable({ rows, columns, onEdit, onDelete, onOpenDocument }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-panel">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="text-xs font-bold uppercase text-slate-500">
          <tr>
            {columns.map((column) => <th key={column} className="border-b px-4 py-3">{label(column)}</th>)}
            {(onEdit || onDelete) && <th className="border-b px-4 py-3">Ações</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-slate-100 last:border-0">
              {columns.map((column) => <td key={column} className="px-4 py-3 text-slate-700">{formatCell(getValue(row, column), column, row, onOpenDocument)}</td>)}
              {(onEdit || onDelete) && <td className="px-4 py-3"><RowActions onEdit={() => onEdit?.(row)} onDelete={() => onDelete?.(row.id, row)} /></td>}
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <p className="p-6 text-center text-sm font-semibold text-slate-500">Nenhum registro encontrado.</p>}
    </div>
  );
}

function RowActions({ onEdit, onDelete }) {
  return (
    <div className="flex gap-1">
      {onEdit && <button onClick={onEdit} className="grid h-9 w-9 place-items-center rounded-lg text-slate-600 hover:bg-slate-100" title="Editar"><Edit size={16} /></button>}
      {onDelete && <button onClick={onDelete} className="grid h-9 w-9 place-items-center rounded-lg text-rose-600 hover:bg-rose-50" title="Excluir"><Trash2 size={16} /></button>}
    </div>
  );
}

function Input({ label, value, onChange, type = 'text', required, step }) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-slate-700">
      {label}
      <input className="h-11 rounded-lg border border-slate-300 px-3 outline-none focus:border-tijuca-500 focus:ring-4 focus:ring-tijuca-100" value={value || ''} onChange={(event) => onChange(event.target.value)} type={type} required={required} step={step} />
    </label>
  );
}

function Select({ label, value, onChange, options, required }) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-slate-700">
      {label}
      <select className="h-11 rounded-lg border border-slate-300 px-3 outline-none focus:border-tijuca-500 focus:ring-4 focus:ring-tijuca-100" value={value || ''} onChange={(event) => onChange(event.target.value)} required={required}>
        <option value="">Selecione</option>
        {options.map((option) => <option key={option.id} value={option.id}>{option.nome}</option>)}
      </select>
    </label>
  );
}

function CancelButton({ onClick }) {
  return <button type="button" onClick={onClick} className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50"><X size={16} /> Cancelar</button>;
}

function Metric({ label, value }) {
  return <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-panel"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-2xl font-extrabold">{value}</p></article>;
}

function defaultForm(fields, row = {}) {
  return fields.reduce((acc, field) => ({ ...acc, [field.name]: row[field.name] ?? field.defaultValue ?? '' }), {});
}

function defaultContractForm(row = {}) {
  return {
    numero_contrato: row.numero_contrato || '',
    fornecedor_id: row.fornecedor_id || '',
    fabrica_id: row.fabrica_id || '',
    produto_id: row.produto_id || '',
    quantidade_contratada: row.quantidade_contratada || '',
    quantidade_recebida: row.quantidade_recebida || '',
    custo_kg: row.custo_kg || '',
    data_vencimento: row.data_vencimento || '',
  };
}

function defaultNoteForm() {
  return {
    numero_nf: '',
    contrato_id: '',
    fornecedor_id: '',
    quantidade_recebida: '',
    valor_total: '',
    valor_unitario: '',
    valor_unitario_decimais: '',
    data_recebimento: '',
  };
}

function filterRows(rows, fields, query) {
  const term = query.toLowerCase().trim();
  if (!term) return rows;
  return rows.filter((row) => fields.some((field) => String(getValue(row, field) || '').toLowerCase().includes(term)));
}

function getValue(row, path) {
  return path.split('.').reduce((value, key) => value?.[key], row);
}

function cleanPayload(payload, allowedFields) {
  const entries = allowedFields ? allowedFields.map((field) => [field, payload[field]]) : Object.entries(payload);
  return Object.fromEntries(entries.map(([key, value]) => [key, value === '' ? null : value]));
}

function findDuplicateCadastro(table, payload, rows, editingId) {
  if (!['fornecedores', 'produtos'].includes(table)) return null;

  const currentName = normalizeKey(payload.nome);
  const currentCnpj = onlyDigits(payload.cnpj);
  const duplicate = rows.find((row) => {
    if (row.id === editingId) return false;
    if (table === 'fornecedores' && currentCnpj && onlyDigits(row.cnpj) === currentCnpj) return true;
    return currentName && normalizeKey(row.nome) === currentName;
  });

  if (!duplicate) return null;

  if (table === 'fornecedores' && currentCnpj && onlyDigits(duplicate.cnpj) === currentCnpj) {
    return {
      message: `Este fornecedor ja esta cadastrado com o CNPJ ${formatCnpj(currentCnpj)}. Como corrigir: use o cadastro existente ou edite o fornecedor ja salvo.`,
    };
  }

  return {
    message: table === 'fornecedores'
      ? 'Este fornecedor ja esta cadastrado com este nome. Como corrigir: use o cadastro existente ou altere o nome para diferenciar corretamente.'
      : 'Este produto ja esta cadastrado com este nome. Como corrigir: use o cadastro existente ou altere o nome para diferenciar corretamente.',
  };
}

function label(value) {
  return value.split('.').pop().replace(/_/g, ' ');
}

function formatCell(value, column, row = {}, onOpenDocument) {
  if (value === null || value === undefined || value === '') return '-';
  if (column === 'url') {
    return (
      <button
        type="button"
        onClick={() => onOpenDocument?.(String(value))}
        className="font-bold text-tijuca-700 hover:underline"
      >
        Abrir PDF
      </button>
    );
  }
  if (column.includes('valor_unitario')) return unitCurrency(value, row.valor_unitario_decimais);
  if (column.includes('custo_kg') || column.includes('custo_medio_com_frete')) return unitCurrency(value, 4);
  if (column.includes('valor') || column.includes('custo') || column.includes('saldo_financeiro')) return currency(value);
  if (column.includes('quantidade')) return kg(value);
  if (column.includes('data')) return dateBr(value);
  return String(value);
}

function parseInvoiceXml(xmlText) {
  const xml = new DOMParser().parseFromString(xmlText, 'application/xml');
  const parserError = xml.querySelector('parsererror');
  if (parserError) throw new Error('XML inválido. Como corrigir: selecione um arquivo XML original de NF-e ou CT-e, sem abrir e salvar em editor de texto.');

  const text = (...selectors) => {
    for (const selector of selectors) {
      const value = xml.querySelector(selector)?.textContent?.trim();
      if (value) return value;
    }
    return '';
  };

  const number = (...selectors) => {
    const parsed = Number(text(...selectors).replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const products = Array.from(xml.querySelectorAll('det prod'));
  if (!products.length) throw new Error('Este XML não parece ser uma NF-e de produto. Como corrigir: importe o XML da nota fiscal de produto na tela Notas Fiscais ou use XML de CT-e na tela Frete.');

  const quantities = products.map((prod) => {
    const raw = prod.querySelector('qCom')?.textContent || prod.querySelector('qTrib')?.textContent || '0';
    const parsed = Number(raw.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : 0;
  });
  const unitItems = products.map((prod) => {
    const quantityText = prod.querySelector('qCom')?.textContent || prod.querySelector('qTrib')?.textContent || '0';
    const unitText = prod.querySelector('vUnCom')?.textContent || prod.querySelector('vUnTrib')?.textContent || '';
    const unitCode = prod.querySelector('uCom')?.textContent || prod.querySelector('uTrib')?.textContent || '';
    const quantity = Number(quantityText.replace(',', '.'));
    const unit = Number(unitText.replace(',', '.'));
    return {
      quantity: Number.isFinite(quantity) ? quantity : 0,
      unit: Number.isFinite(unit) ? unit : 0,
      unitCode: unitCode.trim(),
      decimals: decimalPlaces(unitText),
    };
  });
  const totalQuantity = quantities.reduce((sum, value) => sum + value, 0);
  const weightedUnitTotal = unitItems.reduce((sum, item) => sum + item.quantity * item.unit, 0);
  const dateValue = text('ide dhEmi', 'ide dEmi').slice(0, 10);

  return {
    numero_nf: text('ide nNF', 'infNFe ide nNF'),
    fornecedor_nome: text('emit xNome', 'NFe infNFe emit xNome'),
    fornecedor_cnpj: onlyDigits(text('emit CNPJ', 'NFe infNFe emit CNPJ')),
    quantidade_recebida: totalQuantity,
    valor_total: number('ICMSTot vNF', 'total ICMSTot vNF'),
    valor_unitario: totalQuantity > 0 ? weightedUnitTotal / totalQuantity : 0,
    valor_unitario_decimais: Math.max(2, ...unitItems.map((item) => item.decimals)),
    unidade_xml: unitItems.find((item) => item.unitCode)?.unitCode || '',
    data_recebimento: /^\d{4}-\d{2}-\d{2}$/.test(dateValue) ? dateValue : '',
  };
}

function parseFreightXml(xmlText) {
  const xml = new DOMParser().parseFromString(xmlText, 'application/xml');
  const parserError = xml.querySelector('parsererror');
  if (parserError) throw new Error('XML inválido. Como corrigir: selecione o XML original do CT-e.');

  const text = (...selectors) => {
    for (const selector of selectors) {
      const value = xml.querySelector(selector)?.textContent?.trim();
      if (value) return value;
    }
    return '';
  };

  const number = (...selectors) => {
    const parsed = Number(text(...selectors).replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const numeroCte = text('ide nCT', 'infCte ide nCT');
  if (!numeroCte) throw new Error('Não encontrei o número do CT-e neste XML. Como corrigir: confira se o arquivo importado é um CT-e válido.');

  const dateValue = text('ide dhEmi', 'ide dEmi').slice(0, 10);
  return {
    numero_cte: numeroCte,
    transportadora: text('emit xNome', 'infCte emit xNome'),
    transportadora_cnpj: onlyDigits(text('emit CNPJ', 'infCte emit CNPJ')),
    valor: number('vPrest vTPrest', 'infCte vPrest vTPrest'),
    data_frete: /^\d{4}-\d{2}-\d{2}$/.test(dateValue) ? dateValue : '',
  };
}

function convertInvoiceUnit(parsed, conversion) {
  const origin = conversion.origem;
  const target = conversion.destino;
  if (!origin || !target || origin === target) {
    return {
      ...parsed,
      unidade_aplicada: '',
      unidade_exibicao: parsed.unidade_xml || origin || target || 'KG',
    };
  }

  const sackKg = Number(conversion.peso_saca || 60);
  if (!Number.isFinite(sackKg) || sackKg <= 0) {
    throw new Error('Peso da saca inválido. Como corrigir: informe quantos KG tem uma saca antes de importar o XML.');
  }

  const quantity = Number(parsed.quantidade_recebida || 0);
  const totalValue = Number(parsed.valor_total || 0);
  const quantityInKg = toKg(quantity, origin, sackKg);
  const convertedQuantity = fromKg(quantityInKg, target, sackKg);
  const convertedUnit = convertedQuantity > 0 ? totalValue / convertedQuantity : 0;

  return {
    ...parsed,
    quantidade_recebida: convertedQuantity,
    valor_unitario: convertedUnit,
    valor_unitario_decimais: Math.max(Number(parsed.valor_unitario_decimais || 2), 4),
    unidade_aplicada: `${unitLabel(origin)} para ${unitLabel(target)}`,
    unidade_exibicao: target,
  };
}

function toKg(value, unit, sackKg) {
  if (unit === 'TON') return value * 1000;
  if (unit === 'SAC') return value * sackKg;
  return value;
}

function fromKg(value, unit, sackKg) {
  if (unit === 'TON') return value / 1000;
  if (unit === 'SAC') return value / sackKg;
  return value;
}

function unitLabel(unit) {
  if (unit === 'TON') return 'tonelada';
  if (unit === 'SAC') return 'saca';
  if (unit === 'KG') return 'KG';
  if (unit) return unit;
  return 'KG';
}

function quantityUnitLabel(unit) {
  return unitLabel(unit).toUpperCase();
}

function quantityWithUnit(value, unit) {
  const formatted = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 }).format(Number(value || 0));
  return `${formatted} ${quantityUnitLabel(unit)}`;
}

function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function formatCnpj(value) {
  const digits = onlyDigits(value);
  if (digits.length !== 14) return value || '-';
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

function findSupplierForXml(parsed, suppliers) {
  const xmlCnpj = onlyDigits(parsed.fornecedor_cnpj);
  if (xmlCnpj) {
    const byCnpj = suppliers.find((supplier) => onlyDigits(supplier.cnpj) === xmlCnpj);
    if (byCnpj) return byCnpj;
  }

  const xmlName = normalizeKey(parsed.fornecedor_nome);
  if (!xmlName) return null;
  return suppliers.find((supplier) => normalizeKey(supplier.nome) === xmlName) || null;
}

function normalizeKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w]+/g, '')
    .toLowerCase();
}

function decimalPlaces(value) {
  const [, decimals = ''] = String(value || '').replace(',', '.').split('.');
  return decimals.replace(/0+$/, '').length || (decimals ? decimals.length : 0);
}

function unitCurrency(value, decimals) {
  const places = Math.min(Math.max(Number(decimals ?? 4), 2), 10);
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: places,
    maximumFractionDigits: places,
  }).format(Number(value || 0));
}

function toUserError(context, error) {
  const original = String(error?.message || error || '');
  const raw = original.toLowerCase();

  if (original.includes('Como corrigir:')) return original;

  if (raw.includes('duplicate') || raw.includes('unique')) {
    return 'Registro duplicado. Como corrigir: confira se este número já foi cadastrado para o mesmo fornecedor ou contrato antes de salvar novamente.';
  }
  if (raw.includes('violates foreign key') || raw.includes('foreign key')) {
    return 'Não foi possível salvar porque há um vínculo inválido. Como corrigir: selecione um contrato, fornecedor, fábrica ou produto que exista no cadastro.';
  }
  if (raw.includes('not-null') || raw.includes('null value')) {
    return 'Faltam campos obrigatórios. Como corrigir: preencha todos os campos marcados como obrigatórios e tente novamente.';
  }
  if (raw.includes('permission') || raw.includes('row-level security') || raw.includes('rls')) {
    return 'Acesso negado pelo banco de dados. Como corrigir: entre com o e-mail autorizado e tente novamente.';
  }
  if (raw.includes('schema cache') || raw.includes('does not exist') || raw.includes('could not find')) {
    return 'O banco de dados ainda não reconheceu uma coluna nova. Como corrigir: aplique o SQL pendente no Supabase e execute o reload do schema.';
  }
  if (raw.includes('failed to fetch') || raw.includes('network')) {
    return 'Falha de conexão com o servidor. Como corrigir: verifique sua internet e tente novamente em alguns segundos.';
  }
  if (raw.includes('xml')) {
    return error?.message || 'Não foi possível ler o XML. Como corrigir: selecione o arquivo XML original da NF-e ou do CT-e.';
  }

  const fallback = {
    'carregar-cadastro': 'Não foi possível carregar os dados. Como corrigir: atualize a página e confira sua conexão.',
    'salvar-cadastro': 'Não foi possível salvar o cadastro. Como corrigir: confira os campos preenchidos e tente novamente.',
    'excluir-cadastro': 'Não foi possível excluir o registro. Como corrigir: verifique se ele não está vinculado a outro cadastro.',
    'carregar-contratos': 'Não foi possível carregar os contratos. Como corrigir: atualize a página e tente novamente.',
    'salvar-contrato': 'Não foi possível salvar o contrato. Como corrigir: confira fornecedor, produto e número do contrato.',
    'excluir-contrato': 'Não foi possível excluir o contrato. Como corrigir: remova antes notas fiscais ou fretes vinculados.',
    'carregar-notas': 'Não foi possível carregar as notas fiscais. Como corrigir: atualize a página e tente novamente.',
    'salvar-nota': 'Não foi possível registrar a nota fiscal. Como corrigir: selecione contrato e fornecedor, confira número, quantidade e valor.',
    'excluir-nota': 'Não foi possível excluir a nota fiscal. Como corrigir: atualize a página e tente novamente.',
    'importar-xml-nota': 'Não foi possível importar o XML da NF-e. Como corrigir: selecione o contrato, use o XML original da NF-e e confira se o fornecedor está cadastrado.',
    'importar-xml-frete': 'Não foi possível importar o XML do CT-e. Como corrigir: selecione o contrato vinculado e use o XML original do CT-e.',
    'abrir-documento': 'Não foi possível abrir o PDF. Como corrigir: edite o documento, anexe o arquivo novamente e tente abrir.',
  };

  return fallback[context] || 'Não foi possível concluir a operação. Como corrigir: confira os dados informados e tente novamente.';
}
