import { readFileSync } from 'node:fs';

const SITE_URL = 'https://agroflow-contratos.vercel.app';
const results = [];

async function main() {
  await testPublishedHtml();
  await testEncryptionRoundTrip();
  testSourceContracts();

  console.log('\nBATERIA DE TESTES AGROFLOW - SOLICITACAO SEGURA');
  for (const result of results) {
    console.log(`${result.ok ? 'OK' : 'FALHOU'} - ${result.name}`);
    if (result.detail) console.log(`   ${result.detail}`);
  }

  const failed = results.filter((result) => !result.ok);
  if (failed.length) {
    process.exitCode = 1;
    console.error(`\n${failed.length} teste(s) falharam.`);
  } else {
    console.log('\nTodos os testes passaram.');
  }
}

async function testPublishedHtml() {
  const response = await fetch(`${SITE_URL}/login`);
  const html = await response.text();
  assert('HTML publicado na Vercel responde', response.ok, `status ${response.status}`);
  assert('HTML publicado tem root React', html.includes('<div id="root">'));
}

async function testEncryptionRoundTrip() {
  process.env.ACCESS_REQUEST_ENCRYPTION_KEY = 'teste-local-com-mais-de-trinta-e-dois-caracteres';
  const {
    decryptAccessRequestPassword,
    encryptAccessRequestPassword,
  } = await import('../api/_supabaseAdmin.js');

  const original = 'SenhaSegura123!';
  const encrypted = encryptAccessRequestPassword(original);
  assert('Senha temporaria usa envelope cifrado', encrypted.includes('"v":1') && encrypted.includes('"tag":'));
  assert('Conteudo cifrado nao contem a senha original', !encrypted.includes(original));
  assert('Backend recupera a senha somente com a chave', decryptAccessRequestPassword(encrypted) === original);
}

function testSourceContracts() {
  const login = readFileSync('src/pages/Login.jsx', 'utf8');
  const requestApi = readFileSync('api/solicitar-acesso.js', 'utf8');
  const adminApi = readFileSync('api/admin/solicitacoes.js', 'utf8');
  const adminPage = readFileSync('src/pages/AdminAccessPage.jsx', 'utf8');
  const helper = readFileSync('api/_supabaseAdmin.js', 'utf8');
  const sql = readFileSync('supabase/solicitacoes-senha-segura.sql', 'utf8');
  const envExample = readFileSync('.env.example', 'utf8');

  assert('Formulario pede senha e confirmacao', login.includes("form.senha") && login.includes("form.confirmarSenha"));
  assert('Formulario permite mostrar e ocultar senha', login.includes('PasswordVisibilityButton') && login.includes('EyeOff'));
  assert('Frontend valida minimo de 6 caracteres', login.includes('accessForm.senha.length < 6'));
  assert('Frontend valida senhas iguais', login.includes('accessForm.senha !== accessForm.confirmarSenha'));
  assert(
    'E-mail administrativo nao recebe senha',
    !emailSubmissionBlock(login).includes('senha: accessForm.senha')
      && !emailSubmissionBlock(login).includes('confirmarSenha: accessForm.confirmarSenha'),
  );
  assert('API valida senha novamente no backend', requestApi.includes('senha.length < 6') && requestApi.includes('senha !== confirmarSenha'));
  assert('API cifra antes de gravar', requestApi.includes('encryptAccessRequestPassword(senha)') && requestApi.includes('senha_criptografada: encryptedPassword'));
  assert('API publica nao retorna token ou senha', !responseBlock(requestApi).includes('token:') && !responseBlock(requestApi).includes('senha'));
  assert('Criptografia exige chave exclusiva de backend', helper.includes("readEnv('ACCESS_REQUEST_ENCRYPTION_KEY')") && !helper.includes('VITE_ACCESS_REQUEST'));
  assert('Criptografia usa AES-256-GCM', helper.includes("createCipheriv('aes-256-gcm'") && helper.includes('getAuthTag'));
  assert('Chave consta sem segredo no env example', envExample.includes('ACCESS_REQUEST_ENCRYPTION_KEY='));
  assert('Listagem do Admin nao seleciona senha protegida', adminApi.includes(".select('id,nome,email,telefone,observacao,status,criado_em,expira_em')"));
  assert('Somente Admin ativo processa pedidos', adminApi.includes("profile.perfil !== 'admin'") && adminApi.includes('!profile?.ativo'));
  assert('Aprovacao cria ou atualiza usuario no Supabase Auth', adminApi.includes('auth.admin.createUser') && adminApi.includes('auth.admin.updateUserById'));
  assert('Aprovacao confirma e-mail', adminApi.includes('email_confirm: true'));
  assert('Aprovacao aplica perfil escolhido', adminApi.includes("new Set(['admin', 'gestor', 'operador'])") && adminApi.includes('perfil: effectiveRole'));
  assert('Aprovacao limpa senha cifrada', approvalUpdateBlock(adminApi).includes('senha_criptografada: null'));
  assert('Rejeicao limpa senha cifrada', rejectionUpdateBlock(adminApi).includes('senha_criptografada: null'));
  assert('Auditoria recebe apenas metadados seguros', adminApi.includes("dados_anteriores: {\n      email:") && !auditBlock(adminApi).includes('senha_criptografada'));
  assert('Painel Admin mostra pedidos e perfil', adminPage.includes('Pedidos pendentes de acesso') && adminPage.includes('<option value="gestor">Gestor</option>'));
  assert('Painel Admin possui aprovar e rejeitar', adminPage.includes("processAccessRequest(row, 'aprovar')") && adminPage.includes("processAccessRequest(row, 'rejeitar')"));
  assert('SQL altera somente solicitacoes_acesso', sql.includes('public.solicitacoes_acesso') && !sql.includes('fornecedores') && !sql.includes('contratos'));
  assert('SQL permite rejeicao e campo nulo', sql.includes("'rejeitado'") && sql.includes('senha_criptografada text'));
}

function emailSubmissionBlock(source) {
  return source.slice(source.indexOf('submitNetlifyAccessEmail({'), source.indexOf('});', source.indexOf('submitNetlifyAccessEmail({')) + 3);
}

function responseBlock(source) {
  const start = source.indexOf('return sendJson(response, 200');
  return source.slice(start, source.indexOf('});', start) + 3);
}

function approvalUpdateBlock(source) {
  const start = source.indexOf("status: 'aprovado'");
  return source.slice(start, source.indexOf("await writeSafeAudit", start));
}

function rejectionUpdateBlock(source) {
  const start = source.indexOf("status: 'rejeitado'");
  return source.slice(start, source.indexOf("await writeSafeAudit", start));
}

function auditBlock(source) {
  const start = source.indexOf('async function writeSafeAudit');
  return source.slice(start, source.indexOf('function safeLogError', start));
}

function assert(name, ok, detail = '') {
  results.push({ name, ok: Boolean(ok), detail });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
