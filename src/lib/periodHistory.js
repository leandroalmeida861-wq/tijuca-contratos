export const PERIOD_YEARS = Object.freeze([2026, 2027, 2028, 2029, 2030]);
export const PERIOD_MONTHS = Object.freeze([
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
]);

export function currentPeriod(now = new Date()) {
  const currentYear = now.getFullYear();
  return {
    year: PERIOD_YEARS.includes(currentYear) ? currentYear : PERIOD_YEARS[0],
    month: now.getMonth() + 1,
  };
}

export function filterRowsByPeriod(rows, getDate, period, searchActive = false) {
  if (searchActive) return rows;
  const prefix = `${period.year}-${String(period.month).padStart(2, '0')}`;
  return rows.filter((row) => String(getDate(row) || '').slice(0, 7) === prefix);
}

export function countRowsByPeriod(rows, getDate) {
  const counts = new Map();
  rows.forEach((row) => {
    const date = String(getDate(row) || '');
    const key = /^\d{4}-\d{2}/.test(date) ? date.slice(0, 7) : '';
    if (key) counts.set(key, (counts.get(key) || 0) + 1);
  });
  return counts;
}
