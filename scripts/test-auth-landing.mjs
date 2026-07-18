import assert from 'node:assert/strict';
import { getFirstAllowedRoute } from '../src/lib/permissions.js';

function canOnly(...allowedMenus) {
  return (menu, action) => action === 'visualizar' && allowedMenus.includes(menu);
}

assert.equal(getFirstAllowedRoute(canOnly('dashboard', 'balancas')), '/');
assert.equal(getFirstAllowedRoute(canOnly('balancas')), '/balancas');
assert.equal(getFirstAllowedRoute(canOnly('produtos')), '/produtos');
assert.equal(getFirstAllowedRoute(canOnly()), null);

console.log('Redirecionamento inicial por permissao validado com sucesso.');
