import { readFileSync } from 'node:fs';

const results = [];
const main = readFileSync('src/main.jsx', 'utf8');
const boundary = readFileSync('src/components/AppErrorBoundary.jsx', 'utf8');
const health = readFileSync('api/health.js', 'utf8');
const vercel = JSON.parse(readFileSync('vercel.json', 'utf8'));
const html = readFileSync('index.html', 'utf8');

assert('Aplicacao possui barreira contra tela branca', main.includes('<AppErrorBoundary>') && boundary.includes('Atualizar sistema'));
assert('HTML possui fallback antes do JavaScript carregar', html.includes('Carregando o AgroFlow'));
assert('Endpoint de saude verifica Vercel e Supabase', health.includes('/auth/v1/health') && health.includes('status(503)'));
assert('Index HTML nao fica preso no cache', JSON.stringify(vercel).includes('no-store'));
assert('Assets compilados usam cache imutavel', JSON.stringify(vercel).includes('immutable'));
assert('Asset inexistente nao cai no HTML da SPA', vercel.rewrites?.some((rule) => rule.source === '/assets/(.*)' && rule.destination === '/assets/$1'));
assert('Deploy executa testes preventivos', String(vercel.buildCommand || '').includes('test:resilience'));

console.log('\nTESTES DE ESTABILIDADE');
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
