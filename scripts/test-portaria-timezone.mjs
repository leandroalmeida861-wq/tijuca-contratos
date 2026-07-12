import assert from 'node:assert/strict';
import { fortalezaDateIso, fortalezaTime } from '../src/lib/fortalezaDateTime.js';

const scenarios = [
  ['2026-07-12T03:01:00.000Z', '2026-07-12', '00:01'],
  ['2026-07-12T08:57:00.000Z', '2026-07-12', '05:57'],
  ['2026-07-12T12:40:00.000Z', '2026-07-12', '09:40'],
  ['2026-07-13T02:59:00.000Z', '2026-07-12', '23:59'],
  ['2026-07-13T03:00:00.000Z', '2026-07-13', '00:00'],
];

for (const [instant, expectedDate, expectedTime] of scenarios) {
  const value = new Date(instant);
  assert.equal(fortalezaDateIso(value), expectedDate, `Data incorreta para ${instant}`);
  assert.equal(fortalezaTime(value), expectedTime, `Hora incorreta para ${instant}`);
}

console.log('OK - Portaria respeita America/Fortaleza de 00:00 ate 23:59.');
