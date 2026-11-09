// E2E: nakon razrješenja runde igrač pri povratku dobiva "Jutarnje izdanje". node tests/e2e/edition.mjs <baseUrl> <outDir> [mobile]
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const base = process.argv[2] ?? 'http://localhost:3100', out = process.argv[3] ?? '/tmp', mobile = process.argv[4] === 'mobile';
const errors = [];
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, deviceScaleFactor: 1.5, isMobile: mobile, hasTouch: mobile }); await ctx.addInitScript(() => { try { localStorage.setItem('dom_legend_seen', '1'); } catch {} });
const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
const step = async (n, fn) => { try { await fn(); console.log('OK  ', n); } catch (e) { console.log('FAIL', n, '-', e.message.slice(0, 400)); errors.push(n); } };
await step('priprema', async () => {
  await p.goto(base + '/prijava?mode=register'); await p.fill('[data-testid=username]', 'ed' + (Date.now() % 1000000)); await p.fill('[data-testid=displayname]', 'Urednik'); await p.fill('[data-testid=password]', 'lozinka123');
  await p.click('[data-testid=auth-submit]'); await p.waitForURL('**/igra'); await p.click('[data-testid=new-campaign]'); await p.click('text=Simulacija (botovi)'); await p.click('[data-testid=create-submit]');
  await p.waitForURL(/\/k\//); await p.waitForSelector('[data-testid=dashboard]'); await p.waitForTimeout(500);
  if (await p.locator('[data-testid=morning-edition]').count()) throw new Error('izdanje se ne smije pojaviti pri prvom ulasku');
});
await step('dnevna dilema: odabir se primjenjuje', async () => { await p.waitForSelector('[data-testid=dilemma]'); await p.click('[data-testid=dilemma-b]'); await p.waitForSelector('[data-testid=dilemma] >> text=Odlučeno'); });
await step('rank-strip na početnoj', async () => { await p.waitForSelector('[data-testid=rank-strip]'); });
await step('botovi se javljaju prvi dan', async () => { await p.waitForSelector('[data-testid=suggestions]'); const t = await p.locator('[data-testid=suggestions]').textContent(); if (!t.includes('ti piše')) throw new Error('nema poruke bota: ' + t.slice(0, 200)); });
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
await step('ponavljanje bitki na karti', async () => {
  const root = p.url().replace(/\/izvjestaji.*$/, '');
  for (let i = 0; i < 5; i++) {
    await p.goto(root); await p.waitForSelector('[data-testid=dashboard]');
    await p.click('[data-testid=dev-resolve]'); await p.waitForSelector('[data-testid=morning-edition]', { timeout: 15000 }); await p.waitForTimeout(2200);
    if (await p.locator('[data-testid=edition-map]').count()) {
      await p.click('[data-testid=edition-map]'); await p.waitForSelector('[data-testid=replay-banner]', { timeout: 8000 }); await p.waitForTimeout(600);
      await p.screenshot({ path: `${out}/${mobile ? 'm' : 'd'}-replay.png` });
      const first = await p.locator('[data-testid=replay-banner]').textContent(); await p.waitForFunction((f) => document.querySelector('[data-testid=replay-banner]')?.textContent !== f, first, { timeout: 8000 });
      await p.click('[data-testid=replay-skip]'); await p.waitForSelector('[data-testid=replay-banner]', { state: 'detached' }); return;
    }
    await p.click('[data-testid=edition-continue]');
  }
  console.log('     (preskočeno: u ovoj simulaciji igrač nije vidio nijednu bitku — nasumično; ponovi test)');
});
console.log('\nGreške:', errors.length ? errors.join(', ') : 'nema');
await b.close(); process.exit(errors.length ? 1 : 0);
