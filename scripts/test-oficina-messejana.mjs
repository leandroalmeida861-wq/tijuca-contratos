import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CENTRAL_MESSEJANA_NAME, calculateEntryBalance, complementaryNoteChangesWeight,
  duplicateEntryKey, validateExit,
} from '../src/lib/oficinaMessejana.js';

const entry = { id: 'entrada-1', peso_nf: 47650, deposito_id: 'feliana', status_registro: 'CONFIRMADA' };
assert.equal(CENTRAL_MESSEJANA_NAME, 'Central de Grãos Messejana');
assert.deepEqual(calculateEntryBalance(entry, []), { originalWeight: 47650, withdrawnWeight: 0, balance: 47650, status: 'SEM_SAIDA' });
const exits = [{ id: 's1', peso_saida: 20000, status_registro: 'CONFIRMADA' }];
assert.equal(calculateEntryBalance(entry, exits).balance, 27650);
exits.push({ id: 's2', peso_saida: 10000, status_registro: 'CONFIRMADA' });
assert.equal(calculateEntryBalance(entry, exits).balance, 17650);
assert.equal(validateExit(entry, exits, 17651).code, 'SALDO_INSUFICIENTE');
exits.push({ id: 's3', peso_saida: 17650, status_registro: 'CONFIRMADA' });
assert.equal(calculateEntryBalance(entry, exits).status, 'SAIDA_TOTAL');
assert.equal(validateExit(entry, exits, 17650, 's3').balanceAfter, 0);
exits[2].status_registro = 'CANCELADA';
assert.equal(calculateEntryBalance(entry, exits).balance, 17650);
assert.notEqual(duplicateEntryKey({ fornecedor_cnpj: '11.111.111/0001-11', nf_numero: '001', nf_serie: '1' }), duplicateEntryKey({ fornecedor_cnpj: '22.222.222/0001-22', nf_numero: '001', nf_serie: '1' }));
assert.equal(complementaryNoteChangesWeight(), false);

const migration = readFileSync(new URL('../supabase/migrations/20260803193448_oficina_messejana.sql', import.meta.url), 'utf8');
const page = readFileSync(new URL('../src/pages/OficinaMessejanaPage.jsx', import.meta.url), 'utf8');
const service = readFileSync(new URL('../src/services/oficinaMessejanaService.js', import.meta.url), 'utf8');
for (const table of ['oficina_messejana_depositos','oficina_messejana_entradas','oficina_messejana_saidas','oficina_messejana_notas_complementares']) assert.match(migration, new RegExp(`enable row level security;[\\s\\S]*${table}|${table}[\\s\\S]*enable row level security`));
assert.match(migration, /for update/);
assert.match(migration, /OFICINA_SALDO_INSUFICIENTE/);
assert.match(migration, /idempotency_key/);
assert.match(migration, /security_invoker = true/);
assert.match(migration, /revoke all on function public\.oficina_messejana_salvar_saida/);
assert.match(migration, /create or replace function public\.oficina_messejana_exportar/);
assert.match(migration, /agroflow_tem_permissao\('oficina_messejana_relatorios','exportar'\)/);
assert.match(migration, /v_result := v_result - array\[/);
assert.match(migration, /grant execute on function public\.oficina_messejana_exportar/);
assert.match(migration, /sx\.data_saida < s\.data_saida/);
assert.match(page, /Central de Grãos Messejana/);
assert.match(page, /Histórico por período|PeriodHistory/);
assert.match(service, /\.range\(/);
assert.match(service, /\.gte\(column, start\)\.lt\(column, end\)/);
assert.match(service, /supabase\.rpc\('oficina_messejana_exportar'/);
assert.match(service, /applyTextFilter\(query, 'fornecedor_nome', filters\.fornecedor\)/);
assert.match(service, /applyExactFilter\(query, 'deposito_id', filters\.depositoId\)/);
assert.match(page, /setPeriod\(currentPeriod\(\)\)/);
assert.doesNotMatch(page, /Feliana|Nicodemos|Guaraves|Paulo Dalto/);

console.log('Central de Grãos Messejana: saldo, duplicidade, complemento, paginação, RLS e concorrência verificados.');
