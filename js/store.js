// Capa de datos. Dos modos con la MISMA interfaz:
//   · demo  → datos ficticios en localStorage (sin servidor, ideal para probar y capacitar)
//   · cloud → Supabase (PostgreSQL + Auth + Realtime)
import { CONFIG } from './config.js';
import { buildDemoData } from './demo-data.js';

const TABLES = ['events', 'categories', 'teams', 'riders', 'event_categories'];
const DEMO_KEY = 'chronobike_demo_v2';
const QUEUE_KEY = 'chronobike_queue_v2';
const SESSION_KEY = 'chronobike_demo_session';
const USERS_KEY = 'chronobike_demo_users';
// Las cuentas del staff usan un NOMBRE DE USUARIO (ej. "juan"). Supabase exige un
// correo, así que por dentro se guarda como "juan@chronobike.local" (nunca se envían correos).
export const USER_DOMAIN = 'chronobike.local';
export function toLogin(user) {
  const s = String(user || '').trim().toLowerCase();
  if (s.includes('@')) return s; // cuentas antiguas creadas con correo
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '.') + '@' + USER_DOMAIN;
}
export const displayUser = (email) => String(email || '').replace('@' + USER_DOMAIN, '');
export function checkUsername(user) {
  const s = String(user || '').trim();
  if (s.includes('@')) return;
  const n = s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (!/^[a-z0-9._-]{3,30}$/.test(n)) throw new Error('El usuario debe tener de 3 a 30 caracteres: letras, números, punto, guion o guion bajo (sin espacios)');
}
const newId = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2));
const byName = (a, b) => (a.sort ?? 999) - (b.sort ?? 999) || String(a.name).localeCompare(String(b.name), 'es');

// Interruptor del modo demo:  ?demo=1 lo activa (y se recuerda en este navegador), ?demo=0 lo apaga.
// Así se puede practicar en la página real sin tocar la base de datos.
const DEMO_FLAG = 'chronobike_force_demo';
const HAS_CLOUD = !!(CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY);
(function readDemoSwitch() {
  if (typeof location === 'undefined') return;
  const q = new URLSearchParams(location.search);
  if (!q.has('demo')) return;
  if (q.get('demo') === '0') localStorage.removeItem(DEMO_FLAG); else localStorage.setItem(DEMO_FLAG, '1');
  q.delete('demo'); history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : '') + location.hash);
})();
export const FORCED_DEMO = HAS_CLOUD && typeof localStorage !== 'undefined' && localStorage.getItem(DEMO_FLAG) === '1';
export const exitDemoLink = (page) => `./${page}?demo=0`;

const listeners = new Set();
const emit = (what) => listeners.forEach((fn) => { try { fn(what); } catch (e) { console.error(e); } });

export const store = {
  mode: HAS_CLOUD && !FORCED_DEMO ? 'cloud' : 'demo',
  data: { events: [], categories: [], teams: [], riders: [], event_categories: [] },
  user: null,
  sb: null,

  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },

  async init(onProgress = () => {}) {
    if (this.mode === 'cloud') await cloud.init(this, onProgress); else { demo.init(this); onProgress(0.6, 'Datos de demostración listos'); }
    sortAll(this.data);
    return this;
  },
  async refresh() { if (this.mode === 'cloud') await cloud.loadAll(this); else demo.load(this); sortAll(this.data); },

  // ── Autenticación ──
  async signIn(user, password) { const email = toLogin(user); this.user = await (this.mode === 'cloud' ? cloud.signIn(this, email, password) : demo.signIn(email, password)); return this.user; },
  async signOut() { if (this.mode === 'cloud') await this.sb.auth.signOut(); else localStorage.removeItem(SESSION_KEY); this.user = null; },
  isAdmin() { return this.user?.role === 'admin'; },

  // ── Cuentas del staff (se crean desde la app) ──
  /** ¿Ya existe al menos un administrador? Si no, la app ofrece crear el primero. */
  async staffStatus() { return this.mode === 'cloud' ? cloud.staff(this, 'status') : { hasAdmin: true }; },
  async bootstrapAdmin(user, password) {
    checkUsername(user);
    if (this.mode === 'cloud') await cloud.staff(this, 'bootstrap', { email: toLogin(user), password });
    return this.signIn(user, password);
  },
  async listStaff() { return (this.mode === 'cloud' ? await cloud.staff(this, 'list') : demo.staff('list')).users; },
  async createStaff(user, password, role) { checkUsername(user); const email = toLogin(user); return this.mode === 'cloud' ? cloud.staff(this, 'create', { email, password, role }) : demo.staff('create', { email, password, role }); },
  async setStaffRole(user_id, role) { return this.mode === 'cloud' ? cloud.staff(this, 'set_role', { user_id, role }) : demo.staff('set_role', { user_id, role }); },
  async resetStaffPassword(user_id, password) { return this.mode === 'cloud' ? cloud.staff(this, 'reset_password', { user_id, password }) : demo.staff('reset_password', { user_id, password }); },
  async deleteStaff(user_id) { return this.mode === 'cloud' ? cloud.staff(this, 'delete', { user_id }) : demo.staff('delete', { user_id }); },

  // ── CRUD genérico ──
  async save(table, row) {
    const rec = { ...row }; if (!rec.id) rec.id = newId();
    if (this.mode === 'cloud') await cloud.save(this, table, rec); else demo.save(this, table, rec);
    const list = this.data[table]; const i = list.findIndex((x) => x.id === rec.id);
    if (i >= 0) list[i] = { ...list[i], ...rec }; else list.push(rec);
    sortAll(this.data); emit(table); return rec;
  },
  async remove(table, id) {
    if (this.mode === 'cloud') await cloud.remove(this, table, id); else demo.remove(this, table, id);
    this.data[table] = this.data[table].filter((x) => x.id !== id); emit(table);
  },
  /** Guarda la salida/vueltas de una categoría dentro de un evento. */
  async saveEventCategory(eventId, categoryId, patch) {
    const cur = this.data.event_categories.find((x) => x.event_id === eventId && x.category_id === categoryId);
    return this.save('event_categories', { ...(cur || { event_id: eventId, category_id: categoryId }), ...patch });
  },
  /** Busca un equipo por nombre (sin importar mayúsculas/espacios) o lo crea. */
  async ensureTeam(name) {
    const clean = String(name || '').trim().replace(/\s+/g, ' ');
    if (!clean) return null;
    const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const hit = this.data.teams.find((t) => norm(t.name) === norm(clean));
    return hit || this.save('teams', { name: clean });
  },

  // ── Vueltas ──
  async getLaps(eventId) {
    return this.mode === 'cloud' ? cloud.getLaps(this, eventId) : demo.getLaps(eventId);
  },
  async addLap(eventId, dorsal, ts = new Date().toISOString()) {
    const lap = { id: newId(), event_id: eventId, dorsal: Number(dorsal), ts };
    if (this.mode === 'cloud') await cloud.addLap(this, lap); else demo.addLap(lap);
    emit('laps'); return lap;
  },
  async removeLap(id) {
    if (this.mode === 'cloud') { queue.drop(id); await cloud.remove(this, 'laps', id); } else demo.removeLap(id);
    emit('laps');
  },
  /** Alta masiva de pasos (importación). list = [{dorsal, ts}] */
  async addLaps(eventId, list, onProgress = () => {}) {
    const rows = list.map((l) => ({ id: newId(), event_id: eventId, dorsal: Number(l.dorsal), ts: l.ts }));
    if (this.mode === 'cloud') {
      for (let i = 0; i < rows.length; i += 500) {
        const { error } = await this.sb.from('laps').insert(rows.slice(i, i + 500));
        if (error) throw new Error('No se pudieron guardar los pasos: ' + error.message);
        onProgress(Math.min(rows.length, i + 500), rows.length);
      }
    } else { demo.db.laps.push(...rows.map((r) => ({ ...r, created_at: new Date().toISOString() }))); demo.persist(); }
    emit('laps'); return rows.length;
  },
  pending() { return queue.all().length; },

  /** Guarda muchos registros de una vez (en bloques), para importaciones rápidas. */
  async saveMany(table, rows) {
    if (!rows.length) return;
    if (this.mode === 'cloud') { for (let i = 0; i < rows.length; i += 400) await cloud.saveMany(this, table, rows.slice(i, i + 400)); }
    else demo.saveMany(table, rows);
    const list = this.data[table];
    for (const rec of rows) { const i = list.findIndex((x) => x.id === rec.id); if (i >= 0) list[i] = { ...list[i], ...rec }; else list.push(rec); }
    sortAll(this.data); emit(table);
  },

  // ── Importación masiva (Excel) ──
  // Los datos se guardan TAL COMO VIENEN en el archivo: los equipos con distinta
  // escritura ("Zorros MTB" / "ZORROS MTB") se conservan como equipos distintos.
  async bulkImport({ categories = [], teams = [], riders = [] }, onProgress = () => {}) {
    const res = { categories: 0, teams: 0, riders: 0, skipped: 0 };
    const clean = (v) => String(v ?? '').trim().replace(/\s+/g, ' ');
    const catByName = new Map(this.data.categories.map((c) => [clean(c.name).toLowerCase(), c]));
    const newCats = [];
    const addCat = (name, laps) => {
      const k = clean(name).toLowerCase(); if (!k) return null;
      if (!catByName.has(k)) { const c = { id: newId(), name: clean(name), laps: Number(laps) || 1, color: randomColor(), sort: catByName.size + 1 }; catByName.set(k, c); newCats.push(c); }
      return catByName.get(k);
    };
    const teamByName = new Map(this.data.teams.map((t) => [clean(t.name), t])); // coincidencia EXACTA
    const newTeams = [];
    const addTeam = (name) => {
      const k = clean(name); if (!k) return null;
      if (!teamByName.has(k)) { const t = { id: newId(), name: k }; teamByName.set(k, t); newTeams.push(t); }
      return teamByName.get(k);
    };
    categories.forEach((c) => addCat(c.name, c.laps));
    teams.forEach((t) => addTeam(t.name));
    const byDorsal = new Map();
    for (const p of riders) {
      const dorsal = parseInt(p.dorsal, 10);
      if (!dorsal || !clean(p.name)) { res.skipped++; continue; }
      const cat = addCat(p.category, 1); const team = addTeam(p.team);
      const cur = this.data.riders.find((x) => Number(x.dorsal) === dorsal);
      byDorsal.set(dorsal, { ...(cur || { id: newId(), photo_url: null }), dorsal, name: clean(p.name), category_id: cat?.id || null, team_id: team?.id || null });
    }
    onProgress('Guardando categorías…'); await this.saveMany('categories', newCats);
    onProgress(`Guardando ${newTeams.length} equipos…`); await this.saveMany('teams', newTeams);
    onProgress(`Guardando ${byDorsal.size} corredores…`); await this.saveMany('riders', [...byDorsal.values()]);
    res.categories = newCats.length; res.teams = newTeams.length; res.riders = byDorsal.size;
    return res;
  },

  resetDemo() { localStorage.removeItem(DEMO_KEY); demo.init(this); sortAll(this.data); emit('all'); },
};

function sortAll(d) {
  d.events.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  d.categories.sort(byName); d.teams.sort(byName);
  d.riders.sort((a, b) => Number(a.dorsal) - Number(b.dorsal));
}
function randomColor() { const c = ['#ff5a1f', '#3b82f6', '#22c55e', '#a855f7', '#ec4899', '#14b8a6', '#eab308', '#06b6d4']; return c[Math.floor(Math.random() * c.length)]; }

// ═════════════════════════ MODO DEMO ═════════════════════════
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('chronobike') : null;
const demo = {
  db: null,
  init(s) {
    const raw = localStorage.getItem(DEMO_KEY);
    this.db = raw ? JSON.parse(raw) : buildDemoData();
    if (!raw) this.persist(false);
    this.load(s);
    const sess = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    s.user = sess;
    // Sincroniza entre pestañas (p. ej. vista pública abierta junto al panel de staff)
    channel && (channel.onmessage = () => { this.db = JSON.parse(localStorage.getItem(DEMO_KEY)); this.load(s); sortAll(s.data); emit('remote'); });
    // La carrera "en vivo" del demo avanza sola: las vueltas simuladas aparecen al llegar su hora
    setInterval(() => emit('tick'), 5000);
  },
  load(s) { for (const t of TABLES) s.data[t] = structuredClone(this.db[t] || []); },
  persist(notify = true) { localStorage.setItem(DEMO_KEY, JSON.stringify(this.db)); notify && channel?.postMessage('changed'); },
  save(s, table, rec) {
    const list = this.db[table]; const i = list.findIndex((x) => x.id === rec.id);
    if (table === 'riders' && list.some((x) => Number(x.dorsal) === Number(rec.dorsal) && x.id !== rec.id)) throw new Error(`El dorsal #${rec.dorsal} ya está asignado a otro corredor`);
    if (i >= 0) list[i] = { ...list[i], ...rec }; else list.push(rec);
    this.persist();
  },
  remove(s, table, id) { this.db[table] = this.db[table].filter((x) => x.id !== id); this.persist(); },
  saveMany(table, rows) {
    const list = this.db[table];
    for (const rec of rows) { const i = list.findIndex((x) => x.id === rec.id); if (i >= 0) list[i] = { ...list[i], ...rec }; else list.push(rec); }
    this.persist();
  },
  getLaps(eventId) { const now = Date.now(); return this.db.laps.filter((l) => l.event_id === eventId && (!l.sim || new Date(l.ts).getTime() <= now)); },
  addLap(lap) { this.db.laps.push({ ...lap, created_at: new Date().toISOString() }); this.persist(); },
  removeLap(id) { this.db.laps = this.db.laps.filter((l) => l.id !== id); this.persist(); },
  users() {
    const raw = localStorage.getItem(USERS_KEY);
    if (raw) return JSON.parse(raw);
    const seed = [
      { user_id: 'u-admin', email: 'admin@' + USER_DOMAIN, role: 'admin', password: 'demo', created_at: new Date().toISOString() },
      { user_id: 'u-registro', email: 'registro@' + USER_DOMAIN, role: 'registrador', password: 'demo', created_at: new Date().toISOString() },
    ];
    localStorage.setItem(USERS_KEY, JSON.stringify(seed)); return seed;
  },
  signIn(email, password) {
    const u = this.users().find((x) => x.email === String(email).trim().toLowerCase());
    if (!u || u.password !== password) throw new Error('Usuario o contraseña incorrectos. En el demo: admin / demo');
    const user = { id: u.user_id, email: u.email, role: u.role }; localStorage.setItem(SESSION_KEY, JSON.stringify(user)); u.last_sign_in_at = new Date().toISOString();
    localStorage.setItem(USERS_KEY, JSON.stringify(this.users().map((x) => (x.user_id === u.user_id ? u : x)))); return user;
  },
  staff(action, p = {}) {
    let list = this.users(); const me = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    const save = () => localStorage.setItem(USERS_KEY, JSON.stringify(list));
    const email = String(p.email || '').trim().toLowerCase();
    if ((p.user_id && p.user_id === me?.id) && ['set_role', 'delete'].includes(action)) throw new Error('No puedes hacer eso con tu propia cuenta');
    if (action === 'list') return { users: list.map(({ password, ...u }) => ({ ...u, me: u.user_id === me?.id })) };
    if (action === 'create') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Correo no válido');
      if (String(p.password).length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres');
      if (list.some((u) => u.email === email)) throw new Error('Ya existe ese usuario');
      list.push({ user_id: newId(), email, role: p.role, password: p.password, created_at: new Date().toISOString() });
    }
    if (action === 'set_role') list = list.map((u) => (u.user_id === p.user_id ? { ...u, role: p.role } : u));
    if (action === 'reset_password') {
      if (String(p.password).length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres');
      list = list.map((u) => (u.user_id === p.user_id ? { ...u, password: p.password } : u));
    }
    if (action === 'delete') list = list.filter((u) => u.user_id !== p.user_id);
    save(); return { ok: true };
  },
};

// ═════════════════════════ MODO NUBE (Supabase) ═════════════════════════
const queue = { // cola offline: las vueltas nunca se pierden aunque falle el internet
  all() { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); },
  set(v) { localStorage.setItem(QUEUE_KEY, JSON.stringify(v)); emit('queue'); },
  push(l) { this.set([...this.all(), l]); },
  drop(id) { this.set(this.all().filter((x) => x.id !== id)); },
};
const cloud = {
  async init(s, onProgress = () => {}) {
    onProgress(0.12, 'Conectando con la base de datos…');
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    s.sb = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
    const { data } = await s.sb.auth.getSession();
    if (data.session) { const p = await this.profile(s, data.session.user); if (p.role) s.user = p; else await s.sb.auth.signOut(); }
    onProgress(0.25, 'Cargando tablas…');
    await this.loadAll(s, onProgress);
    s.sb.channel('chronobike-live')
      .on('postgres_changes', { event: '*', schema: 'public' }, async (p) => {
        if (p.table !== 'laps') { await this.loadAll(s); sortAll(s.data); }
        emit(p.table);
      }).subscribe();
    const flush = () => this.flush(s);
    window.addEventListener('online', flush); setInterval(flush, 10000); flush();
  },
  async loadAll(s, onProgress = () => {}) {
    const NAMES = { events: 'eventos', categories: 'categorías', teams: 'equipos', riders: 'corredores', event_categories: 'salidas' };
    let n = 0;
    const res = await Promise.all(TABLES.map((t) => s.sb.from(t).select('*').then((r) => { n++; onProgress(0.25 + 0.55 * (n / TABLES.length), `Cargando ${NAMES[t]}…`); return r; })));
    res.forEach((r, i) => { if (r.error) throw r.error; s.data[TABLES[i]] = r.data; });
  },
  async profile(s, u) {
    const { data } = await s.sb.from('staff').select('role').eq('user_id', u.id).maybeSingle();
    return { email: u.email, id: u.id, role: data?.role || null };
  },
  async staff(s, action, payload = {}) {
    const { data, error } = await s.sb.functions.invoke('staff', { body: { action, ...payload } });
    if (error) {
      let msg = error.message; const status = error.context?.status;
      try { const b = await error.context.json(); if (b?.error) msg = b.error; } catch { /* sin cuerpo */ }
      if (status === 404 || /Failed to send|fetch/i.test(msg)) msg = 'Falta instalar la función "staff" en Supabase (ver docs/BASE_DE_DATOS_Y_DESPLIEGUE.md)';
      const err = new Error(msg); err.notInstalled = status === 404 || /Failed to send/i.test(error.message); throw err;
    }
    if (data?.error) throw new Error(data.error);
    return data;
  },
  async signIn(s, email, password) {
    const { data, error } = await s.sb.auth.signInWithPassword({ email, password });
    if (error) throw new Error(/invalid/i.test(error.message) ? 'Usuario o contraseña incorrectos' : 'No se pudo iniciar sesión: ' + error.message);
    const p = await this.profile(s, data.user);
    if (!p.role) { await s.sb.auth.signOut(); throw new Error('Tu usuario no está dado de alta como staff. Pide a un administrador que te agregue.'); }
    return p;
  },
  async save(s, table, rec) {
    const clean = Object.fromEntries(Object.entries(rec).filter(([k]) => !k.startsWith('_')));
    const { error } = await s.sb.from(table).upsert(clean);
    if (error) throw new Error(error.code === '23505' ? 'Ya existe un registro con ese dato (¿dorsal o nombre duplicado?)' : error.message);
  },
  async remove(s, table, id) { const { error } = await s.sb.from(table).delete().eq('id', id); if (error) throw new Error(error.message); },
  async saveMany(s, table, rows) {
    const clean = rows.map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => !k.startsWith('_'))));
    const { error } = await s.sb.from(table).upsert(clean);
    if (error) {
      if (error.code === '23505' && table === 'teams') throw new Error('La base de datos aún unifica equipos. Ejecuta en Supabase → SQL Editor:  drop index if exists public.teams_name_uq;  y vuelve a importar.');
      throw new Error(error.code === '23505' ? 'Hay datos duplicados (dorsal o nombre): ' + error.message : error.message);
    }
  },
  async getLaps(s, eventId) {
    const all = []; let from = 0;
    for (;;) { // paginado por si hay miles de pasos
      const { data, error } = await s.sb.from('laps').select('*').eq('event_id', eventId).order('ts').range(from, from + 999);
      if (error) throw error; all.push(...data); if (data.length < 1000) break; from += 1000;
    }
    const pend = queue.all().filter((l) => l.event_id === eventId && !all.some((a) => a.id === l.id)).map((l) => ({ ...l, _pending: true }));
    return [...all, ...pend];
  },
  async addLap(s, lap) {
    queue.push(lap);
    try { const { error } = await s.sb.from('laps').insert(lap); if (error && error.code !== '23505') throw error; queue.drop(lap.id); }
    catch (e) { console.warn('Vuelta guardada sin conexión, se enviará después', e); }
  },
  async flush(s) {
    for (const lap of queue.all()) {
      const { error } = await s.sb.from('laps').insert(lap);
      if (!error || error.code === '23505') queue.drop(lap.id); else break;
    }
  },
};
