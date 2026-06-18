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
  let { data, error } = await supabase
    .from('notas_fiscais')
    .select('*, contrato:contratos(numero_contrato), fornecedor:fornecedores(nome)')
    .order('data_recebimento', { ascending: false });
  if (error && isMissingUnitColumnsError(error)) {
    const fallback = await supabase
      .from('notas_fiscais')
      .select('id,user_id,contrato_id,fornecedor_id,numero_nf,quantidade_recebida,valor_total,data_recebimento,created_at,contrato:contratos(numero_contrato),fornecedor:fornecedores(nome)')
      .order('data_recebimento', { ascending: false });
    data = fallback.data;
    error = fallback.error;
  }
  if (error) throw error;
  return (data || []).map((note) => ({
    ...note,
    valor_unitario: note.valor_unitario ?? (Number(note.quantidade_recebida || 0) > 0
      ? Number(note.valor_total || 0) / Number(note.quantidade_recebida || 0)
      : 0),
    valor_unitario_decimais: note.valor_unitario_decimais ?? null,
  }));
}

export async function listFreights() {
  const { data, error } = await supabase
    .from('fretes')
    .select('*, contrato:contratos(id,numero_contrato,fornecedor_id)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function listBackupData() {
  const [fornecedores, fabricas, produtos, contratos, notas_fiscais, documentos, fretes] = await Promise.all([
    listTable('fornecedores'),
    listTable('fabricas'),
    listTable('produtos'),
    listContracts(),
    listNotes(),
    listTable('documentos'),
    listFreights(),
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

export async function importBackupData(tables) {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  const userId = authData?.user?.id;
  if (!userId) throw new Error('Usuário não autenticado. Como corrigir: saia e entre novamente antes de importar o backup.');

  const current = await listBackupData();
  const context = createImportContext(current);
  const report = {};

  for (const table of ['fornecedores', 'fabricas', 'produtos']) {
    report[table] = await importSimpleTable(table, tables[table] || [], context, userId);
    refreshImportContext(context, table, await listTable(table));
  }

  report.contratos = await importContracts(tables.contratos || [], context, userId);
  refreshImportContext(context, 'contratos', await listContracts());

  report.notas_fiscais = await importNotes(tables.notas_fiscais || [], context, userId);
  report.documentos = await importSimpleTable('documentos', tables.documentos || [], context, userId);
  report.fretes = await importFreights(tables.fretes || [], context, userId);

  const contractIds = new Set([
    ...(tables.notas_fiscais || []).map((row) => resolveId(row.contrato_id) || context.contractsByNumber.get(normalizeKey(readAny(row, ['numero_contrato', 'contrato'])))),
    ...(tables.contratos || []).map((row) => resolveId(row.id) || context.contractsByNumber.get(normalizeKey(readAny(row, ['numero_contrato', 'contrato'])))),
  ].filter(Boolean));

  for (const contractId of contractIds) {
    await refreshContractReceived(contractId);
  }

  return report;
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
  if (error && isMissingUnitColumnsError(error)) {
    const fallbackPayload = { ...payload };
    delete fallbackPayload.valor_unitario;
    delete fallbackPayload.valor_unitario_decimais;
    const { data: fallbackData, error: fallbackError } = await supabase.from('notas_fiscais').insert(fallbackPayload).select().single();
    if (fallbackError) throw fallbackError;
    await refreshContractReceived(payload.contrato_id);
    return fallbackData;
  }
  if (error) throw error;
  await refreshContractReceived(payload.contrato_id);
  return data;
}

export function auditAction(action, table = null, recordId = null, newData = null) {
  return supabase.rpc('agroflow_auditar', {
    action_name: action,
    table_name: table,
    record_id: recordId,
    old_data: null,
    new_data: newData,
  });
}

async function importSimpleTable(table, rows, context, userId) {
  const allowed = {
    fornecedores: ['id', 'user_id', 'nome', 'cnpj', 'telefone', 'email', 'cidade', 'uf', 'created_at'],
    fabricas: ['id', 'user_id', 'nome', 'cnpj', 'cidade', 'uf', 'responsavel', 'created_at'],
    produtos: ['id', 'user_id', 'nome', 'unidade', 'descricao', 'created_at'],
    documentos: ['id', 'user_id', 'nome', 'tipo', 'url', 'observacoes', 'created_at'],
  }[table];

  let imported = 0;
  let ignored = 0;

  for (const row of rows) {
    if (isEmptyBackupRow(row)) {
      ignored += 1;
      continue;
    }

    const payload = pickPayload(row, allowed, userId);
    if (!payload.nome && table !== 'documentos') {
      ignored += 1;
      continue;
    }
    if (table === 'documentos' && !payload.nome) {
      ignored += 1;
      continue;
    }

    const existingId = payload.id || findSimpleExistingId(table, payload, context);
    await saveImportedRow(table, { ...payload, id: existingId || payload.id });
    imported += 1;
  }

  return { imported, ignored };
}

async function importContracts(rows, context, userId) {
  let imported = 0;
  let ignored = 0;

  for (const row of rows) {
    if (isEmptyBackupRow(row)) {
      ignored += 1;
      continue;
    }

    const numero = readAny(row, ['numero_contrato', 'numero', 'contrato', 'Número', 'NÃºmero']);
    const fornecedorId = resolveId(row.fornecedor_id)
      || context.suppliersByName.get(normalizeKey(readAny(row, ['fornecedor', 'fornecedor_nome'])));
    const produtoId = resolveId(row.produto_id)
      || context.productsByName.get(normalizeKey(readAny(row, ['produto', 'produto_nome'])));
    const fabricaId = resolveId(row.fabrica_id)
      || context.factoriesByName.get(normalizeKey(readAny(row, ['fabrica', 'fábrica', 'FÃ¡brica', 'fabrica_nome'])));

    if (!numero || !fornecedorId || !produtoId) {
      ignored += 1;
      continue;
    }

    const payload = {
      id: resolveId(row.id) || context.contractsByNumber.get(normalizeKey(numero)),
      user_id: userId,
      numero_contrato: String(numero).trim(),
      fornecedor_id: fornecedorId,
      fabrica_id: fabricaId || null,
      produto_id: produtoId,
      quantidade_contratada: toNumber(readAny(row, ['quantidade_contratada', 'Contratado KG'])) || 0,
      quantidade_recebida: toNumber(readAny(row, ['quantidade_recebida', 'Recebido KG'])) || 0,
      custo_kg: toNumber(readAny(row, ['custo_kg', 'custo kg'])) || 0,
      data_vencimento: toDate(readAny(row, ['data_vencimento', 'vencimento', 'Vencimento'])),
      observacoes: readAny(row, ['observacoes', 'observações']) || null,
      created_at: row.created_at || undefined,
    };

    await saveImportedRow('contratos', payload);
    imported += 1;
  }

  return { imported, ignored };
}

async function importNotes(rows, context, userId) {
  let imported = 0;
  let ignored = 0;

  for (const row of rows) {
    if (isEmptyBackupRow(row)) {
      ignored += 1;
      continue;
    }

    const numeroNf = readAny(row, ['numero_nf', 'NF']);
    const contractId = resolveId(row.contrato_id)
      || context.contractsByNumber.get(normalizeKey(readAny(row, ['numero_contrato', 'contrato'])));
    const supplierId = resolveId(row.fornecedor_id)
      || context.suppliersByName.get(normalizeKey(readAny(row, ['fornecedor', 'fornecedor_nome'])));

    if (!numeroNf || !contractId) {
      ignored += 1;
      continue;
    }

    const existingId = resolveId(row.id) || context.notesByKey.get(`${normalizeKey(numeroNf)}|${supplierId || ''}|${contractId}`);
    const payload = {
      id: existingId,
      user_id: userId,
      contrato_id: contractId,
      fornecedor_id: supplierId || null,
      numero_nf: String(numeroNf).trim(),
      quantidade_recebida: toNumber(row.quantidade_recebida) || 0,
      valor_total: toNumber(row.valor_total) || 0,
      valor_unitario: nullableNumber(row.valor_unitario),
      valor_unitario_decimais: nullableInteger(row.valor_unitario_decimais),
      data_recebimento: toDate(row.data_recebimento),
      created_at: row.created_at || undefined,
    };

    await saveImportedRow('notas_fiscais', payload);
    imported += 1;
  }

  return { imported, ignored };
}

async function importFreights(rows, context, userId) {
  let imported = 0;
  let ignored = 0;

  for (const row of rows) {
    if (isEmptyBackupRow(row)) {
      ignored += 1;
      continue;
    }

    const contractId = resolveId(row.contrato_id)
      || context.contractsByNumber.get(normalizeKey(readAny(row, ['numero_contrato', 'contrato'])))
      || extractContractId(row.contrato);
    const numeroCte = readAny(row, ['numero_cte', 'Número do CTE']);
    const transportadora = readAny(row, ['transportadora']);

    if (!transportadora) {
      ignored += 1;
      continue;
    }

    const existingId = resolveId(row.id) || context.freightsByKey.get(`${normalizeKey(numeroCte)}|${contractId || ''}`);
    const payload = {
      id: existingId,
      user_id: userId,
      contrato_id: contractId || null,
      numero_cte: numeroCte || null,
      transportadora: String(transportadora).trim(),
      placa: row.placa || null,
      motorista: row.motorista || null,
      valor: toNumber(row.valor) || 0,
      data_frete: toDate(row.data_frete),
      created_at: row.created_at || undefined,
    };

    await saveImportedRow('fretes', payload);
    imported += 1;
  }

  return { imported, ignored };
}

async function saveImportedRow(table, payload) {
  const cleanPayload = Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));
  const { error } = await supabase.from(table).upsert(cleanPayload, { onConflict: 'id' });
  if (error) throw error;
}

function createImportContext(data) {
  const context = {};
  refreshImportContext(context, 'fornecedores', data.fornecedores || []);
  refreshImportContext(context, 'fabricas', data.fabricas || []);
  refreshImportContext(context, 'produtos', data.produtos || []);
  refreshImportContext(context, 'contratos', data.contratos || []);
  refreshImportContext(context, 'notas_fiscais', data.notas_fiscais || []);
  refreshImportContext(context, 'fretes', data.fretes || []);
  return context;
}

function refreshImportContext(context, table, rows) {
  if (table === 'fornecedores') context.suppliersByName = mapBy(rows, (row) => row.nome);
  if (table === 'fabricas') context.factoriesByName = mapBy(rows, (row) => row.nome);
  if (table === 'produtos') context.productsByName = mapBy(rows, (row) => row.nome);
  if (table === 'contratos') context.contractsByNumber = mapBy(rows, (row) => row.numero_contrato);
  if (table === 'notas_fiscais') {
    context.notesByKey = new Map(rows.map((row) => [`${normalizeKey(row.numero_nf)}|${row.fornecedor_id || ''}|${row.contrato_id || ''}`, row.id]));
  }
  if (table === 'fretes') {
    context.freightsByKey = new Map(rows.map((row) => [`${normalizeKey(row.numero_cte)}|${row.contrato_id || ''}`, row.id]));
  }
}

function findSimpleExistingId(table, payload, context) {
  if (table === 'fornecedores') return context.suppliersByName?.get(normalizeKey(payload.nome));
  if (table === 'fabricas') return context.factoriesByName?.get(normalizeKey(payload.nome));
  if (table === 'produtos') return context.productsByName?.get(normalizeKey(payload.nome));
  return null;
}

function pickPayload(row, allowed, userId) {
  return Object.fromEntries(
    allowed.map((key) => {
      if (key === 'user_id') return [key, userId];
      if (key === 'id') return [key, resolveId(row[key]) || undefined];
      if (key === 'created_at') return [key, row[key] || undefined];
      return [key, row[key] === '' ? null : row[key]];
    }),
  );
}

function mapBy(rows, getKey) {
  return new Map((rows || []).filter((row) => getKey(row)).map((row) => [normalizeKey(getKey(row)), row.id]));
}

function readAny(row, keys) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== '') return row[key];
  }
  return '';
}

function resolveId(value) {
  const id = String(value || '').trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id) ? id : null;
}

function extractContractId(value) {
  if (!value) return null;
  try {
    return resolveId(JSON.parse(value).id);
  } catch {
    return null;
  }
}

function isEmptyBackupRow(row) {
  return !row || row.aviso || Object.values(row).every((value) => value === undefined || value === null || value === '');
}

function toNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const text = String(value ?? '').trim();
  const normalized = text.includes(',')
    ? text.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '')
    : text.replace(/[^\d.-]/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function nullableNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  return toNumber(value);
}

function nullableInteger(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
  }
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const br = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return null;
}

function normalizeKey(value) {
  return String(value || '').trim().toLowerCase();
}

export async function deleteNote(note) {
  const { error } = await supabase.from('notas_fiscais').delete().eq('id', note.id);
  if (error) throw error;
  if (note.contrato_id) await refreshContractReceived(note.contrato_id);
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
  auditAction('exportar', 'contratos', null, { formato: 'csv', total: contracts.length });
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
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), 'contratos-agroflow.csv');
}

export function exportContractsExcel(contracts) {
  auditAction('exportar', 'contratos', null, { formato: 'xlsx', total: contracts.length });
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
  XLSX.writeFile(workbook, 'contratos-agroflow.xlsx');
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function isMissingUnitColumnsError(error) {
  const message = String(error?.message || '');
  return message.includes('valor_unitario') || message.includes('valor_unitario_decimais');
}
