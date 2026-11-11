// Lector de pasos por meta en lote (texto pegado, CSV o Excel ya convertido a filas).
// Acepta líneas como:
//   11/1/2026 7:34:46<TAB>103        (fecha hora, dorsal)
//   2026-11-01 07:34:46,103
//   103;01/11/2026 07:34:46 a. m.    (dorsal primero)
//   7:34:46 103                      (solo hora: se usa la fecha del evento)
// Funciones puras: sin DOM, para poder probarlas.

const DATE = String.raw`(\d{1,4})[\/\-.](\d{1,2})[\/\-.](\d{1,4})`;
const TIME = String.raw`(\d{1,2}):(\d{2})(?::(\d{2})(?:[.,](\d{1,3}))?)?\s*([ap])?\.?\s*m?\.?`;
const SEP = String.raw`[\s,;|]+`;
const RE_DT_D = new RegExp(String.raw`^\s*${DATE}[\sT,]+${TIME}${SEP}#?(\d{1,5})\s*$`, 'i');
const RE_D_DT = new RegExp(String.raw`^\s*#?(\d{1,5})${SEP}${DATE}[\sT,]+${TIME}\s*$`, 'i');
const RE_T_D = new RegExp(String.raw`^\s*${TIME}${SEP}#?(\d{1,5})\s*$`, 'i');
const RE_D_T = new RegExp(String.raw`^\s*#?(\d{1,5})${SEP}${TIME}\s*$`, 'i');

/** Convierte una línea en { date:[a,b,c]|null, time:{h,m,s,ms}, dorsal } o null. */
export function parseLine(line) {
  const l = String(line).replace(/ /g, ' ').trim();
  if (!l) return null;
  let m;
  const time = (h, mi, s, ms, ap) => {
    let H = Number(h);
    if (ap) { ap = ap.toLowerCase(); if (ap === 'p' && H < 12) H += 12; if (ap === 'a' && H === 12) H = 0; }
    return { h: H, m: Number(mi), s: Number(s || 0), ms: Number(String(ms || 0).padEnd(3, '0')) };
  };
  if ((m = l.match(RE_DT_D))) return { date: [m[1], m[2], m[3]], time: time(m[4], m[5], m[6], m[7], m[8]), dorsal: Number(m[9]) };
  if ((m = l.match(RE_D_DT))) return { date: [m[2], m[3], m[4]], time: time(m[5], m[6], m[7], m[8], m[9]), dorsal: Number(m[1]) };
  if ((m = l.match(RE_T_D))) return { date: null, time: time(m[1], m[2], m[3], m[4], m[5]), dorsal: Number(m[6]) };
  if ((m = l.match(RE_D_T))) return { date: null, time: time(m[2], m[3], m[4], m[5], m[6]), dorsal: Number(m[1]) };
  return null;
}

/** Interpreta [a,b,c] como {y,mo,d} según el formato 'ymd' | 'mdy' | 'dmy'. */
function ymd(parts, fmt) {
  const [a, b, c] = parts.map(Number);
  if (String(parts[0]).length === 4) return { y: a, mo: b, d: c };
  const y = c < 100 ? 2000 + c : c;
  return fmt === 'dmy' ? { y, mo: b, d: a } : { y, mo: a, d: b };
}
const valid = ({ y, mo, d }) => mo >= 1 && mo <= 12 && d >= 1 && d <= 31 && y > 1990;

/**
 * Decide el formato de fecha: si alguna fecha solo tiene sentido de un modo, ese;
 * si no, el que coincida con la fecha del evento; si no, mes/día/año.
 */
export function detectFormat(parsed, eventDate) {
  const dated = parsed.filter((p) => p && p.date && String(p.date[0]).length !== 4);
  if (!dated.length) return 'ymd';
  const okM = dated.every((p) => valid(ymd(p.date, 'mdy')));
  const okD = dated.every((p) => valid(ymd(p.date, 'dmy')));
  if (okM && !okD) return 'mdy';
  if (okD && !okM) return 'dmy';
  if (eventDate) {
    const [ey, em, ed] = String(eventDate).slice(0, 10).split('-').map(Number);
    const hit = (f) => dated.filter((p) => { const x = ymd(p.date, f); return x.y === ey && x.mo === em && x.d === ed; }).length;
    const hm = hit('mdy'), hd = hit('dmy');
    if (hd > hm) return 'dmy';
  }
  return 'mdy';
}

/**
 * Procesa todo el texto/filas.
 * @param {string[]} lines  líneas de texto (cada fila de Excel unida con tabuladores)
 * @param {{eventDate:string, format?:'auto'|'mdy'|'dmy', existing?:Array<{dorsal,ts}>}} opts
 * @returns {{ok:Array<{dorsal,ts,line}>, dup:Array, bad:Array<{n,line}>, format:string}}
 */
export function parseLaps(lines, { eventDate, format = 'auto', existing = [] } = {}) {
  const parsed = lines.map((l) => parseLine(l));
  const fmt = format === 'auto' ? detectFormat(parsed, eventDate) : format;
  const key = (d, t) => `${Number(d)}|${Math.round(t / 1000)}`;
  const seen = new Set(existing.map((l) => key(l.dorsal, new Date(l.ts).getTime())));
  const ok = [], dup = [], bad = [];
  const [ey, em, ed] = String(eventDate || '').slice(0, 10).split('-').map(Number);
  parsed.forEach((p, i) => {
    const line = String(lines[i]).trim();
    if (!line) return;
    if (!p || !p.dorsal) { bad.push({ n: i + 1, line }); return; }
    const dt = p.date ? ymd(p.date, fmt) : { y: ey, mo: em, d: ed };
    if (!valid(dt) || p.time.h > 23 || p.time.m > 59 || p.time.s > 59) { bad.push({ n: i + 1, line }); return; }
    const t = new Date(dt.y, dt.mo - 1, dt.d, p.time.h, p.time.m, p.time.s, p.time.ms).getTime(); // hora local del navegador
    if (Number.isNaN(t)) { bad.push({ n: i + 1, line }); return; }
    const k = key(p.dorsal, t);
    if (seen.has(k)) { dup.push({ n: i + 1, line, dorsal: p.dorsal, ts: new Date(t).toISOString() }); return; }
    seen.add(k);
    ok.push({ n: i + 1, line, dorsal: p.dorsal, ts: new Date(t).toISOString() });
  });
  ok.sort((a, b) => a.ts.localeCompare(b.ts));
  return { ok, dup, bad, format: fmt };
}
