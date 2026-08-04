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

export function parseBrazilianDecimal(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  let text = String(value ?? '').trim();
  if (!text) return null;
  text = text.replace(/R\$/gi, '').replace(/\s/g, '').replace(/[^\d,.-]/g, '');
  const negative = text.startsWith('-');
  text = text.replace(/-/g, '');
  if (!text || !/\d/.test(text)) return null;

  const commaIndex = text.lastIndexOf(',');
  const dotIndex = text.lastIndexOf('.');
  let normalized;
  if (commaIndex >= 0 && dotIndex >= 0) {
    const decimalIndex = Math.max(commaIndex, dotIndex);
    normalized = `${text.slice(0, decimalIndex).replace(/[.,]/g, '')}.${text.slice(decimalIndex + 1).replace(/[.,]/g, '')}`;
  } else if (commaIndex >= 0) {
    normalized = `${text.slice(0, commaIndex).replace(/,/g, '')}.${text.slice(commaIndex + 1).replace(/,/g, '')}`;
  } else if (dotIndex >= 0) {
    const parts = text.split('.');
    const groupedThousands = parts.length > 2 && parts.slice(1).every((part) => part.length === 3);
    const singleThousands = parts.length === 2 && parts[0] !== '0' && parts[0].length <= 3 && parts[1].length === 3;
    normalized = groupedThousands || singleThousands
      ? parts.join('')
      : `${parts.slice(0, -1).join('')}.${parts.at(-1)}`;
  } else {
    normalized = text;
  }

  const number = Number(`${negative ? '-' : ''}${normalized}`);
  return Number.isFinite(number) ? number : null;
}

export function formatBrazilianDecimal(value, minimumFractionDigits, maximumFractionDigits = minimumFractionDigits) {
  const number = typeof value === 'number' ? value : parseBrazilianDecimal(value);
  if (number === null || !Number.isFinite(number)) return '';
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits,
    maximumFractionDigits,
    useGrouping: true,
  }).format(number);
}

export function calculateEntryUnitValue(totalValue, weight) {
  const total = typeof totalValue === 'number' ? totalValue : parseBrazilianDecimal(totalValue);
  const kilograms = typeof weight === 'number' ? weight : parseBrazilianDecimal(weight);
  if (total === null || kilograms === null || total < 0 || kilograms <= 0) return null;
  const unitValue = total / kilograms;
  return Number.isFinite(unitValue) ? Number(unitValue.toFixed(6)) : null;
}

function positiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}
function roundWeight(value) { return Number(Number(value || 0).toFixed(3)); }
function digits(value) { return String(value || '').replace(/\D/g, ''); }
function normalizedNumber(value) { return digits(value).replace(/^0+/, '') || '0'; }
