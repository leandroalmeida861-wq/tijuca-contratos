import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  hasRecebimentoFinalizationData,
  isDiretoPendenteBalanca,
  isLaboratorioPendenteBalanca,
  isRecebimentoFinalizadoBalanca,
  isRecebimentoPendenteBalanca,
} from '../src/lib/balancasFlow.js';

const complete = {
  status: 'aprovada',
  balanca_id: 'balanca-1',
  nf_numero: '006',
  fornecedor_id: 'fornecedor-1',
  veiculo_id: 'veiculo-1',
  produto_id: 'produto-1',
  peso_bruto: 52000,
  tara: 20000,
};

const directPending = {
  ...complete,
  status: 'pendente',
  dispensa_laboratorio: true,
  portaria: { data_entrada: '2026-07-15', hora_entrada: '08:00:00', dispensa_laboratorio: true },
};

assert.equal(hasRecebimentoFinalizationData(complete), true, 'Dados completos devem permitir finalizar');
assert.equal(isDiretoPendenteBalanca(directPending), true, 'Carga direta pendente deve entrar na fila superior');
assert.equal(isRecebimentoPendenteBalanca(directPending), true, 'Fila geral deve incluir carga direta');
assert.equal(isRecebimentoFinalizadoBalanca({ ...directPending, status: 'aprovada' }), true, 'Carga direta aprovada e completa deve finalizar');
assert.equal(isDiretoPendenteBalanca({ ...directPending, status: 'aprovada' }), false, 'Carga finalizada deve sair da fila direta');

const labPending = {
  ...complete,
  peso_bruto: 0,
  tara: 0,
  dispensa_laboratorio: false,
};
assert.equal(isLaboratorioPendenteBalanca(labPending), true, 'Aprovação laboratorial incompleta deve aguardar balança');
assert.equal(isRecebimentoFinalizadoBalanca(labPending), false, 'Aprovação do laboratório não é finalização da balança');
assert.equal(isLaboratorioPendenteBalanca({ ...complete, dispensa_laboratorio: false }), false, 'Carga completa deve sair da fila laboratorial');

const page = await readFile(new URL('../src/pages/BalancasPage.jsx', import.meta.url), 'utf8');
const service = await readFile(new URL('../src/services/balancasService.js', import.meta.url), 'utf8');
const migration = await readFile(new URL('../supabase/portaria-dispensa-laboratorio.sql', import.meta.url), 'utf8');
const unitMigration = await readFile(new URL('../supabase/portaria-exigir-unidade.sql', import.meta.url), 'utf8');
const iguatuTriggerMigration = await readFile(new URL('../supabase/portaria-corrigir-trigger-iguatu.sql', import.meta.url), 'utf8');
const rlsUnitMigration = await readFile(new URL('../supabase/portaria-corrigir-rls-unidade.sql', import.meta.url), 'utf8');

assert.ok(
  page.includes("const canSendToLab = can('balancas', 'aprovar') || canCreate"),
  'Envio ao laboratorio deve respeitar a permissao de aprovacao da Portaria',
);
assert.ok(
  page.includes("row.status !== 'AGUARDANDO_LABORATORIO'"),
  'Entrada ja encaminhada nao pode ser enviada novamente ao laboratorio',
);
assert.ok(
  (page.match(/balanca_id: unidadeId/g) || []).length >= 4,
  'Todas as transicoes da Portaria devem enviar a unidade resolvida pela rota',
);
assert.ok(
  page.includes("if (existing.balanca_id !== unidadeId) throw new Error('UNIDADE_DIVERGENTE')"),
  'Reenvio nao pode reutilizar recebimento de outra unidade',
);
assert.ok(
  page.includes("await updatePortariaEntrada(row.id, {\n        balanca_id: unidadeId,"),
  'Mudanca de status da Portaria deve manter o balanca_id',
);
assert.ok(
  service.includes(".eq('id', id)\n    .eq('balanca_id', balancaId)"),
  'Updates devem ser limitados simultaneamente pelo registro e pela unidade',
);
assert.ok(
  service.includes('Nao foi possivel identificar a unidade desta Portaria.'),
  'Erro tecnico de unidade deve ser traduzido para uma mensagem clara',
);
assert.ok(
  unitMigration.includes('check (balanca_id is not null) not valid'),
  'Banco deve bloquear novos lancamentos sem unidade sem alterar o legado',
);
assert.ok(
  !unitMigration.includes('delete from')
    && !unitMigration.includes('truncate')
    && !unitMigration.includes('update public.'),
  'Migration de unidade obrigatoria nao pode alterar ou excluir dados',
);
assert.ok(
  iguatuTriggerMigration.includes("to_jsonb(new)->>'laboratorio_id'"),
  'Trigger compartilhado deve consultar laboratorio_id sem quebrar a Portaria de Iguatu',
);
assert.ok(
  iguatuTriggerMigration.includes("public.agroflow_unidade_codigo(new.balanca_id) <> 'iguatu'"),
  'Correcao deve preservar a regra existente de Iguatu sem laboratorio',
);
assert.ok(
  (rlsUnitMigration.match(/as restrictive/g) || []).length === 2,
  'RLS deve exigir permissao de menu e permissao da unidade em Portaria e Recebimentos',
);
assert.ok(
  rlsUnitMigration.includes('unidade_portaria_entradas')
    && rlsUnitMigration.includes('unidade_recebimentos'),
  'RLS restritiva deve proteger as duas tabelas do fluxo da Portaria',
);
assert.ok(
  page.includes('Enviar para Laborat'),
  'Visualizacao da entrada deve oferecer a acao de envio ao laboratorio',
);
assert.ok(page.includes('sendingToLabId'), 'Envio deve bloquear cliques simultaneos na mesma entrada');

assert.ok(page.includes('const shouldFinalizePending = Boolean('), 'Salvamento deve concluir qualquer pendencia de balanca valida');
assert.ok(
  page.includes('(isLaboratorioPendenteBalanca(row) || isDiretoPendenteBalanca(row))'),
  'Finalizacao deve contemplar cargas vindas do laboratorio e cargas diretas',
);
assert.ok(
  page.includes("status: 'aprovada', dispensa_laboratorio: hasDispensaLaboratorio(row)"),
  'Finalizacao deve preservar a origem laboratorial ou direta do recebimento',
);
assert.ok(page.includes("'Peso bruto KG maior que zero'"), 'Peso bruto zerado nao pode produzir falso sucesso');
assert.ok(page.includes("'Tara KG maior que zero'"), 'Tara zerada nao pode produzir falso sucesso');
assert.ok(page.includes("item?.afeta_peso !== false"), 'Complemento financeiro nao deve alterar a diferenca de peso');
assert.ok(service.includes('afeta_peso,'), 'Consulta deve carregar o marcador de peso do complemento');
assert.ok(
  page.includes('|| isDiretoPendenteBalanca(row);'),
  'Carga direta pendente deve reutilizar a importação XML do formulário de recebimento',
);
assert.ok(page.includes('sortPendingScaleRows'), 'Pendências devem usar ordenação operacional crescente');
assert.ok(page.toUpperCase().includes('DIRETO PARA RECEBIMENTOS - PENDENTE FINALIZAR RECEBIMENTO'), 'Fila direta deve ter identificação própria');
assert.ok(page.includes("return 'Recebimento finalizado'"), 'Status final deve ter texto próprio e prioritário');
assert.ok(migration.includes("'RECEBIMENTO_FINALIZADO'"), 'Portaria deve persistir o status final');
assert.ok(migration.includes('recebimentos_sincronizar_portaria_finalizada'), 'Trigger deve sincronizar o vínculo na mesma transação');
assert.ok(migration.includes('where id = new.portaria_id'), 'Sincronização deve usar exclusivamente portaria_id');
assert.ok(!migration.includes('where numero_nf ='), 'NF não pode identificar a Portaria a atualizar');

console.log('Testes do fluxo Portaria/Laboratório/Recebimentos aprovados.');
