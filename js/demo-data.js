// Generador de DATOS FICTICIOS para el modo demostración.
// Todos los nombres, equipos y tiempos son inventados.

function rng(seed) { // mulberry32 determinista
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const uid = (p, n) => `${p}-${String(n).padStart(4, '0')}-demo`;

const CATEGORIES = [
  // nombre, vueltas, color, min/vuelta base, desfase de salida (min)
  ['Élite Varonil', 4, '#ff5a1f', 22, 0],
  ['Avanzado Varonil', 3, '#f59e0b', 25, 0],
  ['Avanzado Femenil', 2, '#ec4899', 29, 5],
  ['Intermedio Varonil', 2, '#3b82f6', 29, 5],
  ['Intermedio Femenil', 2, '#a855f7', 33, 5],
  ['Master 50+ Varonil', 2, '#14b8a6', 31, 10],
  ['Juvenil Varonil (15-18)', 2, '#22c55e', 28, 10],
  ['Juvenil Mixto (12-14)', 1, '#84cc16', 34, 15],
  ['Principiantes Varonil', 1, '#06b6d4', 36, 15],
  ['Principiantes Femenil', 1, '#f43f5e', 40, 15],
  ['Infantil Mixto (9-11)', 1, '#eab308', 22, 20],
  ['Infantil Mixto (5-8)', 1, '#fb923c', 12, 20],
];

const TEAMS = ['Halcones MTB', 'Coyotes Racing', 'Sierra Bikers', 'Desierto Pedal', 'Cactus Cycling', 'Lobos Endurance',
  'Club Bacanora', 'Ruta Norte', 'Escuela de Ciclismo Pitic', 'Pedal Fuerte', 'Trail Sonora', 'Saguaro Bike Team', 'Libre'];

const FIRST_M = ['Diego', 'Luis', 'Carlos', 'Jorge', 'Andrés', 'Mateo', 'Santiago', 'Emiliano', 'Raúl', 'Héctor', 'Iván', 'Óscar',
  'Ramón', 'Fernando', 'Gael', 'Julián', 'Sebastián', 'Arturo', 'Manuel', 'Tomás', 'Rodrigo', 'Pablo', 'Eduardo', 'Marco'];
const FIRST_F = ['Ana', 'Lucía', 'Valeria', 'Sofía', 'Camila', 'Regina', 'Daniela', 'Fernanda', 'Mariana', 'Paola', 'Ximena', 'Renata'];
const LAST = ['Valenzuela', 'Moreno', 'Quintero', 'Barrios', 'Encinas', 'Cota', 'Duarte', 'Leyva', 'Ochoa', 'Félix', 'Ibarra',
  'Gastélum', 'Robles', 'Salazar', 'Urías', 'Navarro', 'Peralta', 'Acosta', 'Corral', 'Bojórquez', 'Arvizu', 'Mendívil'];

export function buildDemoData(now = Date.now()) {
  const r = rng(2026);
  const pick = (a) => a[Math.floor(r() * a.length)];

  const categories = CATEGORIES.map(([name, laps, color], i) => ({ id: uid('cat', i + 1), name, laps, color, sort: i + 1 }));
  const teams = TEAMS.map((name, i) => ({ id: uid('team', i + 1), name }));

  // 84 corredores repartidos en categorías
  const perCat = [6, 9, 5, 10, 6, 8, 7, 6, 9, 5, 7, 6];
  const riders = []; let dorsal = 1;
  perCat.forEach((count, ci) => {
    const fem = /Femenil/.test(CATEGORIES[ci][0]);
    for (let k = 0; k < count; k++) {
      const first = fem ? pick(FIRST_F) : (/Mixto/.test(CATEGORIES[ci][0]) && r() < 0.4 ? pick(FIRST_F) : pick(FIRST_M));
      const name = `${first} ${pick(LAST)} ${pick(LAST)}`;
      const team = r() < 0.12 ? teams[teams.length - 1] : teams[Math.floor(r() * (teams.length - 1))];
      riders.push({ id: uid('rider', dorsal), dorsal, name, category_id: categories[ci].id, team_id: team.id, photo_url: null,
        _skill: 0.9 + r() * 0.32 });
      dorsal++;
    }
  });

  const day = (iso) => new Date(iso);
  const liveStart = new Date(now - 56 * 60000); liveStart.setSeconds(0, 0);
  const upcoming = new Date(now + 9 * 86400000); upcoming.setHours(8, 0, 0, 0);
  const localDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const events = [
    { id: uid('evt', 1), name: 'Serial MTB 2026 · 4ª etapa', location: 'Cerro Colorado, Hermosillo', date: '2026-09-13',
      start_at: day('2026-09-13T08:00:00-07:00').toISOString(), lap_km: 8.5, status: 'finalizado' },
    { id: uid('evt', 2), name: 'Serial MTB 2026 · 5ª etapa', location: 'La Sauceda, Hermosillo', date: '2026-10-18',
      start_at: day('2026-10-18T08:30:00-07:00').toISOString(), lap_km: 7.2, status: 'finalizado' },
    { id: uid('evt', 3), name: 'Gran Fondo Desierto MTB', location: 'Parque Johnson, Hermosillo', date: localDate(liveStart),
      start_at: liveStart.toISOString(), lap_km: 6.8, status: 'en_curso', _live: true },
    { id: uid('evt', 4), name: 'Serial MTB 2026 · 6ª etapa (Final)', location: 'Bahía de Kino, Sonora', date: localDate(upcoming),
      start_at: upcoming.toISOString(), lap_km: 9, status: 'proximo' },
  ];

  const event_categories = []; const laps = []; let lapN = 1, ecN = 1;
  events.slice(0, 3).forEach((ev, ei) => {
    const base = new Date(ev.start_at).getTime();
    const kmFactor = ev.lap_km / 8;
    categories.forEach((cat, ci) => {
      const startAt = new Date(base + CATEGORIES[ci][4] * 60000).toISOString();
      event_categories.push({ id: uid('ec', ecN++), event_id: ev.id, category_id: cat.id, laps: cat.laps, start_at: startAt });
      riders.filter((x) => x.category_id === cat.id).forEach((rd) => {
        if (r() < 0.06) return; // no se presentó
        const dnfAfter = r() < 0.05 ? 1 : 99;
        let t = new Date(startAt).getTime();
        for (let lap = 1; lap <= Math.min(cat.laps, dnfAfter); lap++) {
          const minutes = CATEGORIES[ci][3] * kmFactor * rd._skill * (0.95 + r() * 0.1) * (lap === 1 ? 1.03 : 1);
          t += Math.round(minutes * 60000 + r() * 1000);
          laps.push({ id: uid('lap', lapN++), event_id: ev.id, dorsal: rd.dorsal, ts: new Date(t).toISOString(),
            created_at: new Date(t + 1500).toISOString(), sim: !!ev._live });
        }
      });
    });
  });

  riders.forEach((x) => delete x._skill);
  events.forEach((x) => delete x._live);
  return { events, categories, teams, riders, event_categories, laps };
}
