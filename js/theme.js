// Diseños visuales intercambiables. El tema se guarda en este dispositivo y se aplica
// a las tres pantallas (pública, staff y TV). Ver css/themes.css.
import { modal, toast, esc } from './ui.js';

const KEY = 'chronobike_theme';
const GF = 'https://fonts.googleapis.com/css2?display=swap&family=';

export const THEMES = [
  { id: 'original', name: 'Original', tag: 'Actual', desc: 'Oscuro azul noche con naranja y degradados.',
    swatch: ['#070b16', '#111a2e', '#ff5a1f', '#c6f432'], font: 'Barlow Condensed · Inter', fonts: [] },
  { id: 'pista', name: 'Cronometría', tag: 'Broadcast', desc: 'Torre de tiempos de automovilismo: negro plano, rojo señal, esquinas rectas y datos densos. Pensado para leer rápido.',
    swatch: ['#0b0b0c', '#17171a', '#e10600', '#ffffff'], font: 'Titillium Web', fonts: ['Titillium+Web:wght@400;600;700;900'] },
  { id: 'editorial', name: 'Editorial', tag: 'Impreso', desc: 'Sección deportiva de periódico: papel, tinta, titulares serif y cifras monoespaciadas. Sobrio y con autoridad.',
    swatch: ['#f3efe6', '#ffffff', '#111111', '#c8102e'], font: 'Fraunces · IBM Plex', fonts: ['Fraunces:opsz,wght@9..144,600;9..144,800', 'IBM+Plex+Sans:wght@400;500;600;700', 'IBM+Plex+Mono:wght@500;600'] },
  { id: 'sendero', name: 'Sendero', tag: 'Outdoor', desc: 'Marca de montaña: bosque, arena y óxido, con curvas de nivel de mapa topográfico. Cálido y propio del MTB.',
    swatch: ['#ece5d6', '#22362b', '#c4572a', '#e3b04b'], font: 'Archivo · Archivo Narrow', fonts: ['Archivo:wght@400;500;600;700;800', 'Archivo+Narrow:wght@600;700'] },
  { id: 'minimal', name: 'Minimal', tag: 'Producto', desc: 'Software moderno: fondo blanco, líneas finas, un solo acento naranja seguridad y mucho aire. Máxima claridad.',
    swatch: ['#ffffff', '#f5f5f4', '#ff4f00', '#0a0a0a'], font: 'Inter Tight', fonts: ['Inter+Tight:wght@400;500;600;700;800'] },
  { id: 'retro', name: 'Club Retro', tag: 'Jersey 70s', desc: 'Jersey de ciclismo clásico: crema, azul marino, naranja y mostaza en franjas. Con personalidad de club.',
    swatch: ['#f2e8d5', '#1b2a4a', '#e8662b', '#e3a72f'], font: 'Big Shoulders · Work Sans', fonts: ['Big+Shoulders+Display:wght@700;800;900', 'Work+Sans:wght@400;500;600;700'] },
];

export const currentTheme = () => { try { return localStorage.getItem(KEY) || 'original'; } catch { return 'original'; } };

function loadFonts(t) {
  if (!t.fonts.length || document.getElementById('font-' + t.id)) return;
  const l = document.createElement('link'); l.id = 'font-' + t.id; l.rel = 'stylesheet'; l.href = GF + t.fonts.join('&family=');
  document.head.appendChild(l);
}
export function applyTheme(id, { save = true } = {}) {
  const t = THEMES.find((x) => x.id === id) || THEMES[0];
  loadFonts(t);
  if (t.id === 'original') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t.id;
  const meta = document.querySelector('meta[name=theme-color]');
  if (meta) meta.content = t.swatch[0];
  if (save) { try { t.id === 'original' ? localStorage.removeItem(KEY) : localStorage.setItem(KEY, t.id); } catch { /* sin almacenamiento */ } }
  return t;
}
export function initTheme() { applyTheme(currentTheme(), { save: false }); }

/** Selector de diseños (solo admin). Al tocar una opción se ve en vivo. */
export function openThemePicker() {
  const before = currentTheme();
  THEMES.forEach(loadFonts);
  let chosen = before, saved = false;
  const m = modal(`<h2><i class="fa-solid fa-palette" style="color:var(--orange)"></i> Diseño de la app</h2>
    <p class="muted">Toca una opción para verla en vivo en esta pantalla. Se aplica en este dispositivo a la vista pública, el panel y la Pantalla TV.</p>
    <div class="theme-grid">${THEMES.map((t) => `<button class="theme-opt ${t.id === before ? 'on' : ''}" data-theme-id="${t.id}">
      <span class="theme-sw">${t.swatch.map((c) => `<i style="background:${c}"></i>`).join('')}</span>
      <span class="theme-txt"><b>${esc(t.name)} <small>${esc(t.tag)}</small></b><span>${esc(t.desc)}</span><em>${esc(t.font)}</em></span>
      <span class="theme-check"><i class="fa-solid fa-circle-check"></i></span></button>`).join('')}</div>
    <div class="row-end"><button class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-primary" id="thSave"><i class="fa-solid fa-check"></i> Usar este diseño</button></div>`,
  { wide: true, onClose: () => { if (!saved) applyTheme(before); } });
  m.el.querySelectorAll('[data-theme-id]').forEach((b) => b.onclick = () => {
    chosen = b.dataset.themeId; applyTheme(chosen, { save: false });
    m.el.querySelectorAll('[data-theme-id]').forEach((x) => x.classList.toggle('on', x === b));
  });
  m.el.querySelector('#thSave').onclick = () => { saved = true; const t = applyTheme(chosen); m.close(); toast(`Diseño "${t.name}" aplicado`); };
}
