import { X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

const FIELD = 'h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100';

export function EntradaModal({ entry, lookups, responsibleName, onClose, onSave }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(() => entryToForm(entry, responsibleName));

  useEffect(() => setForm(entryToForm(entry, responsibleName)), [entry, responsibleName]);

  async function submit(event) {
    event.preventDefault();
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

  return (
    <Modal title={entry ? 'Editar entrada' : 'Nova entrada'} onClose={onClose}>
      <form onSubmit={submit} className="grid gap-4">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Data e hora da entrada" required><input type="datetime-local" className={FIELD} required value={form.data_entrada} onChange={(e) => change(setForm, 'data_entrada', e.target.value)} /></Field>
          <Field label="Número da NF-e" required><input className={FIELD} required maxLength={30} value={form.nf_numero} onChange={(e) => change(setForm, 'nf_numero', e.target.value)} /></Field>
          <Field label="Série" required><input className={FIELD} required maxLength={10} value={form.nf_serie} onChange={(e) => change(setForm, 'nf_serie', e.target.value)} /></Field>
        </div>
        <Field label="Chave de acesso (44 dígitos)"><input className={FIELD} inputMode="numeric" maxLength={54} value={form.chave_acesso} onChange={(e) => change(setForm, 'chave_acesso', e.target.value)} /></Field>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Fornecedor cadastrado"><select className={FIELD} value={form.fornecedor_id} onChange={(e) => selectFornecedor(e.target.value)}><option value="">Informar manualmente</option>{lookups.fornecedores.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></Field>
          <Field label="Produto cadastrado"><select className={FIELD} value={form.produto_id} onChange={(e) => selectProduto(e.target.value)}><option value="">Informar manualmente</option>{lookups.produtos.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></Field>
          <Field label="Fornecedor" required><input className={FIELD} required maxLength={180} value={form.fornecedor_nome} onChange={(e) => change(setForm, 'fornecedor_nome', e.target.value)} /></Field>
          <Field label="CNPJ do fornecedor" required><input className={FIELD} required inputMode="numeric" maxLength={18} value={form.fornecedor_cnpj} onChange={(e) => change(setForm, 'fornecedor_cnpj', e.target.value)} /></Field>
          <Field label="Produto" required><input className={FIELD} required maxLength={140} value={form.produto_nome} onChange={(e) => change(setForm, 'produto_nome', e.target.value)} /></Field>
          <Field label="Peso da NF (KG)" required><input className={FIELD} required type="number" min="0.001" step="0.001" value={form.peso_nf} onChange={(e) => change(setForm, 'peso_nf', e.target.value)} /></Field>
          <Field label="Depósito de destino" required><select className={FIELD} required value={form.deposito_id} onChange={(e) => change(setForm, 'deposito_id', e.target.value)}><option value="">Selecione</option>{lookups.depositos.filter((item) => item.ativo || item.id === form.deposito_id).map((item) => <option key={item.id} value={item.id}>{item.nome}{item.ativo ? '' : ' (inativo)'}</option>)}</select></Field>
          <Field label="Origem"><input className={FIELD} maxLength={160} value={form.origem} onChange={(e) => change(setForm, 'origem', e.target.value)} /></Field>
          <Field label="Placa"><input className={FIELD} maxLength={10} value={form.placa} onChange={(e) => change(setForm, 'placa', e.target.value.toUpperCase())} /></Field>
          <Field label="Veículo"><input className={FIELD} maxLength={100} value={form.veiculo} onChange={(e) => change(setForm, 'veiculo', e.target.value)} /></Field>
          <Field label="Motorista"><input className={FIELD} maxLength={160} value={form.motorista} onChange={(e) => change(setForm, 'motorista', e.target.value)} /></Field>
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
          <Read label="Depósito de origem" value={entry?.deposito_nome} />
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
function entryToForm(entry, responsibleName) { return { data_entrada: localDateTime(entry?.data_entrada), nf_numero: entry?.nf_numero || '', nf_serie: entry?.nf_serie || '1', chave_acesso: entry?.chave_acesso || '', fornecedor_id: entry?.fornecedor_id || '', fornecedor_nome: entry?.fornecedor_nome || '', fornecedor_cnpj: entry?.fornecedor_cnpj || '', produto_id: entry?.produto_id || '', produto_nome: entry?.produto_nome || '', peso_nf: entry?.peso_nf || '', placa: entry?.placa || '', veiculo: entry?.veiculo || '', motorista: entry?.motorista || '', transportadora: entry?.transportadora || '', origem: entry?.origem || '', deposito_id: entry?.deposito_id || '', observacao: entry?.observacao || '', responsavel_nome: entry?.responsavel_nome || responsibleName || '' }; }
function exitToForm(exit, responsibleName) { return { data_saida: localDateTime(exit?.data_saida), nf_saida_numero: exit?.nf_saida_numero || '', nf_saida_serie: exit?.nf_saida_serie || '1', chave_saida: exit?.chave_saida || '', peso_saida: exit?.peso_saida || '', destino: exit?.destino || '', destinatario: exit?.destinatario || '', destinatario_cnpj: exit?.destinatario_cnpj || '', placa: exit?.placa || '', veiculo: exit?.veiculo || '', motorista: exit?.motorista || '', transportadora: exit?.transportadora || '', responsavel_nome: exit?.responsavel_nome || responsibleName || '', observacao: exit?.observacao || '' }; }
function formatKg(value) { return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 }).format(Number(value || 0)); }
