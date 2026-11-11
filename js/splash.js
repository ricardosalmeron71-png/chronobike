// Pantalla de carga: un ciclista sube pedaleando por un circuito de montaña
// mientras se cargan las tablas. La bicicleta avanza según el progreso real
// y llega a la meta (bandera) al 100 %.
//
//   const splash = showSplash();
//   splash.step(0.3, 'Cargando corredores…');
//   await splash.done();

const SVGNS = 'http://www.w3.org/2000/svg';
// Circuito en zigzag de abajo hacia arriba (cada curva más chica = más lejos)
const ROAD = 'M200 720 C 380 690, 380 615, 200 590 C 30 566, 30 500, 200 478 C 350 458, 350 400, 200 382 C 75 366, 75 318, 200 302 C 300 290, 300 252, 200 240 C 128 231, 128 204, 200 196';

const CSS = `
#splash{position:fixed;inset:0;z-index:999;display:flex;flex-direction:column;align-items:center;background:radial-gradient(900px 600px at 50% 10%,#16213a,#070b16 70%);transition:opacity .5s ease,visibility .5s;font-family:'Inter',system-ui,sans-serif;color:#e8eefc}
#splash.out{opacity:0;visibility:hidden}
#splash .sp-top{width:min(520px,88vw);margin-top:max(3vh,18px);text-align:center;z-index:2}
#splash .sp-brand{display:flex;align-items:center;justify-content:center;gap:.6rem;margin-bottom:1rem}
#splash .sp-brand b{font-family:'Barlow Condensed','Inter',sans-serif;font-size:2.2rem;font-weight:800;letter-spacing:.02em}
#splash .sp-brand em{font-style:normal;color:#ff5a1f}
#splash .sp-bar{height:14px;border-radius:99px;background:#16213a;border:1px solid #2d3d60;overflow:hidden;position:relative}
#splash .sp-fill{position:absolute;inset:0 auto 0 0;width:0;border-radius:99px;background:linear-gradient(90deg,#ffb21f,#ff5a1f);box-shadow:0 0 18px rgba(255,90,31,.6)}
#splash .sp-fill::after{content:"";position:absolute;inset:0;background:repeating-linear-gradient(115deg,rgba(255,255,255,.22) 0 10px,transparent 10px 20px);animation:spstripes .7s linear infinite}
@keyframes spstripes{to{background-position:23px 0}}
#splash .sp-info{display:flex;justify-content:space-between;margin-top:.55rem;font-size:.9rem;color:#8b9ab8;font-weight:600}
#splash .sp-pct{font-family:'Barlow Condensed','Inter',sans-serif;font-size:1.25rem;font-weight:800;color:#ffb21f}
#splash svg.sp-scene{flex:1;width:100%;min-height:0;display:block;overflow:visible}
#splash{overflow:hidden}
#splash .sp-wheel{animation:spspin .55s linear infinite;transform-box:fill-box;transform-origin:center}
@keyframes spspin{to{transform:rotate(360deg)}}
#splash .sp-star{animation:sptw 2.4s ease-in-out infinite}
@keyframes sptw{50%{opacity:.25}}
@media (prefers-reduced-motion:reduce){#splash .sp-wheel,#splash .sp-star,#splash .sp-fill::after{animation:none}}
`;

function el(tag, attrs = {}, parent) {
  const n = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  parent?.appendChild(n); return n;
}

function buildScene(svg) {
  const defs = el('defs', {}, svg);
  defs.innerHTML = `
    <linearGradient id="spSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0c1430"/><stop offset="1" stop-color="#1a2650"/></linearGradient>
    <linearGradient id="spM1" gradientUnits="userSpaceOnUse" x1="0" y1="180" x2="0" y2="760"><stop offset="0" stop-color="#2a3a66"/><stop offset="1" stop-color="#16213a"/></linearGradient>
    <linearGradient id="spM2" gradientUnits="userSpaceOnUse" x1="0" y1="210" x2="0" y2="760"><stop offset="0" stop-color="#1f2d52"/><stop offset="1" stop-color="#0f1730"/></linearGradient>
    <linearGradient id="spM3" gradientUnits="userSpaceOnUse" x1="0" y1="270" x2="0" y2="760"><stop offset="0" stop-color="#1b2a4a"/><stop offset="1" stop-color="#0b1222"/></linearGradient>
    <radialGradient id="spSun" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffd27a"/><stop offset=".6" stop-color="#ff8a3d" stop-opacity=".55"/><stop offset="1" stop-color="#ff5a1f" stop-opacity="0"/></radialGradient>`;
  el('rect', { x: -1600, y: -400, width: 3600, height: 1200, fill: 'url(#spSky)' }, svg);
  // Estrellas
  const stars = [[40, 160], [90, 190], [150, 170], [260, 175], [330, 160], [370, 200], [-120, 180], [-300, 165], [-520, 200], [520, 170], [700, 195], [900, 160], [-800, 175], [1100, 185], [210, 200], [-60, 230]];
  stars.forEach(([x, y], i) => el('circle', { cx: x, cy: y, r: i % 3 ? 1.1 : 1.7, fill: '#fff', class: 'sp-star', style: `animation-delay:${(i * 0.37) % 2.4}s` }, svg));
  // Cordilleras a los lados (se ven en pantallas anchas)
  [[-180, 640, 1.3], [-260, 600, 1], [-420, 660, 1.5], [-640, 620, 1.1], [520, 650, 1.4], [600, 610, 1], [760, 660, 1.5], [980, 630, 1.2], [-900, 650, 1.3], [1250, 650, 1.3]]
    .forEach(([x, y, s2]) => el('path', { d: `M${x} ${y - 34 * s2} L${x - 13 * s2} ${y} L${x + 13 * s2} ${y} Z`, fill: '#0d1a2e', opacity: '.9' }, svg));
  // Sol saliendo detrás de la cima
  el('circle', { cx: 290, cy: 205, r: 70, fill: 'url(#spSun)' }, svg);
  // Montañas (atrás → adelante)
  el('path', { d: 'M-1600 760 L-1600 330 L-1300 250 L-1120 300 L-900 190 L-700 290 L-520 220 L-300 300 L-120 240 L0 300 L70 230 L120 262 L190 170 L250 230 L300 190 L400 280 L560 210 L720 290 L900 180 L1100 280 L1300 230 L1600 320 L2000 300 L2000 760Z', fill: 'url(#spM1)' }, svg);
  el('path', { d: 'M190 170 L172 192 L184 190 L196 200 L206 186 Z M300 190 L288 202 L300 200 L312 206 Z', fill: '#cfd8e6', opacity: '.55' }, svg); // nieve
  el('path', { d: 'M-1600 760 L-1600 430 L-1350 370 L-1150 420 L-950 330 L-760 410 L-560 350 L-360 420 L-160 360 L0 380 L60 330 L110 360 L200 205 L290 340 L340 310 L400 360 L600 330 L820 410 L1000 320 L1220 400 L1450 350 L2000 420 L2000 760Z', fill: 'url(#spM2)' }, svg);
  el('path', { d: 'M-1600 760 L-1600 560 L-1300 500 L-1050 560 L-800 470 L-560 540 L-300 490 L0 520 L40 480 L90 500 L200 260 L320 470 L370 450 L400 470 L640 520 L880 460 L1120 540 L1380 480 L2000 560 L2000 760Z', fill: 'url(#spM3)' }, svg);
  // Pinos
  const pines = [[30, 600, 1], [62, 640, 1.2], [350, 560, 1], [372, 610, 1.3], [24, 470, .8], [365, 430, .7], [95, 700, 1.4], [320, 700, 1.3], [60, 395, .6], [340, 330, .55]];
  pines.forEach(([x, y, s]) => el('path', { d: `M${x} ${y - 30 * s} L${x - 11 * s} ${y} L${x + 11 * s} ${y} Z M${x - 1.5 * s} ${y} h${3 * s} v${6 * s} h${-3 * s}Z`, fill: '#0d1a2e', opacity: '.9' }, svg));
  // Camino del circuito
  el('path', { d: ROAD, fill: 'none', stroke: '#05080f', 'stroke-width': 30, 'stroke-linecap': 'round', opacity: '.5', transform: 'translate(0 4)' }, svg);
  el('path', { d: ROAD, fill: 'none', stroke: '#3a2f2a', 'stroke-width': 26, 'stroke-linecap': 'round' }, svg);
  el('path', { d: ROAD, fill: 'none', stroke: '#5a4636', 'stroke-width': 20, 'stroke-linecap': 'round' }, svg);
  el('path', { d: ROAD, fill: 'none', stroke: '#ffb21f', 'stroke-width': 1.6, 'stroke-dasharray': '7 9', opacity: '.8' }, svg);
  const track = el('path', { d: ROAD, fill: 'none', stroke: 'none' }, svg);
  // Meta: bandera a cuadros en la cima
  const flag = el('g', { transform: 'translate(212 160)' }, svg);
  el('rect', { x: 0, y: 0, width: 2.5, height: 38, fill: '#cfd8e6' }, flag);
  const cells = el('g', { transform: 'translate(2.5 1)' }, flag);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) el('rect', { x: c * 5, y: r * 5, width: 5, height: 5, fill: (r + c) % 2 ? '#0b1020' : '#fff' }, cells);
  el('animateTransform', { attributeName: 'transform', type: 'skewY', values: '0;-6;0;5;0', dur: '1.6s', repeatCount: 'indefinite' }, cells);
  // Ciclista
  const rider = el('g', {}, svg);
  const scaleG = el('g', {}, rider);
  const flipG = el('g', {}, scaleG);
  const bike = buildRider(flipG);
  return { track, rider, scaleG, flipG, bike };
}

// Ciclista en vista lateral (mirando a la derecha). Origen = punto de contacto con el suelo.
function buildRider(g) {
  el('ellipse', { cx: 0, cy: 1, rx: 30, ry: 3, fill: '#000', opacity: '.35' }, g);
  const wheel = (cx) => {
    const w = el('g', { class: 'sp-wheel' }, g);
    el('circle', { cx, cy: -13, r: 12, fill: 'none', stroke: '#0b1020', 'stroke-width': 4 }, w);
    el('circle', { cx, cy: -13, r: 12, fill: 'none', stroke: '#cfd8e6', 'stroke-width': 1.3 }, w);
    for (let a = 0; a < 6; a++) { const t = (a * Math.PI) / 6; el('line', { x1: cx - 11 * Math.cos(t), y1: -13 - 11 * Math.sin(t), x2: cx + 11 * Math.cos(t), y2: -13 + 11 * Math.sin(t), stroke: '#8b9ab8', 'stroke-width': .6 }, w); }
    el('circle', { cx, cy: -13, r: 1.8, fill: '#cfd8e6' }, w);
  };
  wheel(-21); wheel(21);
  // Pierna del fondo (se dibuja antes del cuadro)
  const legBack = el('path', { fill: 'none', stroke: '#1d3a8a', 'stroke-width': 4.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
  // Cuadro
  const frame = 'M-21 -13 L0 -13 L-6 -33 Z M0 -13 L15 -32 L-6 -33 M15 -32 L21 -13 M15 -32 L17 -38';
  el('path', { d: frame, fill: 'none', stroke: '#ff5a1f', 'stroke-width': 2.8, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, g);
  el('path', { d: 'M13 -38 L21 -39', stroke: '#0b1020', 'stroke-width': 2.6, 'stroke-linecap': 'round' }, g); // manubrio
  el('path', { d: 'M-11 -35 L-2 -35', stroke: '#0b1020', 'stroke-width': 3, 'stroke-linecap': 'round' }, g); // asiento
  const crank = el('line', { stroke: '#cfd8e6', 'stroke-width': 2, 'stroke-linecap': 'round' }, g);
  el('circle', { cx: 0, cy: -13, r: 3, fill: '#0b1020', stroke: '#cfd8e6', 'stroke-width': 1 }, g);
  // Cuerpo
  el('path', { d: 'M-6 -37 Q 2 -52 12 -51', fill: 'none', stroke: '#ffb21f', 'stroke-width': 7.5, 'stroke-linecap': 'round' }, g); // torso (jersey)
  el('path', { d: 'M-8 -39 Q -4 -43 0 -40', fill: 'none', stroke: '#0b1020', 'stroke-width': 7, 'stroke-linecap': 'round' }, g); // short
  el('path', { d: 'M11 -50 L16 -44 L19 -39', fill: 'none', stroke: '#e0a06a', 'stroke-width': 3.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g); // brazo
  el('circle', { cx: 17, cy: -57, r: 5, fill: '#e0a06a' }, g); // cabeza
  el('path', { d: 'M10.5 -58 Q 16 -67 23 -59 Z', fill: '#c6f432' }, g); // casco
  el('path', { d: 'M20 -57.5 L24 -57', stroke: '#0b1020', 'stroke-width': 1.6, 'stroke-linecap': 'round' }, g); // lentes
  // Pierna del frente
  const legFront = el('path', { fill: 'none', stroke: '#2a54c9', 'stroke-width': 5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
  return { legBack, legFront, crank };
}

// Cinemática de 2 huesos: rodilla entre cadera y pedal
function leg(hip, foot, l1 = 16.5, l2 = 16.5) {
  const dx = foot[0] - hip[0], dy = foot[1] - hip[1];
  const d = Math.min(Math.hypot(dx, dy), l1 + l2 - 0.01);
  const a = Math.atan2(dy, dx);
  const k = Math.acos((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d));
  const knee = [hip[0] + l1 * Math.cos(a - k), hip[1] + l1 * Math.sin(a - k)];
  return `M${hip[0]} ${hip[1]} L${knee[0].toFixed(2)} ${knee[1].toFixed(2)} L${foot[0].toFixed(2)} ${foot[1].toFixed(2)}`;
}

export function showSplash({ minMs = 1700 } = {}) {
  if (!document.getElementById('splash-css')) {
    const st = document.createElement('style'); st.id = 'splash-css'; st.textContent = CSS; document.head.appendChild(st);
  }
  const wrap = document.createElement('div');
  wrap.id = 'splash'; wrap.setAttribute('role', 'status'); wrap.setAttribute('aria-live', 'polite');
  wrap.innerHTML = `<div class="sp-top">
      <div class="sp-brand"><svg width="38" height="38" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="36" r="22" fill="none" stroke="#ff7a1f" stroke-width="5"/><rect x="26" y="4" width="12" height="6" rx="2" fill="#ff7a1f"/><path d="M32 36 L32 20" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/><circle cx="32" cy="36" r="4" fill="#fff"/></svg><b>Chrono<em>Bike</em></b></div>
      <div class="sp-bar"><div class="sp-fill"></div></div>
      <div class="sp-info"><span class="sp-msg">Preparando el circuito…</span><span class="sp-pct">0%</span></div>
    </div>`;
  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('viewBox', '0 150 400 600'); svg.setAttribute('preserveAspectRatio', 'xMidYMax meet'); svg.setAttribute('class', 'sp-scene'); svg.setAttribute('aria-hidden', 'true');
  wrap.appendChild(svg);
  (document.body || document.documentElement).appendChild(wrap);

  const scene = buildScene(svg);
  const fill = wrap.querySelector('.sp-fill'), pct = wrap.querySelector('.sp-pct'), msg = wrap.querySelector('.sp-msg');
  const L = scene.track.getTotalLength();
  const started = performance.now();
  let target = 0.06, shown = 0, finished = false, resolveDone, crankA = 0, last = started, raf;
  const doneP = new Promise((r) => { resolveDone = r; });

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    // Mientras carga, el objetivo avanza solo (lento) hasta 90 % para que siempre haya movimiento
    if (!finished) target = Math.min(0.9, target + dt * 0.08);
    const maxSpeed = 1 / (minMs / 1000); // nunca sube toda la montaña en menos de minMs
    shown = Math.min(target, shown + Math.min(maxSpeed * dt, (target - shown) * 0.12 + 0.002));
    // Posición en el circuito
    const p = scene.track.getPointAtLength(shown * L);
    const p2 = scene.track.getPointAtLength(Math.min(L, shown * L + 2));
    const dir = p2.x >= p.x ? 1 : -1;
    const size = 1.15 - 0.62 * ((720 - p.y) / 524); // más chico al alejarse
    const tilt = Math.max(-14, Math.min(14, (Math.atan2(p2.y - p.y, Math.abs(p2.x - p.x) + 0.01) * 180) / Math.PI));
    scene.rider.setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`);
    scene.scaleG.setAttribute('transform', `scale(${size.toFixed(3)}) rotate(${(tilt * dir).toFixed(1)})`);
    scene.flipG.setAttribute('transform', `scale(${dir} 1)`);
    // Pedaleo
    crankA += dt * 9;
    const c = [0, -13], r = 6;
    const f1 = [c[0] + r * Math.cos(crankA), c[1] + r * Math.sin(crankA)];
    const f2 = [c[0] - r * Math.cos(crankA), c[1] - r * Math.sin(crankA)];
    scene.bike.crank.setAttribute('x1', f1[0]); scene.bike.crank.setAttribute('y1', f1[1]);
    scene.bike.crank.setAttribute('x2', f2[0]); scene.bike.crank.setAttribute('y2', f2[1]);
    scene.bike.legFront.setAttribute('d', leg([-5, -38], f1));
    scene.bike.legBack.setAttribute('d', leg([-5, -38], f2));
    // Barra
    const v = Math.round(shown * 100);
    fill.style.width = v + '%'; pct.textContent = v + '%';
    if (finished && shown >= 0.999) {
      msg.textContent = '¡Meta! Todo listo';
      cancelAnimationFrame(raf);
      setTimeout(() => { wrap.classList.add('out'); setTimeout(() => { wrap.remove(); resolveDone(); }, 520); }, 280);
      return;
    }
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  return {
    /** Avisa avance real de carga (0 a 1) y un mensaje opcional. */
    step(p, text) { target = Math.max(target, Math.min(0.95, p)); if (text) msg.textContent = text; },
    /** Termina: la bici llega a la meta y la pantalla se desvanece. */
    done() {
      if (!finished) {
        finished = true; target = 1;
        // Seguro: si la animación no avanza (pestaña en segundo plano, ahorro de energía), se cierra igual
        setTimeout(() => { if (document.body.contains(wrap)) { cancelAnimationFrame(raf); wrap.classList.add('out'); setTimeout(() => { wrap.remove(); resolveDone(); }, 520); } }, minMs + 2500);
      }
      return doneP;
    },
    /** Error: quita la pantalla de inmediato para mostrar el mensaje de error. */
    fail() { finished = true; cancelAnimationFrame(raf); wrap.remove(); resolveDone(); },
  };
}
