import { Scale, Warehouse } from 'lucide-react';

/**
 * Configuracao central das unidades de balanca/armazem do AgroFlow.
 *
 * Cada unidade e um modulo principal do menu lateral e reaproveita a mesma
 * implementacao (paginas, formularios, servicos e relatorios). As diferencas
 * entre as unidades ficam concentradas aqui, evitando codigo duplicado.
 *
 * @typedef {'dashboard'|'portaria'|'laboratorio'|'recebimentos'|'armazenagem'|'relatorios'} UnidadeAbaKey
 *
 * @typedef {Object} UnidadeAba
 * @property {UnidadeAbaKey} key       Identificador interno da aba.
 * @property {string} label            Titulo exibido na aba.
 * @property {string} segmento         Segmento de rota usado no modo 'path'.
 * @property {string} menu             Menu de permissao correspondente.
 *
 * @typedef {Object} Unidade
 * @property {string} codigo           Codigo interno da unidade.
 * @property {string} nome             Nome exibido no menu e no titulo da pagina.
 * @property {string} rotulo           Identificacao visual exibida no cabecalho.
 * @property {string} descricao        Subtitulo da pagina.
 * @property {string} rotaBase         Rota principal do modulo.
 * @property {'query'|'path'} modoRota Como as abas sao navegadas.
 * @property {string} cnpj             Identificacao (CNPJ) do registro em `balancas`.
 * @property {string[]} nomesBanco     Nomes aceitos do registro em `balancas`.
 * @property {boolean} incluirSemUnidade Inclui registros historicos sem `balanca_id`.
 * @property {boolean} temCadastros    Exibe a aba de cadastros compartilhados.
 * @property {boolean} dispensaLaboratorio Unidade sem laboratorio.
 * @property {UnidadeAbaKey[]} abas    Abas habilitadas, na ordem exibida.
 * @property {string} permissaoBase    Menu de permissao da rota principal.
 */

/** @type {Record<UnidadeAbaKey, UnidadeAba>} */
export const UNIDADE_ABAS = {
  dashboard: { key: 'dashboard', label: 'Dashboard', segmento: '', menu: 'balancas' },
  portaria: { key: 'portaria', label: 'Portaria', segmento: 'portaria', menu: 'balancas_portaria' },
  laboratorio: { key: 'laboratorio', label: 'Aprovação Laboratório', segmento: 'aprovacao-laboratorio', menu: 'balancas_laboratorio' },
  recebimentos: { key: 'recebimentos', label: 'Recebidos na Balança', segmento: 'recebimentos', menu: 'balancas_recebimentos' },
  armazenagem: { key: 'armazenagem', label: 'Armazenagem M.P.', segmento: 'armazenagem', menu: 'balancas_armazenagem' },
  relatorios: { key: 'relatorios', label: 'Relatórios', segmento: 'relatorios', menu: 'balancas_relatorios' },
};

const ABAS_COMPLETAS = ['dashboard', 'portaria', 'laboratorio', 'recebimentos', 'armazenagem', 'relatorios'];

/** @type {Unidade[]} */
export const UNIDADES = [
  {
    codigo: 'beberibe',
    nome: 'Balança Beberibe',
    rotulo: 'Unidade Beberibe',
    descricao: 'Recebimento, pesagem, conferência de NF-e, laboratório e relatórios da unidade Beberibe.',
    rotaBase: '/balancas',
    modoRota: 'query',
    icone: Scale,
    cnpj: '09524502000196',
    nomesBanco: ['Balança Beberibe da Fabrica', 'Balança Beberibe'],
    // O modulo legado /balancas continua mostrando lancamentos historicos que
    // foram gravados antes de a unidade passar a ser obrigatoria.
    incluirSemUnidade: true,
    temCadastros: true,
    dispensaLaboratorio: false,
    abas: ABAS_COMPLETAS,
    permissaoBase: 'balancas',
  },
  {
    codigo: 'haisa',
    nome: 'Balança Haisa',
    rotulo: 'Unidade Haisa',
    descricao: 'Recebimento, pesagem, conferência de NF-e, laboratório e relatórios da unidade Haisa.',
    rotaBase: '/balanca-haisa',
    modoRota: 'path',
    icone: Scale,
    cnpj: '09524502001753',
    nomesBanco: ['Balança Haisa Horizonte', 'Balança Haisa'],
    incluirSemUnidade: false,
    temCadastros: false,
    dispensaLaboratorio: false,
    abas: ABAS_COMPLETAS,
    permissaoBase: 'balancas',
  },
  {
    codigo: 'estrela',
    nome: 'Balança Estrela',
    rotulo: 'Unidade Estrela',
    descricao: 'Recebimento, pesagem, conferência de NF-e, laboratório e relatórios da unidade Estrela.',
    rotaBase: '/balanca-estrela',
    modoRota: 'path',
    icone: Scale,
    cnpj: '09524502001320',
    nomesBanco: ['Balança Estrela Horizonte', 'Balança Estrela'],
    incluirSemUnidade: false,
    temCadastros: false,
    dispensaLaboratorio: false,
    abas: ABAS_COMPLETAS,
    permissaoBase: 'balancas',
  },
  {
    codigo: 'iguatu',
    nome: 'Armazém Iguatu',
    rotulo: 'Unidade Iguatu',
    descricao: 'Portaria, recebimentos, armazenagem e relatórios da unidade Iguatu.',
    rotaBase: '/armazem-iguatu',
    modoRota: 'path',
    icone: Warehouse,
    cnpj: '09524502001400',
    nomesBanco: ['Balança Iguatu', 'Armazém Iguatu'],
    incluirSemUnidade: false,
    temCadastros: false,
    // Iguatu nao possui laboratorio: as cargas seguem direto para Recebimentos.
    dispensaLaboratorio: true,
    abas: ['portaria', 'recebimentos', 'armazenagem', 'relatorios'],
    permissaoBase: 'balancas',
  },
];

export const UNIDADE_PADRAO = UNIDADES[0];

export function unidadePorCodigo(codigo) {
  return UNIDADES.find((unidade) => unidade.codigo === codigo) || null;
}

/** @returns {UnidadeAba[]} */
export function abasDaUnidade(unidade) {
  return (unidade?.abas || []).map((key) => UNIDADE_ABAS[key]).filter(Boolean);
}

export function unidadeTemAba(unidade, abaKey) {
  return (unidade?.abas || []).includes(abaKey);
}

export function primeiraAbaDaUnidade(unidade) {
  return abasDaUnidade(unidade)[0] || UNIDADE_ABAS.portaria;
}

/** Rota completa de uma aba, respeitando o modo de navegacao da unidade. */
export function rotaDaAba(unidade, abaKey) {
  const aba = UNIDADE_ABAS[abaKey];
  if (!aba) return unidade.rotaBase;
  if (unidade.modoRota === 'query') {
    return abaKey === 'dashboard' ? unidade.rotaBase : `${unidade.rotaBase}?tab=${abaKey}`;
  }
  return aba.segmento ? `${unidade.rotaBase}/${aba.segmento}` : unidade.rotaBase;
}

/** Rota aberta ao clicar no modulo no menu lateral. */
export function rotaInicialDaUnidade(unidade) {
  return rotaDaAba(unidade, primeiraAbaDaUnidade(unidade).key);
}

export function abaPorSegmento(unidade, segmento) {
  const normalizado = String(segmento || '');
  return abasDaUnidade(unidade).find((aba) => aba.segmento === normalizado) || null;
}

export function apenasDigitos(valor) {
  return String(valor || '').replace(/\D/g, '');
}

export function normalizarTexto(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .toLowerCase();
}

/**
 * Localiza o registro da tabela `balancas` correspondente a unidade.
 * A identificacao (CNPJ) e o criterio principal; o nome cadastrado e o
 * fallback. Nenhum ID fica fixo no codigo e nenhum registro e criado.
 */
export function encontrarBalancaDaUnidade(unidade, balancas = []) {
  if (!unidade || !Array.isArray(balancas) || !balancas.length) return null;

  const cnpj = apenasDigitos(unidade.cnpj);
  if (cnpj) {
    const porCnpj = balancas.find((balanca) => apenasDigitos(balanca?.identificacao) === cnpj);
    if (porCnpj) return porCnpj;
  }

  const nomes = (unidade.nomesBanco || []).map(normalizarTexto).filter(Boolean);
  return balancas.find((balanca) => nomes.includes(normalizarTexto(balanca?.nome))) || null;
}

/** Escopo aplicado a todas as consultas e gravacoes da unidade. */
export function escopoDaUnidade(unidade, balanca) {
  return {
    balancaId: balanca?.id || '',
    incluirSemUnidade: Boolean(unidade?.incluirSemUnidade),
  };
}

export function erroUnidadeNaoEncontrada(unidade) {
  return `Unidade "${unidade?.nome || 'desconhecida'}" não encontrada no cadastro de Balanças. Como corrigir: confira em Cadastros → Balanças se o registro existe e está ativo.`;
}
