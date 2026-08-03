import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  PERIOD_MONTHS,
  PERIOD_YEARS,
  countRowsByPeriod,
  currentPeriod,
  filterRowsByPeriod,
} from '../src/lib/periodHistory.js';
import { UNIDADES } from '../src/config/unidades.js';

assert.deepEqual(PERIOD_YEARS, [2026, 2027, 2028, 2029, 2030]);
assert.equal(PERIOD_MONTHS.length, 12);
assert.deepEqual(currentPeriod(new Date('2028-05-12T12:00:00Z')), { year: 2028, month: 5 });

const beberibe = [
  { id: 'b1', data: '2026-08-03' },
  { id: 'b2', data: '2026-08-02' },
  { id: 'b3', data: '2026-07-31' },
  { id: 'b4', data: '2027-01-10' },
];
const haisa = [{ id: 'h1', data: '2026-08-01' }];
const getDate = (row) => row.data;

assert.deepEqual(
  filterRowsByPeriod(beberibe, getDate, { year: 2026, month: 8 }).map((row) => row.id),
  ['b1', 'b2'],
);
assert.equal(filterRowsByPeriod(beberibe, getDate, { year: 2026, month: 8 }, true).length, 4);
for (let month = 1; month <= 12; month += 1) {
  assert.doesNotThrow(() => filterRowsByPeriod(beberibe, getDate, { year: 2026, month }));
}
assert.equal(countRowsByPeriod(beberibe, getDate).get('2026-08'), 2);
assert.equal(countRowsByPeriod(haisa, getDate).get('2026-08'), 1);
assert.equal(countRowsByPeriod(beberibe, getDate).get('2026-08'), 2, 'Contagem de Beberibe não pode incluir Haisa');

assert.deepEqual(
  UNIDADES.map((unidade) => unidade.codigo),
  ['beberibe', 'haisa', 'estrela', 'iguatu'],
);
assert.ok(UNIDADES.slice(0, 3).every((unidade) => unidade.abas.includes('laboratorio')));
assert.equal(UNIDADES.find((unidade) => unidade.codigo === 'iguatu').abas.includes('laboratorio'), false);

const balancasPage = await readFile(new URL('../src/pages/BalancasPage.jsx', import.meta.url), 'utf8');
const armazenagemTab = await readFile(new URL('../src/components/balancas/ArmazenagemTab.jsx', import.meta.url), 'utf8');
assert.equal((balancasPage.match(/<PeriodHistory /g) || []).length, 4);
assert.equal((armazenagemTab.match(/<PeriodHistory /g) || []).length, 1);
assert.ok(balancasPage.includes('hasActiveBalancasFilters(filters)'));
assert.ok(armazenagemTab.includes('hasStorageSearchFilters(appliedFilters)'));

const migration = await readFile(new URL('../supabase/migrations/20260803155355_historico_periodo_indices.sql', import.meta.url), 'utf8');
assert.ok(migration.includes('(balanca_id, data desc, created_at desc)'));
assert.ok(migration.includes('(balanca_id, data_entrada desc, hora_entrada desc)'));

console.log('Histórico por período verificado nos cinco módulos e nas quatro unidades.');
