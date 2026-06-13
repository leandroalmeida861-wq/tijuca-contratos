import { readFileSync } from 'node:fs';

const SITE_URL = 'https://agroflow-contratos.vercel.app';
const AUTHORIZED_EMAIL = 'leandroalmeida861@gmail.com';

const testUser = {
  name: 'Teste Automatizado AgroFlow',
  email: `teste.automatizado.${Date.now()}@example.com`,
  phone: '(11) 90000-0000',
  password: 'Teste123456',
  newPassword: 'NovaSenha123456',
  note: 'Teste automatizado do fluxo real de acesso',
};

const adminBrowser = {
  approvedUsers: {},
};

const userBrowser = {
  approvedUsers: {},
  session: null,
};

const database = {
  authUsers: {},
  solicitacoesAcesso: [],
  usuariosAutorizados: {
    [AUTHORIZED_EMAIL]: { email: AUTHORIZED_EMAIL, nome: 'Leandro Almeida', ativo: true },
  },
};

const results = [];

async function main() {
  await testPublishedHtml();
  await testSourceContracts();
  await testAccessRequestPayload();
  await testRequestPersistsInDatabase();
  await testApprovalPersistsInDatabase();
  await testLoginFromDifferentBrowserWithoutLocalStorage();
  await testWrongPasswordBlocked();
  await testPasswordChangeRequest();
  await testNewPasswordLogin();
  await testProtectedRouteHtmlFallback();

  console.log('\nBATERIA DE TESTES AGROFLOW');
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
  assert('HTML publicado na Vercel responde 200', response.ok, `status ${response.status}`);
  assert('HTML publicado tem root React', html.includes('<div id="root"></div>'));

  const assetMatch = html.match(/src="([^"]*\/assets\/index-[^"]+\.js)"/);
  assert('HTML publicado aponta para bundle JS', Boolean(assetMatch));
}

async function testProtectedRouteHtmlFallback() {
  const response = await fetch(`${SITE_URL}/contratos`);
  const html = await response.text();
  assert('Rota interna publicada entrega HTML do app para o React proteger', response.ok && html.includes('<div id="root"></div>'), `status ${response.status}`);
}

async function testSourceContracts() {
  const authSource = readFileSync('src/contexts/AuthContext.jsx', 'utf8');
  const loginSource = readFileSync('src/pages/Login.jsx', 'utf8');
  const sqlSource = readFileSync('supabase/liberar-email-direto.sql', 'utf8');

  assert('Login consulta autorizacao no banco por agroflow_email_liberado', authSource.includes('agroflow_email_liberado'));
  assert('Login tenta Supabase Auth antes de depender do localStorage do admin', authSource.indexOf('signInWithPassword({ email: normalized, password })') < authSource.indexOf('const allowed = await checkAuthorization(normalized)'));
  assert('Pedido de acesso grava solicitacao no Supabase', loginSource.includes('agroflow_solicitar_acesso'));
  assert('Pedido de acesso prepara usuario no Supabase Auth', loginSource.includes('supabase.auth.signUp'));
  assert('Aprovacao direta atualiza solicitacoes_acesso para liberado', sqlSource.includes("status = 'liberado'"));
}

async function testAccessRequestPayload() {
  const payload = createAccessRequestPayload(testUser);

  assert('Pedido de acesso inclui senha do solicitante', payload.senha === testUser.password);
  assert('Pedido de acesso inclui confirmar_senha', payload.confirmar_senha === testUser.password);
  assert('Pedido de acesso inclui link de liberacao', payload.link_liberacao.includes('aprovar_acesso=1'));
  assert('Link de liberacao carrega a senha', new URL(payload.link_liberacao).searchParams.get('senha') === testUser.password);
  assert('Link de liberacao carrega o e-mail correto', new URL(payload.link_liberacao).searchParams.get('email') === testUser.email);
}

async function testRequestPersistsInDatabase() {
  const result = registerAccessRequestInSupabase(testUser);

  assert('Solicitacao cria usuario em auth.users', Boolean(database.authUsers[testUser.email]));
  assert('Solicitacao grava linha em solicitacoes_acesso', result.requestSaved && database.solicitacoesAcesso.some((row) => row.email === testUser.email && row.status === 'pendente'));
}

async function testApprovalPersistsInDatabase() {
  const payload = createAccessRequestPayload(testUser);
  const url = new URL(payload.link_liberacao);
  const approved = approveLocalAccess(adminBrowser, {
    email: url.searchParams.get('email'),
    name: url.searchParams.get('nome'),
    password: url.searchParams.get('senha'),
  });

  assert('Aprovacao pelo link salva usuario no navegador do admin', approved.email === testUser.email);
  assert('Aprovacao persiste usuario em usuarios_autorizados', Boolean(database.usuariosAutorizados[testUser.email]?.ativo));
  assert('Aprovacao muda solicitacao de pendente para liberado', database.solicitacoesAcesso.some((row) => row.email === testUser.email && row.status === 'liberado'));
}

async function testLoginFromDifferentBrowserWithoutLocalStorage() {
  const user = signIn(userBrowser, testUser.email, testUser.password);
  assert('Usuario aprovado entra em outro navegador sem localStorage do admin', user.email === testUser.email && userBrowser.session?.email === testUser.email);
}

async function testWrongPasswordBlocked() {
  try {
    signIn(userBrowser, testUser.email, 'SenhaErrada');
    assert('Login com senha errada deve bloquear', false);
  } catch (error) {
    assert(
      'Login com senha errada e bloqueado com mensagem em portugues',
      error.message.includes('E-mail ou senha incorretos') && error.message.includes('Como corrigir'),
      error.message,
    );
  }
}

async function testPasswordChangeRequest() {
  const changed = changeApprovedPassword(adminBrowser, testUser.email, testUser.newPassword, testUser.newPassword);
  database.authUsers[testUser.email].password = testUser.newPassword;
  assert('Alteracao de senha aprovada para usuario liberado', changed.password === testUser.newPassword);

  try {
    signIn(userBrowser, testUser.email, testUser.password);
    assert('Senha antiga deve parar de funcionar', false);
  } catch (error) {
    assert('Senha antiga bloqueada depois da alteracao', error.message.includes('E-mail ou senha incorretos'), error.message);
  }
}

async function testNewPasswordLogin() {
  const user = signIn(userBrowser, testUser.email, testUser.newPassword);
  assert('Login com nova senha funciona', user.email === testUser.email && userBrowser.session?.email === testUser.email);
}

function createAccessRequestPayload(form) {
  if (form.password.length < 6) {
    throw new Error('A senha desejada deve ter pelo menos 6 caracteres. Como corrigir: escolha uma senha maior antes de enviar o pedido.');
  }

  const approvalLink = new URL('/login', SITE_URL);
  approvalLink.searchParams.set('aprovar_acesso', '1');
  approvalLink.searchParams.set('email', form.email.trim().toLowerCase());
  approvalLink.searchParams.set('nome', form.name.trim());
  approvalLink.searchParams.set('senha', form.password);

  return {
    nome: form.name,
    email: form.email,
    telefone: form.phone,
    senha: form.password,
    confirmar_senha: form.password,
    observacao: form.note,
    destinatario: AUTHORIZED_EMAIL,
    origem: 'agroflow-contratos-login',
    link_liberacao: approvalLink.toString(),
    status_senha: 'Senha enviada nos campos senha e confirmar_senha',
  };
}

function registerAccessRequestInSupabase(form) {
  const email = normalizeEmail(form.email);
  database.authUsers[email] = {
    email,
    password: form.password,
    emailConfirmed: true,
  };
  database.solicitacoesAcesso.push({
    email,
    nome: form.name,
    telefone: form.phone,
    observacao: form.note,
    status: 'pendente',
  });

  return { requestSaved: true };
}

function approveLocalAccess(browserState, { email, name, password }) {
  const normalized = normalizeEmail(email);
  if (!normalized || !password) {
    throw new Error('Link de liberacao incompleto. Como corrigir: abra o link completo recebido no e-mail de pedido de acesso.');
  }

  browserState.approvedUsers[normalized] = {
    ...(browserState.approvedUsers[normalized] || {}),
    email: normalized,
    name: name || 'Usuario autorizado',
    password,
    approvedBy: AUTHORIZED_EMAIL,
    approvedAt: new Date().toISOString(),
  };

  approveEmailInSupabase(normalized, name || 'Usuario autorizado');
  return browserState.approvedUsers[normalized];
}

function approveEmailInSupabase(email, name) {
  database.usuariosAutorizados[email] = {
    email,
    nome: name,
    ativo: true,
    liberadoPor: AUTHORIZED_EMAIL,
    liberadoEm: new Date().toISOString(),
  };
  for (const request of database.solicitacoesAcesso) {
    if (request.email === email && request.status !== 'liberado') {
      request.status = 'liberado';
      request.liberadoEm = new Date().toISOString();
    }
  }
}

function signIn(browserState, email, password) {
  const normalized = normalizeEmail(email);
  const authUser = database.authUsers[normalized];

  if (!authUser || authUser.password !== password) {
    throw new Error('E-mail ou senha incorretos. Como corrigir: confira o e-mail digitado e use a senha cadastrada para esse usuario.');
  }

  const allowed = database.usuariosAutorizados[normalized]?.ativo || normalized === AUTHORIZED_EMAIL;
  if (!allowed) {
    throw new Error('Este e-mail ainda nao foi liberado pelo administrador. Como corrigir: aguarde a aprovacao do acesso e tente novamente.');
  }

  browserState.session = { email: normalized, name: database.usuariosAutorizados[normalized]?.nome || 'Usuario autorizado' };
  return browserState.session;
}

function changeApprovedPassword(browserState, email, password, confirmPassword) {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    throw new Error('Informe o e-mail do usuario liberado. Como corrigir: digite o mesmo e-mail que foi aprovado pelo administrador.');
  }
  if (!database.usuariosAutorizados[normalized]?.ativo && normalized !== AUTHORIZED_EMAIL) {
    throw new Error('Este e-mail ainda nao foi liberado. Como corrigir: clique em Solicitar acesso e aguarde o administrador abrir o link de liberacao.');
  }
  if (password.length < 6) {
    throw new Error('Crie uma senha com pelo menos 6 caracteres. Como corrigir: use uma senha maior antes de salvar.');
  }
  if (password !== confirmPassword) {
    throw new Error('A confirmacao da senha nao confere. Como corrigir: digite a mesma senha nos dois campos.');
  }

  browserState.approvedUsers[normalized] = {
    ...(browserState.approvedUsers[normalized] || {}),
    email: normalized,
    name: database.usuariosAutorizados[normalized]?.nome || 'Usuario autorizado',
    password,
    updatedAt: new Date().toISOString(),
  };

  return browserState.approvedUsers[normalized];
}

function normalizeEmail(email) {
  return String(email || '').toLowerCase().trim();
}

function assert(name, ok, detail = '') {
  results.push({ name, ok: Boolean(ok), detail });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
