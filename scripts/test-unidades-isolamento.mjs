import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  UNIDADES,
  encontrarBalancaDaUnidade,
  escopoDaUnidade,
} from '../src/config/unidades.js';

const ids = {
  beberibe: '1d495a82-5103-4c7f-9536-54c33f20a772',
  haisa: '2f199b4e-b160-4739-8fb6-a611c091a8f0',
  estrela: '690584fb-b7e3-43a3-abb0-33d6f6585c4a',
  iguatu: 'ca6a615b-610a-4995-bf91-2e941c7f46bc',
};

const balancas = [
  { id: ids.beberibe, nome: 'BalanÃ§a Beberibe da Fabrica', identificacao: '09.524.502/0001-96' },
  { id: ids.haisa, nome: 'BalanÃ§a Haisa Horizonte', identificacao: '09.524.502/0017-53' },
  { id: ids.estrela, nome: 'BalanÃ§a Estrela Horizonte', identificacao: '09.524.502/0013-20' },
  { id: ids.iguatu, nome: 'BalanÃ§a Iguatu', identificacao: '09.524.502/0014-00' },
];

const resolvidas = UNIDADES.map((unidade) => ({
  unidade,
  balanca: encontrarBalancaDaUnidade(unidade, balancas),
}));

assert.equal(resolvidas.length, 4, 'As quatro unidades devem permanecer configuradas');
assert.equal(new Set(resolvidas.map(({ balanca }) => balanca?.id)).size, 4, 'Cada unidade deve resolver uma balanÃ§a diferente');
assert.ok(resolvidas.every(({ balanca }) => balanca?.id), 'Nenhuma unidade pode ficar sem balanca_id');

for (const { unidade, balanca } of resolvidas) {
  const escopo = escopoDaUnidade(unidade, balanca);
  assert.equal(escopo.balancaId, balanca.id, `${unidade.nome} deve usar o prÃ³prio balanca_id`);
  assert.equal(escopo.incluirSemUnidade, unidade.codigo === 'beberibe', 'Somente Beberibe recebe o legado sem unidade');
}

const unidadeModulo = await readFile(new URL('../src/components/UnidadeModulo.jsx', import.meta.url), 'utf8');
const balancasService = await readFile(new URL('../src/services/balancasService.js', import.meta.url), 'utf8');
const armazenagemService = await readFile(new URL('../src/services/armazenagemService.js', import.meta.url), 'utf8');
const armazenagemTab = await readFile(new URL('../src/components/balancas/ArmazenagemTab.jsx', import.meta.url), 'utf8');
const migration = await readFile(new URL('../supabase/isolamento-unidade-fechamentos.sql', import.meta.url), 'utf8');
const armazenagemIsolationMigration = await readFile(
  new URL('../supabase/migrations/20260801133004_isolamento_unidade_armazenagem.sql', import.meta.url),
  'utf8',
);

assert.ok(
  unidadeModulo.includes('key={unidade.codigo}'),
  'A troca de rota deve desmontar o estado da unidade anterior',
);
assert.ok(
  balancasService.includes('requireUnidadeScope(filters);')
    && balancasService.includes('requireUnidadeScope(escopo);'),
  'Recebimentos e Portaria devem recusar consulta sem unidade',
);
assert.ok(
  balancasService.includes("query.eq('balanca_id', escopo.balancaId)"),
  'A consulta deve filtrar balanca_id no banco',
);
assert.ok(
  armazenagemService.includes('recebimento:recebimentos!inner(')
    && armazenagemService.includes(".eq('recebimento.balanca_id', escopo.balancaId)"),
  'Armazenagem deve filtrar a unidade no relacionamento consultado pelo banco',
);
assert.ok(
  armazenagemService.includes(".eq('balanca_id', escopo.balancaId)"),
  'Fechamentos e exclusÃµes devem filtrar balanca_id',
);
assert.ok(
  armazenagemTab.includes('balancaId,')
    && armazenagemService.includes('p_balanca_id: balancaId'),
  'Fechar e reabrir mÃªs devem enviar a unidade ao backend',
);
assert.ok(
  migration.includes('alter table public.fechamentos_armazenagem')
    && migration.includes('balanca_id uuid references public.balancas')
    && migration.includes('agroflow_acessa_unidade(balanca_id)'),
  'O banco deve armazenar e proteger a unidade do fechamento mensal',
);
assert.ok(
  migration.includes('r.balanca_id = p_balanca_id'),
  'Totais e pendÃªncias do fechamento devem usar apenas a unidade solicitada',
);
assert.ok(
  !migration.includes('delete from public.recebimentos')
    && !migration.includes('update public.recebimentos')
    && !migration.includes('truncate'),
  'A correÃ§Ã£o nÃ£o pode mover, apagar ou alterar recebimentos existentes',
);

assert.ok(
  armazenagemIsolationMigration.includes('create trigger armazenagens_validar_unidade_escrita')
    && armazenagemIsolationMigration.includes('public.agroflow_pode_editar_unidade(v_balanca_id)'),
  'RPCs SECURITY DEFINER da Armazenagem devem validar a unidade antes de gravar',
);
assert.ok(
  armazenagemIsolationMigration.includes('create policy unidade_armazenagem_itens_select')
    && armazenagemIsolationMigration.includes('create policy unidade_armazenagem_distribuicoes_select')
    && (armazenagemIsolationMigration.match(/as restrictive/g) || []).length >= 2,
  'Itens e distribuicoes devem possuir policies restritivas por unidade',
);
assert.ok(
  (armazenagemIsolationMigration.match(/public\.agroflow_acessa_unidade\(r\.balanca_id\)/g) || []).length >= 2,
  'Tabelas filhas da Armazenagem devem herdar a unidade do recebimento',
);
assert.ok(
  !/\b(update|delete from|insert into)\s+public\.recebimentos\b/i.test(armazenagemIsolationMigration)
    && !/\btruncate\b/i.test(armazenagemIsolationMigration),
  'O reforco preventivo nao pode modificar recebimentos existentes',
);

console.log('Testes de isolamento entre Beberibe, Haisa, Estrela e Iguatu aprovados.');
