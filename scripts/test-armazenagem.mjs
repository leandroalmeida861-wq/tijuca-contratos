import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  isRecebimentoFinalizadoParaArmazenagem,
  mergeRecebimentosArmazenagens,
  notaItemPesoKg,
  pesoNotaRecebimento,
} from '../src/lib/armazenagem.js';

assert.equal(notaItemPesoKg(48000, 'KG'), 48000, 'KG deve permanecer KG');
assert.equal(notaItemPesoKg(48, 'TON'), 48000, 'TON deve converter para KG');
assert.equal(notaItemPesoKg(638, 'SC', 60), 38280, 'SC deve respeitar peso por saca');
assert.equal(notaItemPesoKg(10, 'UN'), 0, 'Unidade sem peso não pode ser tratada como KG');

const recebimento = {
  id: 'recebimento-1',
  data: '2026-07-14',
  status: 'aprovada',
  balanca_id: 'balanca-1',
  nf_numero: '1459',
  nf_chave_acesso: 'chave-xml',
  peso_bruto: 70000,
  tara: 22000,
  peso_nf: 999999,
  peso_por_saca: 60,
  itens: [
    { quantidade: 30000, unidade: 'KG' },
    { quantidade: 300, unidade: 'SC' },
  ],
};

assert.equal(pesoNotaRecebimento(recebimento), 48000, 'Peso deve somar os itens da NF, sem usar peso da balança');
assert.equal(isRecebimentoFinalizadoParaArmazenagem(recebimento), true, 'Recebimento finalizado deve ficar disponível');
assert.equal(isRecebimentoFinalizadoParaArmazenagem({ ...recebimento, status: 'pendente' }), false, 'Recebimento pendente não pode entrar');

const merged = mergeRecebimentosArmazenagens([recebimento], []);
assert.equal(merged.length, 1, 'Cada recebimento deve gerar uma única linha');
assert.equal(merged[0].peso_nota, 48000);
assert.equal(merged[0].peso_distribuido, 0);
assert.equal(merged[0].saldo_distribuir, 48000);
assert.equal(merged[0].origem_peso, 'XML');

const recebimentoMesmoNumeroA = {
  ...recebimento,
  id: '11111111-1111-4111-8111-111111111111',
  nf_numero: '006',
  fornecedor: { id: 'fornecedor-a', nome: 'Fornecedor A' },
  veiculo: { placa: 'ABC1D23' },
};
const recebimentoMesmoNumeroB = {
  ...recebimento,
  id: '22222222-2222-4222-8222-222222222222',
  nf_numero: '006',
  fornecedor: { id: 'fornecedor-b', nome: 'Fornecedor B' },
  veiculo: { placa: 'ABC1D23' },
};
const armazenagemA = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  recebimento_id: recebimentoMesmoNumeroA.id,
  peso_nota: 48000,
  recebimento: { nf_numero: 'registro-antigo-que-nao-deve-prevalecer' },
};
const armazenagemB = {
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  recebimento_id: recebimentoMesmoNumeroB.id,
  peso_nota: 48000,
};
const isolados = mergeRecebimentosArmazenagens(
  [recebimentoMesmoNumeroA, recebimentoMesmoNumeroB],
  [armazenagemB, armazenagemA],
);

assert.equal(isolados.length, 2, 'Notas iguais devem continuar em registros separados');
assert.equal(isolados[0].id, armazenagemA.id, 'A associação deve usar somente recebimento_id');
assert.equal(isolados[1].id, armazenagemB.id, 'A ordem da consulta não pode misturar vínculos');
assert.equal(isolados[0].recebimento.fornecedor.nome, 'Fornecedor A', 'Fornecedor deve vir do recebimento do mesmo ID');
assert.equal(isolados[1].recebimento.fornecedor.nome, 'Fornecedor B', 'Fornecedores com a mesma NF não podem se misturar');
assert.equal(isolados[0].recebimento.veiculo.placa, 'ABC1D23', 'Placas iguais não podem ser usadas como chave');
assert.equal(isolados[0].recebimento.nf_numero, '006', 'Dados atuais do recebimento devem substituir estado antigo da relação');

const migration = await readFile(new URL('../supabase/armazenagem-materia-prima.sql', import.meta.url), 'utf8');
const page = await readFile(new URL('../src/pages/BalancasPage.jsx', import.meta.url), 'utf8');
const permissions = await readFile(new URL('../src/lib/permissions.js', import.meta.url), 'utf8');
const immutableLinkMigration = await readFile(new URL('../supabase/armazenagem-vinculo-id-imutavel.sql', import.meta.url), 'utf8');
const storagePage = await readFile(new URL('../src/components/balancas/ArmazenagemTab.jsx', import.meta.url), 'utf8');
const service = await readFile(new URL('../src/services/balancasService.js', import.meta.url), 'utf8');

for (const required of [
  'constraint armazenagens_recebimento_unico unique (recebimento_id)',
  "origem_peso in ('XML', 'NOTA', 'RECEBIMENTO')",
  'PESO_DISTRIBUIDO_SUPERA_NOTA',
  'alter table public.armazenagens_materia_prima enable row level security',
  "public.agroflow_tem_permissao('balancas_armazenagem', 'visualizar')",
  'public.agroflow_mesma_empresa(empresa_id)',
  'agroflow_audit_trigger()',
  'PESO_ITEM_NF_NAO_INFORMADO',
]) {
  assert.ok(migration.includes(required), `Migration deve conter: ${required}`);
}

assert.ok(page.includes("{ key: 'armazenagem', label: 'Armazenagem M.P.', menu: 'balancas_armazenagem' }"));
assert.ok(permissions.includes("key: 'balancas_armazenagem'"));
assert.ok(immutableLinkMigration.includes('new.recebimento_id is distinct from old.recebimento_id'));
assert.ok(immutableLinkMigration.includes("raise exception 'RECEBIMENTO_ID_ARMAZENAGEM_IMUTAVEL'"));
assert.ok(storagePage.includes('key={modal.record.id || modal.record.recebimento_id}'), 'Modal deve reiniciar pelo ID selecionado');
assert.ok(storagePage.includes('key={row.id || row.recebimento_id}'), 'Linha deve ter chave estável e única');
assert.ok(page.includes("key={editing?.id || 'novo-recebimento'}"), 'Formulário deve reiniciar ao trocar de recebimento');
assert.ok(service.includes(".update(cleanedPayload)\n    .eq('id', id)"), 'Portaria deve atualizar pelo ID');
assert.ok(service.includes(".update(cleanedPayload).eq('id', id)"), 'Recebimento deve atualizar pelo ID');
assert.ok(!service.includes(".update(cleanedPayload).eq('nf_numero'"), 'NF não pode identificar updates');
assert.ok(!service.includes(".update(cleanedPayload).eq('placa'"), 'Placa não pode identificar updates');

console.log('Testes da Armazenagem M.P. aprovados.');
