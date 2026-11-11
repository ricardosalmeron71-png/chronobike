// Vista PÚBLICA: podios, clasificación y tiempos (solo lectura)
import { store } from './store.js';
import { computeResults, eventSummary } from './results.js';
import { $, $$, esc, brand, fmtDate, fmtClock, toast } from './ui.js';
import { showSplash } from './splash.js';
import { eventCard, kpis, podium, resultsTable, riderDetail, liveFeed, EVENT_STATUS } from './views.js';

const state = { eventId: null, cat: 'ALL', view: 'podios', q: '', laps: [], groups: [] };
const app = $('#app');

function readHash() {
  const p = new URLSearchParams(location.hash.slice(1));
  if (p.get('e')) state.eventId = p.get('e');
  if (p.get('c')) state.cat = p.get('c');
  if (p.get('v')) state.view = p.get('v');
}
function writeHash() {
  history.replaceState(null, '', `#e=${encodeURIComponent(state.eventId)}&c=${encodeURIComponent(state.cat)}&v=${state.view}`);
}
const orderedEvents = () => {
  const w = { en_curso: 0, finalizado: 1, proximo: 2 };
  return [...store.data.events].sort((a, b) => (w[a.status] ?? 3) - (w[b.status] ?? 3) || String(b.date).localeCompare(String(a.date)));
};
const currentEvent = () => store.data.events.find((e) => e.id === state.eventId);

async function loadEvent() {
  const ev = currentEvent(); if (!ev) return;
  state.laps = await store.getLaps(ev.id);
  state.groups = computeResults({ event: ev, ...store.data, eventCategories: store.data.event_categories, laps: state.laps });
}

function renderShell() {
  const ev = currentEvent();
  const st = EVENT_STATUS[ev?.status] || EVENT_STATUS.proximo;
  const live = store.data.events.find((e) => e.status === 'en_curso');
  $('#liveChip').innerHTML = live ? `<i class="live-dot"></i> En vivo: ${esc(live.name)}` : '<i class="fa-regular fa-calendar"></i> Sin carreras en curso';
  app.innerHTML = `
    <section class="hero">
      <div><h1>Resultados <span>${ev?.status === 'en_curso' ? 'en vivo' : 'oficiales'}</span></h1>
        <p>Consulta podios, tiempos por vuelta y clasificación de cada categoría. Toca a cualquier corredor para ver su detalle.</p></div>
      <div class="search"><i class="fa-solid fa-magnifying-glass"></i><input id="q" type="search" placeholder="Buscar por nombre, dorsal o equipo…" value="${esc(state.q)}" autocomplete="off"></div>
    </section>
    <div class="section-title"><h3><i class="fa-solid fa-calendar-days" style="color:var(--orange)"></i> Eventos</h3><span class="muted small">Desliza para ver el historial</span></div>
    <div class="events-strip">${orderedEvents().map((e) => eventCard(e, { active: e.id === state.eventId })).join('')}</div>
    ${ev ? `<div class="event-head"><div>
        <span class="badge ${ev.status === 'en_curso' ? 'st-racing' : ev.status === 'finalizado' ? 'st-final' : 'st-dns'}">${ev.status === 'en_curso' ? '<i class="live-dot"></i>' : ''}${st.label}</span>
        <h1 style="margin-top:.4rem">${esc(ev.name)}</h1>
        <div class="meta"><span><i class="fa-regular fa-calendar"></i> ${fmtDate(ev.date)}</span><span><i class="fa-solid fa-location-dot"></i> ${esc(ev.location || '')}</span>
        <span><i class="fa-solid fa-flag"></i> Salida ${fmtClock(ev.start_at)}</span>${ev.lap_km ? `<span><i class="fa-solid fa-route"></i> ${ev.lap_km} km por vuelta</span>` : ''}</div></div>
        <div class="row no-print"><button class="btn btn-sm" id="share"><i class="fa-solid fa-share-nodes"></i> Compartir</button><button class="btn btn-sm" id="printBtn"><i class="fa-solid fa-print"></i> Imprimir</button></div>
      </div>
      <div id="kpis"></div>
      <div class="toolbar">
        <div class="seg" id="views">
          <button data-v="podios" class="${state.view === 'podios' ? 'on' : ''}"><i class="fa-solid fa-trophy"></i> Podios</button>
          <button data-v="tabla" class="${state.view === 'tabla' ? 'on' : ''}"><i class="fa-solid fa-list-ol"></i> Clasificación</button>
          <button data-v="pasos" class="${state.view === 'pasos' ? 'on' : ''}"><i class="fa-solid fa-flag-checkered"></i> Últimos pasos</button>
        </div>
      </div>
      <div class="cat-chips" id="cats"></div>
      <div id="content" style="margin-top:1rem"></div>` : '<div class="empty"><i class="fa-solid fa-calendar-xmark"></i>No hay eventos publicados todavía.</div>'}`;

  $$('.event-card').forEach((b) => b.onclick = async () => { state.eventId = b.dataset.event; state.cat = 'ALL'; await loadEvent(); writeHash(); renderShell(); });
  $$('#views button').forEach((b) => b.onclick = () => { state.view = b.dataset.v; $$('#views button').forEach((x) => x.classList.toggle('on', x === b)); writeHash(); renderBody(); });
  $('#q').oninput = (e) => { state.q = e.target.value.trim(); renderBody(); };
  if ($('#printBtn')) $('#printBtn').onclick = () => window.print();
  if ($('#share')) $('#share').onclick = async () => {
    const url = location.href;
    try { if (navigator.share) await navigator.share({ title: currentEvent().name, url }); else { await navigator.clipboard.writeText(url); toast('Enlace copiado'); } } catch { /* cancelado */ }
  };
  $('.event-card.active')?.scrollIntoView({ inline: 'center', block: 'nearest' });
  renderBody();
}

function renderBody() {
  const ev = currentEvent(); if (!ev || !$('#content')) return;
  $('#kpis').innerHTML = kpis(eventSummary(state.groups));
  const cats = state.groups.map((g) => g.category);
  $('#cats').innerHTML = `<button class="cat-chip ${state.cat === 'ALL' ? 'on' : ''}" data-c="ALL"><i class="fa-solid fa-layer-group"></i> Todas</button>` +
    cats.map((c) => `<button class="cat-chip ${state.cat === c.id ? 'on' : ''}" data-c="${esc(c.id)}" style="--c:${esc(c.color)}"><span class="cat-dot" style="--c:${esc(c.color)}"></span>${esc(c.name)}</button>`).join('');
  $$('#cats .cat-chip').forEach((b) => b.onclick = () => { state.cat = b.dataset.c; writeHash(); renderBody(); });

  let groups = state.groups.filter((g) => state.cat === 'ALL' || g.category.id === state.cat);
  const q = state.q.toLowerCase();
  if (q) groups = groups.map((g) => ({ ...g, rows: g.rows.filter((r) => `${r.rider.name} ${r.rider.dorsal} ${r.team?.name || ''}`.toLowerCase().includes(q)) })).filter((g) => g.rows.length);

  const c = $('#content');
  if (ev.status === 'proximo' && !state.laps.length) {
    c.innerHTML = `<div class="card"><div class="empty"><i class="fa-solid fa-hourglass-start"></i><h3>Este evento aún no inicia</h3>
      <p>Salida general: <b>${fmtDate(ev.date)} · ${fmtClock(ev.start_at)}</b>. Aquí verás los resultados en vivo el día de la carrera.</p></div></div>`;
    return;
  }
  if (!groups.length) { c.innerHTML = `<div class="empty"><i class="fa-solid fa-magnifying-glass"></i>Sin resultados para tu búsqueda.</div>`; return; }

  if (state.view === 'podios' && !q) c.innerHTML = `<div class="podium-grid">${groups.map(podium).join('')}</div>`;
  else if (state.view === 'pasos') {
    const dorsals = new Set(groups.flatMap((g) => g.rows.map((r) => Number(r.rider.dorsal))));
    c.innerHTML = `<div class="card">${liveFeed(state.laps.filter((l) => dorsals.has(Number(l.dorsal))), store.data, 40)}</div>`;
  } else c.innerHTML = groups.map((g) => resultsTable(g, { showDns: !!q })).join('');

  $$('[data-rider]', c).forEach((el) => el.onclick = () => {
    const d = Number(el.dataset.rider);
    for (const g of state.groups) { const r = g.rows.find((x) => Number(x.rider.dorsal) === d); if (r) return riderDetail(g, r, ev); }
  });
}

const splash = showSplash();
(async function main() {
  $('#brand').innerHTML = brand('Resultados');
  await store.init((p, m) => splash.step(p, m));
  if (store.mode === 'demo') $('#demoBanner').innerHTML = `<div class="demo-banner"><i class="fa-solid fa-flask"></i> MODO DEMOSTRACIÓN · datos ficticios · la carrera "en vivo" avanza sola. <a href="./admin.html">Probar el panel de staff →</a></div>`;
  readHash();
  if (!currentEvent()) state.eventId = orderedEvents()[0]?.id;
  splash.step(0.88, 'Calculando resultados…');
  await loadEvent(); writeHash(); renderShell();
  splash.done();
  let busy = false;
  store.subscribe(async (what) => {
    if (busy) return; busy = true;
    try {
      if (['events', 'categories', 'teams', 'riders', 'all'].includes(what)) { await loadEvent(); renderShell(); }
      else { const before = state.laps.length; await loadEvent(); if (what !== 'tick' || state.laps.length !== before) renderBody(); }
    } finally { busy = false; }
  });
})().catch((e) => { console.error(e); splash.fail(); app.innerHTML = `<div class="empty"><i class="fa-solid fa-plug-circle-xmark"></i>No se pudo conectar con la base de datos.<br><small>${esc(e.message)}</small></div>`; });
