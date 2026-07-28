import { supabase } from '../lib/supabase.js';
import { classifyRequestError } from '../lib/reliableFetch.js';
import { listRecebimentos, requireUnidadeScope } from './balancasService.js';
import {
  isRecebimentoFinalizadoParaArmazenagem,
  mergeRecebimentosArmazenagens,
} from '../lib/armazenagem.js';

export {
  isRecebimentoFinalizadoParaArmazenagem,
  mergeRecebimentosArmazenagens,
  notaComplementoPesoKg,
  notaItemPesoKg,
  pesoNotaPrincipalRecebimento,
  pesoNotaRecebimento,
} from '../lib/armazenagem.js';

const ARMAZENAGEM_SELECT = `
  *,
  recebimento:recebimentos!inner(
    id,
    data,
    nf_numero,
    nf_chave_acesso,
    status,
    peso_bruto,
    tara,
    balanca_id,
    fornecedor_id,
    produto_id,
    transportadora_id,
    tipo_veiculo,
    peso_por_saca,
    fornecedor:fornecedores(id,nome,cnpj),
    produto:produtos(id,nome,unidade),
    transportadora:recebimento_transportadoras(id,nome),
    veiculo:recebimento_veiculos(id,placa,tipo_veiculo),
    complementos:recebimento_notas_complementares(
      id,
      numero_nf,
      quantidade_nota,
      unidade_nota,
      peso_por_saca,
      peso_nf,
      chave_nfe
    )
  ),
  itens:armazenagem_itens(
    *,
    produto:produtos(id,nome,unidade),
    complemento:recebimento_notas_complementares(id,numero_nf),
    distribuicoes:armazenagem_distribuicoes(*)
  )
`;

export async function listArmazenagemData(filters = {}, escopo = {}) {
  requireUnidadeScope(escopo);
  const [recebimentos, armazenagens, fechamentos, exclusoes] = await Promise.all([
    listRecebimentos(escopo),
    listArmazenagens(filters, escopo),
    listFechamentosArmazenagem(filters.ano, escopo),
    listExclusoesFechamento(escopo),
  ]);

  return {
    recebimentos: recebimentos.filter(isRecebimentoFinalizadoParaArmazenagem),
    armazenagens,
    fechamentos,
    exclusoes,
  };
}

/** Recebimentos retirados do fechamento mensal da unidade. */
export async function listExclusoesFechamento(escopo = {}) {
  requireUnidadeScope(escopo);
  let query = supabase
    .from('armazenagem_fechamento_exclusoes')
    .select('*')
    .eq('ativo', true);

  query = escopo.incluirSemUnidade
    ? query.or(`balanca_id.eq.${escopo.balancaId},balanca_id.is.null`)
    : query.eq('balanca_id', escopo.balancaId);

  const { data, error } = await query;
  if (error && isMissingExclusoesTable(error)) return [];
  if (error) throw error;
  return data || [];
}

/**
 * Retira um recebimento do fechamento mensal. O recebimento nao e alterado nem
 * apagado: apenas deixa de compor os totais do mes.
 */
export async function excluirDoFechamento({ recebimentoId, balancaId, motivo, usuario }) {
  const texto = String(motivo || '').trim();
  if (!texto) throw new Error('Informe o motivo para retirar o lançamento do fechamento.');

  const payload = {
    recebimento_id: recebimentoId,
    balanca_id: balancaId || null,
    ativo: true,
    motivo: texto,
    excluido_por: usuario?.id || null,
    excluido_por_nome: usuario?.nome || usuario?.email || null,
    excluido_em: new Date().toISOString(),
    restaurado_por: null,
    restaurado_por_nome: null,
    restaurado_em: null,
    atualizado_em: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('armazenagem_fechamento_exclusoes')
    .upsert(payload, { onConflict: 'recebimento_id' })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

/** Devolve o lancamento ao fechamento mensal, preservando o historico. */
export async function restaurarNoFechamento({ recebimentoId, usuario }) {
  const { data, error } = await supabase
    .from('armazenagem_fechamento_exclusoes')
    .update({
      ativo: false,
      restaurado_por: usuario?.id || null,
      restaurado_por_nome: usuario?.nome || usuario?.email || null,
      restaurado_em: new Date().toISOString(),
      atualizado_em: new Date().toISOString(),
    })
    .eq('recebimento_id', recebimentoId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

function isMissingExclusoesTable(error) {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('armazenagem_fechamento_exclusoes') && (
    message.includes('does not exist')
    || message.includes('could not find')
    || message.includes('schema cache')
  );
}

/**
 * A armazenagem nao possui coluna propria de unidade: ela herda a unidade do
 * recebimento vinculado. Como o vinculo so existe no join, o recorte e feito
 * aqui para que nenhum registro de outra unidade chegue a tela.
 */
export async function listArmazenagens(filters = {}, escopo = {}) {
  requireUnidadeScope(escopo);
  let query = supabase
    .from('armazenagens_materia_prima')
    .select(ARMAZENAGEM_SELECT)
    .eq('recebimento.balanca_id', escopo.balancaId)
    .order('data_armazenagem', { ascending: false })
    .order('created_at', { ascending: false });

  if (filters.dataInicial) query = query.gte('data_armazenagem', filters.dataInicial);
  if (filters.dataFinal) query = query.lte('data_armazenagem', filters.dataFinal);
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.ano) {
    const year = Number(filters.ano);
    if (Number.isInteger(year)) {
      query = query.gte('data_armazenagem', `${year}-01-01`).lte('data_armazenagem', `${year}-12-31`);
    }
  }
  if (filters.mes && filters.ano) {
    const start = monthStart(Number(filters.ano), Number(filters.mes));
    const end = monthEnd(Number(filters.ano), Number(filters.mes));
    query = query.gte('data_armazenagem', start).lte('data_armazenagem', end);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(normalizeArmazenagem);
}

export async function listFechamentosArmazenagem(ano, escopo = {}) {
  requireUnidadeScope(escopo);
  let query = supabase
    .from('fechamentos_armazenagem')
    .select('*')
    .eq('balanca_id', escopo.balancaId)
    .order('ano', { ascending: false })
    .order('mes', { ascending: true });
  if (ano) query = query.eq('ano', Number(ano));
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function iniciarArmazenagem(recebimentoId) {
  requireRecordId(recebimentoId, 'recebimento');
  const { data, error } = await supabase.rpc('agroflow_armazenagem_iniciar', {
    p_recebimento_id: recebimentoId,
  });
  if (error) throw error;
  return getArmazenagem(data);
}

export async function getArmazenagem(id) {
  requireRecordId(id, 'armazenagem');
  const { data, error } = await supabase
    .from('armazenagens_materia_prima')
    .select(ARMAZENAGEM_SELECT)
    .eq('id', id)
    .single();
  if (error) throw error;
  return normalizeArmazenagem(data);
}

export async function salvarArmazenagem({ id, dataArmazenagem, observacao, distribuicoes }) {
  requireRecordId(id, 'armazenagem');
  const { data, error } = await supabase.rpc('agroflow_armazenagem_salvar', {
    p_armazenagem_id: id,
    p_data_armazenagem: dataArmazenagem,
    p_observacao: observacao || null,
    p_distribuicoes: serializeDistributions(distribuicoes),
  });
  if (error) throw error;
  return getArmazenagem(data);
}

export async function salvarNovaArmazenagem({ recebimentoId, dataArmazenagem, observacao, distribuicoes }) {
  requireRecordId(recebimentoId, 'recebimento');
  const { data, error } = await supabase.rpc('agroflow_armazenagem_salvar_recebimento', {
    p_recebimento_id: recebimentoId,
    p_data_armazenagem: dataArmazenagem,
    p_observacao: observacao || null,
    p_distribuicoes: serializeDistributions(distribuicoes, true),
  });
  if (error) throw error;
  return getArmazenagem(data);
}

export async function cancelarArmazenagem(id, motivo) {
  requireRecordId(id, 'armazenagem');
  const { error } = await supabase.rpc('agroflow_armazenagem_cancelar', {
    p_armazenagem_id: id,
    p_motivo: motivo,
  });
  if (error) throw error;
}

export async function fecharMesArmazenagem({ ano, mes, balancaId, autorizarPendencias = false, justificativa = '' }) {
  requireUnidadeScope({ balancaId });
  const { data, error } = await supabase.rpc('agroflow_armazenagem_fechar_mes', {
    p_ano: Number(ano),
    p_mes: Number(mes),
    p_balanca_id: balancaId,
    p_autorizar_pendencias: Boolean(autorizarPendencias),
    p_justificativa: justificativa || null,
  });
  if (error) throw error;
  return data;
}

export async function reabrirMesArmazenagem({ ano, mes, balancaId, justificativa }) {
  requireUnidadeScope({ balancaId });
  const { error } = await supabase.rpc('agroflow_armazenagem_reabrir_mes', {
    p_ano: Number(ano),
    p_mes: Number(mes),
    p_balanca_id: balancaId,
    p_justificativa: justificativa,
  });
  if (error) throw error;
}

export function toArmazenagemError(error) {
  const message = String(error?.message || error || '');
  const normalized = message.toUpperCase();
  const requestError = classifyRequestError(error);
  if (requestError === 'connection') {
    return 'Falha de conexao com o banco de dados. Verifique sua internet e tente novamente.';
  }
  if (requestError === 'session') {
    return 'Sua sessao expirou. Entre novamente no AgroFlow para carregar os dados.';
  }
  if (requestError === 'permission') {
    return 'Acesso negado pelo banco. Peca ao Admin a permissao necessaria em Balancas - Armazenagem M.P.';
  }
  if (requestError === 'server') {
    return 'O servidor de dados esta temporariamente indisponivel. Aguarde um momento e tente novamente.';
  }
  const errors = [
    ['PESO_DISTRIBUIDO_SUPERA_NOTA', 'O peso distribuído ultrapassa o peso da NF. Como corrigir: reduza o peso do Silo ou da Baia.'],
    ['SILO_OU_BAIA_OBRIGATORIO', 'Informe pelo menos um Silo ou uma Baia para cada distribuição.'],
    ['DISTRIBUICAO_OBRIGATORIA', 'Adicione pelo menos uma distribuição antes de salvar.'],
    ['MES_ARMAZENAGEM_FECHADO', 'Este mês está fechado. Somente o Admin pode reabri-lo com justificativa.'],
    ['MES_ARMAZENAGEM_DESTINO_FECHADO', 'A nova data pertence a um mês fechado. Escolha uma data de mês aberto.'],
    ['EXISTEM_PENDENCIAS_ARMAZENAGEM', 'Existem recebimentos com saldo pendente. Finalize as distribuições ou solicite autorização do Admin.'],
    ['JUSTIFICATIVA_ADMIN_OBRIGATORIA', 'Para fechar com pendências, o Admin deve informar uma justificativa.'],
    ['SOMENTE_ADMIN_REABRE_MES', 'Somente o perfil Admin pode reabrir um mês fechado.'],
    ['PESO_NOTA_NAO_INFORMADO', 'O recebimento não possui peso da NF. Corrija a nota ou o recebimento de origem antes de armazenar.'],
    ['PESO_ITEM_NF_NAO_INFORMADO', 'Um ou mais produtos da NF não possuem peso em KG, SC ou TON. Corrija a unidade ou a quantidade no recebimento de origem antes de armazenar.'],
    ['RECEBIMENTO_NAO_FINALIZADO', 'Somente recebimentos finalizados na balança podem seguir para Armazenagem M.P.'],
    ['SEM_PERMISSAO', 'Seu perfil não possui permissão para esta ação em Armazenagem M.P.'],
  ];
  const match = errors.find(([code]) => normalized.includes(code));
  if (match) return match[1];
  if (normalized.includes('ROW-LEVEL SECURITY') || normalized.includes('PERMISSION')) {
    return 'Acesso negado pelo banco. Peça ao Admin a permissão necessária em Balanças - Armazenagem M.P.';
  }
  if (normalized.includes('SCHEMA CACHE') || normalized.includes('COULD NOT FIND')) {
    return 'O banco ainda não reconheceu a Armazenagem M.P. Aplique a migration supabase/armazenagem-materia-prima.sql e recarregue o app.';
  }
  return message || 'Não foi possível concluir a operação de armazenagem.';
}

function requireRecordId(id, label) {
  const value = String(id || '').trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error(`Identificador inválido para ${label}. Recarregue a tela e selecione o registro novamente.`);
  }
  return value;
}

function normalizeArmazenagem(row) {
  const itens = [...(row?.itens || [])]
    .map((item) => ({
      ...item,
      distribuicoes: [...(item.distribuicoes || [])].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at))),
    }))
    .sort((a, b) => Number(a.ordem || 0) - Number(b.ordem || 0));
  return { ...row, itens };
}

function monthStart(year, month) {
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

function monthEnd(year, month) {
  const date = new Date(Date.UTC(year, month, 0));
  return date.toISOString().slice(0, 10);
}

function localeNumber(value) {
  if (typeof value === 'number') return value;
  const text = String(value ?? '').trim();
  if (!text) return 0;
  const normalized = text.includes(',')
    ? text.replace(/\./g, '').replace(',', '.')
    : text;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
}

function serializeDistributions(distributions, includeItemOrder = false) {
  return (distributions || []).map((item) => ({
    armazenagem_item_id: item.armazenagem_item_id,
    ...(includeItemOrder ? { item_ordem: Number(item.item_ordem || 0) } : {}),
    silo: String(item.silo || '').trim() || null,
    baia: String(item.baia || '').trim() || null,
    peso_armazenado: localeNumber(item.peso_armazenado),
    observacao: String(item.observacao || '').trim() || null,
  }));
}
