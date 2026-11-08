import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const base = process.argv[2], out = process.argv[3];
const b = await chromium.launch();
async function session(vp, mobile, prefix) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 1.5, isMobile: mobile, hasTouch: mobile });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await p.goto(base + '/'); await p.waitForTimeout(1200); await p.screenshot({ path: `${out}/${prefix}-welcome.png` });
  await p.goto(base + '/prijava?mode=register'); await p.fill('[data-testid=username]', 'u' + prefix + Date.now() % 100000); await p.fill('[data-testid=password]', 'lozinka123'); await p.click('[data-testid=auth-submit]'); await p.waitForURL('**/igra');
  await p.screenshot({ path: `${out}/${prefix}-hub.png` });
  await p.click('[data-testid=new-campaign]'); await p.click('text=Simulacija (botovi)'); await p.selectOption('[data-testid=create-sheet] select >> nth=1', '600'); await p.click('[data-testid=create-submit]'); await p.waitForURL(/\/k\//);
  await p.goto(p.url().replace(/\/k\/([^/]+).*/, '/k/$1/karta')); await p.waitForSelector('[data-testid=hexmap]'); await p.waitForTimeout(1200); await p.screenshot({ path: `${out}/${prefix}-map.png` });
  const ids = await p.$$eval('[data-tid]', (els) => els.map((e) => e.getAttribute('data-tid')));
  for (const id of ids) { await p.locator(`[data-tid="${id}"]`).first().dispatchEvent('click'); await p.waitForTimeout(160); if (await p.locator('[data-testid=territory-actions] >> text=Novači').count()) break; }
  await p.waitForTimeout(500); await p.screenshot({ path: `${out}/${prefix}-popup.png` });
  console.log(prefix, 'errors:', errs.slice(0, 5));
  await ctx.close();
}
await session({ width: 1440, height: 900 }, false, 'desk');
await session({ width: 390, height: 844 }, true, 'mob');
await b.close();
