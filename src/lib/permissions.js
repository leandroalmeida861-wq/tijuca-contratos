export const MENU_DEFINITIONS = [
  { key: 'dashboard', label: 'Dashboard', path: '/' },
  { key: 'fornecedores', label: 'Fornecedores', path: '/fornecedores' },
  { key: 'fabricas', label: 'Fábricas', path: '/fabricas' },
  { key: 'produtos', label: 'Produtos', path: '/produtos' },
  { key: 'contratos', label: 'Contratos', path: '/contratos' },
  { key: 'notas_fiscais', label: 'Notas Fiscais', path: '/notas-fiscais' },
  { key: 'fretes', label: 'Frete', path: '/frete' },
  { key: 'documentos', label: 'Documentos', path: '/documentos' },
  { key: 'financeiro', label: 'Rel. Financeiro', path: '/rel-financeiro' },
  { key: 'backup', label: 'Backup', path: '/backup' },
  // Os menus abaixo valem para todas as unidades (Beberibe, Haisa, Estrela e
  // Iguatu). O recorte por unidade e feito pela rota e pelo escopo das consultas.
  { key: 'balancas', label: 'Balanças e Armazéns', path: '/balancas' },
  { key: 'balancas_portaria', label: 'Balanças - Portaria', path: '/balancas?tab=portaria' },
  { key: 'balancas_laboratorio', label: 'Balanças - Aprovação Laboratório', path: '/balancas?tab=laboratorio' },
  { key: 'balancas_recebimentos', label: 'Balanças - Recebimentos', path: '/balancas?tab=recebimentos' },
  { key: 'balancas_armazenagem', label: 'Balanças - Armazenagem M.P.', path: '/balancas?tab=armazenagem' },
  { key: 'balancas_relatorios', label: 'Balanças - Relatórios', path: '/balancas?tab=relatorios' },
  { key: 'usuarios', label: 'Usuários e permissões', path: '/admin/acessos' },
  { key: 'auditoria', label: 'Auditoria', path: '/admin/auditoria' },
];

export const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'gestor', label: 'Gestor' },
  { value: 'operador', label: 'Operador' },
  { value: 'visualizador', label: 'Visualizador' },
  { value: 'operador_laboratorio', label: 'Operador Laboratório' },
  { value: 'operador_balanca', label: 'Operador Balança' },
  { value: 'operador_portaria', label: 'Operador Portaria' },
];

export const EDITABLE_ROLE_OPTIONS = ROLE_OPTIONS.filter((role) => role.value !== 'admin');

export const PERMISSION_ACTIONS = [
  'visualizar',
  'cadastrar',
  'editar',
  'excluir',
  'cancelar',
  'aprovar',
  'exportar',
];

// Acoes que alteram dados. Numa unidade em que o usuario so tem "Visualizar",
// elas ficam bloqueadas mesmo que o perfil libere a acao no menu.
// "visualizar" e "exportar" ficam de fora: consultar e exportar relatorios
// continua permitido a quem so visualiza.
export const WRITE_ACTIONS = ['cadastrar', 'editar', 'excluir', 'cancelar', 'aprovar'];

/**
 * Permissao efetiva = permissao do menu E permissao da unidade.
 * Sem "Editar" na unidade, as acoes de escrita caem mesmo que o perfil as
 * libere no menu. Consultar e exportar seguem valendo.
 *
 * @param {(menu: string, action?: string) => boolean} canDoMenu
 * @param {boolean} podeEditarNaUnidade
 */
export function unidadeScopedCan(canDoMenu, podeEditarNaUnidade) {
  return (menu, action = 'visualizar') => {
    if (!canDoMenu(menu, action)) return false;
    if (podeEditarNaUnidade) return true;
    return !WRITE_ACTIONS.includes(action);
  };
}

/**
 * Regras da tela "Permissoes por unidade": marcar Editar marca Visualizar;
 * desmarcar Visualizar desmarca Editar. A mesma regra e reaplicada no banco
 * pela funcao agroflow_salvar_acessos_unidade.
 */
export function alternarNivelUnidade(atual = { visualizar: false, editar: false }, nivel) {
  const proximo = { ...atual, [nivel]: !atual[nivel] };
  if (nivel === 'editar' && proximo.editar) proximo.visualizar = true;
  if (nivel === 'visualizar' && !proximo.visualizar) proximo.editar = false;
  return proximo;
}

export const TABLE_MENU = {
  fornecedores: 'fornecedores',
  fabricas: 'fabricas',
  produtos: 'produtos',
  contratos: 'contratos',
  notas_fiscais: 'notas_fiscais',
  fretes: 'fretes',
  documentos: 'documentos',
};

export function permissionsToMap(rows = []) {
  return Object.fromEntries(rows.map((row) => [row.menu, row]));
}

const LANDING_MENU_PRIORITY = [
  'dashboard',
  'balancas',
  'fornecedores',
  'fabricas',
  'produtos',
  'contratos',
  'notas_fiscais',
  'fretes',
  'documentos',
  'financeiro',
  'backup',
  'usuarios',
  'auditoria',
];

export function getFirstAllowedRoute(can) {
  const menu = LANDING_MENU_PRIORITY.find((menuKey) => can(menuKey, 'visualizar'));
  return MENU_DEFINITIONS.find((item) => item.key === menu)?.path || null;
}
