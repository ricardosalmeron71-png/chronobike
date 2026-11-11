// Utilidades de interfaz compartidas
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function toast(msg, type = 'ok', ms = 2600) {
  let box = $('#toasts');
  if (!box) { box = document.createElement('div'); box.id = 'toasts'; document.body.appendChild(box); }
  const el = document.createElement('div');
  const icon = { ok: 'fa-circle-check', warn: 'fa-triangle-exclamation', err: 'fa-circle-xmark', info: 'fa-circle-info' }[type];
  el.className = `toast toast-${type}`; el.innerHTML = `<i class="fa-solid ${icon}"></i><span>${esc(msg)}</span>`;
  box.appendChild(el); requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, ms);
}

export function modal(html, { wide = false, onClose } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'modal-wrap';
  wrap.innerHTML = `<div class="modal ${wide ? 'modal-wide' : ''}" role="dialog" aria-modal="true">
    <button class="modal-x" data-close aria-label="Cerrar"><i class="fa-solid fa-xmark"></i></button>${html}</div>`;
  const close = () => { wrap.classList.remove('show'); setTimeout(() => wrap.remove(), 200); document.removeEventListener('keydown', onKey); onClose?.(); };
  const onKey = (e) => e.key === 'Escape' && close();
  wrap.addEventListener('click', (e) => { if (e.target === wrap || e.target.closest('[data-close]')) close(); });
  document.addEventListener('keydown', onKey);
  document.body.appendChild(wrap); requestAnimationFrame(() => wrap.classList.add('show'));
  return { el: wrap.querySelector('.modal'), close };
}

export function confirmDialog(title, text, { ok = 'Eliminar', danger = true } = {}) {
  return new Promise((resolve) => {
    let done = false;
    const m = modal(`<div class="confirm"><div class="confirm-ico ${danger ? 'danger' : ''}"><i class="fa-solid ${danger ? 'fa-trash-can' : 'fa-circle-question'}"></i></div>
      <h3>${esc(title)}</h3><p>${esc(text)}</p>
      <div class="row-end"><button class="btn btn-ghost" data-close>Cancelar</button><button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-ok>${esc(ok)}</button></div></div>`,
    { onClose: () => !done && resolve(false) });
    m.el.querySelector('[data-ok]').onclick = () => { done = true; resolve(true); m.close(); };
  });
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export function fmtDate(d) {
  if (!d) return '';
  const [y, m, day] = String(d).slice(0, 10).split('-').map(Number);
  return `${day} ${MONTHS[m - 1]} ${y}`;
}
export const fmtClock = (iso) => (iso ? new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) : '—');
export const toLocalInput = (iso) => { if (!iso) return ''; const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
export const fromLocalInput = (v) => (v ? new Date(v).toISOString() : null);

export function initials(name) { return String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase(); }
export function avatar(rider, color = '#ff5a1f', size = '') {
  if (rider?.photo_url) return `<img class="avatar ${size}" src="${esc(rider.photo_url)}" alt="">`;
  return `<span class="avatar ${size}" style="--c:${esc(color)}">${esc(initials(rider?.name))}</span>`;
}

/** Reduce una imagen a máx. `max` px y devuelve un data URL JPEG ligero. */
export function resizeImage(file, max = 240) {
  return new Promise((resolve, reject) => {
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = reject; img.src = url;
  });
}

export function download(filename, content, type = 'text/csv;charset=utf-8') {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([content], { type })); a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export const LOGO = `<svg class="logo-svg" viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffb21f"/><stop offset="1" stop-color="#ff4d1f"/></linearGradient></defs>
<circle cx="32" cy="36" r="22" fill="none" stroke="url(#lg)" stroke-width="5"/><rect x="26" y="4" width="12" height="6" rx="2" fill="url(#lg)"/><rect x="30" y="9" width="4" height="6" fill="url(#lg)"/>
<g stroke="#fff" stroke-width="2" opacity=".9"><line x1="32" y1="36" x2="32" y2="18"/><line x1="32" y1="36" x2="47" y2="45"/><line x1="32" y1="36" x2="17" y2="45"/><line x1="32" y1="36" x2="45" y2="26"/><line x1="32" y1="36" x2="19" y2="26"/></g>
<circle cx="32" cy="36" r="4" fill="#fff"/><path d="M32 36 L32 20" stroke="url(#lg)" stroke-width="3.5" stroke-linecap="round"/></svg>`;

export function brand(sub = '') {
  return `<a class="brand" href="./index.html">${LOGO}<span><b>Chrono<em>Bike</em></b>${sub ? `<small>${esc(sub)}</small>` : ''}</span></a>`;
}
