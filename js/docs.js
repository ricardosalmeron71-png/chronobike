// Visor de documentación dentro del panel de staff.
// Lee los archivos Markdown de /docs y los muestra con imágenes, tablas,
// diagramas (Mermaid) e índice lateral.
import { $, $$, esc, toast } from './ui.js';

export const DOCS = [
  { file: 'MANUAL_USUARIO.md', title: 'Manual de usuario', icon: 'fa-book-open', desc: 'Paso a paso con capturas: público, registrador y administrador', roles: ['admin', 'registrador'] },
  { file: 'GUIA_ENTRENAMIENTO.md', title: 'Guías de entrenamiento', icon: 'fa-graduation-cap', desc: 'Módulos, ejercicios, simulacro, checklists y evaluación', roles: ['admin', 'registrador'] },
  { file: 'PRESENTACION.md', title: 'Presentación y ventajas', icon: 'fa-person-chalkboard', desc: 'El proyecto, diagnóstico del sistema anterior, comparativa y costos', roles: ['admin'] },
  { file: 'BASE_DE_DATOS_Y_DESPLIEGUE.md', title: 'Base de datos y despliegue', icon: 'fa-database', desc: 'Supabase, Netlify, función de usuarios y mantenimiento', roles: ['admin'] },
  { file: 'SISTEMA_ACTUAL.md', title: 'Sistema actual', icon: 'fa-compass', desc: 'Cómo funciona hoy: esquema, simulación interactiva y plano de la meta', roles: ['admin', 'registrador'] },
];

let markedLib = null, mermaidLib = null;
async function libs() {
  if (!markedLib) markedLib = (await import('https://cdn.jsdelivr.net/npm/marked@12/lib/marked.esm.js')).marked;
  return markedLib;
}
async function mermaid() {
  if (!mermaidLib) {
    mermaidLib = (await import('https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs')).default;
    mermaidLib.initialize({ startOnLoad: false, theme: 'dark', themeVariables: { primaryColor: '#16213a', primaryBorderColor: '#ff5a1f', primaryTextColor: '#e8eefc', lineColor: '#8b9ab8', fontFamily: 'Inter, sans-serif' } });
  }
  return mermaidLib;
}

// Mismo formato de anclas que GitHub (para que funcionen los enlaces del índice)
export const slug = (t) => String(t).toLowerCase().trim().replace(/<[^>]+>/g, '').replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s/g, '-');

const S = { file: null, scrollTo: null };

export async function pageDocs(main, role, pageHead) {
  const list = DOCS.filter((d) => d.roles.includes(role));
  if (!S.file || !list.some((d) => d.file === S.file)) S.file = null;
  if (!S.file) {
    main.innerHTML = pageHead('fa-book', 'Documentación', 'Manuales y guías del sistema, siempre a la mano.') +
      `<div class="grid-cards">${list.map((d) => `<button class="card doc-card" data-doc="${d.file}">
        <i class="fa-solid ${d.icon}"></i><b>${esc(d.title)}</b><span class="muted small">${esc(d.desc)}</span>
        <span class="doc-open">Abrir <i class="fa-solid fa-arrow-right"></i></span></button>`).join('')}</div>`;
    $$('[data-doc]', main).forEach((b) => b.onclick = () => { S.file = b.dataset.doc; pageDocs(main, role, pageHead); });
    return;
  }
  const doc = list.find((d) => d.file === S.file);
  main.innerHTML = `<div class="doc-bar no-print"><button class="btn btn-sm" id="docBack"><i class="fa-solid fa-arrow-left"></i> Documentos</button>
      <div class="seg doc-tabs">${list.map((d) => `<button data-doc="${d.file}" class="${d.file === S.file ? 'on' : ''}"><i class="fa-solid ${d.icon}"></i><span class="hide-m">${esc(d.title)}</span></button>`).join('')}</div>
      <span class="grow"></span><button class="btn btn-sm" id="docPrint"><i class="fa-solid fa-print"></i> Imprimir / PDF</button></div>
    <div class="doc-layout"><article class="doc-body card" id="docBody"><div class="empty"><i class="fa-solid fa-spinner fa-spin"></i>Cargando ${esc(doc.title)}…</div></article>
      <nav class="doc-toc no-print" id="docToc"></nav></div>`;
  $('#docBack').onclick = () => { S.file = null; pageDocs(main, role, pageHead); };
  $('#docPrint').onclick = () => window.print();
  $$('.doc-tabs [data-doc]', main).forEach((b) => b.onclick = () => { S.file = b.dataset.doc; pageDocs(main, role, pageHead); });

  try {
    const [marked, res] = await Promise.all([libs(), fetch(`./docs/${doc.file}`, { cache: 'no-cache' })]);
    if (!res.ok) throw new Error(`No se encontró docs/${doc.file} en el sitio publicado`);
    const md = await res.text();
    const renderer = new marked.Renderer();
    const baseCode = renderer.code.bind(renderer);
    renderer.heading = (text, level, raw) => `<h${level} id="${slug(raw)}">${text}</h${level}>`;
    renderer.code = (code, lang) => (lang === 'mermaid' ? `<div class="mermaid">${esc(code)}</div>` : baseCode(code, lang));
    const html = marked.parse(md, { renderer, gfm: true });
    const body = $('#docBody');
    body.innerHTML = html;
    // Rutas de imágenes y enlaces relativos a /docs
    $$('img', body).forEach((img) => {
      const src = img.getAttribute('src') || '';
      if (!/^(https?:|data:|\/)/.test(src)) img.src = './docs/' + src;
      img.loading = 'lazy';
      img.onclick = () => window.open(img.src, '_blank');
    });
    $$('a', body).forEach((a) => {
      const href = a.getAttribute('href') || '';
      const other = DOCS.find((d) => href.startsWith(d.file));
      if (other) {
        a.onclick = (e) => { e.preventDefault(); if (!other.roles.includes(role)) return toast('Ese documento es solo para administradores', 'info'); S.file = other.file; S.scrollTo = href.split('#')[1] || null; pageDocs(main, role, pageHead); };
      } else if (href.startsWith('#')) {
        a.onclick = (e) => { e.preventDefault(); document.getElementById(decodeURIComponent(href.slice(1)))?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
      } else if (/^\.\.\//.test(href)) {
        a.href = href.replace(/^\.\.\//, './'); a.target = '_blank';
      } else if (/^https?:/.test(href)) a.target = '_blank';
    });
    // Índice lateral
    const heads = $$('h2, h3', body);
    $('#docToc').innerHTML = heads.length ? `<b>En este documento</b>${heads.map((h) => `<a href="#${h.id}" class="${h.tagName === 'H3' ? 'sub' : ''}">${esc(h.textContent)}</a>`).join('')}` : '';
    $$('#docToc a').forEach((a) => a.onclick = (e) => { e.preventDefault(); document.getElementById(a.getAttribute('href').slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
    if (S.scrollTo) { document.getElementById(decodeURIComponent(S.scrollTo))?.scrollIntoView({ block: 'start' }); S.scrollTo = null; } else window.scrollTo(0, 0);
    // Diagramas
    const diagrams = $$('.mermaid', body);
    if (diagrams.length) {
      try { const m = await mermaid(); await m.run({ nodes: diagrams }); } catch (e) { console.warn('Mermaid', e); diagrams.forEach((d) => d.classList.add('mermaid-fail')); }
    }
  } catch (e) {
    $('#docBody').innerHTML = `<div class="empty"><i class="fa-solid fa-file-circle-exclamation"></i>${esc(e.message)}</div>`;
  }
}
