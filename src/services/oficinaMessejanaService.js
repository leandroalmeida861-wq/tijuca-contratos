import { supabase } from '../lib/supabase.js';
import { calculateEntryUnitValue, parseBrazilianDecimal } from '../lib/oficinaMessejana.js';

export const OFICINA_PAGE_SIZE = 10;

const ENTRY_SELECT = '*';
const EXIT_SELECT = '*';

export async function listOficinaLookups() {
  const [{ data, error }, { data: unidades, error: unidadesError }] = await Promise.all([
    supabase.rpc('oficina_messejana_opcoes_entrada'),
    supabase.from('balancas').select('id,nome,identificacao').eq('ativo', true).order('nome'),
  ]);
  if (error) throw error;
  if (unidadesError) throw unidadesError;
  return {
    depositos: [],
    fornecedores: data?.fornecedores || [],
    produtos: data?.produtos || [],
    motoristas: data?.motoristas || [],
    veiculos: data?.veiculos || [],
    unidades: unidades || [],
  };
}

export async function listMovimentacoes({ period, filters = {} } = {}) {
  let query = supabase
    .from('oficina_messejana_movimentacoes_resumo')
    .select('*')
    .order('data_movimentacao', { ascending: false });
  const search = cleanSearch(filters.search);
  if (search) {
    const pattern = `*${search}*`;
    query = query.or([
      `proprietario_nome.ilike.${pattern}`,
      `local_origem_nome.ilike.${pattern}`,
      `local_destino_nome.ilike.${pattern}`,
      `destinatario_nome.ilike.${pattern}`,
      `produto_nome.ilike.${pattern}`,
      `documento_compra.ilike.${pattern}`,
      `documento_venda.ilike.${pattern}`,
    ].join(','));
  } else {
    query = applyPeriod(query, 'data_movimentacao', period);
  }
  if (filters.tipo) query = query.eq('tipo', filters.tipo);
  if (filters.produtoId) query = query.eq('produto_id', filters.produtoId);
  if (filters.proprietarioId) query = query.eq('proprietario_id', filters.proprietarioId);
  if (filters.localId) query = query.or(`local_origem_id.eq.${filters.localId},local_destino_id.eq.${filters.localId}`);
  if (filters.destinatarioId) query = query.eq('destinatario_id', filters.destinatarioId);
  const { data: rows, error } = await query;
  if (error) throw error;
  return rows || [];
}

export async function listEntradas({ page = 1, pageSize = OFICINA_PAGE_SIZE, period, filters = {} } = {}) {
  const lookups = await listOficinaLookups();
  let query = supabase
    .from('oficina_messejana_entradas_resumo')
    .select(ENTRY_SELECT, { count: 'exact' })
    .order('data_entrada', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);
  const search = cleanSearch(filters.search);
  if (search) {
    const pattern = `*${search}*`;
    const destinationIds = supplierIdsForSearch(lookups.fornecedores, search);
    query = query.or([
      `nf_numero.ilike.${pattern}`,
      `fornecedor_nome.ilike.${pattern}`,
      `produto_nome.ilike.${pattern}`,
      `placa.ilike.${pattern}`,
      ...(destinationIds.length ? [`fornecedor_destino_id.in.(${destinationIds.join(',')})`] : []),
    ].join(','));
  } else {
    query = applyPeriod(query, 'data_entrada', period);
  }
  query = applyTextFilter(query, 'fornecedor_nome', filters.fornecedor);
  const destinationFilter = cleanSearch(filters.fornecedorDestino);
  if (destinationFilter) {
    const destinationIds = supplierIdsForSearch(lookups.fornecedores, destinationFilter);
    if (!destinationIds.length) return { rows: [], count: 0 };
    query = query.in('fornecedor_destino_id', destinationIds);
  }
  query = applyTextFilter(query, 'produto_nome', filters.produto);
  query = applyTextFilter(query, 'placa', filters.placa);
  query = applyTextFilter(query, 'motorista', filters.motorista);
  query = applyExactFilter(query, 'status_saldo', filters.status);
  const { data, error, count } = await query;
  if (error) throw error;
  const suppliers = new Map(lookups.fornecedores.map((item) => [item.id, item]));
  return {
    rows: (data || []).map((row) => {
      const destination = suppliers.get(row.fornecedor_destino_id);
      return {
        ...row,
        fornecedor_destino_nome: row.fornecedor_destino_nome || destination?.nome || null,
        fornecedor_destino_cnpj: row.fornecedor_destino_cnpj || destination?.cnpj || null,
      };
    }),
    count: count || 0,
  };
}

export async function listSaidas({ page = 1, pageSize = OFICINA_PAGE_SIZE, period, filters = {} } = {}) {
  let query = supabase
    .from('oficina_messejana_saidas_resumo')
    .select(EXIT_SELECT, { count: 'exact' })
    .order('data_saida', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);
  const search = cleanSearch(filters.search);
  if (search) {
    const pattern = `*${search}*`;
    query = query.or([
      `nf_origem_numero.ilike.${pattern}`,
      `nf_saida_numero.ilike.${pattern}`,
      `fornecedor_nome.ilike.${pattern}`,
      `produto_nome.ilike.${pattern}`,
      `placa.ilike.${pattern}`,
    ].join(','));
  } else {
    query = applyPeriod(query, 'data_saida', period);
  }
  query = applyTextFilter(query, 'fornecedor_nome', filters.fornecedor);
  query = applyTextFilter(query, 'produto_nome', filters.produto);
  query = applyTextFilter(query, 'destino', filters.destino);
  query = applyTextFilter(query, 'placa', filters.placa);
  query = applyTextFilter(query, 'motorista', filters.motorista);
  query = applyExactFilter(query, 'status_registro', filters.status);
  const { data, error, count } = await query;
  if (error) throw error;
  return { rows: data || [], count: count || 0 };
}

export async function getOficinaDashboard(period) {
  const { start, end } = periodRange(period);
  const [{ data, error }, { data: stock, error: stockError }] = await Promise.all([
    supabase.rpc('oficina_messejana_dashboard', { p_inicio: start, p_fim: end }),
    supabase.rpc('oficina_messejana_dashboard_estoque', { p_inicio: start, p_fim: end }),
  ]);
  if (error) throw error;
  if (stockError) throw stockError;
  return {
    ...(data || {}),
    ...(stock || {}),
    saldo_total: Number(data?.saldo_total || 0) + Number(stock?.saldo_complementar || 0),
  };
}

export async function getEntrada(id) {
  const { data, error } = await supabase
    .from('oficina_messejana_entradas_resumo')
    .select(ENTRY_SELECT)
    .eq('id', requireUuid(id))
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('OFICINA_REGISTRO_NAO_ENCONTRADO');
  return data;
}

export async function saveEntrada(id, data) {
  const normalized = normalizeEntryPayload(data);
  const { data: savedId, error } = await supabase.rpc('oficina_messejana_salvar_entrada', {
    p_entrada_id: id || null,
    p_dados: normalized,
  });
  if (error) throw error;
  return savedId;
}

export async function cancelEntrada(id, reason) {
  const { error } = await supabase.rpc('oficina_messejana_cancelar_entrada', {
    p_entrada_id: requireUuid(id),
    p_motivo: String(reason || '').trim(),
  });
  if (error) throw error;
}

export async function saveSaida(id, entradaId, idempotencyKey, data) {
  const { data: savedId, error } = await supabase.rpc('oficina_messejana_salvar_saida', {
    p_saida_id: id || null,
    p_entrada_id: requireUuid(entradaId),
    p_idempotency_key: requireUuid(idempotencyKey),
    p_dados: normalizePayload(data),
  });
  if (error) throw error;
  return savedId;
}

export async function cancelSaida(id, reason) {
  const { error } = await supabase.rpc('oficina_messejana_cancelar_saida', {
    p_saida_id: requireUuid(id),
    p_motivo: String(reason || '').trim(),
  });
  if (error) throw error;
}

export async function saveMovimentacao(id, idempotencyKey, data) {
  const { data: savedId, error } = await supabase.rpc('oficina_messejana_salvar_movimentacao', {
    p_movimentacao_id: id || null,
    p_idempotency_key: requireUuid(idempotencyKey),
    p_dados: normalizeMovementPayload(data),
  });
  if (error) throw error;
  return savedId;
}

export async function cancelMovimentacao(id, reason) {
  const { error } = await supabase.rpc('oficina_messejana_cancelar_movimentacao', {
    p_movimentacao_id: requireUuid(id),
    p_motivo: String(reason || '').trim(),
  });
  if (error) throw error;
}

export async function saveNotaComplementar(entradaId, data) {
  const { data: savedId, error } = await supabase.rpc('oficina_messejana_salvar_nota_complementar', {
    p_entrada_id: requireUuid(entradaId),
    p_nf_numero: String(data.nf_numero || '').trim(),
    p_nf_serie: String(data.nf_serie || '1').trim(),
    p_chave_acesso: String(data.chave_acesso || '').trim() || null,
    p_observacao: String(data.observacao || '').trim() || null,
  });
  if (error) throw error;
  return savedId;
}

export async function saveDeposito(id, data) {
  const { data: savedId, error } = await supabase.rpc('oficina_messejana_salvar_deposito', {
    p_deposito_id: id ? requireUuid(id) : null,
    p_fornecedor_id: data.fornecedor_id ? requireUuid(data.fornecedor_id) : null,
    p_nome: String(data.nome || '').trim(),
    p_ativo: data.ativo !== false,
  });
  if (error) throw error;
  return savedId;
}

export async function deleteDeposito(id) {
  const { error } = await supabase.rpc('oficina_messejana_excluir_deposito', {
    p_deposito_id: requireUuid(id),
  });
  if (error) throw error;
}

export async function listAllForExport(type, options = {}) {
  const allRows = [];
  const { start, end } = periodRange(options.period);
  const pageSize = 500;
  let offset = 0;
  while (true) {
    const { data, error } = await supabase.rpc('oficina_messejana_exportar', {
      p_tipo: type,
      p_inicio: start,
      p_fim: end,
      p_offset: offset,
      p_limit: pageSize,
    });
    if (error) throw error;
    const rows = Array.isArray(data) ? data : [];
    allRows.push(...rows);
    if (rows.length < pageSize) break;
    offset += pageSize;
  }
  return allRows;
}

export function oficinaUserError(error) {
  const message = String(error?.message || error || '');
  if (message.includes('OFICINA_DEPOSITO_EM_USO')) return 'Este depósito possui entradas vinculadas. Desative-o para preservar o histórico.';
  if (message.includes('OFICINA_DEPOSITO_DUPLICADO')) return 'Já existe um depósito com este nome na Central de Grãos Messejana.';
  if (message.includes('OFICINA_FORNECEDOR_INVALIDO')) return 'O fornecedor selecionado não existe ou não pertence à sua empresa.';
  if (message.includes('OFICINA_DEPOSITO_NOME_OBRIGATORIO')) return 'Informe o nome do depósito ou selecione um fornecedor cadastrado.';
  if (message.includes('OFICINA_FORNECEDOR_OBRIGATORIO')) return 'Selecione um fornecedor já cadastrado.';
  if (message.includes('OFICINA_FORNECEDOR_DESTINO_OBRIGATORIO')) return 'Selecione o fornecedor destino onde os grãos ficarão armazenados.';
  if (message.includes('OFICINA_FORNECEDOR_DESTINO_INVALIDO')) return 'O fornecedor destino não existe ou não pertence à sua empresa.';
  if (message.includes('OFICINA_PRODUTO_OBRIGATORIO')) return 'Selecione um produto já cadastrado.';
  if (message.includes('OFICINA_PRODUTO_INVALIDO')) return 'O produto selecionado não existe ou não pertence à sua empresa.';
  if (message.includes('OFICINA_MOTORISTA_INVALIDO')) return 'O motorista selecionado não existe, está inativo ou pertence a outra empresa.';
  if (message.includes('OFICINA_VEICULO_INVALIDO')) return 'O veículo selecionado não existe, está inativo ou pertence a outra empresa.';
  if (message.includes('OFICINA_VALOR_INVALIDO')) return 'Valor unitário e valor total da nota não podem ser negativos.';
  if (message.includes('OFICINA_PESO_INVALIDO')) return 'Informe um peso da NF válido e maior que zero.';
  if (message.includes('OFICINA_SALDO_INSUFICIENTE')) return 'O peso informado é maior que o saldo disponível desta entrada.';
  if (message.includes('OFICINA_SALDO_INICIAL_DUPLICADO')) return 'Já existe saldo inicial para este proprietário, local, produto e data de referência.';
  if (message.includes('OFICINA_MOVIMENTACAO_DUPLICADA')) return 'Esta movimentação já foi registrada.';
  if (message.includes('OFICINA_JUSTIFICATIVA_OBRIGATORIA')) return 'Informe uma justificativa para concluir esta operação.';
  if (message.includes('OFICINA_MOVIMENTACAO_INVALIDA')) return 'Revise os campos obrigatórios da movimentação.';
  if (message.includes('OFICINA_CADASTRO_FORA_EMPRESA') || message.includes('OFICINA_LOCAL_INVALIDO') || message.includes('OFICINA_DESTINO_INVALIDO') || message.includes('OFICINA_UNIDADE_INVALIDA')) return 'Um dos cadastros selecionados não pertence à sua empresa ou unidade autorizada.';
  if (message.includes('OFICINA_NF_DUPLICADA')) return 'Esta nota fiscal já foi cadastrada na Central de Grãos Messejana. Revise o lançamento existente.';
  if (message.includes('OFICINA_ENTRADA_CANCELADA')) return 'Não é permitido registrar saída para uma entrada cancelada.';
  if (message.includes('OFICINA_ENTRADA_COM_SAIDAS')) return 'Cancele primeiro as saídas confirmadas antes de cancelar esta entrada.';
  if (message.includes('OFICINA_DEPOSITO_INVALIDO')) return 'Selecione um depósito ativo da Central de Grãos Messejana.';
  if (message.includes('OFICINA_PESO_MENOR_QUE_SAIDAS')) return 'O peso da entrada não pode ficar abaixo do total já retirado.';
  if (message.includes('OFICINA_ACESSO_NEGADO') || error?.code === '42501') return 'Acesso negado para esta ação na Central de Grãos Messejana.';
  if (message.includes('OFICINA_REGISTRO_NAO_ENCONTRADO')) return 'Registro não encontrado ou fora do seu escopo de acesso.';
  if (message.includes('schema cache') || message.includes('Could not find')) return 'O banco ainda não recebeu a migration da Central de Grãos Messejana.';
  return message || 'Não foi possível concluir a operação.';
}

function applyPeriod(query, column, period) {
  if (!period?.year || !period?.month) return query;
  const { start, end } = periodRange(period);
  return query.gte(column, start).lt(column, end);
}

function periodRange(period) {
  const start = fortalezaMonthStart(period.year, period.month);
  const nextYear = period.month === 12 ? period.year + 1 : period.year;
  const nextMonth = period.month === 12 ? 1 : period.month + 1;
  const end = fortalezaMonthStart(nextYear, nextMonth);
  return { start, end };
}

function fortalezaMonthStart(year, month) {
  return `${year}-${String(month).padStart(2, '0')}-01T00:00:00-03:00`;
}

function applyTextFilter(query, column, value) {
  const clean = cleanSearch(value);
  return clean ? query.ilike(column, `*${clean}*`) : query;
}

function applyExactFilter(query, column, value) {
  const clean = String(value || '').trim();
  return clean ? query.eq(column, clean) : query;
}

function cleanSearch(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}\s./-]/gu, '')
    .trim()
    .slice(0, 80);
}

function normalizePayload(data = {}) {
  return Object.fromEntries(Object.entries(data).map(([key, value]) => [
    key,
    typeof value === 'string' ? value.trim() : value,
  ]));
}

function normalizeEntryPayload(data = {}) {
  const normalized = normalizePayload(data);
  const weight = parseBrazilianDecimal(normalized.peso_nf);
  const total = normalized.valor_total_nota === '' || normalized.valor_total_nota === null || normalized.valor_total_nota === undefined
    ? null
    : parseBrazilianDecimal(normalized.valor_total_nota);
  const informedUnit = normalized.valor_unitario === '' || normalized.valor_unitario === null || normalized.valor_unitario === undefined
    ? null
    : parseBrazilianDecimal(normalized.valor_unitario);
  if (weight === null || weight <= 0) throw new Error('OFICINA_PESO_INVALIDO');
  if (total !== null && total < 0) throw new Error('OFICINA_VALOR_INVALIDO');
  if (informedUnit !== null && informedUnit < 0) throw new Error('OFICINA_VALOR_INVALIDO');
  const roundedWeight = Number(weight.toFixed(3));
  const roundedTotal = total === null ? null : Number(total.toFixed(2));
  const calculatedUnit = roundedTotal === null ? informedUnit : calculateEntryUnitValue(roundedTotal, roundedWeight);
  return {
    ...normalized,
    peso_nf: roundedWeight,
    valor_total_nota: roundedTotal,
    valor_unitario: calculatedUnit,
  };
}

function normalizeMovementPayload(data = {}) {
  const normalized = normalizePayload(data);
  const quantity = parseBrazilianDecimal(normalized.quantidade);
  if (quantity === null || quantity <= 0) throw new Error('OFICINA_MOVIMENTACAO_INVALIDA');
  const numericFields = [
    'valor_unitario_compra',
    'valor_total_compra',
    'valor_unitario_venda',
    'valor_total_venda',
  ];
  for (const field of numericFields) {
    if (normalized[field] === '' || normalized[field] === null || normalized[field] === undefined) {
      normalized[field] = null;
      continue;
    }
    const value = parseBrazilianDecimal(normalized[field]);
    if (value === null || value < 0) throw new Error('OFICINA_VALOR_INVALIDO');
    normalized[field] = Number(value.toFixed(field.includes('unitario') ? 4 : 2));
  }
  normalized.quantidade = Number(quantity.toFixed(3));
  return normalized;
}

function supplierIdsForSearch(suppliers, value) {
  const term = normalizeSearch(value);
  if (!term) return [];
  return suppliers
    .filter((item) => normalizeSearch(`${item.nome} ${item.cnpj || ''}`).includes(term))
    .map((item) => item.id);
}

function normalizeSearch(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();
}

function requireUuid(value) {
  const id = String(value || '').trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    throw new Error('Identificador inválido. Atualize a página e selecione o registro novamente.');
  }
  return id;
}
