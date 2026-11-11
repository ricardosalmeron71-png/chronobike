// Motor de cálculo de resultados (puro, sin DOM). Se usa en la vista
// pública, en el panel de staff y en las pruebas automáticas.

export const STATUS = { FINAL: 'FINAL', RACING: 'EN PISTA', DNS: 'SIN PASO', NOSTART: 'SIN SALIDA' };

/** Formatea milisegundos como HH:MM:SS (o MM:SS.d si showTenths y < 1h). */
export function fmtDuration(ms, { tenths = false } = {}) {
  if (ms == null || !isFinite(ms)) return '—';
  const neg = ms < 0; ms = Math.abs(ms);
  const totalS = Math.floor(ms / 1000);
  const h = Math.floor(totalS / 3600), m = Math.floor((totalS % 3600) / 60), s = totalS % 60;
  const p = (n) => String(n).padStart(2, '0');
  let out = `${p(h)}:${p(m)}:${p(s)}`;
  if (tenths) out += '.' + Math.floor((ms % 1000) / 100);
  return (neg ? '-' : '') + out;
}

export function fmtGap(ms) {
  if (ms == null || ms <= 0) return '';
  const totalS = Math.floor(ms / 1000);
  const h = Math.floor(totalS / 3600), m = Math.floor((totalS % 3600) / 60), s = totalS % 60;
  return '+' + (h ? `${h}:${String(m).padStart(2, '0')}:` : `${m}:`) + String(s).padStart(2, '0');
}

/**
 * Hora de salida efectiva de una categoría en un evento.
 * Prioridad: salida específica de la categoría → salida general del evento.
 */
export function startFor(event, categoryId, eventCategories) {
  const ec = eventCategories.find((x) => x.event_id === event.id && x.category_id === categoryId);
  return (ec && ec.start_at) || event.start_at || null;
}

export function lapsFor(event, category, eventCategories) {
  const ec = eventCategories.find((x) => x.event_id === event.id && x.category_id === category?.id);
  return Math.max(1, Number((ec && ec.laps) || category?.laps || 1));
}

/**
 * Calcula la clasificación de un evento.
 * @returns {Array<{category, start, targetLaps, rows: Array}>} agrupado por categoría
 */
export function computeResults({ event, categories, riders, teams, laps, eventCategories = [] }) {
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const lapsByDorsal = new Map();
  for (const l of laps) {
    if (l.event_id !== event.id) continue;
    const d = Number(l.dorsal);
    if (!lapsByDorsal.has(d)) lapsByDorsal.set(d, []);
    lapsByDorsal.get(d).push(l);
  }
  const lapKm = Number(event.lap_km) || 0;

  const groups = categories.map((category) => {
    const startIso = startFor(event, category.id, eventCategories);
    const start = startIso ? new Date(startIso).getTime() : null;
    const targetLaps = lapsFor(event, category, eventCategories);

    const rows = riders
      .filter((r) => r.category_id === category.id)
      .map((rider) => {
        const passes = (lapsByDorsal.get(Number(rider.dorsal)) || [])
          .map((l) => ({ ...l, t: new Date(l.ts).getTime() }))
          .filter((l) => start == null || l.t >= start) // pasos antes de la salida se ignoran
          .sort((a, b) => a.t - b.t);
        const counted = passes.slice(0, targetLaps);
        const extra = passes.slice(targetLaps);
        let prev = start;
        const splits = counted.map((p, i) => {
          const ms = prev == null ? null : p.t - prev;
          prev = p.t;
          return { n: i + 1, ts: p.ts, lapId: p.id, ms, cumulative: start == null ? null : p.t - start };
        });
        const lastT = counted.length ? counted[counted.length - 1].t : null;
        let status = STATUS.DNS;
        if (start == null && counted.length) status = STATUS.NOSTART;
        else if (counted.length >= targetLaps) status = STATUS.FINAL;
        else if (counted.length > 0) status = STATUS.RACING;
        const total = start != null && lastT != null ? lastT - start : null;
        const valid = splits.filter((s) => s.ms != null);
        const best = valid.length ? Math.min(...valid.map((s) => s.ms)) : null;
        const speed = lapKm && total ? (lapKm * counted.length) / (total / 3600000) : null;
        return {
          rider, team: teamById.get(rider.team_id) || null, status, lapsDone: counted.length,
          targetLaps, splits, extraPasses: extra.length, total, lastT, best, speed,
          progress: Math.min(1, counted.length / targetLaps),
        };
      });

    const rank = { [STATUS.FINAL]: 0, [STATUS.RACING]: 1, [STATUS.NOSTART]: 2, [STATUS.DNS]: 3 };
    rows.sort((a, b) =>
      rank[a.status] - rank[b.status] ||
      b.lapsDone - a.lapsDone ||
      (a.lastT ?? Infinity) - (b.lastT ?? Infinity) ||
      Number(a.rider.dorsal) - Number(b.rider.dorsal));

    const leader = rows[0];
    rows.forEach((r, i) => {
      r.position = r.status === STATUS.DNS ? null : i + 1;
      r.gap = null;
      if (i > 0 && leader && r.status === STATUS.FINAL && leader.status === STATUS.FINAL) r.gap = r.total - leader.total;
      else if (i > 0 && leader && r.lapsDone < leader.lapsDone && r.lapsDone > 0) r.lapsBehind = leader.lapsDone - r.lapsDone;
    });
    return { category, start: startIso, targetLaps, rows };
  });

  return groups.filter((g) => g.rows.length);
}

/** Resumen general de un evento (para tarjetas y KPIs). */
export function eventSummary(groups) {
  let riders = 0, finished = 0, racing = 0, passes = 0;
  for (const g of groups) for (const r of g.rows) {
    riders++;
    if (r.status === 'FINAL') finished++;
    if (r.status === 'EN PISTA') racing++;
    passes += r.lapsDone + r.extraPasses;
  }
  return { riders, finished, racing, passes, categories: groups.length };
}

/** CSV con la clasificación (separador ; para Excel en español). */
export function resultsToCSV(event, groups) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const head = ['Evento', 'Categoría', 'Posición', 'Dorsal', 'Corredor', 'Equipo', 'Vueltas', 'Tiempos por vuelta', 'Tiempo oficial', 'Diferencia', 'Velocidad promedio (km/h)', 'Estado'];
  const lines = [head.map(esc).join(';')];
  for (const g of groups) for (const r of g.rows) {
    lines.push([
      event.name, g.category.name, r.position ?? '', r.rider.dorsal, r.rider.name, r.team?.name ?? '',
      `${r.lapsDone}/${r.targetLaps}`, r.splits.map((s) => `V${s.n}: ${fmtDuration(s.ms)}`).join(' | '),
      fmtDuration(r.total), fmtGap(r.gap), r.speed ? r.speed.toFixed(1) : '', r.status,
    ].map(esc).join(';'));
  }
  return '﻿' + lines.join('\r\n');
}
