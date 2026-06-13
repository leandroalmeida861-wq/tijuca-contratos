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
    assert(`Rota ${route} entrega app React`, html.includes('<div id="root"></div>'));
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
    assert('Bundle contem mensagem de email nao confirmado pelo Supabase', js.includes('E-mail ainda nao confirmado pelo Supabase'));
    assert('Bundle contem orientacao de Confirm email', js.includes('Confirm email'));
    assert('Bundle contem funcao de liberar email direto', js.includes('agroflow_liberar_email_direto'));
    assert('Bundle contem backup completo', js.includes('Baixar backup completo'));
  }

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
