// Pantalla de TV para la meta: clasificación por categoría (rota sola),
// último paso en grande y QR para que el público vea los resultados en su celular.
//
// Parámetros opcionales en la URL:  tv.html?e=<evento>&c=<categoría fija>&s=<segundos por categoría>&n=<filas>
// Teclas:  ← → cambiar categoría · Espacio pausar · F pantalla completa
import { store } from './store.js';
import { computeResults, fmtDuration, fmtGap, STATUS } from './results.js';
import { $, esc, brand, fmtDate, fmtClock } from './ui.js';
import { STATUS_UI } from './views.js';
import { showSplash } from './splash.js';
import { initTheme } from './theme.js';
initTheme();

const qs = new URLSearchParams(location.search);
const S = {
  eventId: qs.get('e'), lockCat: qs.get('c'), secs: Math.max(5, Number(qs.get('s')) || 12), rows: Math.min(15, Number(qs.get('n')) || 10),
  idx: 0, paused: false, laps: [], groups: [], lastLapId: null, timer: null,
};
const root = $('#tv');
const ev = () => store.data.events.find((e) => e.id === S.eventId);

function pickEvent() {
  if (ev()) return;
  const live = store.data.events.find((e) => e.status === 'en_curso');
  S.eventId = (live || store.data.events.find((e) => e.status === 'finalizado') || store.data.events[0])?.id || null;
}
async function load() {
  const e = ev(); if (!e) { S.laps = []; S.groups = []; return; }
  S.laps = await store.getLaps(e.id);
  S.groups = computeResults({ event: e, ...store.data, eventCategories: store.data.event_categories, laps: S.laps });
}
// Categorías a mostrar: las que ya tienen pasos (si ninguna tiene, todas)
function boardGroups() {
  if (S.lockCat) return S.groups.filter((g) => g.category.id === S.lockCat);
  const active = S.groups.filter((g) => g.rows.some((r) => r.lapsDone > 0));
  return active.length ? active : S.groups;
}

function shell() {
  const e = ev();
  const publicUrl = `${location.origin}${location.pathname.replace(/tv\.html$/, '')}index.html${e ? `#e=${encodeURIComponent(e.id)}` : ''}`;
  root.innerHTML = `<div class="tvw">
    <header class="tv-head">${brand('Pantalla de meta')}
      <div class="tv-event"><h1>${esc(e?.name || 'Sin eventos')}</h1><p>${e ? `<i class="fa-solid fa-location-dot"></i> ${esc(e.location || '')} · ${fmtDate(e.date)}` : ''}</p></div>
      ${e?.status === 'en_curso' ? '<span class="tv-live"><i class="live-dot"></i> EN VIVO</span>' : e?.status === 'finalizado' ? '<span class="tv-live" style="color:var(--muted);border-color:var(--line2);background:var(--surface)">RESULTADOS FINALES</span>' : ''}
      ${store.mode === 'demo' ? '<span class="tv-live" style="color:var(--amber);border-color:rgba(255,178,31,.4);background:rgba(255,178,31,.1)"><i class="fa-solid fa-flask"></i> DEMO</span>' : ''}
      <span class="tv-clock" id="clock">${fmtClock(new Date().toISOString())}</span>
    </header>
    <main class="tv-main"><section class="tv-board" id="board"></section>
      <aside class="tv-side"><div class="tv-last" id="last"></div><div class="tv-recent" id="recent"></div></aside></main>
    <footer class="tv-foot"><div class="tv-qr" id="qr"></div>
      <div>Sigue los resultados en tu celular<br><span class="url">${esc(location.host)}</span></div>
      <span class="keys"><kbd>←</kbd> <kbd>→</kbd> categoría · <kbd>Espacio</kbd> pausa · <kbd>F</kbd> pantalla completa</span></footer>
  </div>
  <div class="tv-hint" id="hint"><i class="fa-solid fa-expand"></i> Toca o presiona <b>F</b> para pantalla completa</div>`;
  drawQR(publicUrl);
  setTimeout(() => $('#hint')?.classList.add('hide'), 7000);
}
function drawQR(url) {
  const tryDraw = () => {
    if (!window.qrcode) return setTimeout(tryDraw, 300);
    const q = window.qrcode(0, 'M'); q.addData(url); q.make();
    $('#qr').innerHTML = q.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
  };
  tryDraw();
}

function board() {
  const list = boardGroups(); const el = $('#board'); if (!el) return;
  if (!list.length) { el.innerHTML = '<div class="tv-empty"><div><i class="fa-solid fa-flag"></i>Esperando la salida…</div></div>'; return; }
  S.idx = ((S.idx % list.length) + list.length) % list.length;
  const g = list[S.idx]; const c = g.category.color || '#ff5a1f';
  const rows = g.rows.filter((r) => r.status !== STATUS.DNS).slice(0, S.rows);
  el.style.setProperty('--c', c);
  el.innerHTML = `<div class="tv-cat"><span class="cat-dot" style="--c:${esc(c)}"></span><h2>${esc(g.category.name)}</h2>
      <span class="muted">${g.targetLaps} ${g.targetLaps === 1 ? 'vuelta' : 'vueltas'} · salida ${fmtClock(g.start)}</span>
      <span class="tv-pager">${list.map((_, i) => `<i class="${i === S.idx ? 'on' : ''}"></i>`).join('')}</span></div>
    <div class="tv-timer ${S.paused ? 'paused' : ''}"><i class="${list.length > 1 ? 'run' : ''}" style="--dur:${S.secs}s"></i></div>
    <div class="tv-rows">${rows.length ? rows.map((r) => `<div class="tv-row ${r.status === STATUS.FINAL && r.position <= 3 ? 'p' + r.position : ''}" style="--c:${esc(c)}">
      <span class="tv-pos">${r.position ?? '—'}</span><span class="tv-bib">${esc(r.rider.dorsal)}</span>
      <span class="tv-name"><b>${esc(r.rider.name)}</b><small>${esc(r.team?.name || 'Independiente')}</small></span>
      <span class="tv-laps">${Array.from({ length: Math.min(g.targetLaps, 8) }, (_, i) => `<i class="${i < r.lapsDone ? 'on' : ''}"></i>`).join('')}<span>${r.lapsDone}/${r.targetLaps}</span></span>
      <span class="tv-time ${r.status === STATUS.FINAL ? '' : 'run'}">${r.status === STATUS.FINAL ? fmtDuration(r.total) : fmtDuration(r.splits.at(-1)?.cumulative)}</span>
      <span class="tv-gap">${r.gap ? fmtGap(r.gap) : r.lapsBehind ? `-${r.lapsBehind} V` : r.status === STATUS.RACING ? `<span class="badge ${STATUS_UI[r.status].cls}">En pista</span>` : r.status === STATUS.DNF ? `<span class="badge ${STATUS_UI[r.status].cls}">DNF</span>` : r.position === 1 ? '<span style="color:var(--gold)">🏆</span>' : ''}</span>
    </div>`).join('') : '<div class="tv-empty"><div><i class="fa-solid fa-hourglass-half"></i>Aún no hay pasos en esta categoría</div></div>'}</div>`;
}

function rowFor(dorsal) {
  for (const g of S.groups) { const r = g.rows.find((x) => Number(x.rider.dorsal) === Number(dorsal)); if (r) return { g, r }; }
  return null;
}
function lastPass(flash) {
  const el = $('#last'); if (!el) return;
  const sorted = [...S.laps].sort((a, b) => new Date(b.ts) - new Date(a.ts));
  const l = sorted[0];
  if (!l) { el.innerHTML = '<h3><i class="fa-solid fa-flag-checkered"></i> Último paso por meta</h3><div class="tv-empty" style="min-height:22vh"><div><i class="fa-solid fa-flag"></i>Esperando corredores…</div></div>'; return; }
  const f = rowFor(l.dorsal); const sp = f?.r.splits.find((s) => s.lapId === l.id);
  const c = f?.g.category.color || '#c6f432';
  el.style.setProperty('--c', c);
  el.innerHTML = `<h3><i class="fa-solid fa-flag-checkered"></i> Último paso por meta · ${fmtClock(l.ts)}</h3>
    <div class="hero"><span class="num" style="--c:${esc(c)}">${esc(l.dorsal)}</span>
      <div class="tv-who"><b>${esc(f?.r.rider.name || 'Dorsal no registrado')}</b><small>${esc(f?.g.category.name || '')}${f?.r.team ? ' · ' + esc(f.r.team.name) : ''}</small></div></div>
    <div class="stats"><div><span>Vuelta</span><b>${sp ? `${sp.n}/${f.r.targetLaps}` : '—'}</b></div>
      <div><span>Tiempo vuelta</span><b>${sp ? fmtDuration(sp.ms) : '—'}</b></div>
      <div><span>Posición</span><b>${f?.r.position ? f.r.position + '°' : '—'}</b></div></div>
    ${sp && f.r.status === STATUS.FINAL && sp.n === f.r.targetLaps ? `<div class="finish">🏁 ¡META! TIEMPO OFICIAL ${fmtDuration(f.r.total)}</div>` : ''}`;
  if (flash) { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
  const rec = sorted.slice(1, 9);
  $('#recent').innerHTML = `<h3><i class="fa-solid fa-clock-rotate-left"></i> Pasos anteriores</h3><ul>${rec.map((x) => {
    const ff = rowFor(x.dorsal); const s2 = ff?.r.splits.find((s) => s.lapId === x.id);
    return `<li><span class="tv-bib" style="--c:${esc(ff?.g.category.color || '#64748b')}">${esc(x.dorsal)}</span>
      <div><b>${esc(ff?.r.rider.name || 'Dorsal no registrado')}</b><small>${esc(ff?.g.category.name || '')}</small></div>
      <span class="t">${s2 ? `V${s2.n} · ${fmtDuration(s2.ms)}` : ''}<small class="muted">${fmtClock(x.ts)}</small></span></li>`;
  }).join('')}</ul>`;
  S.lastLapId = l.id;
}

function schedule() {
  clearTimeout(S.timer);
  if (S.paused) return;
  S.timer = setTimeout(() => { S.idx++; board(); schedule(); }, S.secs * 1000);
}
function toggleFs() {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {}); else document.exitFullscreen?.();
}

const splash = showSplash();
(async function main() {
  await store.init((p, m) => splash.step(p, m)); pickEvent();
  splash.step(0.88, 'Calculando clasificación…'); await load();
  shell(); board(); lastPass(false); schedule(); splash.done();
  setInterval(() => { const c = $('#clock'); if (c) c.textContent = fmtClock(new Date().toISOString()); }, 1000);
  document.addEventListener('fullscreenchange', () => document.body.classList.toggle('fs', !!document.fullscreenElement));
  document.addEventListener('click', () => { $('#hint')?.classList.add('hide'); toggleFs(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { S.idx++; board(); schedule(); }
    else if (e.key === 'ArrowLeft') { S.idx--; board(); schedule(); }
    else if (e.key === ' ') { e.preventDefault(); S.paused = !S.paused; board(); schedule(); }
    else if (e.key.toLowerCase() === 'f') toggleFs();
  });
  let busy = false;
  store.subscribe(async (what) => {
    if (busy) return; busy = true;
    try {
      const prev = S.lastLapId; const prevEvent = S.eventId;
      if (['events', 'all', 'remote'].includes(what)) pickEvent();
      await load();
      if (S.eventId !== prevEvent || what === 'events') { shell(); board(); lastPass(false); schedule(); return; }
      const newest = [...S.laps].sort((a, b) => new Date(b.ts) - new Date(a.ts))[0];
      if (newest?.id !== prev) lastPass(true);
      // La tabla se refresca en la siguiente rotación; si hay una sola categoría se refresca ya
      if (boardGroups().length <= 1 || S.paused) board();
    } finally { busy = false; }
  });
})().catch((e) => { console.error(e); splash.fail(); root.innerHTML = `<div class="empty"><i class="fa-solid fa-plug-circle-xmark"></i>No se pudo conectar.<br><small>${esc(e.message)}</small></div>`; });
