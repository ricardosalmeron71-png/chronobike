// Pruebas de la importación masiva de pasos:  npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLine, parseLaps, detectFormat } from '../js/lapimport.js';

process.env.TZ = 'America/Hermosillo';
const local = (iso) => new Date(iso).toLocaleString('sv-SE', { timeZone: 'America/Hermosillo' }); // "2026-11-01 07:34:46"

const SAMPLE = `11/1/2026 7:34:46\t103
11/1/2026 7:34:51\t194
11/1/2026 7:35:47\t35
11/1/2026 9:57:16\t272necesito cargar esos datos`.split('\n');

test('lee "fecha hora<TAB>dorsal" del cronómetro externo', () => {
  const p = parseLine('11/1/2026 7:34:46\t103');
  assert.deepEqual(p.date, ['11', '1', '2026']);
  assert.equal(p.dorsal, 103);
  assert.deepEqual(p.time, { h: 7, m: 34, s: 46, ms: 0 });
});

test('11/1/2026 se interpreta como 1 de noviembre cuando el evento es el 1 de noviembre', () => {
  const r = parseLaps(SAMPLE, { eventDate: '2026-11-01' });
  assert.equal(r.format, 'mdy');
  assert.equal(r.ok.length, 3);
  assert.equal(local(r.ok[0].ts), '2026-11-01 07:34:46');
  assert.equal(r.ok[0].dorsal, 103);
  assert.equal(r.bad.length, 1); // la línea con texto pegado se reporta, no se adivina
});

test('y como 11 de enero si el evento es el 11 de enero', () => {
  const r = parseLaps(['11/1/2026 7:34:46\t103'], { eventDate: '2026-01-11' });
  assert.equal(r.format, 'dmy');
  assert.equal(local(r.ok[0].ts), '2026-01-11 07:34:46');
});

test('si una fecha solo es válida de un modo, se usa ese', () => {
  assert.equal(detectFormat([parseLine('25/10/2026 08:00:00 5')], '2026-11-01'), 'dmy');
  assert.equal(detectFormat([parseLine('10/25/2026 08:00:00 5')], '2026-11-01'), 'mdy');
});

test('otros formatos: ISO, dorsal primero, a. m./p. m., solo hora, separadores', () => {
  const r = parseLaps([
    '2026-11-01 07:34:46,103',
    '194;11/01/2026 07:34:51',
    '11/01/2026 1:05:10 p. m. 35',
    '9:12:10 43',
    '#69 | 7:37:27',
    'Fecha\tDorsal',
  ], { eventDate: '2026-11-01', format: 'mdy' });
  assert.deepEqual(r.ok.map((x) => [x.dorsal, local(x.ts).slice(11)]),
    [[103, '07:34:46'], [194, '07:34:51'], [69, '07:37:27'], [43, '09:12:10'], [35, '13:05:10']]);
  assert.equal(r.bad.length, 1); // encabezado
});

test('no duplica pasos ya cargados ni repetidos en el mismo archivo', () => {
  const first = parseLaps(SAMPLE.slice(0, 3), { eventDate: '2026-11-01' });
  const again = parseLaps([...SAMPLE.slice(0, 3), SAMPLE[0]], { eventDate: '2026-11-01', existing: first.ok });
  assert.equal(again.ok.length, 0);
  assert.equal(again.dup.length, 4);
});
