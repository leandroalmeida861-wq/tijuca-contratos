import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { abasDaUnidade, rotaInicialDaUnidade, unidadePorCodigo } from '../src/config/unidades.js';

const iguatu = unidadePorCodigo('iguatu');
assert.ok(iguatu, 'Armazém Iguatu deve existir');
assert.equal(iguatu.dispensaLaboratorio, true);
assert.deepEqual(abasDaUnidade(iguatu).map((tab) => tab.key), [
  'dashboard', 'portaria', 'recebimentos', 'armazenagem', 'relatorios',
]);
assert.equal(rotaInicialDaUnidade(iguatu), '/armazem-iguatu');

const page = readFileSync(new URL('../src/pages/BalancasPage.jsx', import.meta.url), 'utf8');
const periodHistory = readFileSync(new URL('../src/components/balancas/PeriodHistory.jsx', import.meta.url), 'utf8');
assert.match(page, /activeTab === 'dashboard'/);
assert.match(page, /dispensaLaboratorio|semLaboratorio/);
assert.match(periodHistory, /collapsible = true/);
assert.match(periodHistory, /Ocultar período/);
assert.match(periodHistory, /Mostrar período/);

console.log('Dashboard do Armazém Iguatu e histórico recolhível reutilizam o módulo das balanças sem laboratório.');
