const SITE_URL = 'https://agroflow-contratos.vercel.app';

const results = [];
const routes = [
  '/login',
  '/',
  '/fornecedores',
  '/fabricas',
  '/produtos',
  '/contratos',
  '/notas-fiscais',
  '/frete',
  '/documentos',
  '/rel-financeiro',
  '/backup',
];

async function main() {
  for (const route of routes) {
    const response = await fetch(`${SITE_URL}${route}`);
    const html = await response.text();
    assert(`Rota ${route} responde 200`, response.ok, `status ${response.status}`);
    assert(`Rota ${route} entrega app React`, html.includes('<div id="root">'));
  }

  const loginHtml = await fetch(`${SITE_URL}/login`).then((response) => response.text());
  const assetMatch = loginHtml.match(/src="([^"]*\/assets\/index-[^"]+\.js)"/);
  assert('HTML aponta para bundle JS', Boolean(assetMatch));
  if (assetMatch) {
    const js = await fetch(new URL(assetMatch[1], SITE_URL)).then((response) => response.text());
    assert('Bundle contem menu Backup', js.includes('Backup'));
    assert('Bundle contem menu Documentos', js.includes('Documentos'));
    assert('Bundle contem Importar PDF', js.includes('Importar PDF'));
    assert('Bundle bloqueia arquivo que nao seja PDF', js.includes('Apenas PDF'));
    assert('Bundle nao orienta usuario a confirmar e-mail manualmente no Supabase', !js.includes('E-mail ainda nao confirmado pelo Supabase') && !js.includes('Confirm email'));
    assert('Bundle usa rota segura de pedido de acesso', js.includes('/api/solicitar-acesso'));
    assert('Bundle nao aprova usuario pelo frontend', !js.includes('/api/approve-access') && !js.includes('aprovar_acesso=1'));
    assert('Bundle contem backup completo', js.includes('Baixar backup completo'));
  }

  const requestApi = await fetch(`${SITE_URL}/api/solicitar-acesso`, { method: 'HEAD' });
  assert('API publicada de solicitacao existe e aceita POST', requestApi.status === 405 && requestApi.headers.get('allow')?.includes('POST'), `status ${requestApi.status}`);

  const approveApi = await fetch(`${SITE_URL}/api/aprovar-acesso?token=teste`, { method: 'HEAD' });
  assert('API publicada de aprovacao existe e aceita GET', approveApi.status === 405 && approveApi.headers.get('allow')?.includes('GET'), `status ${approveApi.status}`);

  console.log('\nBATERIA DE ROTAS E INTERFACE');
  for (const result of results) {
    console.log(`${result.ok ? 'OK' : 'FALHOU'} - ${result.name}`);
    if (result.detail) console.log(`   ${result.detail}`);
  }

  const failed = results.filter((result) => !result.ok);
  if (failed.length) {
    process.exitCode = 1;
    console.error(`\n${failed.length} teste(s) falharam.`);
    return;
  }

  console.log('\nTodos os testes de rotas/interface passaram.');
}

function assert(name, ok, detail = '') {
  results.push({ name, ok: Boolean(ok), detail });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
