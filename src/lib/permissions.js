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
  { key: 'balancas', label: 'Balanças', path: '/balancas' },
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
