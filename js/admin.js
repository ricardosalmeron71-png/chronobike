// Panel de STAFF: registro de eventos, corredores, categorías, equipos y cronometraje de vueltas
import { store, displayUser, FORCED_DEMO } from './store.js';
import { CONFIG } from './config.js';
import { computeResults, eventSummary, resultsToCSV, fmtDuration, STATUS } from './results.js';
import { $, $$, esc, toast, modal, confirmDialog, fmtDate, fmtClock, toLocalInput, fromLocalInput, avatar, resizeImage, download, brand } from './ui.js';
import { showSplash } from './splash.js';
import { initTheme, openThemePicker } from './theme.js';
initTheme();
import { pageDocs } from './docs.js';
import { parseLaps } from './lapimport.js';
import { podium, resultsTable, riderDetail, kpis, EVENT_STATUS } from './views.js';

const ACTIVE_KEY = 'chronobike_active_event';
const PAGES = [
  { id: 'crono', icon: 'fa-stopwatch', label: 'Cronómetro', roles: ['admin', 'registrador'] },
  { id: 'eventos', icon: 'fa-calendar-days', label: 'Eventos', roles: ['admin'] },
  { id: 'corredores', icon: 'fa-person-biking', label: 'Corredores', roles: ['admin', 'registrador'] },
  { id: 'categorias', icon: 'fa-layer-group', label: 'Categorías', roles: ['admin'] },
  { id: 'equipos', icon: 'fa-users', label: 'Equipos', roles: ['admin'] },
  { id: 'resultados', icon: 'fa-trophy', label: 'Resultados', roles: ['admin', 'registrador'] },
  { id: 'usuarios', icon: 'fa-user-shield', label: 'Usuarios', roles: ['admin'] },
  { id: 'docs', icon: 'fa-book', label: 'Documentación', roles: ['admin', 'registrador'] },
  { id: 'ajustes', icon: 'fa-gear', label: 'Importar y ajustes', roles: ['admin'] },
];
const S = { page: 'crono', eventId: localStorage.getItem(ACTIVE_KEY), dorsal: '', laps: [], groups: [], riderQ: '', riderCat: 'ALL', resView: 'podios', lastId: null };
const root = $('#root');
const D = () => store.data;
const ev = () => D().events.find((e) => e.id === S.eventId);
const catById = (id) => D().categories.find((c) => c.id === id);
const teamById = (id) => D().teams.find((t) => t.id === id);
const can = (pageId) => PAGES.find((p) => p.id === pageId)?.roles.includes(store.user?.role);

// ─────────────── Arranque ───────────────
const splash = showSplash();
(async function main() {
  await store.init((p, m) => splash.step(p, m));
  if (store.mode === 'demo') $('#demoBanner').innerHTML = `<div class="demo-banner"><i class="fa-solid fa-flask"></i> MODO DEMOSTRACIÓN · datos ficticios, los cambios se guardan solo en este navegador · <a href="./index.html" target="_blank">Vista pública demo →</a>${FORCED_DEMO ? ' · <a href="./admin.html?demo=0"><b>Salir del demo (volver a datos reales)</b></a>' : ''}</div>`;
  if (!ev()) S.eventId = (D().events.find((e) => e.status === 'en_curso') || D().events[0])?.id || null;
  splash.step(0.88, store.user ? 'Cargando vueltas y resultados…' : 'Preparando acceso…');
  store.user ? await boot() : await renderLogin();
  splash.done();
})().catch((e) => { console.error(e); splash.fail(); root.innerHTML = `<div class="empty"><i class="fa-solid fa-plug-circle-xmark"></i>No se pudo conectar con la base de datos.<br><small>${esc(e.message)}</small></div>`; });

async function boot() {
  const fromHash = location.hash.slice(1);
  if (PAGES.some((p) => p.id === fromHash) && can(fromHash)) S.page = fromHash;
  if (!can(S.page)) S.page = 'crono';
  renderLayout(); await reloadLaps(); renderPage();
  setInterval(() => { const c = $('#clock'); if (c) c.textContent = fmtClock(new Date().toISOString()); updateSync(); }, 1000);
  let busy = false;
  store.subscribe(async (what) => {
    if (busy || what === 'queue') { updateSync(); return; }
    busy = true;
    try {
      const before = S.laps.length; await reloadLaps();
      if (what === 'tick' && S.laps.length === before) return;
      if (['crono', 'resultados'].includes(S.page) || what === 'remote') renderPage({ soft: true });
    } finally { busy = false; }
  });
  document.addEventListener('keydown', onKey);
}

async function reloadLaps() {
  const e = ev(); S.laps = e ? await store.getLaps(e.id) : [];
  S.groups = e ? computeResults({ event: e, ...D(), eventCategories: D().event_categories, laps: S.laps }) : [];
}

// ─────────────── Login ───────────────
async function renderLogin() {
  let status = { hasAdmin: true }; let setupError = null;
  try { status = await store.staffStatus(); } catch (e) { setupError = e; }
  const setup = !status.hasAdmin;
  root.innerHTML = `<div class="login">
    <div class="login-art"><div class="track"></div>${brand('Panel de staff')}
      <div><h1>Cada segundo<br><span>cuenta.</span></h1><p class="muted" style="max-width:44ch">Registra eventos, corredores y pasos por meta desde cualquier celular. Los resultados se publican al instante.</p></div>
      <div class="feat"><div><i class="fa-solid fa-bolt"></i>Registro de vuelta en un toque</div><div><i class="fa-solid fa-wifi"></i>Funciona aunque se caiga el internet</div><div><i class="fa-solid fa-trophy"></i>Podios automáticos por categoría</div></div></div>
    <div class="login-form"><form class="card form" id="loginForm">
      ${setup ? `<div style="text-align:center"><i class="fa-solid fa-rocket" style="font-size:2rem;color:var(--lime)"></i><h2 style="margin-top:.4rem">Configuración inicial</h2>
        <p class="muted small">Aún no hay administradores. Crea <b>tu cuenta de administrador</b>; después podrás dar de alta a tu staff desde <b>Usuarios</b>.</p></div>`
      : `<div style="text-align:center"><i class="fa-solid fa-user-shield" style="font-size:2rem;color:var(--orange)"></i><h2 style="margin-top:.4rem">Acceso de staff</h2><p class="muted small">Solo administradores y registradores</p></div>`}
      <div class="field"><label>Usuario</label><input name="email" type="text" required autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="${setup ? 'elige tu usuario, ej. ricardo' : 'tu usuario'}">${setup ? '<span class="hint">Sin espacios: letras, números, punto o guion</span>' : ''}</div>
      <div class="field"><label>Contraseña</label><input name="password" type="password" required minlength="${setup ? 8 : 1}" autocomplete="${setup ? 'new-password' : 'current-password'}" placeholder="••••••••">${setup ? '<span class="hint">Mínimo 8 caracteres</span>' : ''}</div>
      ${setup ? '<div class="field"><label>Repite la contraseña</label><input name="password2" type="password" required autocomplete="new-password" placeholder="••••••••"></div>' : ''}
      <button class="btn ${setup ? 'btn-lime' : 'btn-primary'}" style="height:50px"><i class="fa-solid ${setup ? 'fa-user-plus' : 'fa-right-to-bracket'}"></i> ${setup ? 'Crear administrador y entrar' : 'Entrar'}</button>
      <a class="btn btn-ghost" href="./index.html"><i class="fa-solid fa-arrow-left"></i> Volver a resultados</a>
      ${!setup ? '<p class="muted small" style="text-align:center;margin:0">¿No tienes cuenta? Pídela al administrador del evento.</p>' : ''}
      ${store.mode === 'cloud' ? '<a class="btn btn-ghost btn-sm" href="./admin.html?demo=1"><i class="fa-solid fa-flask"></i> Practicar en modo demo (datos ficticios)</a>' : ''}
      ${setupError ? `<div class="demo-hint"><b><i class="fa-solid fa-triangle-exclamation"></i> Gestión de usuarios no disponible</b><br>${esc(setupError.message)}</div>` : ''}
      ${store.mode === 'demo' ? `<div class="demo-hint"><b><i class="fa-solid fa-flask"></i> Modo demo</b><br>Administrador: usuario <code>admin</code><br>Registrador: usuario <code>registro</code><br>Contraseña: <code>demo</code></div>` : ''}
    </form></div></div>`;
  $('#loginForm').onsubmit = async (e) => {
    e.preventDefault(); const f = new FormData(e.target); const btn = e.target.querySelector('button.btn');
    const email = f.get('email').trim(); const pass = f.get('password');
    if (setup && pass !== f.get('password2')) return toast('Las contraseñas no coinciden', 'err');
    btn.disabled = true;
    try {
      if (setup) { await store.bootstrapAdmin(email, pass); toast('¡Cuenta de administrador creada!'); }
      else await store.signIn(email, pass);
      toast(`Bienvenido · ${store.user.role}`); await boot();
    } catch (err) { toast(err.message, 'err', 4500); btn.disabled = false; }
  };
}

// ─────────────── Layout ───────────────
function renderLayout() {
  const pages = PAGES.filter((p) => can(p.id));
  root.innerHTML = `
  <header class="topbar">${brand('Staff')}
    <div class="event-pill hide-m"><i class="fa-solid fa-flag-checkered" style="color:var(--orange)"></i><select id="eventSel" aria-label="Evento activo"></select></div>
    <span class="spacer"></span>
    <span class="sync" id="sync"><span class="dot"></span><span></span></span>
    <span class="clock hide-m" id="clock">${fmtClock(new Date().toISOString())}</span>
    ${store.isAdmin() ? '<button class="btn btn-sm btn-ghost hide-m" id="themeBtn" title="Cambiar diseño de la app"><i class="fa-solid fa-palette"></i> Diseño</button>' : ''}
    <a class="btn btn-sm btn-ghost hide-m" href="./tv.html" target="_blank" id="tvLink"><i class="fa-solid fa-tv"></i> Pantalla TV</a>
    <a class="btn btn-sm btn-ghost hide-m" href="./index.html" target="_blank"><i class="fa-solid fa-eye"></i> Vista pública</a>
  </header>
  <div class="admin-layout">
    <nav class="sidenav">${pages.map((p) => `<button data-page="${p.id}"><i class="fa-solid ${p.icon}"></i>${p.label}</button>`).join('')}
      <div class="who-box"><div class="row"><i class="fa-solid fa-circle-user" style="font-size:1.4rem;color:var(--muted)"></i><div style="min-width:0"><b style="display:block;overflow:hidden;text-overflow:ellipsis">${esc(displayUser(store.user.email))}</b><span class="role-badge">${esc(store.user.role)}</span></div></div>
      <button class="btn btn-sm btn-ghost" id="logout" style="width:100%;margin-top:.6rem"><i class="fa-solid fa-right-from-bracket"></i> Cerrar sesión</button></div>
    </nav>
    <main class="admin-main" id="main"></main>
  </div>
  <nav class="bottomnav">${pages.slice(0, 5).map((p) => `<button data-page="${p.id}"><i class="fa-solid ${p.icon}"></i>${p.label.split(' ')[0]}</button>`).join('')}
    <button id="moreBtn"><i class="fa-solid fa-ellipsis"></i>Más</button></nav>`;
  fillEventSelect();
  if (S.eventId) $('#tvLink').href = `./tv.html?e=${encodeURIComponent(S.eventId)}`;
  $$('[data-page]').forEach((b) => b.onclick = () => go(b.dataset.page));
  $('#themeBtn') && ($('#themeBtn').onclick = openThemePicker);
  $('#logout').onclick = async () => { await store.signOut(); location.hash = ''; location.reload(); };
  $('#moreBtn').onclick = () => {
    const m = modal(`<h3>Menú</h3><div class="list" style="margin-top:1rem">
      <div class="event-pill"><i class="fa-solid fa-flag-checkered" style="color:var(--orange)"></i><select id="eventSel2"></select></div>
      ${pages.slice(5).map((p) => `<button class="btn" data-go="${p.id}"><i class="fa-solid ${p.icon}"></i>${p.label}</button>`).join('')}
      <a class="btn" href="./index.html" target="_blank"><i class="fa-solid fa-eye"></i> Vista pública</a>
      ${store.isAdmin() ? '<button class="btn" data-theme-pick><i class="fa-solid fa-palette"></i> Diseño de la app</button>' : ''}
      <a class="btn" href="./tv.html${S.eventId ? '?e=' + encodeURIComponent(S.eventId) : ''}" target="_blank"><i class="fa-solid fa-tv"></i> Pantalla TV de meta</a>
      <button class="btn btn-danger" data-logout><i class="fa-solid fa-right-from-bracket"></i> Cerrar sesión (${esc(displayUser(store.user.email))})</button></div>`);
    fillEventSelect($('#eventSel2', m.el));
    $$('[data-go]', m.el).forEach((b) => b.onclick = () => { m.close(); go(b.dataset.go); });
    $('[data-logout]', m.el).onclick = () => $('#logout').click();
    $('[data-theme-pick]', m.el) && ($('[data-theme-pick]', m.el).onclick = () => { m.close(); setTimeout(openThemePicker, 220); });
  };
  updateNav();
}
function fillEventSelect(sel = $('#eventSel')) {
  if (!sel) return;
  sel.innerHTML = D().events.length ? D().events.map((e) => `<option value="${esc(e.id)}" ${e.id === S.eventId ? 'selected' : ''}>${e.status === 'en_curso' ? '● ' : ''}${esc(e.name)} · ${fmtDate(e.date)}</option>`).join('') : '<option>Sin eventos</option>';
  sel.onchange = async () => { await setEvent(sel.value); };
}
async function setEvent(id) {
  S.eventId = id; const tl = $('#tvLink'); if (tl) tl.href = `./tv.html?e=${encodeURIComponent(id)}`; localStorage.setItem(ACTIVE_KEY, id); await reloadLaps(); fillEventSelect(); renderPage();
  toast(`Evento activo: ${ev()?.name}`, 'info');
}
async function go(page) { S.page = page; history.replaceState(null, '', '#' + page); updateNav(); renderPage(); window.scrollTo(0, 0); }
function updateNav() { $$('[data-page]').forEach((b) => b.classList.toggle('on', b.dataset.page === S.page)); }
function updateSync() {
  const el = $('#sync'); if (!el) return;
  const pend = store.pending(); const on = navigator.onLine;
  el.className = 'sync ' + (!on ? 'off' : pend ? 'pend' : '');
  el.lastElementChild.textContent = store.mode === 'demo' ? 'Demo local' : !on ? `Sin conexión${pend ? ` · ${pend} pendientes` : ''}` : pend ? `Enviando ${pend}…` : 'Sincronizado';
}

function pageHead(icon, title, sub, actions = '') {
  return `<div class="page-head"><div><h1><i class="fa-solid ${icon}"></i>${title}</h1>${sub ? `<p>${sub}</p>` : ''}</div><span class="grow"></span>${actions}</div>`;
}
function needEvent() {
  return `<div class="card"><div class="empty"><i class="fa-solid fa-calendar-plus"></i><h3>Primero crea o selecciona un evento</h3>
    ${can('eventos') ? '<button class="btn btn-primary" data-goto="eventos"><i class="fa-solid fa-plus"></i> Ir a Eventos</button>' : '<p>Pide a un administrador que cree el evento.</p>'}</div></div>`;
}

function renderPage(opts = {}) {
  const main = $('#main'); if (!main) return;
  const fn = { crono: pageCrono, eventos: pageEventos, corredores: pageCorredores, categorias: pageCategorias, equipos: pageEquipos, resultados: pageResultados, usuarios: pageUsuarios, docs: (m) => pageDocs(m, store.user.role, pageHead), ajustes: pageAjustes }[S.page];
  if (opts.soft && S.page === 'crono' && $('#keypad')) { renderCronoSide(); renderPreview(); return; }
  main.dataset.page = S.page; main.innerHTML = ''; fn(main);
  $$('[data-goto]', main).forEach((b) => b.onclick = () => go(b.dataset.goto));
}

// ═════════════════════ CRONÓMETRO ═════════════════════
function pageCrono(main) {
  const e = ev();
  if (!e) { main.innerHTML = pageHead('fa-stopwatch', 'Cronómetro', '') + needEvent(); return; }
  const st = EVENT_STATUS[e.status];
  main.innerHTML = pageHead('fa-stopwatch', 'Cronómetro', `<span class="badge ${e.status === 'en_curso' ? 'st-racing' : 'st-dns'}">${e.status === 'en_curso' ? '<i class="live-dot"></i>' : ''}${st.label}</span> &nbsp;${esc(e.name)} · ${esc(e.location || '')}`,
    (can('ajustes') ? `<button class="btn btn-sm" id="goImpLaps"><i class="fa-solid fa-file-import"></i> Importar pasos</button>` : '') +
    (e.status !== 'en_curso' && can('eventos') ? `<button class="btn btn-lime" id="goLive"><i class="fa-solid fa-play"></i> Marcar evento EN VIVO</button>` : '')) + `
  <div class="timing">
    <div class="card pad-card">
      <div class="dorsal-display" id="dDisplay"><small>Dorsal</small><div class="dorsal-num" id="dNum"></div></div>
      <div class="rider-preview" id="preview"></div>
      <div class="keypad" id="keypad">
        ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button class="key" data-k="${n}">${n}</button>`).join('')}
        <button class="key k-fn" data-k="C" aria-label="Borrar todo">C</button><button class="key" data-k="0">0</button>
        <button class="key k-fn" data-k="B" aria-label="Borrar"><i class="fa-solid fa-delete-left"></i></button>
      </div>
      <button class="register-btn" id="regBtn"><i class="fa-solid fa-flag-checkered"></i> REGISTRAR PASO</button>
      <p class="muted small" style="text-align:center;margin:.7rem 0 0"><i class="fa-regular fa-keyboard"></i> En computadora: escribe el número y presiona <b>Enter</b></p>
    </div>
    <div id="cronoSide"></div>
  </div>`;
  $('#goImpLaps') && ($('#goImpLaps').onclick = async () => { await go('ajustes'); $('#lapsCard')?.scrollIntoView({ behavior: 'smooth' }); });
  $('#goLive') && ($('#goLive').onclick = async () => { await store.save('events', { ...e, status: 'en_curso' }); toast('Evento en vivo'); renderPage(); });
  $$('#keypad .key').forEach((b) => b.onpointerdown = (ev2) => { ev2.preventDefault(); keyPress(b.dataset.k); });
  $('#regBtn').onclick = registerLap;
  renderPreview(); renderCronoSide();
}

function keyPress(k) {
  if (k === 'C') S.dorsal = ''; else if (k === 'B') S.dorsal = S.dorsal.slice(0, -1); else if (S.dorsal.length < 4) S.dorsal += k;
  navigator.vibrate?.(15); renderPreview();
}
function onKey(e) {
  if (S.page !== 'crono' || !$('#keypad') || $('.modal-wrap')) return;
  if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
  if (/^[0-9]$/.test(e.key)) keyPress(e.key);
  else if (e.key === 'Backspace') keyPress('B');
  else if (e.key === 'Escape') keyPress('C');
  else if (e.key === 'Enter') { e.preventDefault(); registerLap(); }
  else return;
  const b = $(`#keypad [data-k="${e.key === 'Backspace' ? 'B' : e.key === 'Escape' ? 'C' : e.key}"]`); b?.classList.add('press'); setTimeout(() => b?.classList.remove('press'), 100);
}
function rowFor(dorsal) {
  for (const g of S.groups) { const r = g.rows.find((x) => Number(x.rider.dorsal) === Number(dorsal)); if (r) return { g, r }; }
  return null;
}
function renderPreview() {
  const num = $('#dNum'); if (!num) return;
  num.textContent = S.dorsal;
  const disp = $('#dDisplay'); const pv = $('#preview');
  disp.classList.remove('ok', 'bad');
  if (!S.dorsal) { pv.innerHTML = '<i class="fa-solid fa-hand-pointer muted"></i><span class="muted">Teclea el dorsal del ciclista que cruza la meta</span>'; return; }
  const rider = D().riders.find((r) => Number(r.dorsal) === Number(S.dorsal));
  if (!rider) { disp.classList.add('bad'); pv.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color:var(--amber);font-size:1.4rem"></i><div><b>Dorsal no registrado</b><small>Se guardará el paso y podrás dar de alta al corredor después.</small></div>`; return; }
  disp.classList.add('ok');
  const cat = catById(rider.category_id); const found = rowFor(rider.dorsal);
  const done = found?.r.lapsDone || 0; const target = found?.r.targetLaps || cat?.laps || 1;
  pv.innerHTML = `${avatar(rider, cat?.color)}<div style="min-width:0"><b>${esc(rider.name)}</b><small><span class="cat-dot" style="--c:${esc(cat?.color || '#888')}"></span> ${esc(cat?.name || 'Sin categoría')} · ${esc(teamById(rider.team_id)?.name || 'Independiente')}</small></div>
    <div class="rp-laps" style="color:${done >= target ? 'var(--green)' : 'var(--lime)'}">${done >= target ? '<i class="fa-solid fa-flag-checkered"></i>' : `V${done + 1}`}<small class="muted">${done >= target ? 'ya terminó' : `de ${target}`}</small></div>`;
}

let audioCtx;
function beep(ok = true) {
  try {
    audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
    o.frequency.value = ok ? 1320 : 440; g.gain.value = 0.08; o.connect(g); g.connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime + (ok ? 0.12 : 0.3));
  } catch { /* sin audio */ }
}

async function registerLap() {
  const e = ev(); const dorsal = parseInt(S.dorsal, 10);
  if (!e) return toast('Selecciona un evento', 'err');
  if (!dorsal) { beep(false); return toast('Ingresa un dorsal', 'warn'); }
  const ts = new Date().toISOString(); // la hora se toma al tocar, antes de cualquier confirmación
  const rider = D().riders.find((r) => Number(r.dorsal) === dorsal);
  const last = S.laps.filter((l) => Number(l.dorsal) === dorsal).sort((a, b) => new Date(b.ts) - new Date(a.ts))[0];
  const since = last ? (Date.now() - new Date(last.ts).getTime()) / 1000 : Infinity;
  const found = rowFor(dorsal);
  if (since < CONFIG.DUPLICATE_WINDOW_SECONDS && !(await confirmDialog('¿Paso duplicado?', `El dorsal #${dorsal} se registró hace ${Math.round(since)} segundos. ¿Registrar otro paso de todos modos?`, { ok: 'Sí, registrar', danger: false }))) return;
  if (found && found.r.status === STATUS.FINAL && !(await confirmDialog('Ya terminó', `#${dorsal} ya completó sus ${found.r.targetLaps} vueltas. El paso extra no cuenta para el tiempo oficial. ¿Registrarlo?`, { ok: 'Registrar', danger: false }))) return;
  const lap = await store.addLap(e.id, dorsal, ts);
  S.lastId = lap.id; S.dorsal = '';
  await reloadLaps();
  const now = rowFor(dorsal);
  beep(true); navigator.vibrate?.([40, 40, 40]);
  const b = $('#regBtn'); b?.classList.remove('flash'); void b?.offsetWidth; b?.classList.add('flash');
  toast(rider ? `#${dorsal} ${rider.name.split(' ')[0]} · V${now?.r.lapsDone ?? '?'}/${now?.r.targetLaps ?? '?'} · ${fmtDuration(now?.r.splits.at(-1)?.ms)}` : `Paso de #${dorsal} registrado (dorsal no dado de alta)`, rider ? 'ok' : 'warn');
  if (!rider) beep(false);
  if (now && now.r.status === STATUS.FINAL && now.r.lapsDone === now.r.targetLaps && found?.r.status !== STATUS.FINAL) toast(`🏁 #${dorsal} TERMINÓ · ${fmtDuration(now.r.total)}`, 'ok', 3500);
  renderPreview(); renderCronoSide();
}

function renderCronoSide() {
  const side = $('#cronoSide'); const e = ev(); if (!side || !e) return;
  const cats = D().categories.filter((c) => D().riders.some((r) => r.category_id === c.id));
  const ecs = D().event_categories.filter((x) => x.event_id === e.id);
  const sum = eventSummary(S.groups);
  const recent = [...S.laps].sort((a, b) => new Date(b.ts) - new Date(a.ts)).slice(0, 15);
  side.innerHTML = `${kpis(sum)}
  <div class="card" style="margin-bottom:1rem">
    <div class="row" style="margin-bottom:.8rem"><h3><i class="fa-solid fa-flag" style="color:var(--orange)"></i> Salidas por categoría</h3><span class="grow"></span>
      <button class="btn btn-sm btn-lime" id="startAll"><i class="fa-solid fa-play"></i> Salida a pendientes</button></div>
    <div class="starts">${cats.map((c) => {
      const x = ecs.find((y) => y.category_id === c.id); const start = x?.start_at; const laps = x?.laps || c.laps;
      return `<div class="start-item" style="--c:${esc(c.color)}"><div><b>${esc(c.name)}</b><small>${laps} V · ${start ? `<i class="fa-solid fa-circle-check" style="color:var(--green)"></i> ${fmtClock(start)}` : e.start_at ? `general ${fmtClock(e.start_at)}` : '<span class="warn-t">sin salida</span>'}</small></div>
        <button class="btn btn-sm btn-icon" data-edit-start="${esc(c.id)}" title="Editar salida y vueltas"><i class="fa-solid fa-pen"></i></button>
        ${start ? '' : `<button class="btn btn-sm btn-primary" data-start="${esc(c.id)}" title="Dar salida ahora"><i class="fa-solid fa-play"></i></button>`}</div>`;
    }).join('') || '<p class="muted">No hay corredores inscritos.</p>'}</div>
  </div>
  <div class="card"><div class="row" style="margin-bottom:.8rem"><h3><i class="fa-solid fa-clock-rotate-left" style="color:var(--orange)"></i> Últimos pasos</h3><span class="grow"></span><span class="chip">${S.laps.length} en total</span></div>
    ${recent.length ? `<ul class="feed">${recent.map((l) => {
      const r = D().riders.find((x) => Number(x.dorsal) === Number(l.dorsal)); const c = catById(r?.category_id); const row = rowFor(l.dorsal);
      const sp = row?.r.splits.find((s) => s.lapId === l.id);
      return `<li class="${l.id === S.lastId ? 'fresh' : ''}"><span class="bib" style="--c:${esc(c?.color || '#64748b')}">#${esc(l.dorsal)}</span>
        <div><b>${esc(r?.name || 'Dorsal no registrado')}</b><small class="muted">${esc(c?.name || '—')}</small></div>
        <div class="lapinfo">${l._pending ? '<span class="pending"><i class="fa-solid fa-cloud-arrow-up"></i> pendiente</span><br>' : ''}${sp ? `V${sp.n} · <b class="mono">${fmtDuration(sp.ms)}</b>` : '<span class="warn-t">no cuenta</span>'}<br><span class="mono">${fmtClock(l.ts)}</span></div>
        <button class="btn btn-sm btn-icon btn-ghost" data-del-lap="${esc(l.id)}" title="Eliminar paso"><i class="fa-solid fa-trash-can"></i></button></li>`;
    }).join('')}</ul>` : '<div class="empty small"><i class="fa-solid fa-flag"></i>Aún no hay pasos registrados</div>'}</div>`;

  $$('[data-start]', side).forEach((b) => b.onclick = async () => { await store.saveEventCategory(e.id, b.dataset.start, { start_at: new Date().toISOString() }); await reloadLaps(); renderCronoSide(); toast(`¡Salida! ${catById(b.dataset.start).name}`); beep(); });
  $('#startAll').onclick = async () => {
    const now = new Date().toISOString(); const pend = cats.filter((c) => !ecs.find((y) => y.category_id === c.id)?.start_at);
    if (!pend.length) return toast('Todas las categorías ya tienen salida', 'info');
    if (!(await confirmDialog('Dar salida', `Se registrará la salida AHORA (${fmtClock(now)}) para ${pend.length} categoría(s).`, { ok: '¡Salida!', danger: false }))) return;
    for (const c of pend) await store.saveEventCategory(e.id, c.id, { start_at: now });
    await reloadLaps(); renderCronoSide(); beep(); toast('¡Salida registrada!');
  };
  $$('[data-edit-start]', side).forEach((b) => b.onclick = () => editStart(b.dataset.editStart));
  $$('[data-del-lap]', side).forEach((b) => b.onclick = async () => {
    const l = S.laps.find((x) => x.id === b.dataset.delLap);
    if (!(await confirmDialog('Eliminar paso', `¿Eliminar el paso de #${l.dorsal} a las ${fmtClock(l.ts)}?`))) return;
    await store.removeLap(l.id); await reloadLaps(); renderCronoSide(); renderPreview(); toast('Paso eliminado', 'info');
  });
}

function editStart(catId) {
  const e = ev(); const c = catById(catId); const x = D().event_categories.find((y) => y.event_id === e.id && y.category_id === catId);
  const m = modal(`<h2><span class="cat-dot" style="--c:${esc(c.color)}"></span> ${esc(c.name)}</h2><p class="muted">Configuración solo para <b>${esc(e.name)}</b></p>
    <form class="form" id="f"><div class="two">
      <div class="field"><label>Hora de salida</label><input type="datetime-local" step="1" name="start" value="${toLocalInput(x?.start_at)}"><span class="hint">Vacío = usa la salida general del evento</span></div>
      <div class="field"><label>Vueltas en este evento</label><input type="number" min="1" max="50" name="laps" value="${x?.laps || c.laps}"></div></div>
      <div class="row-end"><button type="button" class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-primary"><i class="fa-solid fa-floppy-disk"></i> Guardar</button></div></form>`);
  $('#f', m.el).onsubmit = async (evt) => {
    evt.preventDefault(); const f = new FormData(evt.target);
    await store.saveEventCategory(e.id, catId, { start_at: fromLocalInput(f.get('start')), laps: Number(f.get('laps')) || c.laps });
    m.close(); await reloadLaps(); renderCronoSide(); toast('Salida actualizada');
  };
}

// ═════════════════════ EVENTOS ═════════════════════
function pageEventos(main) {
  main.innerHTML = pageHead('fa-calendar-days', 'Eventos', 'Crea carreras, define la salida general y elige cuál vas a cronometrar.', `<button class="btn btn-primary" id="newEv"><i class="fa-solid fa-plus"></i> Nuevo evento</button>`) +
  `<div class="grid-cards">${D().events.map((e) => {
    const st = EVENT_STATUS[e.status] || EVENT_STATUS.proximo;
    return `<div class="card ${st.cls}" style="${e.id === S.eventId ? 'border-color:var(--orange);box-shadow:0 0 0 1px var(--orange)' : ''}">
      <div class="row"><span class="ev-badge" style="font-size:.7rem;font-weight:800;padding:.2rem .5rem;border-radius:6px">${e.status === 'en_curso' ? '<i class="live-dot"></i> ' : ''}${st.label}</span><span class="grow"></span>${e.id === S.eventId ? '<span class="chip" style="color:var(--orange)"><i class="fa-solid fa-stopwatch"></i> Activo</span>' : ''}</div>
      <h3 style="margin:.5rem 0 .3rem">${esc(e.name)}</h3>
      <div class="muted small"><i class="fa-regular fa-calendar"></i> ${fmtDate(e.date)} · <i class="fa-solid fa-flag"></i> ${fmtClock(e.start_at)}<br><i class="fa-solid fa-location-dot"></i> ${esc(e.location || '—')} ${e.lap_km ? `· ${e.lap_km} km/vuelta` : ''}</div>
      <div class="row" style="margin-top:1rem">
        ${e.id !== S.eventId ? `<button class="btn btn-sm btn-primary" data-act="${esc(e.id)}"><i class="fa-solid fa-stopwatch"></i> Cronometrar</button>` : `<button class="btn btn-sm btn-lime" data-goto="crono"><i class="fa-solid fa-stopwatch"></i> Ir al cronómetro</button>`}
        <button class="btn btn-sm" data-edit="${esc(e.id)}"><i class="fa-solid fa-pen"></i> Editar</button>
        <a class="btn btn-sm btn-ghost" href="./index.html#e=${esc(e.id)}" target="_blank" title="Ver público"><i class="fa-solid fa-eye"></i></a>
        <button class="btn btn-sm btn-ghost" data-del="${esc(e.id)}" title="Eliminar"><i class="fa-solid fa-trash-can"></i></button>
      </div></div>`;
  }).join('') || '<div class="empty"><i class="fa-solid fa-calendar-plus"></i>Aún no hay eventos. Crea el primero.</div>'}</div>`;
  $('#newEv').onclick = () => eventForm();
  $$('[data-edit]', main).forEach((b) => b.onclick = () => eventForm(D().events.find((e) => e.id === b.dataset.edit)));
  $$('[data-act]', main).forEach((b) => b.onclick = async () => { await setEvent(b.dataset.act); });
  $$('[data-del]', main).forEach((b) => b.onclick = async () => {
    const e = D().events.find((x) => x.id === b.dataset.del);
    if (!(await confirmDialog('Eliminar evento', `Se eliminará "${e.name}" junto con TODOS sus pasos registrados. Esta acción no se puede deshacer.`))) return;
    await store.remove('events', e.id); if (S.eventId === e.id) { S.eventId = D().events[0]?.id || null; localStorage.setItem(ACTIVE_KEY, S.eventId || ''); await reloadLaps(); }
    fillEventSelect(); renderPage(); toast('Evento eliminado', 'info');
  });
}
function eventForm(e = null) {
  const today = new Date().toISOString().slice(0, 10);
  const m = modal(`<h2>${e ? 'Editar evento' : 'Nuevo evento'}</h2>
    <form class="form" id="f" style="margin-top:1rem">
      <div class="field"><label>Nombre del evento *</label><input name="name" required value="${esc(e?.name || '')}" placeholder="Ej. Serial MTB 2026 · 7ª etapa"></div>
      <div class="field"><label>Sede / lugar</label><input name="location" value="${esc(e?.location || '')}" placeholder="Ej. Cerro Colorado, Hermosillo"></div>
      <div class="two"><div class="field"><label>Fecha *</label><input type="date" name="date" required value="${esc(e?.date || today)}"></div>
        <div class="field"><label>Hora de salida general</label><input type="time" step="1" name="time" value="${e?.start_at ? toLocalInput(e.start_at).slice(11, 16) : '08:00'}"><span class="hint">Cada categoría puede tener su propia salida en el cronómetro</span></div></div>
      <div class="two"><div class="field"><label>Km por vuelta (opcional)</label><input type="number" step="0.1" min="0" name="lap_km" value="${esc(e?.lap_km ?? '')}" placeholder="Para calcular velocidad"></div>
        <div class="field"><label>Estado</label><select name="status">${Object.entries(EVENT_STATUS).map(([k, v]) => `<option value="${k}" ${(e?.status || 'proximo') === k ? 'selected' : ''}>${v.label}</option>`).join('')}</select></div></div>
      <div class="row-end"><button type="button" class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-primary"><i class="fa-solid fa-floppy-disk"></i> Guardar evento</button></div>
    </form>`);
  $('#f', m.el).onsubmit = async (evt) => {
    evt.preventDefault(); const f = Object.fromEntries(new FormData(evt.target));
    try {
      const saved = await store.save('events', { ...(e || {}), name: f.name.trim(), location: f.location.trim(), date: f.date,
        start_at: f.time ? new Date(`${f.date}T${f.time}`).toISOString() : null, lap_km: f.lap_km ? Number(f.lap_km) : null, status: f.status });
      m.close(); toast('Evento guardado');
      if (!S.eventId || !e) { S.eventId = saved.id; localStorage.setItem(ACTIVE_KEY, saved.id); await reloadLaps(); }
      fillEventSelect(); renderPage();
    } catch (err) { toast(err.message, 'err'); }
  };
}

// ═════════════════════ CORREDORES ═════════════════════
function pageCorredores(main) {
  main.innerHTML = pageHead('fa-person-biking', 'Corredores', `${D().riders.length} corredores en el padrón`, `<button class="btn btn-primary" id="newR"><i class="fa-solid fa-user-plus"></i> Inscribir corredor</button>`) + `
    <div class="toolbar"><div class="search grow" style="min-width:220px"><i class="fa-solid fa-magnifying-glass"></i><input id="rq" type="search" placeholder="Buscar nombre, dorsal o equipo…" value="${esc(S.riderQ)}"></div>
      <div class="field" style="min-width:200px"><select id="rcat"><option value="ALL">Todas las categorías</option>${D().categories.map((c) => `<option value="${esc(c.id)}" ${S.riderCat === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div></div>
    <div class="list" id="rlist"></div>`;
  const draw = () => {
    const q = S.riderQ.toLowerCase();
    const list = D().riders.filter((r) => (S.riderCat === 'ALL' || r.category_id === S.riderCat) && (!q || `${r.name} ${r.dorsal} ${teamById(r.team_id)?.name || ''}`.toLowerCase().includes(q)));
    $('#rlist').innerHTML = list.slice(0, 300).map((r) => { const c = catById(r.category_id); return `<div class="list-item">
      <span class="bib big" style="--c:${esc(c?.color || '#64748b')};min-width:62px;text-align:center">${esc(r.dorsal)}</span>${avatar(r, c?.color)}
      <div class="info"><b>${esc(r.name)}</b><small><span class="cat-dot" style="--c:${esc(c?.color || '#888')}"></span> ${esc(c?.name || 'Sin categoría')} · <i class="fa-solid fa-users"></i> ${esc(teamById(r.team_id)?.name || 'Independiente')}</small></div>
      <div class="acts"><button class="btn btn-sm btn-icon" data-edit="${esc(r.id)}" title="Editar"><i class="fa-solid fa-pen"></i></button>
      ${can('eventos') ? `<button class="btn btn-sm btn-icon btn-ghost" data-del="${esc(r.id)}" title="Eliminar"><i class="fa-solid fa-trash-can"></i></button>` : ''}</div></div>`; }).join('') ||
      '<div class="empty"><i class="fa-solid fa-user-slash"></i>No hay corredores con ese filtro.</div>';
    $$('[data-edit]', $('#rlist')).forEach((b) => b.onclick = () => riderForm(D().riders.find((r) => r.id === b.dataset.edit)));
    $$('[data-del]', $('#rlist')).forEach((b) => b.onclick = async () => {
      const r = D().riders.find((x) => x.id === b.dataset.del);
      if (!(await confirmDialog('Eliminar corredor', `¿Eliminar a #${r.dorsal} ${r.name}? Sus pasos registrados se conservan.`))) return;
      await store.remove('riders', r.id); draw(); toast('Corredor eliminado', 'info');
    });
  };
  $('#rq').oninput = (e) => { S.riderQ = e.target.value.trim(); draw(); };
  $('#rcat').onchange = (e) => { S.riderCat = e.target.value; draw(); };
  $('#newR').onclick = () => riderForm(null, draw);
  draw();
}
function riderForm(r = null, after = () => renderPage()) {
  const nextDorsal = Math.max(0, ...D().riders.map((x) => Number(x.dorsal))) + 1;
  let photo = r?.photo_url || null;
  const m = modal(`<h2>${r ? 'Editar corredor' : 'Inscripción de corredor'}</h2>
    <form class="form" id="f" style="margin-top:1rem">
      <div class="photo-pick"><span id="ph">${avatar({ ...r, photo_url: photo, name: r?.name || '?' }, '#ff5a1f', 'xl')}</span>
        <div class="row"><label class="btn btn-sm"><i class="fa-solid fa-camera"></i> Tomar foto<input type="file" accept="image/*" capture="user" hidden data-photo></label>
        <label class="btn btn-sm"><i class="fa-solid fa-image"></i> Subir archivo<input type="file" accept="image/*" hidden data-photo></label>
        <button type="button" class="btn btn-sm btn-ghost" id="noPh">Quitar</button></div></div>
      <div class="two"><div class="field"><label>Número de dorsal *</label><input name="dorsal" type="number" min="1" max="9999" required value="${esc(r?.dorsal ?? nextDorsal)}" inputmode="numeric"></div>
        <div class="field"><label>Categoría *</label><select name="category_id" required><option value="">Selecciona…</option>${D().categories.map((c) => `<option value="${esc(c.id)}" ${r?.category_id === c.id ? 'selected' : ''}>${esc(c.name)} (${c.laps} V)</option>`).join('')}</select></div></div>
      <div class="field"><label>Nombre completo *</label><input name="name" required value="${esc(r?.name || '')}" placeholder="Nombre y apellidos"></div>
      <div class="field"><label>Equipo / club</label><input name="team" list="teamsDl" value="${esc(teamById(r?.team_id)?.name || '')}" placeholder="Escribe o elige; vacío = Independiente">
        <datalist id="teamsDl">${D().teams.map((t) => `<option value="${esc(t.name)}">`).join('')}</datalist><span class="hint">Si el equipo no existe se crea automáticamente (sin duplicar mayúsculas/acentos)</span></div>
      <div class="row-end"><button type="button" class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-primary"><i class="fa-solid fa-floppy-disk"></i> Guardar corredor</button></div>
    </form>`);
  const drawPh = () => { $('#ph', m.el).innerHTML = avatar({ photo_url: photo, name: $('[name=name]', m.el).value || '?' }, '#ff5a1f', 'xl'); };
  $$('[data-photo]', m.el).forEach((inp) => inp.onchange = async () => { if (inp.files[0]) { photo = await resizeImage(inp.files[0]); drawPh(); } });
  $('#noPh', m.el).onclick = () => { photo = null; drawPh(); };
  $('#f', m.el).onsubmit = async (evt) => {
    evt.preventDefault(); const f = Object.fromEntries(new FormData(evt.target));
    const dorsal = Number(f.dorsal);
    const clash = D().riders.find((x) => Number(x.dorsal) === dorsal && x.id !== r?.id);
    if (clash) return toast(`El dorsal #${dorsal} ya es de ${clash.name}`, 'err', 3500);
    try {
      const team = await store.ensureTeam(f.team);
      await store.save('riders', { ...(r || {}), dorsal, name: f.name.trim(), category_id: f.category_id || null, team_id: team?.id || null, photo_url: photo });
      m.close(); toast(r ? 'Corredor actualizado' : `#${dorsal} inscrito`); await reloadLaps(); after();
    } catch (err) { toast(err.message, 'err'); }
  };
}

// ═════════════════════ CATEGORÍAS ═════════════════════
function pageCategorias(main) {
  main.innerHTML = pageHead('fa-layer-group', 'Categorías', 'Vueltas por defecto y color de cada categoría. La hora de salida se da en el Cronómetro de cada evento.', `<button class="btn btn-primary" id="newC"><i class="fa-solid fa-plus"></i> Nueva categoría</button>`) +
  `<div class="grid-cards">${D().categories.map((c) => { const n = D().riders.filter((r) => r.category_id === c.id).length; return `<div class="card cat-card" style="--c:${esc(c.color)}">
    <div class="row"><span class="cat-dot" style="--c:${esc(c.color)}"></span><h3>${esc(c.name)}</h3></div>
    <div class="row" style="margin-top:.7rem;gap:1.5rem"><div><span class="big">${c.laps}</span> <span class="muted">vueltas</span></div><div><span class="big">${n}</span> <span class="muted">corredores</span></div></div>
    <div class="row" style="margin-top:.8rem"><button class="btn btn-sm" data-edit="${esc(c.id)}"><i class="fa-solid fa-pen"></i> Editar</button><button class="btn btn-sm btn-ghost" data-del="${esc(c.id)}"><i class="fa-solid fa-trash-can"></i></button></div></div>`; }).join('') ||
    '<div class="empty"><i class="fa-solid fa-layer-group"></i>Crea tu primera categoría.</div>'}</div>`;
  $('#newC').onclick = () => catForm();
  $$('[data-edit]', main).forEach((b) => b.onclick = () => catForm(catById(b.dataset.edit)));
  $$('[data-del]', main).forEach((b) => b.onclick = async () => {
    const c = catById(b.dataset.del); const n = D().riders.filter((r) => r.category_id === c.id).length;
    if (!(await confirmDialog('Eliminar categoría', `¿Eliminar "${c.name}"?${n ? ` ${n} corredor(es) quedarán sin categoría.` : ''}`))) return;
    await store.remove('categories', c.id); renderPage(); toast('Categoría eliminada', 'info');
  });
}
function catForm(c = null) {
  const m = modal(`<h2>${c ? 'Editar categoría' : 'Nueva categoría'}</h2><form class="form" id="f" style="margin-top:1rem">
    <div class="field"><label>Nombre *</label><input name="name" required value="${esc(c?.name || '')}" placeholder="Ej. Élite Varonil"></div>
    <div class="two"><div class="field"><label>Vueltas *</label><input name="laps" type="number" min="1" max="50" required value="${c?.laps || 1}"></div>
    <div class="field"><label>Color</label><input name="color" type="color" value="${esc(c?.color || '#ff5a1f')}"></div></div>
    <div class="row-end"><button type="button" class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-primary"><i class="fa-solid fa-floppy-disk"></i> Guardar categoría</button></div></form>`);
  $('#f', m.el).onsubmit = async (evt) => {
    evt.preventDefault(); const f = Object.fromEntries(new FormData(evt.target));
    try { await store.save('categories', { ...(c || { sort: D().categories.length + 1 }), name: f.name.trim(), laps: Number(f.laps), color: f.color }); m.close(); renderPage(); toast('Categoría guardada'); }
    catch (err) { toast(err.message, 'err'); }
  };
}

// ═════════════════════ EQUIPOS ═════════════════════
function pageEquipos(main) {
  main.innerHTML = pageHead('fa-users', 'Equipos', `${D().teams.length} equipos / clubes`, `<button class="btn btn-primary" id="newT"><i class="fa-solid fa-plus"></i> Nuevo equipo</button>`) +
  `<div class="grid-cards">${D().teams.map((t) => { const n = D().riders.filter((r) => r.team_id === t.id).length; return `<div class="list-item">
    <span class="avatar lg" style="--c:#3b82f6">${esc(t.name.slice(0, 2).toUpperCase())}</span><div class="info"><b>${esc(t.name)}</b><small>${n} corredor(es)</small></div>
    <div class="acts"><button class="btn btn-sm btn-icon" data-edit="${esc(t.id)}"><i class="fa-solid fa-pen"></i></button><button class="btn btn-sm btn-icon btn-ghost" data-del="${esc(t.id)}"><i class="fa-solid fa-trash-can"></i></button></div></div>`; }).join('') ||
    '<div class="empty"><i class="fa-solid fa-users"></i>Sin equipos. También se crean solos al inscribir corredores.</div>'}</div>`;
  const form = (t = null) => {
    const m = modal(`<h2>${t ? 'Editar equipo' : 'Nuevo equipo'}</h2><form class="form" id="f" style="margin-top:1rem"><div class="field"><label>Nombre *</label><input name="name" required value="${esc(t?.name || '')}"></div>
      <div class="row-end"><button type="button" class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-primary"><i class="fa-solid fa-floppy-disk"></i> Guardar</button></div></form>`);
    $('#f', m.el).onsubmit = async (evt) => { evt.preventDefault(); try { await store.save('teams', { ...(t || {}), name: new FormData(evt.target).get('name').trim() }); m.close(); renderPage(); toast('Equipo guardado'); } catch (err) { toast(err.message, 'err'); } };
  };
  $('#newT').onclick = () => form();
  $$('[data-edit]', main).forEach((b) => b.onclick = () => form(teamById(b.dataset.edit)));
  $$('[data-del]', main).forEach((b) => b.onclick = async () => {
    const t = teamById(b.dataset.del);
    if (!(await confirmDialog('Eliminar equipo', `¿Eliminar "${t.name}"? Sus corredores quedarán como Independientes.`))) return;
    for (const r of D().riders.filter((x) => x.team_id === t.id)) await store.save('riders', { ...r, team_id: null });
    await store.remove('teams', t.id); renderPage(); toast('Equipo eliminado', 'info');
  });
}

// ═════════════════════ RESULTADOS ═════════════════════
function pageResultados(main) {
  const e = ev();
  if (!e) { main.innerHTML = pageHead('fa-trophy', 'Resultados', '') + needEvent(); return; }
  main.innerHTML = pageHead('fa-trophy', 'Resultados', `${esc(e.name)} · ${fmtDate(e.date)}`, `
    <button class="btn btn-sm" id="csv"><i class="fa-solid fa-file-csv"></i> Exportar Excel (CSV)</button>
    <button class="btn btn-sm" id="prt"><i class="fa-solid fa-print"></i> Imprimir / PDF</button>
    <a class="btn btn-sm" href="./tv.html?e=${encodeURIComponent(e.id)}" target="_blank"><i class="fa-solid fa-tv"></i> Pantalla TV</a>
    ${can('eventos') && e.status !== 'finalizado' ? '<button class="btn btn-sm btn-primary" id="fin"><i class="fa-solid fa-flag-checkered"></i> Cerrar evento</button>' : ''}`) +
    `${kpis(eventSummary(S.groups))}<div class="toolbar"><div class="seg" id="rv"><button data-v="podios" class="${S.resView === 'podios' ? 'on' : ''}"><i class="fa-solid fa-trophy"></i> Podios</button><button data-v="tabla" class="${S.resView === 'tabla' ? 'on' : ''}"><i class="fa-solid fa-list-ol"></i> Clasificación</button></div></div><div id="rbody"></div>`;
  $('#rbody').innerHTML = S.resView === 'podios' ? `<div class="podium-grid">${S.groups.map(podium).join('')}</div>` : S.groups.map((g) => resultsTable(g, { admin: true })).join('');
  $$('#rv button').forEach((b) => b.onclick = () => { S.resView = b.dataset.v; renderPage(); });
  $('#csv').onclick = () => download(`resultados-${e.name.replace(/[^\w]+/g, '-').toLowerCase()}.csv`, resultsToCSV(e, S.groups));
  $('#prt').onclick = () => window.print();
  $('#fin') && ($('#fin').onclick = async () => { if (await confirmDialog('Cerrar evento', 'El evento se marcará como FINALIZADO y aparecerá en el historial público.', { ok: 'Finalizar', danger: false })) { await store.save('events', { ...e, status: 'finalizado' }); renderPage(); toast('Evento finalizado'); } });
  $$('[data-rider]', main).forEach((el) => el.onclick = () => { const f = rowFor(el.dataset.rider); if (f) riderDetail(f.g, f.r, e); });
}

// ═════════════════════ USUARIOS (cuentas del staff) ═════════════════════
const ROLE_INFO = {
  admin: { label: 'Administrador', icon: 'fa-crown', desc: 'Todo: eventos, categorías, equipos, usuarios, importación' },
  registrador: { label: 'Registrador', icon: 'fa-stopwatch', desc: 'Cronómetro, salidas, corredores y resultados' },
};
const genPassword = () => { const a = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'; const r = crypto.getRandomValues(new Uint32Array(10)); return Array.from(r, (n) => a[n % a.length]).join(''); };
function credentialsCard(email, password) {
  const text = `ChronoBike · acceso de staff\nPágina: ${location.origin}${location.pathname}\nUsuario: ${displayUser(email)}\nContraseña: ${password}`;
  const m = modal(`<div class="confirm"><div class="confirm-ico" style="background:rgba(34,197,94,.15);color:#5ee08f"><i class="fa-solid fa-circle-check"></i></div>
    <h3>Cuenta lista</h3><p>Comparte estos datos con la persona. <b>La contraseña no se volverá a mostrar.</b></p>
    <pre class="card" style="text-align:left;white-space:pre-wrap;font-size:.9rem;margin:1rem 0">${esc(text)}</pre>
    <div class="row-end"><button class="btn" id="cp"><i class="fa-regular fa-copy"></i> Copiar</button>
    <a class="btn btn-lime" target="_blank" href="https://wa.me/?text=${encodeURIComponent(text)}"><i class="fa-brands fa-whatsapp"></i> WhatsApp</a>
    <button class="btn btn-primary" data-close>Listo</button></div></div>`);
  $('#cp', m.el).onclick = async () => { try { await navigator.clipboard.writeText(text); toast('Copiado'); } catch { toast('No se pudo copiar', 'warn'); } };
}
async function pageUsuarios(main) {
  main.innerHTML = pageHead('fa-user-shield', 'Usuarios', 'Cuentas de las personas que registran datos. El público no necesita cuenta.', `<button class="btn btn-primary" id="newU"><i class="fa-solid fa-user-plus"></i> Nuevo usuario</button>`) +
    `<div class="grid-cards" style="margin-bottom:1rem">${Object.values(ROLE_INFO).map((r) => `<div class="card" style="padding:.9rem 1rem"><b><i class="fa-solid ${r.icon}" style="color:var(--orange)"></i> ${r.label}</b><div class="muted small">${r.desc}</div></div>`).join('')}</div>
    <div class="list" id="ulist"><div class="empty small"><i class="fa-solid fa-spinner fa-spin"></i> Cargando usuarios…</div></div>`;
  $('#newU').onclick = () => userForm();
  let users;
  try { users = await store.listStaff(); } catch (e) { $('#ulist').innerHTML = `<div class="card"><div class="empty"><i class="fa-solid fa-plug-circle-xmark"></i>${esc(e.message)}</div></div>`; return; }
  $('#ulist').innerHTML = users.map((u) => { const r = ROLE_INFO[u.role] || ROLE_INFO.registrador; return `<div class="list-item">
    <span class="avatar lg" style="--c:${u.role === 'admin' ? '#ff5a1f' : '#3b82f6'}"><i class="fa-solid ${r.icon}"></i></span>
    <div class="info"><b>${esc(displayUser(u.email))} ${u.me ? '<span class="chip" style="margin-left:.3rem">Tú</span>' : ''}</b>
      <small><span class="role-badge">${r.label}</span> · ${u.last_sign_in_at ? `último acceso ${fmtDate(u.last_sign_in_at)} ${fmtClock(u.last_sign_in_at)}` : 'nunca ha entrado'}</small></div>
    <div class="acts">
      ${u.me ? '' : `<select class="btn btn-sm" data-role="${esc(u.user_id)}" title="Cambiar rol">${Object.entries(ROLE_INFO).map(([k, v]) => `<option value="${k}" ${u.role === k ? 'selected' : ''}>${v.label}</option>`).join('')}</select>`}
      <button class="btn btn-sm btn-icon" data-pass="${esc(u.user_id)}" title="Cambiar contraseña"><i class="fa-solid fa-key"></i></button>
      ${u.me ? '' : `<button class="btn btn-sm btn-icon btn-ghost" data-del="${esc(u.user_id)}" title="Eliminar cuenta"><i class="fa-solid fa-trash-can"></i></button>`}
    </div></div>`; }).join('');
  const byId = (id) => users.find((u) => u.user_id === id);
  $$('[data-role]', main).forEach((sel) => sel.onchange = async () => {
    try { await store.setStaffRole(sel.dataset.role, sel.value); toast(`Rol actualizado: ${ROLE_INFO[sel.value].label}`); } catch (e) { toast(e.message, 'err'); renderPage(); }
  });
  $$('[data-pass]', main).forEach((b) => b.onclick = () => {
    const u = byId(b.dataset.pass); const pw = genPassword();
    const m = modal(`<h2>Cambiar contraseña</h2><p class="muted">Usuario: <b>${esc(displayUser(u.email))}</b></p><form class="form" id="f">
      <div class="field"><label>Nueva contraseña</label><div class="row"><input name="password" required minlength="8" value="${pw}" class="grow" style="font-family:var(--display);font-size:1.2rem"><button type="button" class="btn" id="gen"><i class="fa-solid fa-dice"></i></button></div><span class="hint">Mínimo 8 caracteres</span></div>
      <div class="row-end"><button type="button" class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-primary"><i class="fa-solid fa-key"></i> Guardar</button></div></form>`);
    $('#gen', m.el).onclick = () => { $('[name=password]', m.el).value = genPassword(); };
    $('#f', m.el).onsubmit = async (e) => {
      e.preventDefault(); const p = new FormData(e.target).get('password');
      try { await store.resetStaffPassword(u.user_id, p); m.close(); if (u.me) toast('Tu contraseña se actualizó'); else credentialsCard(u.email, p); } catch (err) { toast(err.message, 'err'); }
    };
  });
  $$('[data-del]', main).forEach((b) => b.onclick = async () => {
    const u = byId(b.dataset.del);
    if (!(await confirmDialog('Eliminar cuenta', `${displayUser(u.email)} ya no podrá entrar al panel. Los pasos que registró se conservan.`))) return;
    try { await store.deleteStaff(u.user_id); toast('Cuenta eliminada', 'info'); renderPage(); } catch (e) { toast(e.message, 'err'); }
  });
}
function userForm() {
  const pw = genPassword();
  const m = modal(`<h2>Nuevo usuario</h2><p class="muted">La persona entrará con este usuario y contraseña en <b>${esc(location.host + location.pathname)}</b></p>
    <form class="form" id="f" style="margin-top:.5rem">
      <div class="field"><label>Usuario *</label><input name="email" type="text" required placeholder="ej. juan, meta1, registro2" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false"><span class="hint">Sin espacios: letras, números, punto, guion o guion bajo</span></div>
      <div class="field"><label>Contraseña *</label><div class="row"><input name="password" required minlength="8" value="${pw}" class="grow" autocomplete="new-password" style="font-family:var(--display);font-size:1.2rem"><button type="button" class="btn" id="gen" title="Generar otra"><i class="fa-solid fa-dice"></i></button></div><span class="hint">Generada al azar; puedes cambiarla. Mínimo 8 caracteres.</span></div>
      <div class="field"><label>Rol *</label><div class="seg" id="roleSeg" style="width:100%">${Object.entries(ROLE_INFO).map(([k, v]) => `<button type="button" data-r="${k}" class="${k === 'registrador' ? 'on' : ''}" style="flex:1"><i class="fa-solid ${v.icon}"></i> ${v.label}</button>`).join('')}</div><span class="hint" id="roleDesc">${ROLE_INFO.registrador.desc}</span></div>
      <div class="row-end"><button type="button" class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-primary"><i class="fa-solid fa-user-plus"></i> Crear cuenta</button></div></form>`);
  let role = 'registrador';
  $$('#roleSeg button', m.el).forEach((b) => b.onclick = () => { role = b.dataset.r; $$('#roleSeg button', m.el).forEach((x) => x.classList.toggle('on', x === b)); $('#roleDesc', m.el).textContent = ROLE_INFO[role].desc; });
  $('#gen', m.el).onclick = () => { $('[name=password]', m.el).value = genPassword(); };
  $('#f', m.el).onsubmit = async (e) => {
    e.preventDefault(); const f = Object.fromEntries(new FormData(e.target)); const btn = e.target.querySelector('.btn-primary'); btn.disabled = true;
    try { await store.createStaff(f.email.trim(), f.password, role); m.close(); credentialsCard(f.email.trim().toLowerCase(), f.password); renderPage(); }
    catch (err) { toast(err.message, 'err', 4500); btn.disabled = false; }
  };
}

// ═════════════════════ IMPORTAR Y AJUSTES ═════════════════════
function pageAjustes(main) {
  main.innerHTML = pageHead('fa-gear', 'Importar y ajustes', '') + `
  <div class="grid-cards" style="grid-template-columns:repeat(auto-fit,minmax(320px,1fr))">
    <div class="card"><h3><i class="fa-solid fa-file-excel" style="color:var(--green)"></i> Importar desde Excel</h3>
      <p class="muted small">Sube el archivo con las hojas <b>CORREDORES</b> (dorsal, name, category, team), <b>CATEGORIAS</b> (name, laps) y <b>Equipos</b> (name). Es el mismo formato del sistema anterior.</p>
      <label class="drop" id="drop"><i class="fa-solid fa-cloud-arrow-up"></i><p><b>Arrastra tu archivo .xlsx aquí</b><br><span class="muted small">o toca para elegirlo</span></p><input type="file" accept=".xlsx,.xls,.csv" hidden id="xls"></label>
      <details style="margin-top:.8rem"><summary class="small" style="cursor:pointer;color:var(--amber);font-weight:700"><i class="fa-solid fa-paste"></i> O pega la lista (copiada de Excel, con encabezados)</summary>
        <textarea id="rText" rows="6" placeholder="dorsal&#9;name&#9;category&#9;team&#10;1&#9;Raúl Chavira&#9;50+ Varonil&#9;Zorros" style="width:100%;margin-top:.5rem;font-family:ui-monospace,monospace;font-size:.8rem;background:var(--surface);border:1px solid var(--line2);border-radius:11px;padding:.6rem;color:var(--text)"></textarea>
        <button class="btn btn-sm" id="rCheck" style="margin-top:.4rem"><i class="fa-solid fa-magnifying-glass"></i> Revisar lista</button></details>
      <div id="imp"></div></div>
    <div class="card" id="lapsCard" style="grid-column:1/-1"><h3><i class="fa-solid fa-flag-checkered" style="color:var(--lime)"></i> Importar pasos por meta (vueltas) a un evento</h3>
      <p class="muted small">Pega los registros de otro cronómetro, hoja de cálculo o app: <b>una línea por paso</b> con fecha/hora y dorsal, por ejemplo <code>11/1/2026 7:34:46&nbsp;&nbsp;103</code>. También sirve solo la hora (<code>7:34:46 103</code>) o subir un archivo Excel/CSV.</p>
      <div class="form">
        <div class="two"><div class="field"><label>Evento destino *</label><select id="lpEvent">${D().events.map((x) => `<option value="${esc(x.id)}" ${x.id === S.eventId ? 'selected' : ''}>${esc(x.name)} · ${fmtDate(x.date)}</option>`).join('') || '<option value="">Primero crea un evento</option>'}</select></div>
          <div class="field"><label>Formato de fecha</label><select id="lpFmt"><option value="auto">Automático (según la fecha del evento)</option><option value="mdy">Mes/Día/Año (11/1/2026 = 1 nov)</option><option value="dmy">Día/Mes/Año (11/1/2026 = 11 ene)</option></select></div></div>
        <div class="field"><label>Pasos</label><textarea id="lpText" rows="8" placeholder="11/1/2026 7:34:46	103&#10;11/1/2026 7:34:51	194&#10;…" style="font-family:ui-monospace,monospace;font-size:.85rem"></textarea></div>
        <div class="row"><button class="btn" id="lpCheck"><i class="fa-solid fa-magnifying-glass"></i> Revisar</button>
          <label class="btn btn-ghost"><i class="fa-solid fa-file-excel"></i> Subir Excel/CSV<input type="file" id="lpFile" accept=".xlsx,.xls,.csv,.txt" hidden></label></div>
      </div><div id="lpPrev"></div></div>
    <div class="card"><h3><i class="fa-solid fa-database" style="color:var(--blue)"></i> Base de datos</h3>
      <p class="muted small">Modo actual: <b>${store.mode === 'demo' ? 'DEMO (navegador local)' : 'Supabase (nube)'}</b></p>
      ${store.mode === 'demo' ? `<ol class="steps small"><li>Crea un proyecto gratis en supabase.com</li><li>Ejecuta <code>supabase/schema.sql</code> en el SQL Editor</li><li>Pega la URL y la clave anon en <code>js/config.js</code></li><li>Publica el sitio (Netlify) y crea a tu staff en <b>Usuarios</b></li></ol>
        <button class="btn btn-danger" id="reset" style="margin-top:1rem"><i class="fa-solid fa-rotate"></i> Restablecer datos de demostración</button>` : '<p class="muted small">Conectado. Los cambios se ven en tiempo real en todos los dispositivos.</p>'}
      <button class="btn" id="backup" style="margin-top:1rem"><i class="fa-solid fa-download"></i> Descargar respaldo completo (JSON)</button></div>
  </div>`;
  const drop = $('#drop');
  ['dragover', 'dragenter'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((t) => drop.addEventListener(t, () => drop.classList.remove('over')));
  drop.addEventListener('drop', (e) => { e.preventDefault(); e.dataTransfer.files[0] && handleXls(e.dataTransfer.files[0]); });
  $('#xls').onchange = (e) => e.target.files[0] && handleXls(e.target.files[0]);
  $('#rCheck').onclick = () => handleRiderText($('#rText').value);
  $('#reset') && ($('#reset').onclick = async () => { if (await confirmDialog('Restablecer demo', 'Se borrarán tus cambios y se cargarán de nuevo los datos ficticios.')) { store.resetDemo(); S.eventId = D().events.find((x) => x.status === 'en_curso')?.id; localStorage.setItem(ACTIVE_KEY, S.eventId); await reloadLaps(); fillEventSelect(); renderPage(); toast('Demo restablecido'); } });
  setupLapImport();
  $('#backup').onclick = async () => {
    const laps = []; for (const e of D().events) laps.push(...(await store.getLaps(e.id)));
    download(`chronobike-respaldo-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ ...D(), laps }, null, 2), 'application/json');
  };
}
// ── Importación masiva de pasos ──
function setupLapImport() {
  const check = async () => {
    const evId = $('#lpEvent').value; const e = D().events.find((x) => x.id === evId);
    if (!e) return toast('Primero crea el evento en Eventos', 'warn');
    const lines = $('#lpText').value.split(/\r?\n/);
    if (!lines.some((l) => l.trim())) return toast('Pega los pasos o sube un archivo', 'warn');
    const existing = await store.getLaps(e.id);
    const r = parseLaps(lines, { eventDate: e.date, format: $('#lpFmt').value, existing });
    const riderBy = new Map(D().riders.map((x) => [Number(x.dorsal), x]));
    const unknown = [...new Set(r.ok.filter((x) => !riderBy.has(x.dorsal)).map((x) => x.dorsal))].sort((a, b) => a - b);
    const days = [...new Set(r.ok.map((x) => new Date(x.ts).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })))];
    const otherDay = r.ok.some((x) => { const d = new Date(x.ts); const loc = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; return loc !== String(e.date).slice(0, 10); });
    const fmtName = { mdy: 'Mes/Día/Año', dmy: 'Día/Mes/Año', ymd: 'Año-Mes-Día' }[r.format];
    const byDorsal = {}; r.ok.forEach((x) => { byDorsal[x.dorsal] = (byDorsal[x.dorsal] || 0) + 1; });
    $('#lpPrev').innerHTML = `<div class="kpis" style="grid-template-columns:repeat(4,1fr);margin-top:1rem">
        <div class="kpi k-green"><i class="fa-solid fa-circle-check"></i><b>${r.ok.length}</b><span>Pasos nuevos</span></div>
        <div class="kpi"><i class="fa-solid fa-users"></i><b>${Object.keys(byDorsal).length}</b><span>Dorsales</span></div>
        <div class="kpi"><i class="fa-solid fa-clone"></i><b>${r.dup.length}</b><span>Ya cargados (se omiten)</span></div>
        <div class="kpi ${r.bad.length ? 'k-orange' : ''}"><i class="fa-solid fa-triangle-exclamation"></i><b>${r.bad.length}</b><span>Líneas con error</span></div></div>
      <p class="small muted"><i class="fa-regular fa-calendar"></i> Fechas leídas como <b>${fmtName}</b>: ${esc(days.join(', ') || '—')} · de <b>${r.ok.length ? fmtClock(r.ok[0].ts) : '—'}</b> a <b>${r.ok.length ? fmtClock(r.ok.at(-1).ts) : '—'}</b></p>
      ${otherDay ? `<p class="small warn-t"><i class="fa-solid fa-triangle-exclamation"></i> Algunas fechas no coinciden con la del evento (${fmtDate(e.date)}). Revisa el formato de fecha.</p>` : ''}
      ${unknown.length ? `<p class="small warn-t"><i class="fa-solid fa-user-slash"></i> ${unknown.length} dorsal(es) no inscritos: ${unknown.slice(0, 30).join(', ')}${unknown.length > 30 ? '…' : ''}. Se importan igual; da de alta a esos corredores para que aparezcan en resultados.</p>` : ''}
      ${r.bad.length ? `<details class="small"><summary class="warn-t" style="cursor:pointer">Ver líneas con error</summary><pre class="card" style="white-space:pre-wrap;font-size:.8rem">${r.bad.slice(0, 50).map((b) => `Línea ${b.n}: ${esc(b.line)}`).join('\n')}</pre></details>` : ''}
      ${r.ok.length ? `<div class="table-scroll" style="max-height:260px;overflow:auto;margin:.6rem 0;border:1px solid var(--line);border-radius:12px"><table class="results"><thead><tr><th>#</th><th>Hora</th><th>Dorsal</th><th>Corredor</th><th>Vuelta en archivo</th></tr></thead><tbody>
        ${(() => { const cnt = {}; return r.ok.slice(0, 400).map((x, i) => { cnt[x.dorsal] = (cnt[x.dorsal] || 0) + 1; const rd = riderBy.get(x.dorsal); return `<tr><td class="muted">${i + 1}</td><td class="mono">${fmtClock(x.ts)}</td><td><span class="bib">#${x.dorsal}</span></td><td>${rd ? esc(rd.name) : '<span class="warn-t">no inscrito</span>'}</td><td class="muted">V${cnt[x.dorsal]}</td></tr>`; }).join(''); })()}
        </tbody></table></div>
        <div class="row"><button class="btn btn-primary" id="lpGo"><i class="fa-solid fa-file-import"></i> Importar ${r.ok.length} pasos a "${esc(e.name)}"</button></div>
        <p class="muted small"><i class="fa-solid fa-circle-info"></i> Después revisa en <b>Cronómetro → Salidas por categoría</b> que cada categoría tenga su hora de salida: los pasos anteriores a la salida no cuentan.</p>` : ''}`;
    $('#lpGo') && ($('#lpGo').onclick = async () => {
      const b = $('#lpGo'); b.disabled = true;
      try {
        const n = await store.addLaps(e.id, r.ok, (done, total) => { b.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Guardando ${done}/${total}…`; });
        toast(`${n} pasos importados a ${e.name}`, 'ok', 5000);
        if (S.eventId !== e.id) { S.eventId = e.id; localStorage.setItem(ACTIVE_KEY, e.id); fillEventSelect(); }
        await reloadLaps();
        $('#lpText').value = '';
        $('#lpPrev').innerHTML = `<p class="small" style="color:var(--green);margin-top:1rem"><i class="fa-solid fa-circle-check"></i> Listo: ${n} pasos importados. <button class="btn btn-sm" data-goto="crono">Revisar salidas en el Cronómetro</button> <button class="btn btn-sm" data-goto="resultados">Ver resultados</button></p>`;
        $$('#lpPrev [data-goto]').forEach((x) => x.onclick = () => go(x.dataset.goto));
      } catch (err) { toast(err.message, 'err', 6000); b.disabled = false; b.textContent = 'Reintentar'; }
    });
  };
  $('#lpCheck').onclick = check;
  $('#lpFmt').onchange = () => $('#lpPrev').innerHTML && check();
  $('#lpEvent').onchange = () => $('#lpPrev').innerHTML && check();
  $('#lpFile').onchange = async (ev) => {
    const f = ev.target.files[0]; if (!f) return;
    if (/\.(csv|txt)$/i.test(f.name)) $('#lpText').value = await f.text();
    else {
      if (!window.XLSX) return toast('El lector de Excel aún está cargando, intenta de nuevo', 'warn');
      const wb = window.XLSX.read(await f.arrayBuffer());
      const rows = window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, dateNF: 'yyyy-mm-dd hh:mm:ss', defval: '' });
      $('#lpText').value = rows.map((r) => r.join('\t')).join('\n');
    }
    ev.target.value = ''; check();
  };
}

async function handleXls(file) {
  if (/\.(csv|txt|tsv)$/i.test(file.name)) return handleRiderText(await file.text());
  if (!window.XLSX) return toast('El lector de Excel aún está cargando, intenta de nuevo', 'warn');
  const wb = window.XLSX.read(await file.arrayBuffer(), { cellDates: true });
  const toJson = (n) => window.XLSX.utils.sheet_to_json(wb.Sheets[n], { defval: null });
  const hasDorsal = (n) => { const r = window.XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1 })[0] || []; return r.some((h) => /^(dorsal|n[uú]mero)$/i.test(String(h).trim())); };
  const sheet = (re) => { const n = wb.SheetNames.find((x) => re.test(x)); return n ? toJson(n) : []; };
  // Hoja de corredores: la que se llame CORREDORES… o, si no, la primera que tenga columna "dorsal"
  const riderSheet = wb.SheetNames.find((x) => /corredor|rider|particip|inscri/i.test(x)) || wb.SheetNames.find(hasDorsal);
  previewRiderImport({ riders: riderSheet ? toJson(riderSheet) : [], categories: sheet(/categor/i), teams: sheet(/equipo|team/i) });
}
/** Lista pegada (copiada de Excel): primera línea = encabezados (dorsal, name/nombre, category/categoría, team/equipo) */
function handleRiderText(text) {
  const lines = String(text).split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return toast('Pega la lista con encabezados: dorsal, nombre, categoría, equipo', 'warn');
  const sep = lines[0].includes('\t') ? '\t' : lines[0].includes(';') ? ';' : ',';
  const head = lines[0].split(sep).map((h) => h.trim());
  if (!head.some((h) => /^(dorsal|n[uú]mero)$/i.test(h))) return toast('La primera línea debe tener los encabezados (dorsal, nombre, categoría, equipo)', 'warn', 5000);
  const riders = lines.slice(1).map((l) => { const c = l.split(sep); return Object.fromEntries(head.map((h, i) => [h, (c[i] ?? '').trim() || null])); });
  previewRiderImport({ riders, categories: [], teams: [] });
}
function previewRiderImport({ riders: raw, categories: rawCats, teams: rawTeams }) {
  const pick = (o, ...keys) => { for (const k of Object.keys(o)) if (keys.includes(k.toLowerCase().trim())) return o[k]; return null; };
  const clean = (v) => String(v ?? '').trim().replace(/\s+/g, ' ');
  let riders = raw.map((o) => ({ dorsal: pick(o, 'dorsal', 'numero', 'número'), name: pick(o, 'name', 'nombre'), category: pick(o, 'category', 'categoria', 'categoría'), team: pick(o, 'team', 'equipo') }))
    .filter((r) => parseInt(r.dorsal, 10));
  const categories = rawCats.map((o) => ({ name: pick(o, 'name', 'nombre'), laps: pick(o, 'laps', 'vueltas') })).filter((c) => c.name);
  const teams = rawTeams.map((o) => ({ name: pick(o, 'name', 'nombre') })).filter((t) => t.name);
  // Sin nombre pero con categoría o equipo → se importa como "Corredor #N" para no perder sus tiempos
  const placeholder = riders.filter((r) => !clean(r.name) && (clean(r.category) || clean(r.team)));
  placeholder.forEach((r) => { r.name = `Corredor #${parseInt(r.dorsal, 10)}`; });
  const empty = riders.filter((r) => !clean(r.name));
  riders = riders.filter((r) => clean(r.name));
  // Avisos
  const byName = {}; riders.forEach((r) => { const k = clean(r.name).toLowerCase(); (byName[k] ||= []).push(r.dorsal); });
  const dupNames = Object.entries(byName).filter(([, d]) => d.length > 1);
  const byDorsal = {}; riders.forEach((r) => { const d = parseInt(r.dorsal, 10); byDorsal[d] = (byDorsal[d] || 0) + 1; });
  const dupDorsal = Object.entries(byDorsal).filter(([, n]) => n > 1).map(([d]) => d);
  const known = new Set(D().categories.map((c) => clean(c.name).toLowerCase()));
  categories.forEach((c) => known.add(clean(c.name).toLowerCase()));
  const newCats = [...new Set(riders.map((r) => clean(r.category)).filter((c) => c && !known.has(c.toLowerCase())).map((c) => c))];
  const newCatsU = [...newCats.reduce((m, c) => (m.has(c.toLowerCase()) ? m : m.set(c.toLowerCase(), c)), new Map()).values()];
  const noCat = riders.filter((r) => !clean(r.category)).map((r) => r.dorsal);
  const noTeam = riders.filter((r) => !clean(r.team)).length;
  const updates = riders.filter((r) => D().riders.some((x) => Number(x.dorsal) === parseInt(r.dorsal, 10))).length;
  const w = (icon, html) => `<p class="small warn-t" style="margin:.35rem 0"><i class="fa-solid ${icon}"></i> ${html}</p>`;
  $('#imp').innerHTML = `<div class="kpis" style="grid-template-columns:repeat(3,1fr);margin-top:1rem">
    <div class="kpi"><i class="fa-solid fa-person-biking"></i><b>${riders.length}</b><span>Corredores</span></div><div class="kpi"><i class="fa-solid fa-layer-group"></i><b>${categories.length + newCatsU.length}</b><span>Categorías</span></div><div class="kpi"><i class="fa-solid fa-rotate"></i><b>${updates}</b><span>Ya existían (se actualizan)</span></div></div>
    ${placeholder.length ? w('fa-user-pen', `${placeholder.length} sin nombre pero con categoría/equipo (dorsal ${placeholder.map((r) => r.dorsal).join(', ')}): se importan como <b>“Corredor #N”</b> para no perder sus tiempos. Edítalos después en Corredores.`) : ''}
    ${empty.length ? `<p class="small muted" style="margin:.35rem 0"><i class="fa-solid fa-ban"></i> ${empty.length} fila(s) vacías se omiten (dorsal ${empty.map((r) => r.dorsal).join(', ')}).</p>` : ''}
    ${dupDorsal.length ? w('fa-clone', `Dorsales repetidos en la lista: ${dupDorsal.join(', ')}. Se queda la <b>última</b> fila de cada uno.`) : ''}
    ${dupNames.length ? w('fa-people-arrows', `Mismo nombre con distinto dorsal: ${dupNames.slice(0, 12).map(([n, d]) => `${esc(n)} (${d.join(', ')})`).join(' · ')}. Revisa si son la misma persona.`) : ''}
    ${newCatsU.length ? w('fa-layer-group', `Categorías nuevas (se crean con <b>1 vuelta</b>; ajústalas en Categorías): ${newCatsU.map(esc).join(', ')}`) : ''}
    ${noCat.length ? w('fa-circle-question', `Sin categoría: dorsal ${noCat.join(', ')} (no aparecerán en resultados hasta asignarles una).`) : ''}
    ${noTeam ? `<p class="small muted" style="margin:.35rem 0"><i class="fa-solid fa-users-slash"></i> ${noTeam} sin equipo: aparecerán como “Independiente”.</p>` : ''}
    <p class="muted small">Los dorsales que ya existan se actualizarán. Los datos se guardan <b>tal como vienen</b> (los equipos no se unifican).</p>
    ${riders.length ? '<button class="btn btn-primary" id="doImp"><i class="fa-solid fa-file-import"></i> Importar ahora</button>' : '<p class="warn-t small">No se encontraron corredores: revisa que exista la columna <b>dorsal</b>.</p>'}`;
  $('#doImp') && ($('#doImp').onclick = async () => {
    $('#doImp').disabled = true; $('#doImp').innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Importando…';
    try {
      const r = await store.bulkImport({ categories, teams, riders }, (msg) => { $('#doImp').innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${esc(msg)}`; });
      toast(`Importados: ${r.riders} corredores, ${r.categories} categorías nuevas, ${r.teams} equipos nuevos`, 'ok', 6000); await reloadLaps();
      $('#imp').innerHTML = `<p class="small" style="color:var(--green);margin-top:1rem"><i class="fa-solid fa-circle-check"></i> Listo: ${r.riders} corredores, ${r.categories} categorías y ${r.teams} equipos nuevos.</p>`;
    }
    catch (err) { toast(err.message, 'err', 5000); $('#doImp').disabled = false; }
  });
}
