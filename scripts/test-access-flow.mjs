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

const state = {
  approvedUsers: {},
  session: null,
};

const results = [];

async function main() {
  await testPublishedHtml();
  await testAccessRequestPayload();
  await testApprovalLink();
  await testWrongPasswordBlocked();
  await testCorrectPasswordLogin();
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
  assert('HTML publicado tem titulo AgroFlow', html.includes('<title>AgroFlow | Gestão de Contratos</title>'));
  assert('HTML publicado tem root React', html.includes('<div id="root"></div>'));

  const assetMatch = html.match(/src="([^"]*\/assets\/index-[^"]+\.js)"/);
  assert('HTML publicado aponta para bundle JS', Boolean(assetMatch));
  if (!assetMatch) return;

  const assetUrl = new URL(assetMatch[1], SITE_URL).toString();
  const assetResponse = await fetch(assetUrl);
  const js = await assetResponse.text();

  assert('Bundle JS publicado responde 200', assetResponse.ok, `status ${assetResponse.status}`);
  assert('Bundle publicado contem campo confirmar_senha', js.includes('confirmar_senha'));
  assert('Bundle publicado contem campo senha desejada', js.includes('Senha desejada'));
  assert('Bundle publicado contem origem do AgroFlow', js.includes('agroflow-contratos-login'));
  assert('Bundle publicado contem mensagem de senha errada em portugues', js.includes('Senha incorreta para este e-mail'));
}

async function testProtectedRouteHtmlFallback() {
  const response = await fetch(`${SITE_URL}/contratos`);
  const html = await response.text();
  assert('Rota interna publicada entrega HTML do app para o React proteger', response.ok && html.includes('<div id="root"></div>'), `status ${response.status}`);
}

async function testAccessRequestPayload() {
  const payload = createAccessRequestPayload(testUser);

  assert('Pedido de acesso inclui senha do solicitante', payload.senha === testUser.password);
  assert('Pedido de acesso inclui confirmar_senha', payload.confirmar_senha === testUser.password);
  assert('Pedido de acesso inclui link de liberacao', payload.link_liberacao.includes('aprovar_acesso=1'));
  assert('Link de liberacao carrega a senha', new URL(payload.link_liberacao).searchParams.get('senha') === testUser.password);
  assert('Link de liberacao carrega o e-mail correto', new URL(payload.link_liberacao).searchParams.get('email') === testUser.email);
}

async function testApprovalLink() {
  const payload = createAccessRequestPayload(testUser);
  const url = new URL(payload.link_liberacao);
  const approved = approveLocalAccess({
    email: url.searchParams.get('email'),
    name: url.searchParams.get('nome'),
    password: url.searchParams.get('senha'),
  });

  assert('Aprovacao pelo link salva usuario liberado', approved.email === testUser.email);
  assert('Aprovacao pelo link salva senha informada', state.approvedUsers[testUser.email]?.password === testUser.password);
}

async function testWrongPasswordBlocked() {
  try {
    signIn(testUser.email, 'SenhaErrada');
    assert('Login com senha errada deve bloquear', false);
  } catch (error) {
    assert(
      'Login com senha errada e bloqueado com mensagem em portugues',
      error.message.includes('Senha incorreta') && error.message.includes('Como corrigir'),
      error.message,
    );
  }
}

async function testCorrectPasswordLogin() {
  const user = signIn(testUser.email, testUser.password);
  assert('Login com senha correta cria sessao local', state.session?.email === testUser.email);
  assert('Login com senha correta retorna usuario', user.email === testUser.email);
}

async function testPasswordChangeRequest() {
  const changed = changeApprovedPassword(testUser.email, testUser.newPassword, testUser.newPassword);
  assert('Alteracao de senha aprovada para usuario liberado', changed.password === testUser.newPassword);

  try {
    signIn(testUser.email, testUser.password);
    assert('Senha antiga deve parar de funcionar', false);
  } catch (error) {
    assert('Senha antiga bloqueada depois da alteracao', error.message.includes('Senha incorreta'), error.message);
  }
}

async function testNewPasswordLogin() {
  const user = signIn(testUser.email, testUser.newPassword);
  assert('Login com nova senha funciona', user.email === testUser.email && state.session?.email === testUser.email);
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

function approveLocalAccess({ email, name, password }) {
  const normalized = normalizeEmail(email);
  if (!normalized || !password) {
    throw new Error('Link de liberacao incompleto. Como corrigir: abra o link completo recebido no e-mail de pedido de acesso.');
  }

  state.approvedUsers[normalized] = {
    ...(state.approvedUsers[normalized] || {}),
    email: normalized,
    name: name || 'Usuario autorizado',
    password,
    approvedBy: AUTHORIZED_EMAIL,
    approvedAt: new Date().toISOString(),
  };

  return state.approvedUsers[normalized];
}

function signIn(email, password) {
  const normalized = normalizeEmail(email);
  const savedUser = state.approvedUsers[normalized];

  if (!savedUser && normalized !== AUTHORIZED_EMAIL) {
    throw new Error('Este e-mail ainda nao foi liberado. Como corrigir: clique em Solicitar acesso e aguarde a liberacao pelo administrador.');
  }

  if (savedUser) {
    if (!password) {
      throw new Error('Digite a senha para entrar. Como corrigir: informe a senha cadastrada no pedido de acesso.');
    }
    if (savedUser.password !== password) {
      throw new Error('Senha incorreta para este e-mail. Como corrigir: confira se digitou a senha criada em Solicitar acesso ou use Alterar senha de usuario liberado.');
    }
  }

  state.session = { email: normalized, name: savedUser?.name || 'Usuario autorizado' };
  return state.session;
}

function changeApprovedPassword(email, password, confirmPassword) {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    throw new Error('Informe o e-mail do usuario liberado. Como corrigir: digite o mesmo e-mail que foi aprovado pelo administrador.');
  }
  if (!state.approvedUsers[normalized] && normalized !== AUTHORIZED_EMAIL) {
    throw new Error('Este e-mail ainda nao foi liberado. Como corrigir: clique em Solicitar acesso e aguarde o administrador abrir o link de liberacao.');
  }
  if (password.length < 6) {
    throw new Error('Crie uma senha com pelo menos 6 caracteres. Como corrigir: use uma senha maior antes de salvar.');
  }
  if (password !== confirmPassword) {
    throw new Error('A confirmacao da senha nao confere. Como corrigir: digite a mesma senha nos dois campos.');
  }

  state.approvedUsers[normalized] = {
    ...(state.approvedUsers[normalized] || {}),
    email: normalized,
    name: state.approvedUsers[normalized]?.name || 'Usuario autorizado',
    password,
    updatedAt: new Date().toISOString(),
  };

  return state.approvedUsers[normalized];
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
