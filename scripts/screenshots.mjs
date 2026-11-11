// Genera las capturas del manual de usuario (docs/img) usando el modo demo.
// Uso:  deja SUPABASE_URL vacío en js/config.js (modo demo), npm start en otra terminal → npm run screenshots
// Requiere Playwright instalado (npm i -D playwright && npx playwright install chromium)
import { createRequire } from 'node:module';
import { computeResults, STATUS } from '../js/results.js';
import { buildDemoData } from '../js/demo-data.js';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const BASE = process.env.BASE_URL || 'http://localhost:5173';
const OUT = new URL('../docs/img/', import.meta.url).pathname;
const NOW = new Date('2026-11-11T10:20:00-07:00');

// Elegimos corredores reales del demo para que las capturas sean coherentes
const SEED = 2026; // el demo ahora es aleatorio; las capturas fijan la semilla para ser reproducibles
const data = buildDemoData(NOW.getTime(), SEED);
const live = data.events.find((e) => e.status === 'en_curso');
const visible = data.laps.filter((l) => !l.sim || new Date(l.ts) <= NOW);
const groups = computeResults({ event: live, ...data, eventCategories: data.event_categories, laps: visible });
const racing = groups.flatMap((g) => g.rows).find((r) => r.status === STATUS.RACING && r.lapsDone === 1 && r.targetLaps === 2);
const eliteCat = data.categories[0].id;

const browser = await chromium.launch();
async function ctx(opts = {}) {
  const c = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5, locale: 'es-MX', timezoneId: 'America/Hermosillo', ...opts });
  const p = await c.newPage();
  await c.addInitScript((seed) => localStorage.setItem('chronobike_demo_seed', String(seed)), SEED);
  await p.clock.setFixedTime(NOW);
  p.on('pageerror', (e) => console.error('pageerror', e.message));
  return { c, p };
}
const noSplash = (p) => p.waitForSelector('#splash', { state: 'detached', timeout: 15000 }).catch(() => {});
const shot = async (p, name, opts = {}) => { await noSplash(p); await p.waitForTimeout(450); await p.screenshot({ path: OUT + name, ...opts }); console.log('✓', name); };
const hideToasts = (p) => p.evaluate(() => document.querySelectorAll('.toast').forEach((t) => t.remove()));

// ───────── Vista pública ─────────
{
  const { c, p } = await ctx();
  await p.goto(`${BASE}/index.html`); await p.waitForSelector('.podium-card');
  await shot(p, '01-publico-inicio.png');
  await p.evaluate(() => window.scrollTo(0, document.querySelector('#kpis').offsetTop - 90));
  await shot(p, '02-publico-podios.png');
  // Evento finalizado (historial)
  await p.click('.event-card:nth-child(2)'); await p.waitForSelector('.podium-card');
  await p.evaluate(() => window.scrollTo(0, document.querySelector('.event-head').offsetTop - 90));
  await shot(p, '03-publico-historial-podios.png');
  await p.click('#views [data-v=tabla]'); await p.click(`#cats [data-c="${eliteCat}"]`);
  await p.evaluate(() => window.scrollTo(0, document.querySelector('.toolbar').offsetTop - 90));
  await shot(p, '04-publico-clasificacion.png');
  await p.click('.results tbody tr'); await p.waitForSelector('.rider-detail');
  await shot(p, '05-publico-detalle-corredor.png');
  await p.keyboard.press('Escape');
  await p.click('#cats [data-c=ALL]'); await p.fill('#q', 'Halcones');
  await p.evaluate(() => window.scrollTo(0, 0));
  await shot(p, '06-publico-buscar.png');
  await p.fill('#q', '');
  await p.click('.event-card:nth-child(1)'); await p.click('#views [data-v=pasos]');
  await p.evaluate(() => window.scrollTo(0, document.querySelector('.toolbar').offsetTop - 90));
  await shot(p, '07-publico-ultimos-pasos.png');
  await c.close();
}
{
  const { c, p } = await ctx({ ...devices['iPhone 13'], deviceScaleFactor: undefined });
  await p.goto(`${BASE}/index.html`); await p.waitForSelector('.podium-card');
  await p.evaluate(() => window.scrollTo(0, document.querySelector('.podium-grid').offsetTop - 70));
  await shot(p, '08-publico-movil.png');
  await c.close();
}

// ───────── Panel de staff ─────────
{
  const { c, p } = await ctx();
  await p.goto(`${BASE}/admin.html`); await p.waitForSelector('#loginForm');
  await shot(p, '10-login.png');
  await p.fill('[name=email]', 'admin'); await p.fill('[name=password]', 'demo'); await p.click('#loginForm .btn-primary');
  await p.waitForSelector('#keypad'); await hideToasts(p);
  await shot(p, '11-crono.png');
  for (const d of String(racing.rider.dorsal)) await p.click(`#keypad [data-k="${d}"]`);
  await shot(p, '12-crono-dorsal.png');
  await p.click('#regBtn'); await p.waitForTimeout(250);
  await shot(p, '13-crono-registrado.png');
  await hideToasts(p);
  await p.keyboard.type(String(racing.rider.dorsal)); await p.keyboard.press('Enter');
  await shot(p, '14-crono-duplicado.png');
  await p.click('.modal [data-close].btn'); await hideToasts(p);
  await p.keyboard.type('150');
  await shot(p, '15-crono-no-registrado.png');
  await p.keyboard.press('Escape');
  await p.click('[data-edit-start]');
  await shot(p, '16-crono-salida.png');
  await p.keyboard.press('Escape');

  const pages = [['eventos', '20-eventos.png'], ['corredores', '22-corredores.png'], ['categorias', '24-categorias.png'], ['equipos', '26-equipos.png'], ['resultados', '27-resultados.png'], ['ajustes', '29-importar.png'], ['usuarios', '30-usuarios.png']];
  for (const [pg, file] of pages) {
    await p.click(`.sidenav [data-page=${pg}]`); await hideToasts(p); await shot(p, file);
    if (pg === 'eventos') { await p.click('#newEv'); await shot(p, '21-evento-form.png'); await p.keyboard.press('Escape'); }
    if (pg === 'corredores') { await p.click('#newR'); await p.fill('[name=name]', 'Lucía Encinas Duarte'); await p.selectOption('[name=category_id]', { index: 5 }); await p.fill('[name=team]', 'Halcones MTB'); await shot(p, '23-corredor-form.png'); await p.keyboard.press('Escape'); }
    if (pg === 'categorias') { await p.click('[data-edit]'); await shot(p, '25-categoria-form.png'); await p.keyboard.press('Escape'); }
    if (pg === 'resultados') { await p.click('#rv [data-v=tabla]'); await shot(p, '28-resultados-tabla.png'); }
    if (pg === 'usuarios') {
      await p.waitForSelector('#ulist .list-item'); await shot(p, file);
      await p.click('#newU'); await p.fill('[name=email]', 'laura.meta'); await shot(p, '31-usuario-nuevo.png');
      await p.click('.modal .btn-primary'); await p.waitForSelector('#cp'); await shot(p, '32-usuario-credenciales.png');
    }
  }
  await c.close();
}
{
  const { c, p } = await ctx({ ...devices['iPhone 13'], deviceScaleFactor: undefined });
  await p.goto(`${BASE}/admin.html`); await p.waitForSelector('#loginForm');
  await p.fill('[name=email]', 'registro'); await p.fill('[name=password]', 'demo'); await p.click('#loginForm .btn-primary');
  await p.waitForSelector('#keypad'); await hideToasts(p);
  for (const d of String(racing.rider.dorsal)) await p.click(`#keypad [data-k="${d}"]`);
  await p.evaluate(() => window.scrollTo(0, 0));
  await shot(p, '17-crono-movil.png');
  await p.click('#regBtn');
  await shot(p, '18-crono-movil-registrado.png');
  await c.close();
}
await browser.close();
