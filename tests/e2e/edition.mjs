// E2E: nakon razrješenja runde igrač pri povratku dobiva "Jutarnje izdanje". node tests/e2e/edition.mjs <baseUrl> <outDir> [mobile]
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const base = process.argv[2] ?? 'http://localhost:3100', out = process.argv[3] ?? '/tmp', mobile = process.argv[4] === 'mobile';
const errors = [];
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, deviceScaleFactor: 1.5, isMobile: mobile, hasTouch: mobile });
const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
const step = async (n, fn) => { try { await fn(); console.log('OK  ', n); } catch (e) { console.log('FAIL', n, '-', e.message.slice(0, 400)); errors.push(n); } };
await step('priprema', async () => {
  await p.goto(base + '/prijava?mode=register'); await p.fill('[data-testid=username]', 'ed' + (Date.now() % 1000000)); await p.fill('[data-testid=displayname]', 'Urednik'); await p.fill('[data-testid=password]', 'lozinka123');
  await p.click('[data-testid=auth-submit]'); await p.waitForURL('**/igra'); await p.click('[data-testid=new-campaign]'); await p.click('text=Simulacija (botovi)'); await p.click('[data-testid=create-submit]');
  await p.waitForURL(/\/k\//); await p.waitForSelector('[data-testid=dashboard]'); await p.waitForTimeout(500);
  if (await p.locator('[data-testid=morning-edition]').count()) throw new Error('izdanje se ne smije pojaviti pri prvom ulasku');
});
await step('rank-strip na početnoj', async () => { await p.waitForSelector('[data-testid=rank-strip]'); });
await step('razrješenje → izdanje', async () => {
  await p.click('[data-testid=dev-resolve]'); await p.waitForSelector('[data-testid=morning-edition]', { timeout: 15000 });
  await p.waitForSelector('[data-testid=edition-headline]'); await p.waitForTimeout(3500); await p.screenshot({ path: `${out}/${mobile ? 'm' : 'd'}-edition.png` });
  const h = await p.locator('[data-testid=edition-headline]').textContent(); if (!h || h.length < 5) throw new Error('prazan naslov');
});
await step('zatvaranje + ne vraća se', async () => {
  await p.click('[data-testid=edition-continue]'); await p.waitForSelector('[data-testid=morning-edition]', { state: 'detached' });
  await p.reload(); await p.waitForSelector('[data-testid=dashboard]'); await p.waitForTimeout(800);
  if (await p.locator('[data-testid=morning-edition]').count()) throw new Error('izdanje se ponovno pojavilo');
});
await step('ponovni prikaz iz izvještaja', async () => {
  await p.goto(p.url().replace(/\/?$/, '') + '/izvjestaji'); await p.click('[data-testid=open-edition]'); await p.waitForSelector('[data-testid=morning-edition]'); await p.click('[data-testid=edition-continue]');
});
console.log('\nGreške:', errors.length ? errors.join(', ') : 'nema');
await b.close(); process.exit(errors.length ? 1 : 0);
