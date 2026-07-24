import { readFileSync } from 'node:fs';
import { createReliableFetch, classifyRequestError } from '../src/lib/reliableFetch.js';

const results = [];
const main = readFileSync('src/main.jsx', 'utf8');
const boundary = readFileSync('src/components/AppErrorBoundary.jsx', 'utf8');
const health = readFileSync('api/health.js', 'utf8');
const recovery = readFileSync('public/asset-recovery.js', 'utf8');
const vercel = JSON.parse(readFileSync('vercel.json', 'utf8'));
const html = readFileSync('index.html', 'utf8');

assert('Aplicacao possui barreira contra tela branca', main.includes('<AppErrorBoundary>') && boundary.includes('Atualizar sistema'));
assert('HTML possui fallback antes do JavaScript carregar', html.includes('Carregando o AgroFlow'));
assert('Endpoint de saude verifica Vercel e Supabase', health.includes('/auth/v1/health') && health.includes('status(503)'));
assert('Index HTML nao fica preso no cache', JSON.stringify(vercel).includes('no-store'));
assert('Assets compilados usam cache imutavel', JSON.stringify(vercel).includes('immutable'));
assert('Asset antigo aciona recuperacao automatica', vercel.rewrites?.some((rule) => rule.source === '/assets/(.*)' && rule.destination === '/asset-recovery.js') && recovery.includes('window.location.replace'));
assert('Deploy executa testes preventivos', String(vercel.buildCommand || '').includes('test:resilience'));
assert('Cliente Supabase usa fetch resiliente', readFileSync('src/lib/supabase.js', 'utf8').includes('createReliableFetch(globalThis.fetch)'));
assert('Retry interno fica desativado para nao duplicar tentativas', readFileSync('src/lib/supabase.js', 'utf8').includes('retry: false'));
assert('Armazenagem oferece nova tentativa sem recarregar a pagina', readFileSync('src/components/balancas/ArmazenagemTab.jsx', 'utf8').includes('Tentar novamente'));
assert('Erro de conexao e classificado corretamente', classifyRequestError(new TypeError('Failed to fetch')) === 'connection');
assert('Sessao expirada e classificada corretamente', classifyRequestError({ status: 401, message: 'JWT expired' }) === 'session');
assert('RLS e classificada como permissao', classifyRequestError({ status: 403, message: 'permission denied' }) === 'permission');
assert('Erro 503 e classificado como servidor', classifyRequestError({ status: 503, message: 'Service unavailable' }) === 'server');

let attempts = 0;
const retriedResponse = await createReliableFetch(async () => {
  attempts += 1;
  if (attempts === 1) throw new TypeError('Failed to fetch');
  return new Response('[]', { status: 200 });
}, { retries: 1, timeoutMs: 1000, retryDelayMs: 0 })('https://example.test/rest/v1/dados');
assert('Leitura com falha transitoria tenta novamente uma unica vez', attempts === 2 && retriedResponse.status === 200);

let cloudflareAttempts = 0;
const cloudflareResponse = await createReliableFetch(async () => {
  cloudflareAttempts += 1;
  return new Response('[]', { status: cloudflareAttempts === 1 ? 522 : 200 });
}, { retries: 1, timeoutMs: 1000, retryDelayMs: 0 })('https://example.test/rest/v1/dados');
assert('Leitura com erro 522 do Supabase tenta novamente', cloudflareAttempts === 2 && cloudflareResponse.status === 200);

let writeAttempts = 0;
try {
  await createReliableFetch(async () => {
    writeAttempts += 1;
    throw new TypeError('Failed to fetch');
  }, { retries: 1, timeoutMs: 1000, retryDelayMs: 0 })('https://example.test/rest/v1/dados', { method: 'POST' });
} catch {
  // A escrita deve falhar sem nova tentativa para evitar duplicidade.
}
assert('Gravacoes nao sao repetidas automaticamente', writeAttempts === 1);

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
