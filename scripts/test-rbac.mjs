import { readFileSync } from 'node:fs';

const results = [];
const sql = readFileSync('supabase/rbac-tres-perfis.sql', 'utf8');
const auth = readFileSync('src/contexts/AuthContext.jsx', 'utf8');
const routes = readFileSync('src/main.jsx', 'utf8');
const layout = readFileSync('src/components/AppLayout.jsx', 'utf8');
const admin = readFileSync('src/pages/AdminAccessPage.jsx', 'utf8');
const denied = readFileSync('src/pages/AccessDenied.jsx', 'utf8');
const requestApi = readFileSync('api/solicitar-acesso.js', 'utf8');
const approveApi = readFileSync('api/aprovar-acesso.js', 'utf8');
const vercel = JSON.parse(readFileSync('vercel.json', 'utf8'));
const vercelIgnore = readFileSync('.vercelignore', 'utf8');

assert('Existem apenas Admin, Gestor e Operador', sql.includes("('admin', 'gestor', 'operador')") && !sql.includes("'consulta'"));
assert('Admin principal e automatico', sql.includes('leandroalmeida861@gmail.com') && sql.includes('agroflow_ensure_profile'));
assert('Permissoes possuem sete acoes', ['visualizar', 'cadastrar', 'editar', 'excluir', 'cancelar', 'aprovar', 'exportar'].every((item) => sql.includes(item)));
assert('RLS valida menu e acao', sql.includes('agroflow_tem_permissao') && sql.includes('rbac_delete_'));
assert('Logs de auditoria existem', sql.includes('create table if not exists public.audit_logs') && sql.includes('agroflow_audit_trigger'));
assert('Rotas usam protecao por menu', routes.includes('ProtectedRoute menu="contratos"') && routes.includes('ProtectedRoute menu="usuarios"'));
assert('Pagina de acesso negado existe', routes.includes('/acesso-negado') && denied.includes('Você não tem permissão'));
assert('Menu respeita permissao visualizar', layout.includes("can(item.menu, 'visualizar')"));
assert('Admin gerencia usuarios e permissoes', admin.includes("from('profiles')") && admin.includes("from('permissoes_menu')"));
assert('Auth carrega profile e permissoes', auth.includes('agroflow_profile_atual') && auth.includes('agroflow_permissoes_atuais'));
assert('Solicitacao nao armazena senha', !requestApi.includes('senha_criptografada') && !requestApi.includes('password'));
assert('Aprovacao usa convite do Supabase', approveApi.includes('inviteUserByEmail') && !approveApi.includes('password:'));
assert('Modulo legado inseguro nao e publicado', vercelIgnore.includes('public/consulta-cnpj') && vercel.rewrites.some((rule) => rule.source === '/consulta-cnpj/(.*)' && rule.destination === '/login'));

console.log('\nTESTES RBAC AGROFLOW');
for (const result of results) console.log(`${result.ok ? 'OK' : 'FALHOU'} - ${result.name}`);
const failed = results.filter((result) => !result.ok);
if (failed.length) {
  process.exitCode = 1;
  console.error(`\n${failed.length} teste(s) falharam.`);
} else {
  console.log('\nTodos os testes passaram.');
}

function assert(name, ok) {
  results.push({ name, ok: Boolean(ok) });
}
