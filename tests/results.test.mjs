// Pruebas del motor de resultados:  node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeResults, fmtDuration, resultsToCSV, STATUS, eventSummary } from '../js/results.js';
import { buildDemoData, randomSeed } from '../js/demo-data.js';

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
  const data = buildDemoData(new Date('2026-11-11T12:00:00Z').getTime(), 2026);
  const event = data.events[0];
  const groups = computeResults({ event, ...data, eventCategories: data.event_categories });
  assert.ok(groups.length >= 10);
  assert.ok(groups.every((g) => g.rows.filter((r) => r.status === STATUS.FINAL).length >= 3));
  // y con cualquier semilla, los eventos terminados tienen podio completo en todas las categorías
  for (let i = 0; i < 15; i++) {
    const dd = buildDemoData(new Date('2026-11-11T12:00:00Z').getTime(), randomSeed());
    for (const ev of dd.events.filter((x) => x.status === 'finalizado')) {
      const gs = computeResults({ event: ev, ...dd, eventCategories: dd.event_categories });
      assert.ok(gs.every((g) => g.rows.filter((r) => r.status === STATUS.FINAL).length >= 3));
    }
  }
  const csv = resultsToCSV(event, groups);
  assert.match(csv, /Tiempo oficial/);
});

test('velocidad promedio = km recorridos / tiempo (requiere km por vuelta en el evento)', () => {
  const d = base(); d.event.lap_km = 8;
  d.laps = [lap(1, '08:25:00'), lap(1, '08:51:30'), lap(1, '09:17:10')]; // 3 vueltas · 24 km · 1:17:10
  const ana = computeResults(d)[0].rows[0];
  assert.equal(ana.speed.toFixed(1), '18.7');
  d.event.lap_km = null;
  assert.equal(computeResults(d)[0].rows[0].speed, null);
});

test('al cerrar el evento, quien se quedó en pista pasa a DNF (no EN PISTA)', () => {
  const d = base();
  d.laps = [
    lap(1, '08:25:00'), lap(1, '08:51:30'), lap(1, '09:17:10'), // Ana: termina sus 3 vueltas
    lap(2, '08:24:00'), lap(2, '08:49:00'), // Beto: solo 2 de 3, se queda en pista
  ];
  // Mientras el evento sigue activo, Beto está EN PISTA
  let [elite] = computeResults(d);
  let beto = elite.rows.find((r) => r.rider.name === 'Beto');
  assert.equal(beto.status, STATUS.RACING);

  // Al finalizar el evento, Beto pasa a DNF y no afecta el podio de quien sí terminó
  d.event.status = 'finalizado';
  [elite] = computeResults(d);
  const ana = elite.rows.find((r) => r.rider.name === 'Ana');
  beto = elite.rows.find((r) => r.rider.name === 'Beto');
  assert.equal(ana.status, STATUS.FINAL);
  assert.equal(beto.status, STATUS.DNF);
  assert.equal(beto.position, 2); // sigue abajo de quien terminó, por orden de vueltas
});

test('un evento finalizado sin nadie en meta reporta DNF en el resumen', () => {
  const d = base(); d.event.status = 'finalizado';
  d.laps = [lap(2, '08:24:00'), lap(2, '08:49:00')]; // Beto: 2 de 3, nunca terminó
  const groups = computeResults(d);
  const sum = eventSummary(groups);
  assert.equal(sum.dnf, 1);
  assert.equal(sum.finished, 0);
  assert.equal(sum.racing, 0);
});

test('demo: cada generación es distinta y la carrera en vivo siempre está al 50 %', () => {
  const NOW = new Date('2026-11-11T17:20:00Z').getTime();
  const seen = new Set(); const names = new Set();
  for (let i = 0; i < 25; i++) {
    const d = buildDemoData(NOW, randomSeed());
    const live = d.events.find((e) => e.status === 'en_curso');
    const lapsLive = d.laps.filter((l) => l.event_id === live.id);
    const done = lapsLive.filter((l) => Date.parse(l.ts) <= NOW).length;
    const pct = done / lapsLive.length;
    assert.ok(pct >= 0.48 && pct <= 0.54, `avance ${pct}`);                     // ~50 %
    assert.ok(Date.parse(live.start_at) < NOW);                                  // ya salió
    assert.ok(d.event_categories.filter((x) => x.event_id === live.id).every((x) => Date.parse(x.start_at) <= NOW)); // todas ya salieron
    assert.ok(d.riders.length >= 55 && d.riders.length <= 110);
    seen.add(d.riders.map((r) => r.name).join('|')); names.add(live.name);
    // los pasos de eventos finalizados no se alteran: todo en el pasado
    const past = d.events.filter((e) => e.status === 'finalizado').map((e) => e.id);
    assert.ok(d.laps.filter((l) => past.includes(l.event_id)).every((l) => Date.parse(l.ts) < NOW));
  }
  assert.equal(seen.size, 25);   // 25 demos, 25 listas de corredores distintas
  assert.ok(names.size > 1);     // y no siempre la misma carrera
});

test('demo: con la misma semilla es reproducible', () => {
  const NOW = new Date('2026-11-11T17:20:00Z').getTime();
  assert.deepEqual(buildDemoData(NOW, 7), buildDemoData(NOW, 7));
  assert.notDeepEqual(buildDemoData(NOW, 7).riders, buildDemoData(NOW, 8).riders);
});
