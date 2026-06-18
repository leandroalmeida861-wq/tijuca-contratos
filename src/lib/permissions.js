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
  { key: 'usuarios', label: 'Usuários e permissões', path: '/admin/acessos' },
  { key: 'auditoria', label: 'Auditoria', path: '/admin/auditoria' },
];

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
