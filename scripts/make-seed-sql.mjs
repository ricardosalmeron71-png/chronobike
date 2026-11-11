// Genera supabase/seed.sql con los MISMOS datos ficticios del modo demo.
// Uso: npm run seed:sql
import { buildDemoData } from '../js/demo-data.js';

const d = buildDemoData(new Date('2026-11-11T17:20:00Z').getTime(), 2026); // semilla fija: el SQL es reproducible
// En la nube no existe el "simulador": todas las vueltas quedan registradas tal cual
const q = (v) => (v == null ? 'null' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
// Los IDs del demo no son UUID: generamos UUID deterministas a partir del texto
const map = new Map();
const uuid = (id) => {
  if (!map.has(id)) { const n = map.size + 1; map.set(id, `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`); }
  return map.get(id);
};
const rows = (table, cols, list) => list.length ? `insert into public.${table} (${cols.join(', ')}) values\n${list.map((r) => '  (' + cols.map((c) => (c.endsWith('id') && r[c] ? q(uuid(r[c])) : q(r[c]))).join(', ') + ')').join(',\n')}\non conflict do nothing;\n` : '';

console.log(`-- ChronoBike · DATOS FICTICIOS de demostración (generado por scripts/make-seed-sql.mjs)
-- Ejecuta DESPUÉS de schema.sql. Para borrarlos: delete from public.events; delete from public.riders; delete from public.teams; delete from public.categories;
begin;
${rows('categories', ['id', 'name', 'laps', 'color', 'sort'], d.categories)}
${rows('teams', ['id', 'name'], d.teams)}
${rows('riders', ['id', 'dorsal', 'name', 'category_id', 'team_id'], d.riders)}
${rows('events', ['id', 'name', 'location', 'date', 'start_at', 'lap_km', 'status'], d.events)}
${rows('event_categories', ['id', 'event_id', 'category_id', 'laps', 'start_at'], d.event_categories)}
${rows('laps', ['id', 'event_id', 'dorsal', 'ts'], d.laps)}
commit;`);
