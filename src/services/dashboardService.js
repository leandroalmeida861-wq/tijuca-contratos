import { hydrateContracts } from '../lib/api.js';
import { supabase } from '../lib/supabase.js';

const dashboardContractSelect = `
  *,
  fornecedor:fornecedores(id,nome),
  fabrica:fabricas(id,nome),
  produto:produtos(id,nome)
`;

export async function loadDashboardOptions() {
  const [suppliersResult, productsResult, contractsResult] = await Promise.all([
    supabase.from('fornecedores').select('id,nome').order('nome'),
    supabase.from('produtos').select('id,nome').order('nome'),
    supabase
      .from('contratos')
      .select('id,numero_contrato,fornecedor:fornecedores(nome)')
      .order('numero_contrato'),
  ]);

  const firstError = suppliersResult.error || productsResult.error || contractsResult.error;
  if (firstError) throw firstError;

  return {
    suppliers: suppliersResult.data || [],
    products: productsResult.data || [],
    contracts: (contractsResult.data || []).map((contract) => ({
      ...contract,
      label: contract.fornecedor?.nome
        ? `${contract.numero_contrato} - ${contract.fornecedor.nome}`
        : contract.numero_contrato,
    })),
  };
}

export async function loadDashboardData(filters) {
  let contractsQuery = supabase
    .from('contratos')
    .select(dashboardContractSelect)
    .order('created_at', { ascending: false });

  if (filters.dataInicial) contractsQuery = contractsQuery.gte('data_vencimento', filters.dataInicial);
  if (filters.dataFinal) contractsQuery = contractsQuery.lte('data_vencimento', filters.dataFinal);
  if (filters.fornecedorId) contractsQuery = contractsQuery.eq('fornecedor_id', filters.fornecedorId);
  if (filters.produtoId) contractsQuery = contractsQuery.eq('produto_id', filters.produtoId);
  if (filters.contratoId) contractsQuery = contractsQuery.eq('id', filters.contratoId);

  const { data, error } = await contractsQuery;
  if (error) throw error;

  const contracts = hydrateContracts(data || []);
  const freights = await loadFreightsForContracts(contracts.map((contract) => contract.id), hasActiveFilters(filters));

  return { contracts, freights };
}

async function loadFreightsForContracts(contractIds, filtered) {
  if (!contractIds.length) return [];

  if (!filtered) {
    const { data, error } = await supabase
      .from('fretes')
      .select('id,contrato_id,valor')
      .not('contrato_id', 'is', null);
    if (error) throw error;
    return data || [];
  }

  const chunks = chunk(contractIds, 200);
  const results = await Promise.all(chunks.map((ids) => (
    supabase
      .from('fretes')
      .select('id,contrato_id,valor')
      .in('contrato_id', ids)
  )));
  const firstError = results.find((result) => result.error)?.error;
  if (firstError) throw firstError;
  return results.flatMap((result) => result.data || []);
}

function hasActiveFilters(filters) {
  return Object.values(filters).some(Boolean);
}

function chunk(values, size) {
  const chunks = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}
