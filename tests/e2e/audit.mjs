// Snimke svih ekrana (desktop + mobilni) za vizualni pregled. node tests/e2e/audit.mjs <baseUrl> <outDir>
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const base = process.argv[2], out = process.argv[3];
const b = await chromium.launch();
const routes = ['', '/karta', '/naredbe', '/diplomacija', '/tehnologija', '/kraljevstvo', '/izvjestaji', '/ljestvica', '/profil', '/vise', '/obavijesti'];
async function run(vp, mobile, prefix) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 1.25, isMobile: mobile, hasTouch: mobile });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(base + '/prijava?mode=register'); await p.fill('[data-testid=username]', 'a' + prefix + (Date.now() % 100000)); await p.fill('[data-testid=password]', 'lozinka123'); await p.click('[data-testid=auth-submit]'); await p.waitForURL('**/igra');
  await p.screenshot({ path: `${out}/${prefix}-hub.png` });
  await p.click('[data-testid=new-campaign]'); await p.click('text=Simulacija (botovi)'); await p.waitForTimeout(300); await p.screenshot({ path: `${out}/${prefix}-create.png` }); await p.selectOption('[data-testid=create-sheet] select >> nth=1', '600'); await p.click('[data-testid=create-submit]'); await p.waitForURL(/\/k\//);
  const root = p.url();
  await p.waitForSelector('[data-testid=dashboard]');
  // dvije odigrane runde (botovi) da ekrani imaju stvarne podatke
  await p.click('[data-testid=dev-resolve]'); await p.waitForSelector('text=Dan 2 / 7'); await p.click('[data-testid=dev-resolve]'); await p.waitForSelector('text=Dan 3 / 7'); await p.waitForTimeout(500);
  for (const r of routes) { await p.goto(root + r); await p.waitForTimeout(900); await p.screenshot({ path: `${out}/${prefix}-${r.slice(1) || 'home'}.png` }); }
  console.log(prefix, 'greške:', errs.slice(0, 3));
  await ctx.close();
}
await run({ width: 1440, height: 900 }, false, 'd');
await run({ width: 390, height: 844 }, true, 'm');
await b.close();
