export const FORTALEZA_TIME_ZONE = 'America/Fortaleza';

function fortalezaParts(value = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: FORTALEZA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(value);

  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

export function fortalezaDateIso(value = new Date()) {
  const { year, month, day } = fortalezaParts(value);
  return `${year}-${month}-${day}`;
}

export function fortalezaTime(value = new Date()) {
  const { hour, minute } = fortalezaParts(value);
  return `${hour}:${minute}`;
}
