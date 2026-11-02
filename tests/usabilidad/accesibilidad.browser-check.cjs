/* Auditoría WCAG 2.1 AA con axe en las pantallas principales: 390 y 1280 px, en los dos temas. */
const { chromium } = require('@playwright/test'), fs = require('node:fs');
const axe = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3119', ficha = '/proyectos/00000000-0000-4000-8000-000000000010';
const rutas = ['/', '/proyectos', ficha, `${ficha}?s=budget`, `${ficha}?s=work`, `${ficha}?s=purchases`, `${ficha}?s=documents`, `${ficha}?s=cobros`, `${ficha}/captura`, `${ficha}/plano`, '/agenda', '/clientes', '/finanzas', '/catalogo', '/ajustes', '/mas'];
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined });
  const fallos = [];
  for (const [width, height] of [[390, 844], [1280, 800]]) for (const tema of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width, height } }), page = await context.newPage();
    for (const ruta of rutas) {
      await page.goto(base + ruta, { waitUntil: 'load' });
      await page.evaluate(t => document.documentElement.setAttribute('data-theme', t), tema);
      await page.waitForTimeout(700);
      await page.evaluate(axe);
      const { violations } = await page.evaluate(() => window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'], exclude: [['nextjs-portal']] }));
      for (const v of violations) for (const nodo of v.nodes) fallos.push(`${width} ${tema} ${ruta} · ${v.id} · ${nodo.target.join(' ')} · ${(nodo.any[0] || nodo.all[0] || nodo.none[0] || {}).message || ''}`);
    }
    await context.close();
  }
  await browser.close();
  if (fallos.length) { console.error(fallos.join('\n')); console.error(`${fallos.length} fallos de accesibilidad`); process.exit(1); }
  console.log('Accesibilidad AA sin fallos automáticos');
})().catch(e => { console.error(e); process.exit(1); });
