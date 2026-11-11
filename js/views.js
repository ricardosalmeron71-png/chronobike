// Componentes visuales de resultados (compartidos entre vista pública y staff)
import { esc, avatar, fmtDate, fmtClock, modal } from './ui.js';
import { fmtDuration, fmtGap, STATUS } from './results.js';

export const STATUS_UI = {
  [STATUS.FINAL]: { cls: 'st-final', icon: 'fa-flag-checkered', label: 'Meta' },
  [STATUS.RACING]: { cls: 'st-racing', icon: 'fa-person-biking', label: 'En pista' },
  [STATUS.DNS]: { cls: 'st-dns', icon: 'fa-hourglass-start', label: 'Sin paso' },
  [STATUS.NOSTART]: { cls: 'st-dns', icon: 'fa-circle-exclamation', label: 'Sin salida' },
};
export const EVENT_STATUS = {
  en_curso: { cls: 'ev-live', label: 'EN VIVO' },
  finalizado: { cls: 'ev-done', label: 'Finalizado' },
  proximo: { cls: 'ev-next', label: 'Próximo' },
};

export const fmtSpeed = (v) => (v ? `${v.toFixed(1)} km/h` : '—');
export const statusBadge = (s) => { const u = STATUS_UI[s]; return `<span class="badge ${u.cls}"><i class="fa-solid ${u.icon}"></i>${u.label}</span>`; };

export function eventCard(ev, { active = false, stats = null } = {}) {
  const st = EVENT_STATUS[ev.status] || EVENT_STATUS.proximo;
  return `<button class="event-card ${active ? 'active' : ''} ${st.cls}" data-event="${esc(ev.id)}">
    <span class="ev-badge">${ev.status === 'en_curso' ? '<i class="live-dot"></i>' : ''}${st.label}</span>
    <span class="ev-date"><i class="fa-regular fa-calendar"></i> ${fmtDate(ev.date)}</span>
    <strong class="ev-name">${esc(ev.name)}</strong>
    <span class="ev-loc"><i class="fa-solid fa-location-dot"></i> ${esc(ev.location || 'Sin sede')}</span>
    ${stats ? `<span class="ev-mini">${stats}</span>` : ''}
  </button>`;
}

export function kpis(sum) {
  const k = (icon, val, label, cls = '') => `<div class="kpi ${cls}"><i class="fa-solid ${icon}"></i><b>${val}</b><span>${label}</span></div>`;
  return `<div class="kpis">${k('fa-users', sum.riders, 'Corredores')}${k('fa-flag-checkered', sum.finished, 'En meta', 'k-green')}
    ${k('fa-person-biking', sum.racing, 'En pista', 'k-lime')}${k('fa-layer-group', sum.categories, 'Categorías')}${k('fa-stopwatch', sum.passes, 'Pasos registrados', 'k-orange')}</div>`;
}

export function podium(group) {
  const top = group.rows.filter((r) => r.status === STATUS.FINAL).slice(0, 3);
  const color = group.category.color || '#ff5a1f';
  const head = `<div class="cat-head"><span class="cat-dot" style="--c:${esc(color)}"></span><h3>${esc(group.category.name)}</h3>
    <span class="muted">${group.targetLaps} ${group.targetLaps === 1 ? 'vuelta' : 'vueltas'} · Salida ${fmtClock(group.start)}</span></div>`;
  if (!top.length) {
    const racing = group.rows.filter((r) => r.status === STATUS.RACING).length;
    return `<section class="podium-card" style="--c:${esc(color)}">${head}<div class="empty small"><i class="fa-solid fa-hourglass-half"></i>
      ${racing ? `${racing} corredor(es) en pista. El podio aparecerá cuando crucen la meta.` : 'Aún no hay corredores en meta.'}</div></section>`;
  }
  const order = [top[1], top[0], top[2]];
  const place = ['p2', 'p1', 'p3'];
  return `<section class="podium-card" style="--c:${esc(color)}">${head}<div class="podium">
    ${order.map((r, i) => r ? `<div class="pod ${place[i]}" data-rider="${esc(r.rider.dorsal)}">
      <div class="pod-avatar">${avatar(r.rider, color, 'lg')}<span class="medal">${place[i].slice(1)}</span></div>
      <b class="pod-name">${esc(r.rider.name)}</b><span class="pod-team">${esc(r.team?.name || 'Independiente')}</span>
      <span class="pod-time">${fmtDuration(r.total)}</span>${r.speed ? `<span class="pod-speed"><i class="fa-solid fa-gauge-high"></i> ${fmtSpeed(r.speed)}</span>` : ''}${r.gap ? `<span class="pod-gap">${fmtGap(r.gap)}</span>` : '<span class="pod-gap lead">Ganador</span>'}
      <div class="pod-step"><span>${place[i].slice(1)}°</span><small>#${esc(r.rider.dorsal)}</small></div></div>` : '<div class="pod empty-pod"></div>').join('')}
  </div></section>`;
}

export function resultsTable(group, { showDns = true, admin = false } = {}) {
  const color = group.category.color || '#ff5a1f';
  const rows = group.rows.filter((r) => showDns || r.status !== STATUS.DNS);
  const maxLaps = group.targetLaps;
  const hasSpeed = rows.some((r) => r.speed);
  return `<section class="table-card" style="--c:${esc(color)}">
    <div class="cat-head"><span class="cat-dot" style="--c:${esc(color)}"></span><h3>${esc(group.category.name)}</h3>
    <span class="muted">${group.targetLaps} ${group.targetLaps === 1 ? 'vuelta' : 'vueltas'} · Salida ${fmtClock(group.start)}</span>
    <span class="grow"></span><span class="chip">${rows.length} corredores</span></div>
    <div class="table-scroll"><table class="results">
    <thead><tr><th>Pos</th><th>Corredor</th><th class="hide-sm">Progreso</th>${Array.from({ length: maxLaps }, (_, i) => `<th class="num hide-sm">V${i + 1}</th>`).join('')}
    <th class="num">Tiempo</th><th class="num hide-xs">Dif.</th>${hasSpeed ? '<th class="num hide-xs" title="Velocidad promedio">Vel. prom.</th>' : ''}<th>Estado</th></tr></thead><tbody>
    ${rows.map((r) => `<tr data-rider="${esc(r.rider.dorsal)}" class="${r.position && r.position <= 3 && r.status === STATUS.FINAL ? 'top' + r.position : ''}">
      <td class="pos">${r.position && r.status !== STATUS.DNS ? `<span class="pos-n">${r.position}</span>` : '—'}</td>
      <td><div class="who">${avatar(r.rider, color)}<div><b>${esc(r.rider.name)}</b><small><span class="bib">#${esc(r.rider.dorsal)}</span> ${esc(r.team?.name || 'Independiente')}</small></div></div></td>
      <td class="hide-sm"><div class="laps-bar" title="${r.lapsDone}/${r.targetLaps}">${Array.from({ length: maxLaps }, (_, i) => `<i class="${i < r.lapsDone ? 'on' : ''}"></i>`).join('')}</div><small class="muted">${r.lapsDone}/${r.targetLaps}${r.extraPasses ? ` <span class="warn-t" title="Pasos extra ignorados">+${r.extraPasses}</span>` : ''}</small></td>
      ${Array.from({ length: maxLaps }, (_, i) => { const s = r.splits[i]; return `<td class="num mono hide-sm ${s && s.ms === r.best && r.splits.length > 1 ? 'best' : ''}">${s ? fmtDuration(s.ms) : ''}</td>`; }).join('')}
      <td class="num mono strong">${r.status === STATUS.FINAL ? fmtDuration(r.total) : r.lapsDone ? `<span class="muted">${fmtDuration(r.splits.at(-1)?.cumulative)}</span>` : ''}</td>
      <td class="num mono hide-xs muted">${r.gap ? fmtGap(r.gap) : r.lapsBehind ? `-${r.lapsBehind}V` : ''}</td>
      ${hasSpeed ? `<td class="num mono hide-xs">${r.speed ? `${r.speed.toFixed(1)} <small class="muted">km/h</small>` : ''}</td>` : ''}
      <td>${statusBadge(r.status)}</td></tr>`).join('') || `<tr><td colspan="${7 + maxLaps}" class="empty small">Sin corredores en esta categoría</td></tr>`}
    </tbody></table></div></section>`;
}

export function riderDetail(group, row, event) {
  const color = group.category.color || '#ff5a1f';
  const max = Math.max(...row.splits.map((s) => s.ms || 0), 1);
  return modal(`<div class="rider-detail" style="--c:${esc(color)}">
    <div class="rd-head">${avatar(row.rider, color, 'xl')}<div><span class="bib big">#${esc(row.rider.dorsal)}</span>
      <h2>${esc(row.rider.name)}</h2><p class="muted"><i class="fa-solid fa-users"></i> ${esc(row.team?.name || 'Independiente')} · <span class="cat-dot" style="--c:${esc(color)}"></span> ${esc(group.category.name)}</p></div></div>
    <div class="rd-stats">
      <div><span>Posición</span><b>${row.position ? row.position + '°' : '—'}</b></div>
      <div><span>Tiempo oficial</span><b class="mono">${row.status === STATUS.FINAL ? fmtDuration(row.total) : '—'}</b></div>
      <div><span>Vueltas</span><b>${row.lapsDone}/${row.targetLaps}</b></div>
      <div><span>Mejor vuelta</span><b class="mono">${fmtDuration(row.best)}</b></div>
      ${row.speed ? `<div><span>Vel. promedio</span><b>${row.speed.toFixed(1)} km/h</b></div>` : ''}
    </div>
    <h4>Tiempos por vuelta</h4>
    <div class="lap-bars">${row.splits.map((s) => `<div class="lap-bar ${s.ms === row.best ? 'best' : ''}"><span>V${s.n}</span>
      <div><i style="width:${Math.max(8, ((s.ms || 0) / max) * 100)}%"></i></div><b class="mono">${fmtDuration(s.ms)}</b><small class="muted">paso ${fmtClock(s.ts)}</small></div>`).join('') || '<p class="muted">Sin pasos registrados.</p>'}</div>
    <p class="muted small">${esc(event.name)} · ${fmtDate(event.date)}</p></div>`);
}

export function liveFeed(laps, ctx, limit = 25) {
  const { riders, categories } = ctx;
  const sorted = [...laps].sort((a, b) => new Date(b.ts) - new Date(a.ts)).slice(0, limit);
  if (!sorted.length) return `<div class="empty"><i class="fa-solid fa-flag"></i>Todavía no hay pasos por meta.</div>`;
  return `<ul class="feed">${sorted.map((l) => {
    const r = riders.find((x) => Number(x.dorsal) === Number(l.dorsal));
    const c = categories.find((x) => x.id === r?.category_id);
    return `<li data-rider="${esc(l.dorsal)}"><span class="bib" style="--c:${esc(c?.color || '#64748b')}">#${esc(l.dorsal)}</span>
      <div><b>${esc(r?.name || 'Dorsal no registrado')}</b><small class="muted">${esc(c?.name || '—')}</small></div><span class="mono">${fmtClock(l.ts)}</span></li>`;
  }).join('')}</ul>`;
}
