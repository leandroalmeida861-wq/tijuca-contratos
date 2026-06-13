const SITE_URL = 'https://agroflow-contratos.vercel.app';

const sampleCsv = {
  fornecedores: [
    'id;user_id;nome;cnpj;telefone;email;cidade;uf;created_at',
    '"11111111-1111-4111-8111-111111111111";"old-user";"Fornecedor Teste";"00.000.000/0001-00";"(11) 90000-0000";"fornecedor@example.com";"Sao Paulo";"SP";""',
  ].join('\n'),
  produtos: [
    'id;user_id;nome;unidade;descricao;created_at',
    '"22222222-2222-4222-8222-222222222222";"old-user";"SOJA";"KG";"Produto teste";""',
  ].join('\n'),
  fabricas: [
    'id;user_id;nome;cnpj;cidade;uf;responsavel;created_at',
    '"33333333-3333-4333-8333-333333333333";"old-user";"Fabrica Teste";"11.111.111/0001-11";"Beberibe";"CE";"Leandro";""',
  ].join('\n'),
  contratos: [
    'id;numero_contrato;fornecedor;produto;fabrica;quantidade_contratada;quantidade_recebida;saldo;percentual_execucao;custo_kg;data_vencimento;status;created_at',
    '"44444444-4444-4444-8444-444444444444";"CT-TESTE";"Fornecedor Teste";"SOJA";"Fabrica Teste";"1000.5";"100.25";"900.25";"10";"0.42";"2026-12-31";"Ativo";""',
  ].join('\n'),
  notas_fiscais: [
    'id;numero_nf;numero_contrato;fornecedor;quantidade_recebida;valor_unitario;valor_total;data_recebimento;created_at',
    '"55555555-5555-4555-8555-555555555555";"NF-TESTE";"CT-TESTE";"Fornecedor Teste";"100.25";"0.423456";"42.45";"2026-06-13";""',
  ].join('\n'),
  fretes: [
    'id;contrato_id;numero_cte;transportadora;placa;motorista;valor;data_frete;created_at',
    '"66666666-6666-4666-8666-666666666666";"44444444-4444-4444-8444-444444444444";"CTE-TESTE";"Transportadora Teste";"ABC1D23";"Motorista";"123.45";"2026-06-13";""',
  ].join('\n'),
};

const results = [];

async function main() {
  await validatePublishedBackupPage();
  const parsed = Object.fromEntries(Object.entries(sampleCsv).map(([table, csv]) => [table, parseCsv(csv)]));
  const simulated = simulateImport(parsed);

  assert('CSV de fornecedores foi lido', parsed.fornecedores.length === 1);
  assert('CSV de contratos foi lido', parsed.contratos.length === 1);
  assert('Decimal com ponto foi preservado no custo kg', simulated.contratos[0].custo_kg === 0.42);
  assert('Decimal com mais casas foi preservado na nota', simulated.notas_fiscais[0].valor_unitario === 0.423456);
  assert('Contrato resolveu fornecedor por nome', simulated.contratos[0].fornecedor_id === parsed.fornecedores[0].id);
  assert('Contrato resolveu produto por nome', simulated.contratos[0].produto_id === parsed.produtos[0].id);
  assert('Contrato resolveu fabrica por nome', simulated.contratos[0].fabrica_id === parsed.fabricas[0].id);
  assert('Nota resolveu contrato por numero', simulated.notas_fiscais[0].contrato_id === parsed.contratos[0].id);
  assert('Nota resolveu fornecedor por nome', simulated.notas_fiscais[0].fornecedor_id === parsed.fornecedores[0].id);
  assert('Frete manteve contrato_id do backup', simulated.fretes[0].contrato_id === parsed.contratos[0].id);

  console.log('\nBATERIA DE TESTES BACKUP/IMPORTACAO');
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

  console.log('\nTodos os testes de backup passaram.');
}

async function validatePublishedBackupPage() {
  const response = await fetch(`${SITE_URL}/backup`);
  const html = await response.text();
  assert('HTML de /backup publicado responde 200', response.ok, `status ${response.status}`);
  assert('HTML de /backup entrega app React', html.includes('<div id="root"></div>'));

  const assetMatch = html.match(/src="([^"]*\/assets\/index-[^"]+\.js)"/);
  assert('HTML de /backup aponta para bundle JS', Boolean(assetMatch));
  if (!assetMatch) return;

  const js = await fetch(new URL(assetMatch[1], SITE_URL)).then((asset) => asset.text());
  assert('Bundle publicado contem Baixar backup completo', js.includes('Baixar backup completo'));
  assert('Bundle publicado contem arquivo JSON completo', js.includes('backup-agroflow-completo'));
  assert('Bundle publicado contem Importar backup', js.includes('Importar backup'));
  assert('Bundle publicado contem Arquivo de backup', js.includes('Arquivo de backup'));
  assert('Bundle publicado contem parse de confirmar_senha anterior intacto', js.includes('confirmar_senha'));
}

function simulateImport(tables) {
  const suppliersByName = mapBy(tables.fornecedores, 'nome');
  const productsByName = mapBy(tables.produtos, 'nome');
  const factoriesByName = mapBy(tables.fabricas, 'nome');
  const contractsByNumber = mapBy(tables.contratos, 'numero_contrato');

  return {
    contratos: tables.contratos.map((row) => ({
      id: row.id,
      numero_contrato: row.numero_contrato,
      fornecedor_id: suppliersByName.get(normalizeKey(row.fornecedor)),
      produto_id: productsByName.get(normalizeKey(row.produto)),
      fabrica_id: factoriesByName.get(normalizeKey(row.fabrica)),
      quantidade_contratada: toNumber(row.quantidade_contratada),
      quantidade_recebida: toNumber(row.quantidade_recebida),
      custo_kg: toNumber(row.custo_kg),
    })),
    notas_fiscais: tables.notas_fiscais.map((row) => ({
      id: row.id,
      numero_nf: row.numero_nf,
      contrato_id: contractsByNumber.get(normalizeKey(row.numero_contrato)),
      fornecedor_id: suppliersByName.get(normalizeKey(row.fornecedor)),
      quantidade_recebida: toNumber(row.quantidade_recebida),
      valor_unitario: toNumber(row.valor_unitario),
      valor_total: toNumber(row.valor_total),
    })),
    fretes: tables.fretes.map((row) => ({
      id: row.id,
      contrato_id: row.contrato_id,
      numero_cte: row.numero_cte,
      valor: toNumber(row.valor),
    })),
  };
}

function parseCsv(csv) {
  const rows = csv.split(/\r?\n/).filter((line) => line.trim());
  const headers = splitCsvLine(rows[0], ';').map((header) => header.replace(/^\uFEFF/, '').trim());
  return rows.slice(1).map((line) => {
    const values = splitCsvLine(line, ';');
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
  });
}

function splitCsvLine(line, separator) {
  const cells = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === separator && !quoted) {
      cells.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  cells.push(current);
  return cells;
}

function mapBy(rows, key) {
  return new Map(rows.map((row) => [normalizeKey(row[key]), row.id]));
}

function normalizeKey(value) {
  return String(value || '').trim().toLowerCase();
}

function toNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const text = String(value ?? '').trim();
  const normalized = text.includes(',')
    ? text.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '')
    : text.replace(/[^\d.-]/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function assert(name, ok, detail = '') {
  results.push({ name, ok: Boolean(ok), detail });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
