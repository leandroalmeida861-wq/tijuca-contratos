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
const migration = await readFile(new URL('../supabase/portaria-dispensa-laboratorio.sql', import.meta.url), 'utf8');

assert.ok(
  page.includes("const canSendToLab = can('balancas', 'aprovar') || canCreate"),
  'Envio ao laboratorio deve respeitar a permissao de aprovacao da Portaria',
);
assert.ok(
  page.includes("row.status !== 'AGUARDANDO_LABORATORIO'"),
  'Entrada ja encaminhada nao pode ser enviada novamente ao laboratorio',
);
assert.ok(
  page.includes('Enviar para Laborat'),
  'Visualizacao da entrada deve oferecer a acao de envio ao laboratorio',
);
assert.ok(page.includes('sendingToLabId'), 'Envio deve bloquear cliques simultaneos na mesma entrada');

assert.ok(page.includes("status: 'aprovada', dispensa_laboratorio: true"), 'Salvar carga direta completa deve persistir status final');
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
