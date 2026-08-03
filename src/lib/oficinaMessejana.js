export const CENTRAL_MESSEJANA_NAME = 'Central de Grãos Messejana';

export function calculateEntryBalance(entry, exits = []) {
  const originalWeight = positiveNumber(entry?.peso_nf);
  const withdrawnWeight = exits.reduce((total, item) => (
    item?.status_registro === 'CANCELADA' ? total : total + positiveNumber(item?.peso_saida)
  ), 0);
  const balance = Math.max(0, roundWeight(originalWeight - withdrawnWeight));
  const status = entry?.status_registro === 'CANCELADA'
    ? 'CANCELADA'
    : withdrawnWeight === 0 ? 'SEM_SAIDA' : balance === 0 ? 'SAIDA_TOTAL' : 'SAIDA_PARCIAL';
  return { originalWeight, withdrawnWeight: roundWeight(withdrawnWeight), balance, status };
}

export function validateExit(entry, exits, nextWeight, editingExitId = null) {
  if (entry?.status_registro === 'CANCELADA') return { valid: false, code: 'ENTRADA_CANCELADA' };
  if (!entry?.deposito_id) return { valid: false, code: 'DEPOSITO_OBRIGATORIO' };
  const weight = positiveNumber(nextWeight);
  if (!weight) return { valid: false, code: 'PESO_INVALIDO' };
  const activeExits = exits.filter((item) => item.id !== editingExitId);
  const { balance } = calculateEntryBalance(entry, activeExits);
  if (weight > balance) return { valid: false, code: 'SALDO_INSUFICIENTE', balance };
  return { valid: true, balanceAfter: roundWeight(balance - weight) };
}

export function duplicateEntryKey(entry) {
  return [
    'central-messejana',
    digits(entry?.fornecedor_cnpj),
    normalizedNumber(entry?.nf_numero),
    String(entry?.nf_serie || '1').trim().toUpperCase(),
  ].join('|');
}

export function complementaryNoteChangesWeight() {
  return false;
}

function positiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}
function roundWeight(value) { return Number(Number(value || 0).toFixed(3)); }
function digits(value) { return String(value || '').replace(/\D/g, ''); }
function normalizedNumber(value) { return digits(value).replace(/^0+/, '') || '0'; }
