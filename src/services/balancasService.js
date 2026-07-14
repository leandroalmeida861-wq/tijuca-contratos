import { supabase } from '../lib/supabase.js';

const RECEBIMENTO_SELECT = `
  *,
  balanca:balancas(id,nome),
  laboratorio:recebimento_laboratorios(id,nome),
  veiculo:recebimento_veiculos(id,placa,tipo_veiculo,qtd_eixos),
  motorista:recebimento_motoristas(id,nome),
  transportadora:recebimento_transportadoras(id,nome),
  fornecedor:fornecedores(id,nome,cnpj),
  produto:produtos(id,nome,unidade),
  itens:recebimento_itens(
    id,
    recebimento_id,
    produto_id,
    quantidade,
    unidade,
    valor_unitario,
    desconto,
    valor_total,
    ordem,
    created_at,
    updated_at,
    produto:produtos(id,nome,unidade)
  ),
  complementos:recebimento_notas_complementares(
    id,
    recebimento_id,
    numero_nf,
    serie,
    chave_nfe,
    data_emissao,
    fornecedor_id,
    fornecedor_nome,
    quantidade_nota,
    unidade_nota,
    peso_por_saca,
    peso_nf,
    valor_unitario,
    valor_total,
    xml_nome_arquivo,
    observacao,
    criado_em,
    atualizado_em,
    fornecedor:fornecedores(id,nome,cnpj)
  )
`;

const PORTARIA_SELECT = `
  *,
  veiculo:recebimento_veiculos(id,placa,tipo_veiculo,qtd_eixos),
  motorista:recebimento_motoristas(id,nome),
  transportadora:recebimento_transportadoras(id,nome),
  fornecedor:fornecedores(id,nome,cnpj),
  produto:produtos(id,nome,unidade)
`;

export const lookupTables = {
  balancas: {
    table: 'balancas',
    label: 'Balanças',
    search: ['nome', 'identificacao', 'localizacao'],
    fields: [
      { name: 'nome', label: 'Nome', required: true },
      { name: 'identificacao', label: 'Identificação' },
      { name: 'localizacao', label: 'Localização' },
    ],
    columns: ['nome', 'identificacao', 'localizacao', 'ativo'],
  },
  veiculos: {
    table: 'recebimento_veiculos',
    label: 'Veículos',
    search: ['placa', 'tipo_veiculo'],
    fields: [
      { name: 'placa', label: 'Placa', required: true },
      { name: 'tipo_veiculo', label: 'Tipo de veículo' },
      { name: 'qtd_eixos', label: 'Qtd. eixos', type: 'number' },
    ],
    columns: ['placa', 'tipo_veiculo', 'qtd_eixos', 'ativo'],
  },
  motoristas: {
    table: 'recebimento_motoristas',
    label: 'Motoristas',
    search: ['nome', 'cpf', 'telefone'],
    fields: [
      { name: 'nome', label: 'Nome', required: true },
      { name: 'cpf', label: 'CPF' },
      { name: 'telefone', label: 'Telefone' },
    ],
    columns: ['nome', 'cpf', 'telefone', 'ativo'],
  },
  transportadoras: {
    table: 'recebimento_transportadoras',
    label: 'Transportadoras',
    search: ['nome', 'cnpj', 'telefone'],
    fields: [
      { name: 'nome', label: 'Nome', required: true },
      { name: 'cnpj', label: 'CNPJ' },
      { name: 'telefone', label: 'Telefone' },
    ],
    columns: ['nome', 'cnpj', 'telefone', 'ativo'],
  },
  laboratorios: {
    table: 'recebimento_laboratorios',
    label: 'Laboratórios',
    search: ['nome', 'responsavel'],
    fields: [
      { name: 'nome', label: 'Nome', required: true },
      { name: 'responsavel', label: 'Responsável' },
    ],
    columns: ['nome', 'responsavel', 'ativo'],
  },
};

export async function loadBalancasOptions() {
  const [balancas, veiculos, motoristas, transportadoras, fornecedores, produtos, laboratorios] = await Promise.all([
    listLookup('balancas'),
    listLookup('recebimento_veiculos', 'placa'),
    listLookup('recebimento_motoristas'),
    listLookup('recebimento_transportadoras'),
    listLookup('fornecedores'),
    listLookup('produtos'),
    listLookup('recebimento_laboratorios'),
  ]);

  return { balancas, veiculos, motoristas, transportadoras, fornecedores, produtos, laboratorios };
}

export async function listLookup(table, orderColumn = 'nome') {
  const { data, error } = await supabase.from(table).select('*').order(orderColumn, { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function listRecebimentos(filters = {}) {
  let query = supabase
    .from('recebimentos')
    .select(RECEBIMENTO_SELECT)
    .order('data', { ascending: false })
    .order('created_at', { ascending: false });

  if (filters.dataInicial) query = query.gte('data', filters.dataInicial);
  if (filters.dataFinal) query = query.lte('data', filters.dataFinal);
  if (filters.balancaId) query = query.eq('balanca_id', filters.balancaId);
  if (filters.fornecedorId) query = query.eq('fornecedor_id', filters.fornecedorId);
  if (filters.produtoId) query = query.eq('produto_id', filters.produtoId);
  if (filters.laboratorioId) query = query.eq('laboratorio_id', filters.laboratorioId);
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.origemPortaria === 'com_portaria') query = query.not('portaria_id', 'is', null);
  if (filters.origemPortaria === 'sem_portaria') query = query.is('portaria_id', null);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function listPortariaEntradas() {
  const { data, error } = await supabase
    .from('portaria_entradas')
    .select(PORTARIA_SELECT)
    .order('data_entrada', { ascending: false })
    .order('hora_entrada', { ascending: false })
    .order('created_at', { ascending: false });
  if (error && isMissingPortariaTable(error)) return [];
  if (error) throw error;
  return data || [];
}

export async function createPortariaEntrada(payload) {
  const cleanedPayload = cleanPayload(payload);
  const { data, error } = await supabase
    .from('portaria_entradas')
    .insert(cleanedPayload)
    .select(PORTARIA_SELECT)
    .single();
  const fallbackPayload = stripMissingPortariaOptionalColumns(error, cleanedPayload);
  if (error && fallbackPayload) {
    const fallback = await supabase
      .from('portaria_entradas')
      .insert(fallbackPayload)
      .select(PORTARIA_SELECT)
      .single();
    if (fallback.error) throw fallback.error;
    return fallback.data;
  }
  if (error) throw error;
  return data;
}

export async function updatePortariaEntrada(id, payload) {
  requireRecordId(id, 'entrada da Portaria');
  const cleanedPayload = cleanPayload(payload);
  const { data, error } = await supabase
    .from('portaria_entradas')
    .update(cleanedPayload)
    .eq('id', id)
    .select(PORTARIA_SELECT)
    .single();
  const fallbackPayload = stripMissingPortariaOptionalColumns(error, cleanedPayload);
  if (error && fallbackPayload) {
    const fallback = await supabase
      .from('portaria_entradas')
      .update(fallbackPayload)
      .eq('id', id)
      .select(PORTARIA_SELECT)
      .single();
    if (fallback.error) throw fallback.error;
    return fallback.data;
  }
  if (error) throw error;
  return data;
}

export async function deletePortariaEntrada(id) {
  requireRecordId(id, 'entrada da Portaria');
  const { error } = await supabase.from('portaria_entradas').delete().eq('id', id);
  if (error) throw error;
}

export async function getRecebimento(id) {
  requireRecordId(id, 'recebimento');
  const { data, error } = await supabase.from('recebimentos').select(RECEBIMENTO_SELECT).eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function findRecebimentoByPortariaId(portariaId) {
  if (!portariaId) return null;
  requireRecordId(portariaId, 'entrada da Portaria');
  const { data, error } = await supabase
    .from('recebimentos')
    .select(RECEBIMENTO_SELECT)
    .eq('portaria_id', portariaId)
    .neq('status', 'cancelada')
    .order('created_at', { ascending: false })
    .limit(1);
  if (error && isMissingColumn(error, 'portaria_id')) return null;
  if (error) throw error;
  return data?.[0] || null;
}

export async function findDuplicateRecebimentoNotaFornecedor({ fornecedor_id, nf_numero, excludeId } = {}) {
  const fornecedorId = fornecedor_id || '';
  const nfDigits = normalizeNfNumber(nf_numero);
  if (!fornecedorId || !nfDigits) return null;

  const { data: selectedSupplier, error: supplierError } = await supabase
    .from('fornecedores')
    .select('id,nome,cnpj')
    .eq('id', fornecedorId)
    .maybeSingle();
  if (supplierError) throw supplierError;

  let query = supabase
    .from('recebimentos')
    .select('id,portaria_id,nf_numero,status,fornecedor:fornecedores(id,nome,cnpj)')
    .neq('status', 'cancelada');

  if (excludeId) query = query.neq('id', excludeId);

  let { data, error } = await query;
  if (error && isMissingColumn(error, 'portaria_id')) {
    query = supabase
      .from('recebimentos')
      .select('id,nf_numero,status,fornecedor:fornecedores(id,nome,cnpj)')
      .neq('status', 'cancelada');
    if (excludeId) query = query.neq('id', excludeId);
    const fallback = await query;
    data = fallback.data;
    error = fallback.error;
  }
  if (error) throw error;

  const selectedSupplierDoc = onlyDigits(selectedSupplier?.cnpj);
  const selectedSupplierName = normalize(selectedSupplier?.nome);

  return (data || []).find((row) => {
    if (normalizeNfNumber(row.nf_numero) !== nfDigits) return false;
    if (row.fornecedor?.id === fornecedorId) return true;

    const rowSupplierDoc = onlyDigits(row.fornecedor?.cnpj);
    if (selectedSupplierDoc && rowSupplierDoc && rowSupplierDoc === selectedSupplierDoc) return true;

    const rowSupplierName = normalize(row.fornecedor?.nome);
    return Boolean(selectedSupplierName && rowSupplierName && rowSupplierName === selectedSupplierName);
  }) || null;
}

export async function createRecebimento(payload) {
  const { itens, header } = prepareRecebimentoForSave(payload);
  const cleanedPayload = cleanPayload(header);
  const { data, error } = await supabase.from('recebimentos').insert(cleanedPayload).select(RECEBIMENTO_SELECT).single();
  const fallbackPayload = stripMissingOptionalColumns(error, cleanedPayload);
  if (error && fallbackPayload) {
    const fallback = await supabase.from('recebimentos').insert(fallbackPayload).select(RECEBIMENTO_SELECT).single();
    if (fallback.error) throw fallback.error;
    return saveRecebimentoItensAndReload(fallback.data.id, itens);
  }
  if (error) throw error;
  return saveRecebimentoItensAndReload(data.id, itens);
}

export async function updateRecebimento(id, payload) {
  requireRecordId(id, 'recebimento');
  const { itens, header } = prepareRecebimentoForSave(payload);
  const cleanedPayload = cleanPayload(header);
  const { data, error } = await supabase.from('recebimentos').update(cleanedPayload).eq('id', id).select(RECEBIMENTO_SELECT).single();
  const fallbackPayload = stripMissingOptionalColumns(error, cleanedPayload);
  if (error && fallbackPayload) {
    const fallback = await supabase.from('recebimentos').update(fallbackPayload).eq('id', id).select(RECEBIMENTO_SELECT).single();
    if (fallback.error) throw fallback.error;
    return saveRecebimentoItensAndReload(id, itens);
  }
  if (error) throw error;
  return saveRecebimentoItensAndReload(id, itens);
}

async function updateRecebimentoFields(id, payload) {
  requireRecordId(id, 'recebimento');
  const { data, error } = await supabase
    .from('recebimentos')
    .update(cleanPayload(payload))
    .eq('id', id)
    .select(RECEBIMENTO_SELECT)
    .single();
  if (error) throw error;
  return data;
}

export async function deleteRecebimento(id) {
  requireRecordId(id, 'recebimento');
  const { error: itensError } = await supabase.from('recebimento_itens').delete().eq('recebimento_id', id);
  if (itensError && !isMissingRecebimentoItensTable(itensError)) throw itensError;

  const { error: complementosError } = await supabase.from('recebimento_notas_complementares').delete().eq('recebimento_id', id);
  if (complementosError && !isMissingComplementosTable(complementosError)) throw complementosError;

  const { error } = await supabase.from('recebimentos').delete().eq('id', id);
  if (error) throw error;
}

export async function createNotaComplementar(payload) {
  const { data, error } = await supabase
    .from('recebimento_notas_complementares')
    .insert(cleanPayload(payload))
    .select('*, fornecedor:fornecedores(id,nome,cnpj)')
    .single();
  if (error) throw error;
  return data;
}

export async function updateNotaComplementar(id, payload) {
  const { data, error } = await supabase
    .from('recebimento_notas_complementares')
    .update(cleanPayload(payload))
    .eq('id', id)
    .select('*, fornecedor:fornecedores(id,nome,cnpj)')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteNotaComplementar(id) {
  const { error } = await supabase.from('recebimento_notas_complementares').delete().eq('id', id);
  if (error) throw error;
}

export async function approveRecebimento(id, { nf_numero, ticket_numero, umidade, umidade_01, umidade_02, liberado_por }) {
  return updateRecebimentoFields(id, {
    status: 'aprovada',
    nf_numero,
    ticket_numero,
    umidade,
    umidade_01,
    umidade_02,
    liberado_por,
    motivo_reprovacao: null,
    motivo_cancelamento: null,
  });
}

export async function rejectRecebimento(id, { motivo_reprovacao, nf_numero, ticket_numero, umidade, umidade_01, umidade_02, liberado_por }) {
  return updateRecebimentoFields(id, {
    status: 'reprovada',
    motivo_reprovacao,
    nf_numero,
    ticket_numero,
    umidade,
    umidade_01,
    umidade_02,
    liberado_por,
  });
}

export async function cancelRecebimento(id, motivo_cancelamento) {
  return updateRecebimentoFields(id, { status: 'cancelada', motivo_cancelamento });
}

export async function createLookup(table, payload) {
  const { data, error } = await supabase.from(table).insert(cleanPayload(payload)).select('*').single();
  if (error) throw error;
  return data;
}

export async function updateLookup(table, id, payload) {
  const { data, error } = await supabase.from(table).update(cleanPayload(payload)).eq('id', id).select('*').single();
  if (error) throw error;
  return data;
}

export async function deleteLookup(table, id) {
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) throw error;
}

export async function findOrCreateLookup(table, matchField, value, payload) {
  const normalized = normalize(value);
  if (!normalized) return null;
  const rows = await listLookup(table, matchField);
  const existing = rows.find((row) => normalize(row[matchField]) === normalized);
  if (existing) return existing;
  return createLookup(table, payload);
}

export function exportRecebimentosCsv(rows, fileName = 'recebimentos-balancas.csv') {
  const headers = [
    'Data',
    'Tipo da nota',
    'NF principal vinculada',
    'Numero da NF complementar',
    'NF',
    'Balança',
    'Fornecedor',
    'Produto',
    'Placa',
    'Peso bruto',
    'Tara',
    'Peso líquido',
    'Peso - Quantidade',
    'Quantidade NF',
    'Unidade NF',
    'Valor unitario',
    'Valor principal',
    'Valor complemento',
    'Valor total agregado',
    'Umidade',
    'Diferenca KG',
    'Chave da NF-e complementar',
    'Observacao complemento',
    'Umidade 01',
    'Umidade 02',
    'Umidade media',
    'Diferença %',
    'Motivo reprovação',
    'Motivo cancelamento',
  ];
  const body = rows.map((row) => [
    row.data,
    row.tipo_nota_relatorio || 'Principal',
    row.nf_principal_relatorio || row.nf_numero,
    row.nf_complementar_relatorio || '',
    row.nf_numero,
    row.balanca?.nome,
    row.fornecedor?.nome || row.fornecedor_nome_manual,
    row.produto?.nome || row.produto_nome_manual,
    row.veiculo_placa_manual || row.veiculo?.placa,
    row.peso_bruto,
    row.tara,
    row.peso_liquido,
    row.peso_nf,
    row.quantidade_nota,
    row.unidade_nota,
    row.valor_unitario,
    row.valor_principal_relatorio ?? row.valor_total,
    row.valor_complemento_relatorio ?? 0,
    row.valor_agregado_relatorio ?? row.valor_total,
    row.umidade_relatorio ?? row.umidade ?? '',
    row.diferenca_relatorio ?? row.diferenca_kg,
    row.chave_complementar_relatorio || '',
    row.observacao_complementar_relatorio || '',
    row.umidade_01,
    row.umidade_02,
    row.umidade,
    row.diferenca_pct,
    row.motivo_reprovacao,
    row.motivo_cancelamento,
  ]);
  const csv = [headers, ...body].map((line) => line.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(';')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export function toUserError(error) {
  const message = String(error?.message || error || '');
  const lower = message.toLowerCase();
  if (lower.includes('row-level security') || lower.includes('permission')) {
    return 'Acesso negado. Como corrigir: confira se seu perfil tem permissão no menu Balanças.';
  }
  if (lower.includes('recebimento_notas_complementares_chave_unica') || (lower.includes('duplicate') && lower.includes('chave'))) {
    return 'Chave da NF-e complementar duplicada. Como corrigir: confira se esta nota complementar ja foi vinculada a outro recebimento.';
  }
  if (lower.includes('duplicate') || lower.includes('unique')) {
    return 'Registro duplicado. Como corrigir: confira placa, chave da NF ou cadastro já existente antes de salvar novamente.';
  }
  if (lower.includes('foreign key')) {
    return 'Vínculo inválido. Como corrigir: escolha um cadastro existente de fornecedor, produto, balança ou laboratório.';
  }
  if (lower.includes('schema cache') || lower.includes('does not exist') || lower.includes('could not find')) {
    return 'Banco ainda não reconheceu o módulo Balanças. Como corrigir: aplique os SQLs supabase/balancas-modulo-recebimento.sql e supabase/portaria-balancas.sql no Supabase e recarregue o app.';
  }
  return message || 'Não foi possível concluir a operação. Como corrigir: confira os dados e tente novamente.';
}

function requireRecordId(id, label) {
  const value = String(id || '').trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error(`Identificador inválido para ${label}. Recarregue a tela e selecione o registro novamente.`);
  }
  return value;
}

function cleanPayload(payload) {
  return Object.fromEntries(
    Object.entries(payload)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, value === '' ? null : value]),
  );
}

function prepareRecebimentoForSave(payload = {}) {
  const rawItems = Array.isArray(payload.itens) && payload.itens.length
    ? payload.itens
    : [legacyItemFromRecebimento(payload)];
  const itens = normalizeRecebimentoItens(rawItems);
  const totals = calcularTotaisRecebimento(itens);
  const firstItem = itens[0] || {};
  const header = { ...payload };
  delete header.itens;

  header.produto_id = firstItem.produto_id || header.produto_id || null;
  header.quantidade_nota = firstItem.quantidade ?? header.quantidade_nota ?? null;
  header.unidade_nota = firstItem.unidade || header.unidade_nota || 'KG';
  header.valor_unitario = firstItem.valor_unitario ?? header.valor_unitario ?? null;
  header.valor_total = totals.valorTotal;
  header.subtotal = totals.subtotal;
  header.desconto_total = totals.descontoTotal;

  return { header, itens };
}

function legacyItemFromRecebimento(payload = {}) {
  return {
    produto_id: payload.produto_id,
    quantidade: payload.quantidade_nota ?? payload.peso_nf ?? 0,
    unidade: payload.unidade_nota || 'KG',
    valor_unitario: payload.valor_unitario ?? 0,
    desconto: 0,
    valor_total: payload.valor_total,
    ordem: 1,
  };
}

function normalizeRecebimentoItens(items = []) {
  return (items || []).map((item, index) => {
    const quantidade = nonNegativeNumber(item.quantidade);
    const valorUnitario = nonNegativeNumber(item.valor_unitario);
    const subtotal = roundMoney(quantidade * valorUnitario);
    const desconto = Math.min(nonNegativeNumber(item.desconto), subtotal);
    const hasManualTotal = item.valor_total !== null && item.valor_total !== undefined && item.valor_total !== '';
    const valorTotal = hasManualTotal ? nonNegativeNumber(item.valor_total) : roundMoney(subtotal - desconto);
    return {
      id: item.id || undefined,
      produto_id: item.produto_id || null,
      quantidade,
      unidade: item.unidade || 'KG',
      valor_unitario: valorUnitario,
      desconto,
      valor_total: valorTotal,
      ordem: Number(item.ordem || index + 1),
    };
  }).filter((item) => item.quantidade >= 0);
}

function calcularTotaisRecebimento(itens = []) {
  return (itens || []).reduce((acc, item) => {
    const subtotalItem = roundMoney(nonNegativeNumber(item.quantidade) * nonNegativeNumber(item.valor_unitario));
    const descontoItem = Math.min(nonNegativeNumber(item.desconto), subtotalItem);
    const hasManualTotal = item.valor_total !== null && item.valor_total !== undefined && item.valor_total !== '';
    const valorTotalItem = hasManualTotal ? nonNegativeNumber(item.valor_total) : roundMoney(subtotalItem - descontoItem);
    acc.subtotal = roundMoney(acc.subtotal + subtotalItem);
    acc.descontoTotal = roundMoney(acc.descontoTotal + descontoItem);
    acc.valorTotal = roundMoney(acc.valorTotal + valorTotalItem);
    return acc;
  }, { subtotal: 0, descontoTotal: 0, valorTotal: 0 });
}

async function saveRecebimentoItensAndReload(recebimentoId, itens = []) {
  const normalizedItems = normalizeRecebimentoItens(itens).map((item, index) => ({
    ...item,
    recebimento_id: recebimentoId,
    ordem: index + 1,
  }));

  const { error: deleteError } = await supabase.from('recebimento_itens').delete().eq('recebimento_id', recebimentoId);
  if (deleteError && !isMissingRecebimentoItensTable(deleteError)) throw deleteError;

  if (normalizedItems.length && !deleteError) {
    const { error: insertError } = await supabase.from('recebimento_itens').insert(normalizedItems.map(cleanPayload));
    if (insertError && !isMissingRecebimentoItensTable(insertError)) throw insertError;
  }

  return getRecebimento(recebimentoId);
}

function nonNegativeNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
}

function roundMoney(value) {
  return Number((Number(value || 0)).toFixed(2));
}

function isMissingColumn(error, column) {
  const message = String(error?.message || '').toLowerCase();
  return message.includes(column.toLowerCase()) && (
    message.includes('schema cache')
    || message.includes('could not find')
    || message.includes('does not exist')
    || message.includes('column')
  );
}

function stripMissingPortariaOptionalColumns(error, payload) {
  if (!error) return null;
  const fallbackPayload = { ...payload };
  let changed = false;

  ['unidade_nota'].forEach((column) => {
    if (fallbackPayload[column] !== undefined && isMissingColumn(error, column)) {
      delete fallbackPayload[column];
      changed = true;
    }
  });

  return changed ? fallbackPayload : null;
}

function stripMissingOptionalColumns(error, payload) {
  if (!error) return null;
  const fallbackPayload = { ...payload };
  let changed = false;

  if (fallbackPayload.portaria_id !== undefined && isMissingColumn(error, 'portaria_id')) {
    delete fallbackPayload.portaria_id;
    changed = true;
  }

  if ((fallbackPayload.umidade_01 !== undefined || fallbackPayload.umidade_02 !== undefined)
    && (isMissingColumn(error, 'umidade_01') || isMissingColumn(error, 'umidade_02'))) {
    delete fallbackPayload.umidade_01;
    delete fallbackPayload.umidade_02;
    changed = true;
  }

  if ((fallbackPayload.quantidade_nota !== undefined || fallbackPayload.unidade_nota !== undefined || fallbackPayload.peso_por_saca !== undefined)
    && (isMissingColumn(error, 'quantidade_nota') || isMissingColumn(error, 'unidade_nota') || isMissingColumn(error, 'peso_por_saca'))) {
    delete fallbackPayload.quantidade_nota;
    delete fallbackPayload.unidade_nota;
    delete fallbackPayload.peso_por_saca;
    changed = true;
  }

  return changed ? fallbackPayload : null;
}

function isMissingPortariaTable(error) {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('portaria_entradas') && (
    message.includes('does not exist')
    || message.includes('could not find')
    || message.includes('schema cache')
  );
}

function isMissingRecebimentoItensTable(error) {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('recebimento_itens') && (
    message.includes('does not exist')
    || message.includes('could not find')
    || message.includes('schema cache')
  );
}

function isMissingComplementosTable(error) {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('recebimento_notas_complementares') && (
    message.includes('does not exist')
    || message.includes('could not find')
    || message.includes('schema cache')
  );
}

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w]+/g, '')
    .toLowerCase();
}

function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function normalizeNfNumber(value) {
  const digits = onlyDigits(value);
  if (!digits) return '';
  return digits.replace(/^0+/, '') || '0';
}
