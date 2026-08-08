import { AlertTriangle, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { formatBrazilianDecimal, parseBrazilianDecimal } from '../../lib/oficinaMessejana.js';

export const MOVEMENT_TYPES = [
  ['TRANSFERENCIA_ESTOQUE_PROPRIO', 'Estoque próprio da empresa'],
  ['REFATURAMENTO_VENDA', 'Refaturamento/venda para outra empresa'],
  ['OPERACAO_DIRETA', 'Operação direta'],
  ['SALDO_INICIAL', 'Saldo inicial'],
  ['AJUSTE_ESTOQUE', 'Ajuste de estoque'],
];

const INPUT = 'h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100';

export default function OficinaMovimentacaoModal({ movement, defaults, sourceEntry, initialType, lookups, onClose, onSave }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(() => toForm(movement || defaults, initialType));
  const [error, setError] = useState('');
  const type = form.tipo;
  const needsOrigin = ['TRANSFERENCIA_ESTOQUE_PROPRIO', 'REFATURAMENTO_VENDA', 'OPERACAO_DIRETA'].includes(type);
  const needsStorage = ['SALDO_INICIAL', 'AJUSTE_ESTOQUE'].includes(type);
  const needsRecipient = ['REFATURAMENTO_VENDA', 'OPERACAO_DIRETA'].includes(type);
  const hasPurchase = ['OPERACAO_DIRETA', 'SALDO_INICIAL'].includes(type);
  const hasSale = ['REFATURAMENTO_VENDA', 'OPERACAO_DIRETA'].includes(type);
  const calculatedSale = useMemo(() => {
    const quantity = parseBrazilianDecimal(form.quantidade);
    const unit = parseBrazilianDecimal(form.valor_unitario_venda);
    return quantity && unit !== null ? Number((quantity * unit).toFixed(2)) : null;
  }, [form.quantidade, form.valor_unitario_venda]);
  const exactSale = parseBrazilianDecimal(form.valor_total_venda);
  const showDifference = calculatedSale !== null && exactSale !== null && Math.abs(calculatedSale - exactSale) > 0.01;

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    setSaving(true);
    try {
      await onSave(form);
    } catch (saveError) {
      setError(saveError?.message || 'Não foi possível salvar a movimentação.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-label="Movimentação de estoque">
      <form onSubmit={submit} className="mx-auto my-6 max-w-5xl rounded-2xl bg-white shadow-2xl">
        <header className="flex items-start justify-between border-b border-slate-200 p-5">
          <div><h2 className="text-xl font-black">{movement ? 'Editar movimentação' : 'Registrar saída / movimentação'}</h2><p className="mt-1 text-sm text-slate-500">Escolha o tipo da operação. Os campos e o impacto no estoque serão ajustados automaticamente.</p></div>
          <button type="button" onClick={onClose} aria-label="Fechar"><X /></button>
        </header>
        <div className="grid gap-4 p-5">
          {error && <p className="rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}
          {sourceEntry && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"><p className="font-black">Dados preenchidos a partir da entrada</p><p className="mt-1">NF {sourceEntry.nf_numero}/{sourceEntry.nf_serie} · {sourceEntry.fornecedor_nome} · {sourceEntry.produto_nome} · saldo {formatBrazilianDecimal(sourceEntry.saldo_disponivel, 3, 3)} KG</p></div>}
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Tipo de destinação/movimentação" required><select className={INPUT} required value={type} onChange={(e) => update('tipo', e.target.value)}>{MOVEMENT_TYPES.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
            <Field label="Data da movimentação" required><input type="datetime-local" className={INPUT} required value={form.data_movimentacao} onChange={(e) => update('data_movimentacao', e.target.value)} /></Field>
            <SearchSelect label="Fornecedor proprietário/origem" required rows={lookups.fornecedores} value={form.proprietario_id} onChange={(value) => update('proprietario_id', value)} />
            <SearchSelect label="Produto" required rows={lookups.produtos} value={form.produto_id} onChange={(value) => update('produto_id', value)} documentKey={null} />
            {needsOrigin && <SearchSelect label={type === 'OPERACAO_DIRETA' ? 'Fornecedor ou local de retirada' : 'Local de armazenagem atual'} required rows={lookups.fornecedores} value={form.local_origem_id} onChange={(value) => update('local_origem_id', value)} />}
            {needsStorage && <SearchSelect label="Fornecedor depositário/local de armazenagem" required rows={lookups.fornecedores} value={form.local_destino_id} onChange={(value) => update('local_destino_id', value)} />}
            {type === 'TRANSFERENCIA_ESTOQUE_PROPRIO' && <SearchSelect label="Unidade/local próprio de destino" required rows={lookups.unidades} value={form.unidade_destino_id} onChange={(value) => update('unidade_destino_id', value)} documentKey="identificacao" />}
            {needsRecipient && <SearchSelect label="Cliente, fornecedor ou empresa de destino" required rows={lookups.fornecedores} value={form.destinatario_id} onChange={(value) => update('destinatario_id', value)} />}
            <Field label="Quantidade (KG)" required><BrazilianInput value={form.quantidade} onChange={(value) => update('quantidade', value)} decimals={3} /></Field>
            <Field label="Data de referência" required><input type="date" className={INPUT} required value={form.data_referencia} onChange={(e) => update('data_referencia', e.target.value)} /></Field>
            {type === 'AJUSTE_ESTOQUE' && <Field label="Tipo do ajuste" required><select className={INPUT} required value={form.sentido_ajuste} onChange={(e) => update('sentido_ajuste', e.target.value)}><option value="POSITIVO">Positivo</option><option value="NEGATIVO">Negativo</option></select></Field>}
            {hasPurchase && <><Field label="NF/documento da compra" required={type === 'OPERACAO_DIRETA'}><input className={INPUT} required={type === 'OPERACAO_DIRETA'} value={form.documento_compra} onChange={(e) => update('documento_compra', e.target.value)} /></Field><Field label="Valor unitário da compra"><BrazilianInput value={form.valor_unitario_compra} onChange={(value) => update('valor_unitario_compra', value)} decimals={4} money /></Field><Field label="Valor total da compra"><BrazilianInput value={form.valor_total_compra} onChange={(value) => update('valor_total_compra', value)} decimals={2} money /></Field></>}
            {hasSale && <><Field label="NF/documento da venda" required={type === 'REFATURAMENTO_VENDA'}><input className={INPUT} required={type === 'REFATURAMENTO_VENDA'} value={form.documento_venda} onChange={(e) => update('documento_venda', e.target.value)} /></Field><Field label="Valor unitário da venda"><BrazilianInput value={form.valor_unitario_venda} onChange={(value) => update('valor_unitario_venda', value)} decimals={4} money /></Field><Field label="Valor total exato da NF"><BrazilianInput value={form.valor_total_venda} onChange={(value) => update('valor_total_venda', value)} decimals={2} money /></Field></>}
          </div>
          {hasSale && calculatedSale !== null && <p className={`rounded-lg p-3 text-sm font-bold ${showDifference ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-700'}`}>{showDifference && <AlertTriangle className="mr-2 inline h-4 w-4" />}Total calculado: R$ {formatBrazilianDecimal(calculatedSale,2,2)}{showDifference ? '. Confira a diferença para o total exato da NF.' : ''}</p>}
          {['SALDO_INICIAL','AJUSTE_ESTOQUE'].includes(type) && <Field label="Justificativa" required><textarea className={`${INPUT} min-h-24 py-3`} required value={form.justificativa} onChange={(e) => update('justificativa', e.target.value)} /></Field>}
          <Field label="Observação"><textarea className={`${INPUT} min-h-24 py-3`} value={form.observacao} onChange={(e) => update('observacao', e.target.value)} /></Field>
          {type === 'OPERACAO_DIRETA' && <p className="rounded-lg bg-sky-50 p-3 text-sm font-bold text-sky-800">Operação direta: este lançamento não aumenta nem reduz o estoque físico próprio.</p>}
        </div>
        <footer className="flex justify-end gap-2 border-t border-slate-200 p-4"><button type="button" className="secondary" onClick={onClose}>Cancelar</button><button type="submit" className="primary" disabled={saving}>{saving ? 'Salvando...' : 'Salvar movimentação'}</button></footer>
      </form>
    </div>
  );
}

function SearchSelect({ label, rows, value, onChange, required = false, documentKey = 'cnpj' }) {
  const [search, setSearch] = useState('');
  const term = normalize(search);
  const filtered = rows.filter((row) => !term || normalize(`${row.nome} ${documentKey ? row[documentKey] || '' : ''}`).includes(term));
  return <Field label={label} required={required}><div className="grid gap-2"><input className={INPUT} placeholder="Buscar por nome ou documento" value={search} onChange={(e) => setSearch(e.target.value)} /><select className={INPUT} required={required} value={value} onChange={(e) => onChange(e.target.value)}><option value="">Selecione</option>{filtered.map((row) => <option key={row.id} value={row.id}>{row.nome}{documentKey && row[documentKey] ? ` — ${row[documentKey]}` : ''}</option>)}</select></div></Field>;
}

function BrazilianInput({ value, onChange, decimals, money = false }) {
  return <input className={INPUT} inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} onBlur={() => { const parsed=parseBrazilianDecimal(value); if (parsed!==null) onChange(`${money?'R$ ':''}${formatBrazilianDecimal(parsed,decimals,decimals)}`); }} />;
}

function Field({ label, required, children }) { return <label className="grid content-start gap-1 text-sm font-bold">{label}{required ? ' *' : ''}{children}</label>; }
function normalize(value) { return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]/g,'').toLowerCase(); }
function localDateTime(value) { const date=value?new Date(value):new Date(); const local=new Date(date.getTime()-date.getTimezoneOffset()*60000); return local.toISOString().slice(0,16); }
function toForm(row, initialType) {
  const date = localDateTime(row?.data_movimentacao);
  return {
    tipo: row?.tipo || initialType || 'TRANSFERENCIA_ESTOQUE_PROPRIO',
    proprietario_id: row?.proprietario_id || '', local_origem_id: row?.local_origem_id || '',
    local_destino_id: row?.local_destino_id || '', destinatario_id: row?.destinatario_id || '',
    unidade_destino_id: row?.unidade_destino_id || '', produto_id: row?.produto_id || '',
    entrada_id: row?.entrada_id || '', data_movimentacao: date, data_referencia: row?.data_referencia || date.slice(0,10),
    quantidade: row?.quantidade ? formatBrazilianDecimal(row.quantidade,3,3) : '',
    sentido_ajuste: row?.sentido_ajuste || 'POSITIVO',
    documento_compra: row?.documento_compra || '', documento_venda: row?.documento_venda || '',
    valor_unitario_compra: row?.valor_unitario_compra ?? '', valor_total_compra: row?.valor_total_compra ?? '',
    valor_unitario_venda: row?.valor_unitario_venda ?? '', valor_total_venda: row?.valor_total_venda ?? '',
    justificativa: row?.justificativa || '', observacao: row?.observacao || '',
  };
}
