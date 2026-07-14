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

const migration = await readFile(new URL('../supabase/armazenagem-materia-prima.sql', import.meta.url), 'utf8');
const page = await readFile(new URL('../src/pages/BalancasPage.jsx', import.meta.url), 'utf8');
const permissions = await readFile(new URL('../src/lib/permissions.js', import.meta.url), 'utf8');

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

console.log('Testes da Armazenagem M.P. aprovados.');
