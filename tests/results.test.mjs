// Pruebas del motor de resultados:  node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeResults, fmtDuration, resultsToCSV, STATUS } from '../js/results.js';
import { buildDemoData } from '../js/demo-data.js';

const T = (hms) => `2026-09-22T${hms}-07:00`;
const base = () => ({
  event: { id: 'e1', name: 'Prueba', start_at: new Date(T('08:00:00')).toISOString() },
  categories: [{ id: 'c1', name: 'Élite', laps: 3 }, { id: 'c2', name: 'Infantil', laps: 1 }],
  teams: [{ id: 't1', name: 'Halcones' }],
  riders: [
    { id: 'r1', dorsal: 1, name: 'Ana', category_id: 'c1', team_id: 't1' },
    { id: 'r2', dorsal: 2, name: 'Beto', category_id: 'c1' },
    { id: 'r3', dorsal: 3, name: 'Caro', category_id: 'c1' },
    { id: 'r4', dorsal: 4, name: 'Dani', category_id: 'c2' },
  ],
  eventCategories: [{ event_id: 'e1', category_id: 'c2', start_at: new Date(T('08:30:00')).toISOString() }],
  laps: [],
});
const lap = (d, hms) => ({ id: `${d}-${hms}`, event_id: 'e1', dorsal: d, ts: new Date(T(hms)).toISOString() });

test('formato de duración', () => {
  assert.equal(fmtDuration(0), '00:00:00');
  assert.equal(fmtDuration(3723000), '01:02:03');
  assert.equal(fmtDuration(null), '—');
});

test('tiempo por vuelta y tiempo oficial usan la salida del evento (no la hora del reloj)', () => {
  const d = base();
  d.laps = [lap(1, '08:25:00'), lap(1, '08:51:30'), lap(1, '09:17:10')];
  const [elite] = computeResults(d);
  const ana = elite.rows[0];
  assert.equal(ana.status, STATUS.FINAL);
  assert.deepEqual(ana.splits.map((s) => fmtDuration(s.ms)), ['00:25:00', '00:26:30', '00:25:40']);
  assert.equal(fmtDuration(ana.total), '01:17:10');
});

test('la salida propia de una categoría tiene prioridad sobre la general', () => {
  const d = base(); d.laps = [lap(4, '08:42:05')];
  const inf = computeResults(d).find((g) => g.category.id === 'c2');
  assert.equal(fmtDuration(inf.rows[0].total), '00:12:05');
});

test('orden: terminados por tiempo, luego en pista por vueltas; pasos extra no cuentan', () => {
  const d = base();
  d.laps = [
    lap(2, '08:24:00'), lap(2, '08:49:00'), lap(2, '09:14:00'), lap(2, '09:40:00'), // 4 pasos: el 4º es extra
    lap(1, '08:25:00'), lap(1, '08:51:30'), lap(1, '09:17:10'),
    lap(3, '08:30:00'),
  ];
  const [elite] = computeResults(d);
  assert.deepEqual(elite.rows.map((r) => r.rider.name), ['Beto', 'Ana', 'Caro']);
  assert.equal(elite.rows[0].extraPasses, 1);
  assert.equal(fmtDuration(elite.rows[0].total), '01:14:00');
  assert.equal(fmtDuration(elite.rows[1].gap), '00:03:10');
  assert.equal(elite.rows[2].status, STATUS.RACING);
});

test('pasos antes de la salida se ignoran y sin pasos = SIN PASO', () => {
  const d = base(); d.laps = [lap(4, '08:10:00')];
  const inf = computeResults(d).find((g) => g.category.id === 'c2');
  assert.equal(inf.rows[0].status, STATUS.DNS);
});

test('datos ficticios generan podios completos y CSV válido', () => {
  const data = buildDemoData(new Date('2026-11-11T12:00:00Z').getTime());
  const event = data.events[0];
  const groups = computeResults({ event, ...data, eventCategories: data.event_categories });
  assert.ok(groups.length >= 10);
  assert.ok(groups.every((g) => g.rows.filter((r) => r.status === STATUS.FINAL).length >= 3));
  const csv = resultsToCSV(event, groups);
  assert.match(csv, /Tiempo oficial/);
});
