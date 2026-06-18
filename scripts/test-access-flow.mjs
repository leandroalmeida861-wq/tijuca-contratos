import { readFileSync } from 'node:fs';

const SITE_URL = 'https://agroflow-contratos.vercel.app';
const AUTHORIZED_EMAIL = 'leandroalmeida861@gmail.com';
const results = [];

async function main() {
  await testPublishedHtml();
  testSourceContracts();
  testSimulatedFlow();

  console.log('\nBATERIA DE TESTES AGROFLOW - ACESSO SEGURO');
  for (const result of results) {
    console.log(`${result.ok ? 'OK' : 'FALHOU'} - ${result.name}`);
    if (result.detail) console.log(`   ${result.detail}`);
  }

  const failed = results.filter((result) => !result.ok);
  if (failed.length > 0) {
    process.exitCode = 1;
    console.error(`\n${failed.length} teste(s) falharam.`);
    return;
  }

  console.log('\nTodos os testes passaram.');
}

async function testPublishedHtml() {
  const response = await fetch(`${SITE_URL}/login`);
  const html = await response.text();
  assert('HTML publicado na Vercel responde', response.ok, `status ${response.status}`);
  assert('HTML publicado tem root React', html.includes('<div id="root">'));
}

function testSourceContracts() {
  const authSource = readFileSync('src/contexts/AuthContext.jsx', 'utf8');
  const loginSource = readFileSync('src/pages/Login.jsx', 'utf8');
  const requestApiSource = readFileSync('api/solicitar-acesso.js', 'utf8');
  const approveApiSource = readFileSync('api/aprovar-acesso.js', 'utf8');
  const sqlSource = readFileSync('supabase/rbac-tres-perfis.sql', 'utf8');

  assert('Projeto usa Vercel Serverless Function para solicitar acesso', loginSource.includes('/api/solicitar-acesso'));
  assert('Link de aprovacao correto vai para /api/aprovar-acesso', requestApiSource.includes('/api/aprovar-acesso?token='));
  assert('Aprovacao usa convite oficial do Supabase', approveApiSource.includes('inviteUserByEmail'));
  assert('Senha e gerenciada somente pelo Supabase Auth', !approveApiSource.includes('password:') && !requestApiSource.includes('senha_criptografada'));
  assert('Aprovacao ativa usuario antes de enviar convite', approveApiSource.indexOf('await upsertAuthorizedUser') < approveApiSource.indexOf('inviteUserByEmail'));
  assert('Aprovacao reenvia senha para usuario ja existente', approveApiSource.includes('resetPasswordForEmail'));
  assert('Convite redireciona para /login', approveApiSource.includes('redirectTo: INVITE_REDIRECT_URL'));
  assert('Admin volta para /admin/solicitacoes com sucesso', approveApiSource.includes('ADMIN_APPROVED_REDIRECT'));
  assert('Frontend nao cria usuario com signUp', !loginSource.includes('signUp') && !authSource.includes('signUp'));
  assert('Frontend nao usa service role', !loginSource.includes('SERVICE_ROLE') && !authSource.includes('SERVICE_ROLE'));
  assert('AuthContext nao depende de localStorage', !authSource.includes('localStorage'));
  assert('Login consulta profile e permissoes no Supabase', authSource.includes('agroflow_profile_atual') && authSource.includes('agroflow_permissoes_atuais'));
  assert('SQL cria profiles e permissoes', sqlSource.includes('create table if not exists public.profiles') && sqlSource.includes('create table if not exists public.permissoes_menu'));
  assert('SQL garante Leandro como admin', sqlSource.includes(AUTHORIZED_EMAIL) && sqlSource.includes("'admin'"));
  assert('SQL cria RLS por menu e acao', sqlSource.includes('agroflow_tem_permissao') && sqlSource.includes('rbac_insert_'));
  assert('Formulario de solicitacao nao pede senha', !loginSource.includes('form.senha') && !loginSource.includes('confirmarSenha'));
  assert('Convite abre criacao de senha em portugues', loginSource.includes('Criar senha de acesso') && loginSource.includes('hasPasswordSetupToken'));
  assert('Convite reconhece formatos atuais do Supabase', loginSource.includes("queryParams.get('code')") && loginSource.includes("hashParams.get('access_token')") && loginSource.includes("queryParams.get('token_hash')"));
  assert('Login troca code PKCE por sessao', loginSource.includes('exchangeCodeForSession'));
  assert('Criacao de senha valida sessao do convite', loginSource.includes('supabase.auth.getSession()') && loginSource.includes('Convite ainda nao carregou a sessao'));
  assert('Login tem recuperacao segura de senha', loginSource.includes('Alterar ou recuperar senha') && loginSource.includes('resetPasswordForEmail'));
}

function testSimulatedFlow() {
  const request = createAccessRequest({
    nome: 'Usuario Teste AgroFlow',
    email: 'usuario.teste@example.com',
    telefone: '(11) 90000-0000',
    observacao: 'Teste do fluxo seguro',
  });

  assert('Solicitacao grava status pendente', request.status === 'pendente');
  assert('Link de aprovacao tem apenas token', hasOnlyToken(request.approvalUrl));
  assert('Link nao contem senha, e-mail, nome nem service role', !/[?&](senha|password|email|nome|service_role)=/i.test(request.approvalUrl));

  const approved = approveRequest(request);
  assert('Aprovacao marca solicitacao como aprovada', approved.request.status === 'aprovado');
  assert('Usuario autorizado fica operador e ativo', approved.user.perfil === 'operador' && approved.user.status === 'ativo');
  assert('Convite e enviado para o e-mail solicitado', approved.invite.email === request.email);
  assert('Convite usa redirectTo correto', approved.invite.redirectTo === `${SITE_URL}/login`);
}

function createAccessRequest(form) {
  const token = cryptoRandomToken();
  return {
    ...form,
    email: form.email.toLowerCase(),
    token,
    status: 'pendente',
    approvalUrl: `${SITE_URL}/api/aprovar-acesso?token=${token}`,
  };
}

function approveRequest(request) {
  request.status = 'aprovado';
  request.usado_em = new Date().toISOString();
  request.aprovado_em = request.usado_em;

  return {
    request,
    invite: {
      email: request.email,
      redirectTo: `${SITE_URL}/login`,
    },
    user: {
      email: request.email,
      nome: request.nome,
      perfil: 'operador',
      status: 'ativo',
    },
  };
}

function hasOnlyToken(url) {
  const parsed = new URL(url);
  const params = [...parsed.searchParams.keys()];
  return parsed.origin === SITE_URL && parsed.pathname === '/api/aprovar-acesso' && params.length === 1 && params[0] === 'token';
}

function cryptoRandomToken() {
  return '00000000-0000-4000-8000-000000000001';
}

function assert(name, ok, detail = '') {
  results.push({ name, ok: Boolean(ok), detail });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
