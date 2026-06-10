import { differenceInCalendarDays, parseISO } from 'date-fns';
import * as XLSX from 'xlsx';
import { supabase } from './supabase.js';

const selectContracts = `
  *,
  fornecedor:fornecedores(id,nome),
  fabrica:fabricas(id,nome),
  produto:produtos(id,nome)
`;

export async function listTable(table) {
  const { data, error } = await supabase.from(table).select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function listContracts() {
  const { data, error } = await supabase.from('contratos').select(selectContracts).order('created_at', { ascending: false });
  if (error) throw error;
  return hydrateContracts(data || []);
}

export async function listNotes() {
  const { data, error } = await supabase
    .from('notas_fiscais')
    .select('*, contrato:contratos(numero_contrato), fornecedor:fornecedores(nome)')
    .order('data_recebimento', { ascending: false });
  if (error) throw error;
  return (data || []).map((note) => ({
    ...note,
    valor_unitario: Number(note.quantidade_recebida || 0) > 0
      ? Number(note.valor_total || 0) / Number(note.quantidade_recebida || 0)
      : 0,
  }));
}

export async function listBackupData() {
  const [fornecedores, fabricas, produtos, contratos, notas_fiscais, documentos, fretes] = await Promise.all([
    listTable('fornecedores'),
    listTable('fabricas'),
    listTable('produtos'),
    listContracts(),
    listNotes(),
    listTable('documentos'),
    listTable('fretes'),
  ]);

  return {
    fornecedores,
    fabricas,
    produtos,
    contratos,
    notas_fiscais,
    documentos,
    fretes,
  };
}

export async function createRow(table, payload) {
  const { data, error } = await supabase.from(table).insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function updateRow(table, id, payload) {
  const { data, error } = await supabase.from(table).update(payload).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteRow(table, id) {
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) throw error;
}

export async function createNote(payload) {
  const { data, error } = await supabase.from('notas_fiscais').insert(payload).select().single();
  if (error) throw error;
  await refreshContractReceived(payload.contrato_id);
  return data;
}

export async function refreshContractReceived(contractId) {
  const { data: notes, error: notesError } = await supabase
    .from('notas_fiscais')
    .select('quantidade_recebida')
    .eq('contrato_id', contractId);
  if (notesError) throw notesError;

  const total = (notes || []).reduce((sum, note) => sum + Number(note.quantidade_recebida || 0), 0);
  const { error } = await supabase.from('contratos').update({ quantidade_recebida: total }).eq('id', contractId);
  if (error) throw error;
}

export function hydrateContracts(contracts) {
  return contracts.map((contract) => {
    const contratado = Number(contract.quantidade_contratada || 0);
    const recebido = Number(contract.quantidade_recebida || 0);
    const saldo = Math.max(contratado - recebido, 0);
    const percentual = contratado > 0 ? Math.min((recebido / contratado) * 100, 100) : 0;
    const daysToDue = contract.data_vencimento
      ? differenceInCalendarDays(parseISO(contract.data_vencimento), new Date())
      : null;
    const vencido = daysToDue !== null && daysToDue < 0 && saldo > 0;
    const venceEm30 = daysToDue !== null && daysToDue >= 0 && daysToDue <= 30 && saldo > 0;

    return {
      ...contract,
      saldo,
      percentual,
      vencido,
      venceEm30,
      status_calculado: vencido ? 'Vencido' : saldo <= 0 ? 'Concluído' : 'Ativo',
    };
  });
}

export function exportContractsCsv(contracts) {
  const headers = [
    'Número',
    'Fornecedor',
    'Produto',
    'Fábrica',
    'Contratado KG',
    'Recebido KG',
    'Saldo KG',
    'Execução %',
    'Vencimento',
    'Status',
  ];
  const rows = contracts.map((contract) => [
    contract.numero_contrato,
    contract.fornecedor?.nome || '',
    contract.produto?.nome || '',
    contract.fabrica?.nome || '',
    contract.quantidade_contratada,
    contract.quantidade_recebida,
    contract.saldo,
    Math.round(contract.percentual),
    contract.data_vencimento || '',
    contract.status_calculado,
  ]);
  const csv = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(';')).join('\n');
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), 'contratos-tijuca.csv');
}

export function exportContractsExcel(contracts) {
  const rows = contracts.map((contract) => ({
    Número: contract.numero_contrato,
    Fornecedor: contract.fornecedor?.nome || '',
    Produto: contract.produto?.nome || '',
    Fábrica: contract.fabrica?.nome || '',
    'Contratado KG': contract.quantidade_contratada,
    'Recebido KG': contract.quantidade_recebida,
    'Saldo KG': contract.saldo,
    'Execução %': Math.round(contract.percentual),
    Vencimento: contract.data_vencimento || '',
    Status: contract.status_calculado,
  }));
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Contratos');
  XLSX.writeFile(workbook, 'contratos-tijuca.xlsx');
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
