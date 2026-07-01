import { supabase } from '../lib/supabase.js';

const RECEBIMENTO_SELECT = `
  *,
  balanca:balancas(id,nome),
  laboratorio:recebimento_laboratorios(id,nome),
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
  let query = supabase.from('recebimentos').select(RECEBIMENTO_SELECT).order('created_at', { ascending: false });

  if (filters.dataInicial) query = query.gte('data', filters.dataInicial);
  if (filters.dataFinal) query = query.lte('data', filters.dataFinal);
  if (filters.balancaId) query = query.eq('balanca_id', filters.balancaId);
  if (filters.fornecedorId) query = query.eq('fornecedor_id', filters.fornecedorId);
  if (filters.produtoId) query = query.eq('produto_id', filters.produtoId);
  if (filters.laboratorioId) query = query.eq('laboratorio_id', filters.laboratorioId);
  if (filters.status) query = query.eq('status', filters.status);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getRecebimento(id) {
  const { data, error } = await supabase.from('recebimentos').select(RECEBIMENTO_SELECT).eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function createRecebimento(payload) {
  const { data, error } = await supabase.from('recebimentos').insert(cleanPayload(payload)).select(RECEBIMENTO_SELECT).single();
  if (error) throw error;
  return data;
}

export async function updateRecebimento(id, payload) {
  const { data, error } = await supabase.from('recebimentos').update(cleanPayload(payload)).eq('id', id).select(RECEBIMENTO_SELECT).single();
  if (error) throw error;
  return data;
}

export async function deleteRecebimento(id) {
  const { error } = await supabase.from('recebimentos').delete().eq('id', id);
  if (error) throw error;
}

export async function approveRecebimento(id, { ticket_numero, umidade, liberado_por }) {
  return updateRecebimento(id, {
    status: 'aprovada',
    ticket_numero,
    umidade,
    liberado_por,
    motivo_reprovacao: null,
    motivo_cancelamento: null,
  });
}

export async function rejectRecebimento(id, { motivo_reprovacao, ticket_numero, umidade, liberado_por }) {
  return updateRecebimento(id, {
    status: 'reprovada',
    motivo_reprovacao,
    ticket_numero,
    umidade,
    liberado_por,
  });
}

export async function cancelRecebimento(id, motivo_cancelamento) {
  return updateRecebimento(id, { status: 'cancelada', motivo_cancelamento });
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
    'NF',
    'Balança',
    'Fornecedor',
    'Produto',
    'Placa',
    'Peso bruto',
    'Tara',
    'Peso líquido',
    'Peso NF',
    'Diferença KG',
    'Diferença %',
    'Status',
    'Motivo reprovação',
    'Motivo cancelamento',
  ];
  const body = rows.map((row) => [
    row.data,
    row.nf_numero,
    row.balanca?.nome,
    row.fornecedor?.nome || row.fornecedor_nome_manual,
    row.produto_nome_manual || row.produto?.nome,
    row.veiculo_placa_manual || row.veiculo?.placa,
    row.peso_bruto,
    row.tara,
    row.peso_liquido,
    row.peso_nf,
    row.diferenca_kg,
    row.diferenca_pct,
    row.status,
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
  if (lower.includes('duplicate') || lower.includes('unique')) {
    return 'Registro duplicado. Como corrigir: confira placa, chave da NF ou cadastro já existente antes de salvar novamente.';
  }
  if (lower.includes('foreign key')) {
    return 'Vínculo inválido. Como corrigir: escolha um cadastro existente de fornecedor, produto, balança ou laboratório.';
  }
  if (lower.includes('schema cache') || lower.includes('does not exist') || lower.includes('could not find')) {
    return 'Banco ainda não reconheceu o módulo Balanças. Como corrigir: aplique o SQL supabase/balancas-modulo-recebimento.sql no Supabase e recarregue o app.';
  }
  return message || 'Não foi possível concluir a operação. Como corrigir: confira os dados e tente novamente.';
}

function cleanPayload(payload) {
  return Object.fromEntries(
    Object.entries(payload)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, value === '' ? null : value]),
  );
}

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w]+/g, '')
    .toLowerCase();
}
