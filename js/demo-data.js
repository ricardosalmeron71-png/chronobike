// Generador de DATOS FICTICIOS para el modo demostración.
// Todos los nombres, equipos y tiempos son inventados.
//
//  · Cada vez que se genera, usa una SEMILLA ALEATORIA distinta → corredores, equipos,
//    cantidades, tiempos, sedes y fechas cambian en cada demo.
//  · La carrera "en vivo" se alinea para estar siempre al 50 % de avance: justo la
//    mitad de sus pasos por meta ya ocurrió y la otra mitad va apareciendo sola.
//  · Pruebas y capturas pasan una semilla fija para obtener siempre lo mismo.

function rng(seed) { // mulberry32
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const randomSeed = () => (typeof crypto !== 'undefined' && crypto.getRandomValues
  ? crypto.getRandomValues(new Uint32Array(1))[0] : Math.floor(Math.random() * 2 ** 32));
const uid = (p, n) => `${p}-${String(n).padStart(4, '0')}-demo`;

const CATEGORIES = [
  // nombre, vueltas, color, min/vuelta base, desfase de salida (min), corredores base
  ['Élite Varonil', 4, '#ff5a1f', 22, 0, 6],
  ['Avanzado Varonil', 3, '#f59e0b', 25, 0, 9],
  ['Avanzado Femenil', 2, '#ec4899', 29, 5, 5],
  ['Intermedio Varonil', 2, '#3b82f6', 29, 5, 10],
  ['Intermedio Femenil', 2, '#a855f7', 33, 5, 6],
  ['Master 50+ Varonil', 2, '#14b8a6', 31, 10, 8],
  ['Juvenil Varonil (15-18)', 2, '#22c55e', 28, 10, 7],
  ['Juvenil Mixto (12-14)', 1, '#84cc16', 34, 15, 6],
  ['Principiantes Varonil', 1, '#06b6d4', 36, 15, 9],
  ['Principiantes Femenil', 1, '#f43f5e', 40, 15, 5],
  ['Infantil Mixto (9-11)', 1, '#eab308', 22, 20, 7],
  ['Infantil Mixto (5-8)', 1, '#fb923c', 12, 20, 6],
];

const TEAMS = ['Halcones MTB', 'Coyotes Racing', 'Sierra Bikers', 'Desierto Pedal', 'Cactus Cycling', 'Lobos Endurance',
  'Club Bacanora', 'Ruta Norte', 'Escuela de Ciclismo Pitic', 'Pedal Fuerte', 'Trail Sonora', 'Saguaro Bike Team',
  'Águilas del Mayo', 'Dunas Bike Club', 'Cerro Prieto MTB', 'Raíces Cycling', 'Tierra Roja Racing', 'Cañón Rider',
  'Mezquite Pedal', 'Cumbre Norte', 'Los Tecolotes', 'Polvo y Cadena', 'Alta Sierra Team', 'Chaparral Racing'];

const FIRST_M = ['Diego', 'Luis', 'Carlos', 'Jorge', 'Andrés', 'Mateo', 'Santiago', 'Emiliano', 'Raúl', 'Héctor', 'Iván', 'Óscar',
  'Ramón', 'Fernando', 'Gael', 'Julián', 'Sebastián', 'Arturo', 'Manuel', 'Tomás', 'Rodrigo', 'Pablo', 'Eduardo', 'Marco',
  'Alonso', 'Bruno', 'Cristian', 'Dante', 'Esteban', 'Federico', 'Gustavo', 'Ignacio', 'Joaquín', 'Leonel', 'Mauricio', 'Nicolás'];
const FIRST_F = ['Ana', 'Lucía', 'Valeria', 'Sofía', 'Camila', 'Regina', 'Daniela', 'Fernanda', 'Mariana', 'Paola', 'Ximena', 'Renata',
  'Abril', 'Brenda', 'Carolina', 'Dalia', 'Elena', 'Frida', 'Giselle', 'Itzel', 'Jimena', 'Karla', 'Laura', 'Monserrat'];
const LAST = ['Valenzuela', 'Moreno', 'Quintero', 'Barrios', 'Encinas', 'Cota', 'Duarte', 'Leyva', 'Ochoa', 'Félix', 'Ibarra',
  'Gastélum', 'Robles', 'Salazar', 'Urías', 'Navarro', 'Peralta', 'Acosta', 'Corral', 'Bojórquez', 'Arvizu', 'Mendívil',
  'Amaya', 'Beltrán', 'Camacho', 'Domínguez', 'Escalante', 'Figueroa', 'Grijalva', 'Holguín', 'Islas', 'Jaime', 'Lugo', 'Murrieta'];

// Sedes y nombres de la carrera "en vivo" (se elige una distinta cada vez)
const LIVE_EVENTS = [
  ['Gran Fondo Desierto MTB', 'Parque Johnson, Hermosillo'], ['Copa Sierra Alta', 'Sierra de Ures, Sonora'],
  ['Vuelta al Cerro Colorado', 'Cerro Colorado, Hermosillo'], ['Reto Bahía MTB', 'Bahía de Kino, Sonora'],
  ['Desafío del Mezquite', 'Pueblo de Álamos, Sonora'], ['Circuito Las Dunas', 'San Carlos, Guaymas'],
  ['Trofeo Cañón del Sol', 'Cañón del Nacapule, Sonora'], ['Maratón Río Sonora', 'Banámichi, Sonora'],
];
const LOCATIONS = ['Cerro Colorado, Hermosillo', 'La Sauceda, Hermosillo', 'Parque Johnson, Hermosillo', 'Bahía de Kino, Sonora',
  'Sierra de Ures, Sonora', 'San Carlos, Guaymas', 'Pueblo de Álamos, Sonora', 'Cajeme, Sonora'];

export function buildDemoData(now = Date.now(), seed = randomSeed()) {
  const r = rng(seed);
  const pick = (a) => a[Math.floor(r() * a.length)];
  const rnd = (lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
  const shuffle = (a) => { const x = [...a]; for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; };

  const categories = CATEGORIES.map(([name, laps, color], i) => ({ id: uid('cat', i + 1), name, laps, color, sort: i + 1 }));
  // 11 a 14 equipos al azar + "Libre"
  const teamNames = [...shuffle(TEAMS).slice(0, rnd(11, 14)), 'Libre'];
  const teams = teamNames.map((name, i) => ({ id: uid('team', i + 1), name }));

  // 70 a 95 corredores aprox., repartidos en categorías
  const riders = []; let dorsal = 1;
  CATEGORIES.forEach(([catName, , , , , base], ci) => {
    const count = Math.max(4, base + rnd(-1, 2));
    const fem = /Femenil/.test(catName);
    for (let k = 0; k < count; k++) {
      const first = fem ? pick(FIRST_F) : (/Mixto/.test(catName) && r() < 0.4 ? pick(FIRST_F) : pick(FIRST_M));
      const name = `${first} ${pick(LAST)} ${pick(LAST)}`;
      const team = r() < 0.12 ? teams[teams.length - 1] : teams[Math.floor(r() * (teams.length - 1))];
      riders.push({ id: uid('rider', dorsal), dorsal, name, category_id: categories[ci].id, team_id: team.id, photo_url: null,
        _skill: 0.88 + r() * 0.36 });
      dorsal++;
    }
  });

  // ── Eventos (fechas relativas a hoy) ──
  const localDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const dayAt = (offsetDays, h, m) => { const d = new Date(now); d.setDate(d.getDate() + offsetDays); d.setHours(h, m, 0, 0); return d; };
  const past1 = dayAt(-rnd(45, 65), 8, rnd(0, 3) * 15), past2 = dayAt(-rnd(14, 28), rnd(7, 9), rnd(0, 3) * 15);
  const upcoming = dayAt(rnd(7, 16), 8, rnd(0, 3) * 15);
  const [liveName, liveLoc] = pick(LIVE_EVENTS);
  const stage = (d, n, extra = '') => `Serial MTB ${d.getFullYear()} · ${n}ª etapa${extra}`;

  const events = [
    { id: uid('evt', 1), name: stage(past1, 4), location: pick(LOCATIONS), date: localDate(past1), start_at: past1.toISOString(),
      lap_km: +(6 + r() * 4).toFixed(1), status: 'finalizado' },
    { id: uid('evt', 2), name: stage(past2, 5), location: pick(LOCATIONS), date: localDate(past2), start_at: past2.toISOString(),
      lap_km: +(6 + r() * 4).toFixed(1), status: 'finalizado' },
    // La hora de salida del evento en vivo se calcula más abajo (para quedar al 50 %)
    { id: uid('evt', 3), name: liveName, location: liveLoc, date: localDate(new Date(now)), start_at: null,
      lap_km: +(5.5 + r() * 3).toFixed(1), status: 'en_curso', _live: true },
    { id: uid('evt', 4), name: stage(upcoming, 6, ' (Final)'), location: pick(LOCATIONS), date: localDate(upcoming), start_at: upcoming.toISOString(),
      lap_km: +(7 + r() * 3).toFixed(1), status: 'proximo' },
  ];

  // ── Salidas y pasos por meta ──
  const event_categories = []; const laps = []; let lapN = 1, ecN = 1;
  let liveFirstEc = 0, liveFirstLap = 0;
  events.slice(0, 3).forEach((ev) => {
    const live = !!ev._live;
    // En vivo se genera "relativo" (t = 0 es la salida) y luego se desplaza al momento correcto
    const base = live ? 0 : new Date(ev.start_at).getTime();
    if (live) { liveFirstEc = event_categories.length; liveFirstLap = laps.length; }
    const kmFactor = ev.lap_km / 8;
    categories.forEach((cat, ci) => {
      const startAt = base + CATEGORIES[ci][4] * 60000;
      event_categories.push({ id: uid('ec', ecN++), event_id: ev.id, category_id: cat.id, laps: cat.laps, start_at: new Date(startAt).toISOString() });
      riders.filter((x) => x.category_id === cat.id).forEach((rd, idx) => {
        // En eventos terminados, los 3 primeros de cada categoría siempre terminan (podios completos);
        // el resto puede no presentarse o abandonar
        const forced = !live && idx < 3;
        if (!forced && r() < 0.06) return; // no se presentó
        const dnfAfter = !forced && r() < 0.05 ? 1 : 99;
        let t = startAt;
        for (let lap = 1; lap <= Math.min(cat.laps, dnfAfter); lap++) {
          const minutes = CATEGORIES[ci][3] * kmFactor * rd._skill * (0.95 + r() * 0.1) * (lap === 1 ? 1.03 : 1);
          t += Math.round(minutes * 60000 + r() * 1000);
          laps.push({ id: uid('lap', lapN++), event_id: ev.id, dorsal: rd.dorsal, ts: new Date(t).toISOString(),
            created_at: new Date(t + 1500).toISOString(), sim: live });
        }
      });
    });
  });

  // ── Carrera en vivo al 50 %: la mediana de sus pasos cae exactamente en "ahora" ──
  const liveLaps = laps.slice(liveFirstLap);
  const times = liveLaps.map((l) => Date.parse(l.ts)).sort((a, b) => a - b);
  const shift = now - times[Math.floor(times.length / 2)];
  const move = (iso) => new Date(Date.parse(iso) + shift).toISOString();
  const live = events.find((e) => e._live);
  live.start_at = new Date(shift).toISOString();
  live.date = localDate(new Date(shift));
  event_categories.slice(liveFirstEc, liveFirstEc + categories.length).forEach((ec) => { ec.start_at = move(ec.start_at); });
  liveLaps.forEach((l) => { l.ts = move(l.ts); l.created_at = move(l.created_at); });

  riders.forEach((x) => delete x._skill);
  events.forEach((x) => delete x._live);
  return { events, categories, teams, riders, event_categories, laps, meta: { seed, seededAt: now } };
}
