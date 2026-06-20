import assert from 'node:assert/strict';
import {
  createDashboardSearchParams,
  readDashboardFilters,
  validateDashboardFilters,
} from '../src/hooks/useDashboardFilters.js';

const filters = {
  dataInicial: '2026-01-01',
  dataFinal: '2026-01-31',
  fornecedorId: 'fornecedor-123',
  produtoId: 'produto-456',
  contratoId: 'contrato-789',
};

const params = createDashboardSearchParams(filters);
assert.equal(
  params.toString(),
  'dataInicial=2026-01-01&dataFinal=2026-01-31&fornecedorId=fornecedor-123&produtoId=produto-456&contratoId=contrato-789',
);
assert.deepEqual(readDashboardFilters(params), filters);

const paramsWithoutEmptyValues = createDashboardSearchParams({
  ...filters,
  produtoId: '',
  contratoId: '',
});
assert.equal(paramsWithoutEmptyValues.has('produtoId'), false);
assert.equal(paramsWithoutEmptyValues.has('contratoId'), false);

assert.equal(validateDashboardFilters(filters), '');
assert.match(
  validateDashboardFilters({ ...filters, dataInicial: '2026-02-01', dataFinal: '2026-01-31' }),
  /data inicial não pode ser maior/i,
);

console.log('OK - filtros do Dashboard preservam URL, combinação e validação de datas.');
