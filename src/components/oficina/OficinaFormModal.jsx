import { FileUp, Search, X } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { parseNfeRecebimento } from '../../lib/nfeRecebimento.js';
import {
  calculateEntryUnitValue, formatBrazilianDecimal, parseBrazilianDecimal,
} from '../../lib/oficinaMessejana.js';

const FIELD = 'h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100';

export function EntradaModal({ entry, lookups, responsibleName, onClose, onSave }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(() => entryToForm(entry, responsibleName));
  const [xmlInfo, setXmlInfo] = useState('');
  const [xmlError, setXmlError] = useState('');
  const [formError, setFormError] = useState('');

  useEffect(() => setForm(entryToForm(entry, responsibleName)), [entry, responsibleName]);

  async function submit(event) {
    event.preventDefault();
    setFormError('');
    if (!form.fornecedor_destino_id) {
      setFormError('Selecione o fornecedor destino onde os grãos ficarão armazenados.');
      return;
    }
    setSaving(true);
    try { await onSave(form); } finally { setSaving(false); }
  }

  function selectFornecedor(value) {
    const fornecedor = lookups.fornecedores.find((item) => item.id === value);
    setForm((current) => ({
      ...current,
      fornecedor_id: value,
      fornecedor_nome: fornecedor?.nome || '',
      fornecedor_cnpj: fornecedor?.cnpj || '',
    }));
  }

  function selectProduto(value) {
    const produto = lookups.produtos.find((item) => item.id === value);
    setForm((current) => ({ ...current, produto_id: value, produto_nome: produto?.nome || '' }));
  }

  function selectFornecedorDestino(value) {
    const fornecedor = lookups.fornecedores.find((item) => item.id === value);
    setForm((current) => ({
      ...current,
      fornecedor_destino_id: value,
      fornecedor_destino_nome: fornecedor?.nome || '',
      fornecedor_destino_cnpj: fornecedor?.cnpj || '',
    }));
  }

  function updateFinancial(field, value) {
    setForm((current) => recalculateFinancials({ ...current, [field]: value }));
  }

  function formatFinancial(field, minimumFractionDigits, maximumFractionDigits = minimumFractionDigits) {
    setForm((current) => {
      const value = parseBrazilianDecimal(current[field]);
      if (value === null) return current;
      return recalculateFinancials({
        ...current,
        [field]: formatBrazilianDecimal(value, minimumFractionDigits, maximumFractionDigits),
      });
    });
  }

  function selectMotorista(value) {
    const motorista = lookups.motoristas.find((item) => item.id === value);
    setForm((current) => ({ ...current, motorista_id: value, motorista: motorista?.nome || '' }));
  }

  function selectVeiculo(value) {
    const veiculo = lookups.veiculos.find((item) => item.id === value);
    setForm((current) => ({
      ...current,
      veiculo_id: value,
      placa: veiculo?.placa || '',
      veiculo: veiculo?.tipo_veiculo || '',
    }));
  }

  async function importXml(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setXmlInfo(''); setXmlError('');
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('O XML deve ter no máximo 5 MB.');
      const parsed = parseNfeRecebimento(await file.text());
      const fornecedor = matchSupplier(parsed, lookups.fornecedores);
      const matchedItem = matchProductItem(parsed.itens, lookups.produtos);
      const produto = matchedItem?.produto || null;
      const item = matchedItem?.item || (parsed.itens?.length === 1 ? parsed.itens[0] : null);
      const veiculo = lookups.veiculos.find((row) => normalizeKey(row.placa) === normalizeKey(parsed.placaVeiculo)) || null;
      const missing = [];
      if (!fornecedor) missing.push('fornecedor do XML não cadastrado');
      if (!produto) missing.push('produto do XML não cadastrado');
      if (parsed.placaVeiculo && !veiculo) missing.push('placa do XML não cadastrada nas Balanças');

      setForm((current) => recalculateFinancials({
        ...current,
        data_entrada: parsed.dataEmissao ? `${parsed.dataEmissao}T12:00` : current.data_entrada,
        nf_numero: parsed.numero || current.nf_numero,
        nf_serie: parsed.serie || current.nf_serie,
        chave_acesso: parsed.chaveAcesso || current.chave_acesso,
        fornecedor_id: fornecedor?.id || '',
        fornecedor_nome: fornecedor?.nome || '',
        fornecedor_cnpj: fornecedor?.cnpj || '',
        produto_id: produto?.id || '',
        produto_nome: produto?.nome || '',
        peso_nf: formatOptionalDecimal(parsed.pesoLiquidoNf ?? item?.quantidade, 3, 3) || current.peso_nf,
        valor_unitario: formatOptionalDecimal(item?.valorUnitario, 4, 4) || current.valor_unitario,
        valor_total_nota: formatOptionalDecimal(parsed.valorTotalNota ?? item?.valorTotal, 2, 2) || current.valor_total_nota,
        veiculo_id: veiculo?.id || '',
        placa: veiculo?.placa || '',
        veiculo: veiculo?.tipo_veiculo || '',
        transportadora: parsed.transportadora?.nome || current.transportadora,
      }));
      setXmlInfo(`XML ${file.name} importado. Confira os dados antes de salvar.`);
      if (missing.length) setXmlError(`Confira: ${missing.join('; ')}.`);
    } catch (error) {
      setXmlError(error?.message || 'Não foi possível importar o XML da NF-e.');
    }
  }

  return (
    <Modal title={entry ? 'Editar entrada' : 'Nova entrada'} onClose={onClose}>
      <form onSubmit={submit} className="grid gap-4">
        <section className="flex flex-col gap-3 rounded-xl border border-sky-200 bg-sky-50 p-4 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-black text-sky-950">Importar XML da NF-e</h3><p className="text-sm text-sky-800">Preenche nota, fornecedor, produto, peso, valores e placa usando apenas cadastros existentes.</p></div><label className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-sky-700 px-4 text-sm font-bold text-white"><FileUp size={18} /> Selecionar XML<input type="file" accept=".xml,text/xml,application/xml" onChange={importXml} className="sr-only" /></label></section>
        {xmlInfo && <p className="rounded-lg bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{xmlInfo}</p>}
        {xmlError && <p className="rounded-lg bg-amber-50 p-3 text-sm font-bold text-amber-800">{xmlError}</p>}
        {formError && <p className="rounded-lg bg-red-50 p-3 text-sm font-bold text-red-800">{formError}</p>}
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Data e hora da entrada" required><input type="datetime-local" className={FIELD} required value={form.data_entrada} onChange={(e) => change(setForm, 'data_entrada', e.target.value)} /></Field>
          <Field label="Número da NF-e" required><input className={FIELD} required maxLength={30} value={form.nf_numero} onChange={(e) => change(setForm, 'nf_numero', e.target.value)} /></Field>
          <Field label="Série" required><input className={FIELD} required maxLength={10} value={form.nf_serie} onChange={(e) => change(setForm, 'nf_serie', e.target.value)} /></Field>
        </div>
        <Field label="Chave de acesso (44 dígitos)"><input className={FIELD} inputMode="numeric" maxLength={54} value={form.chave_acesso} onChange={(e) => change(setForm, 'chave_acesso', e.target.value)} /></Field>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Fornecedor cadastrado — origem" required><select className={FIELD} required value={form.fornecedor_id} onChange={(e) => selectFornecedor(e.target.value)}><option value="">Selecione um fornecedor</option>{lookups.fornecedores.map((item) => <option key={item.id} value={item.id}>{item.nome}{item.cnpj ? ` — ${formatDocument(item.cnpj)}` : ''}</option>)}</select></Field>
          <Field label="Produto cadastrado" required><select className={FIELD} required value={form.produto_id} onChange={(e) => selectProduto(e.target.value)}><option value="">Selecione um produto</option>{lookups.produtos.map((item) => <option key={item.id} value={item.id}>{item.nome}{item.unidade ? ` — ${item.unidade}` : ''}</option>)}</select></Field>
          <Read label="CNPJ do fornecedor" value={formatDocument(form.fornecedor_cnpj)} />
          <Read label="Produto selecionado" value={form.produto_nome} />
          <SearchableSupplier label="Fornecedor destino" required suppliers={lookups.fornecedores} value={form.fornecedor_destino_id} onChange={selectFornecedorDestino} />
          <div className="grid grid-cols-2 gap-3 rounded-lg border border-emerald-100 bg-emerald-50 p-3"><Read label="Fornecedor destino selecionado" value={form.fornecedor_destino_nome} /><Read label="CNPJ do destino" value={formatDocument(form.fornecedor_destino_cnpj)} /></div>
          <Field label="Peso da NF (KG)" required><input className={FIELD} required type="text" inputMode="decimal" placeholder="48.110,000" value={form.peso_nf} onChange={(e) => updateFinancial('peso_nf', e.target.value)} onBlur={() => formatFinancial('peso_nf', 3, 3)} /></Field>
          <Field label="Valor unitário"><input className={FIELD} type="text" inputMode="decimal" readOnly aria-readonly="true" placeholder="R$ 0,8333 por KG" value={form.valor_unitario} /></Field>
          <Field label="Valor total da nota"><input className={FIELD} type="text" inputMode="decimal" placeholder="R$ 40.091,67" value={form.valor_total_nota} onChange={(e) => updateFinancial('valor_total_nota', e.target.value)} onBlur={() => formatFinancial('valor_total_nota', 2, 2)} /></Field>
          <Field label="Veículo e placa cadastrados"><select className={FIELD} value={form.veiculo_id} onChange={(e) => selectVeiculo(e.target.value)}><option value="">Sem veículo informado</option>{lookups.veiculos.map((item) => <option key={item.id} value={item.id}>{item.placa}{item.tipo_veiculo ? ` — ${item.tipo_veiculo}` : ''}</option>)}</select></Field>
          <Field label="Motorista cadastrado"><select className={FIELD} value={form.motorista_id} onChange={(e) => selectMotorista(e.target.value)}><option value="">Sem motorista informado</option>{lookups.motoristas.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></Field>
          <Read label="Placa" value={form.placa} />
          <Read label="Veículo" value={form.veiculo} />
          <Field label="Transportadora"><input className={FIELD} maxLength={180} value={form.transportadora} onChange={(e) => change(setForm, 'transportadora', e.target.value)} /></Field>
        </div>
        <Field label="Observação"><textarea className={`${FIELD} min-h-24 py-3`} maxLength={1000} value={form.observacao} onChange={(e) => change(setForm, 'observacao', e.target.value)} /></Field>
        <Field label="Responsável pelo lançamento" required><input className={FIELD} required maxLength={180} value={form.responsavel_nome} onChange={(e) => change(setForm, 'responsavel_nome', e.target.value)} /></Field>
        <ModalActions saving={saving} onClose={onClose} />
      </form>
    </Modal>
  );
}

export function SaidaModal({ entry, exit, responsibleName, onClose, onSave }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(() => exitToForm(exit, responsibleName));
  useEffect(() => setForm(exitToForm(exit, responsibleName)), [exit, responsibleName]);
  const saldoPermitido = useMemo(() => Number(entry?.saldo_disponivel || 0) + Number(exit?.peso_saida || 0), [entry, exit]);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    try { await onSave(form); } finally { setSaving(false); }
  }

  return (
    <Modal title={exit ? 'Editar saída' : 'Registrar saída'} onClose={onClose}>
      <form onSubmit={submit} className="grid gap-4">
        <section className="grid gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm md:grid-cols-3">
          <Read label="NF de origem" value={`${entry?.nf_numero || '-'} / ${entry?.nf_serie || '-'}`} />
          <Read label="Fornecedor" value={entry?.fornecedor_nome} />
          <Read label="Produto" value={entry?.produto_nome} />
          <Read label="Fornecedor/origem" value={entry?.fornecedor_nome} />
          <Read label="Peso original" value={`${formatKg(entry?.peso_nf)} KG`} />
          <Read label="Saldo disponível" value={`${formatKg(saldoPermitido)} KG`} strong />
        </section>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Data e hora da saída" required><input type="datetime-local" className={FIELD} required value={form.data_saida} onChange={(e) => change(setForm, 'data_saida', e.target.value)} /></Field>
          <Field label="NF de saída" required><input className={FIELD} required maxLength={30} value={form.nf_saida_numero} onChange={(e) => change(setForm, 'nf_saida_numero', e.target.value)} /></Field>
          <Field label="Série" required><input className={FIELD} required maxLength={10} value={form.nf_saida_serie} onChange={(e) => change(setForm, 'nf_saida_serie', e.target.value)} /></Field>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Chave da NF de saída"><input className={FIELD} inputMode="numeric" maxLength={54} value={form.chave_saida} onChange={(e) => change(setForm, 'chave_saida', e.target.value)} /></Field>
          <Field label="Peso da saída (KG)" required><input className={FIELD} required type="number" min="0.001" max={saldoPermitido} step="0.001" value={form.peso_saida} onChange={(e) => change(setForm, 'peso_saida', e.target.value)} /></Field>
          <Field label="Destino da mercadoria" required><input className={FIELD} required maxLength={180} value={form.destino} onChange={(e) => change(setForm, 'destino', e.target.value)} /></Field>
          <Field label="Destinatário"><input className={FIELD} maxLength={180} value={form.destinatario} onChange={(e) => change(setForm, 'destinatario', e.target.value)} /></Field>
          <Field label="CNPJ do destinatário"><input className={FIELD} inputMode="numeric" maxLength={18} value={form.destinatario_cnpj} onChange={(e) => change(setForm, 'destinatario_cnpj', e.target.value)} /></Field>
          <Field label="Placa"><input className={FIELD} maxLength={10} value={form.placa} onChange={(e) => change(setForm, 'placa', e.target.value.toUpperCase())} /></Field>
          <Field label="Veículo"><input className={FIELD} maxLength={100} value={form.veiculo} onChange={(e) => change(setForm, 'veiculo', e.target.value)} /></Field>
          <Field label="Motorista"><input className={FIELD} maxLength={160} value={form.motorista} onChange={(e) => change(setForm, 'motorista', e.target.value)} /></Field>
          <Field label="Transportadora"><input className={FIELD} maxLength={180} value={form.transportadora} onChange={(e) => change(setForm, 'transportadora', e.target.value)} /></Field>
          <Field label="Responsável pela saída" required><input className={FIELD} required maxLength={180} value={form.responsavel_nome} onChange={(e) => change(setForm, 'responsavel_nome', e.target.value)} /></Field>
        </div>
        <Field label="Observação"><textarea className={`${FIELD} min-h-24 py-3`} maxLength={1000} value={form.observacao} onChange={(e) => change(setForm, 'observacao', e.target.value)} /></Field>
        <ModalActions saving={saving} onClose={onClose} />
      </form>
    </Modal>
  );
}

export function ComplementoModal({ entry, onClose, onSave }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ nf_numero: '', nf_serie: '1', chave_acesso: '', observacao: '' });
  async function submit(event) {
    event.preventDefault(); setSaving(true);
    try { await onSave(form); } finally { setSaving(false); }
  }
  return <Modal title="Vincular NF complementar de valor" onClose={onClose}><form onSubmit={submit} className="grid gap-4"><section className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900"><p className="font-black">NF principal: {entry.nf_numero}/{entry.nf_serie}</p><p className="mt-1">A nota complementar não cria carga física, não adiciona peso e não altera o saldo.</p></section><div className="grid gap-4 sm:grid-cols-2"><Field label="Número da NF complementar" required><input className={FIELD} required maxLength={30} value={form.nf_numero} onChange={(e)=>change(setForm,'nf_numero',e.target.value)} /></Field><Field label="Série" required><input className={FIELD} required maxLength={10} value={form.nf_serie} onChange={(e)=>change(setForm,'nf_serie',e.target.value)} /></Field></div><Field label="Chave de acesso"><input className={FIELD} inputMode="numeric" maxLength={54} value={form.chave_acesso} onChange={(e)=>change(setForm,'chave_acesso',e.target.value)} /></Field><Field label="Observação"><textarea className={`${FIELD} min-h-24 py-3`} maxLength={1000} value={form.observacao} onChange={(e)=>change(setForm,'observacao',e.target.value)} /></Field><ModalActions saving={saving} onClose={onClose} /></form></Modal>;
}

export function ConfirmModal({ title, text, confirmLabel = 'Confirmar', onClose, onConfirm }) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    try { await onConfirm(reason); } finally { setSaving(false); }
  }
  return <Modal title={title} onClose={onClose}><form onSubmit={submit} className="grid gap-4"><p className="text-sm text-slate-600">{text}</p><Field label="Motivo" required><textarea className={`${FIELD} min-h-24 py-3`} required maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} /></Field><div className="flex justify-end gap-2"><button type="button" className="h-11 rounded-lg border border-slate-300 px-4 text-sm font-bold" onClick={onClose}>Voltar</button><button type="submit" disabled={saving} className="h-11 rounded-lg bg-red-600 px-4 text-sm font-bold text-white disabled:opacity-60">{saving ? 'Processando...' : confirmLabel}</button></div></form></Modal>;
}

function Modal({ title, onClose, children }) {
  return <div className="fixed inset-0 z-[70] overflow-y-auto bg-slate-950/60 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label={title}><div className="mx-auto my-4 w-full max-w-5xl rounded-2xl bg-white shadow-2xl"><header className="sticky top-0 z-10 flex items-center justify-between rounded-t-2xl border-b border-slate-200 bg-white px-5 py-4"><h2 className="text-xl font-black text-slate-950">{title}</h2><button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-lg text-slate-500 hover:bg-slate-100" aria-label="Fechar"><X /></button></header><div className="p-5">{children}</div></div></div>;
}

function Field({ label, required = false, children }) { return <label className="grid gap-1.5 text-sm font-bold text-slate-700"><span>{label}{required && <span className="text-red-600"> *</span>}</span>{children}</label>; }
function Read({ label, value, strong = false }) { return <div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p><p className={`mt-1 ${strong ? 'text-lg font-black text-emerald-700' : 'font-bold text-slate-900'}`}>{value || '-'}</p></div>; }
function ModalActions({ saving, onClose }) { return <div className="flex justify-end gap-2 border-t border-slate-200 pt-4"><button type="button" className="h-11 rounded-lg border border-slate-300 px-5 text-sm font-bold" onClick={onClose}>Cancelar</button><button type="submit" disabled={saving} className="h-11 rounded-lg bg-emerald-600 px-5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60">{saving ? 'Salvando...' : 'Salvar'}</button></div>; }
function change(setter, key, value) { setter((current) => ({ ...current, [key]: value })); }
function localDateTime(value = new Date()) { const date = value instanceof Date ? value : new Date(value); const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000); return local.toISOString().slice(0, 16); }
function entryToForm(entry, responsibleName) {
  const weight = formatOptionalDecimal(entry?.peso_nf, 3, 3);
  const total = formatOptionalDecimal(entry?.valor_total_nota, 2, 2);
  const calculatedUnit = calculateEntryUnitValue(entry?.valor_total_nota, entry?.peso_nf);
  return {
    data_entrada: localDateTime(entry?.data_entrada), nf_numero: entry?.nf_numero || '', nf_serie: entry?.nf_serie || '1', chave_acesso: entry?.chave_acesso || '',
    fornecedor_id: entry?.fornecedor_id || '', fornecedor_nome: entry?.fornecedor_nome || '', fornecedor_cnpj: entry?.fornecedor_cnpj || '',
    fornecedor_destino_id: entry?.fornecedor_destino_id || '', fornecedor_destino_nome: entry?.fornecedor_destino_nome || '', fornecedor_destino_cnpj: entry?.fornecedor_destino_cnpj || '',
    produto_id: entry?.produto_id || '', produto_nome: entry?.produto_nome || '', motorista_id: entry?.motorista_id || '', veiculo_id: entry?.veiculo_id || '',
    peso_nf: weight, valor_unitario: formatOptionalDecimal(calculatedUnit ?? entry?.valor_unitario, 4, 4), valor_total_nota: total,
    placa: entry?.placa || '', veiculo: entry?.veiculo || '', motorista: entry?.motorista || '', transportadora: entry?.transportadora || '', observacao: entry?.observacao || '', responsavel_nome: entry?.responsavel_nome || responsibleName || '',
  };
}
function exitToForm(exit, responsibleName) { return { data_saida: localDateTime(exit?.data_saida), nf_saida_numero: exit?.nf_saida_numero || '', nf_saida_serie: exit?.nf_saida_serie || '1', chave_saida: exit?.chave_saida || '', peso_saida: exit?.peso_saida || '', destino: exit?.destino || '', destinatario: exit?.destinatario || '', destinatario_cnpj: exit?.destinatario_cnpj || '', placa: exit?.placa || '', veiculo: exit?.veiculo || '', motorista: exit?.motorista || '', transportadora: exit?.transportadora || '', responsavel_nome: exit?.responsavel_nome || responsibleName || '', observacao: exit?.observacao || '' }; }
function formatKg(value) { return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 }).format(Number(value || 0)); }
function formatDocument(value) { const digits=String(value||'').replace(/\D/g,''); return digits.length===14?digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,'$1.$2.$3/$4-$5'):(value||'-'); }
function normalizeKey(value) { return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]/g,'').toLowerCase(); }
function matchSupplier(parsed, suppliers) { const document=String(parsed?.emitente?.documento||'').replace(/\D/g,''); return suppliers.find((item)=>String(item.cnpj||'').replace(/\D/g,'')===document)||suppliers.find((item)=>normalizeKey(item.nome)===normalizeKey(parsed?.emitente?.nome))||null; }
function matchProductItem(items=[], products=[]) { for (const item of items) { const produto=products.find((row)=>normalizeKey(row.nome)===normalizeKey(item.nome)); if (produto) return { item, produto }; } return null; }

function recalculateFinancials(form) {
  const weight = parseBrazilianDecimal(form.peso_nf);
  const total = parseBrazilianDecimal(form.valor_total_nota);
  const unit = calculateEntryUnitValue(total, weight);
  return { ...form, valor_unitario: unit === null ? '' : formatBrazilianDecimal(unit, 4, 4) };
}

function formatOptionalDecimal(value, minimumFractionDigits, maximumFractionDigits) {
  if (value === null || value === undefined || value === '') return '';
  return formatBrazilianDecimal(value, minimumFractionDigits, maximumFractionDigits);
}

function SearchableSupplier({ label, suppliers, value, onChange, required = false }) {
  const id = useId();
  const rootRef = useRef(null);
  const keepTypedQueryRef = useRef(false);
  const selected = suppliers.find((item) => item.id === value);
  const selectedLabel = supplierLabel(selected);
  const [query, setQuery] = useState(selectedLabel);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (keepTypedQueryRef.current && !selectedLabel) {
      keepTypedQueryRef.current = false;
      return;
    }
    setQuery(selectedLabel);
  }, [selectedLabel]);
  useEffect(() => {
    function close(event) { if (!rootRef.current?.contains(event.target)) setOpen(false); }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const filtered = useMemo(() => {
    const term = normalizeKey(query);
    if (!term || query === selectedLabel) return suppliers;
    return suppliers.filter((item) => normalizeKey(`${item.nome} ${item.cnpj || ''}`).includes(term));
  }, [query, selectedLabel, suppliers]);

  function type(next) {
    setQuery(next);
    setOpen(true);
    if (value) {
      keepTypedQueryRef.current = true;
      onChange('');
    }
  }

  function choose(item) {
    onChange(item.id);
    setQuery(supplierLabel(item));
    setOpen(false);
  }

  return <div ref={rootRef} className="relative grid gap-1.5 text-sm font-bold text-slate-700">
    <label htmlFor={id}>{label}{required && <span className="text-red-600"> *</span>}</label>
    <div className="relative"><Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input id={id} className={`${FIELD} pl-9`} required={required} value={query} onChange={(event) => type(event.target.value)} onFocus={() => setOpen(true)} placeholder="Buscar por nome ou CNPJ" autoComplete="off" role="combobox" aria-expanded={open} aria-autocomplete="list" /></div>
    {open && <div className="absolute top-full z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-xl" role="listbox">{filtered.map((item) => <button key={item.id} type="button" role="option" aria-selected={item.id === value} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(item)} className="block w-full rounded-md px-3 py-2 text-left hover:bg-emerald-50"><span className="block font-bold text-slate-900">{item.nome}</span><span className="block text-xs font-medium text-slate-500">{formatDocument(item.cnpj)}</span></button>)}{!filtered.length && <p className="px-3 py-2 text-sm text-slate-500">Nenhum fornecedor cadastrado encontrado.</p>}</div>}
  </div>;
}

function supplierLabel(item) { return item ? `${item.nome}${item.cnpj ? ` — ${formatDocument(item.cnpj)}` : ''}` : ''; }
