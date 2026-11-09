// E2E vodiča: prolazi SVE korake kao stvarni korisnik (bez prijave). node tests/e2e/tutorial.mjs <baseUrl> <outDir> [mobile]
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const base = process.argv[2] ?? 'http://localhost:3100', out = process.argv[3] ?? '/tmp', mobile = process.argv[4] === 'mobile';
const errors = [];
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, deviceScaleFactor: 1.5, isMobile: mobile, hasTouch: mobile });
const p = await ctx.newPage();
p.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
p.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
const title = async () => (await p.locator('[data-testid=tutorial-title]').first().textContent().catch(() => '')) ?? '';
const waitTitle = async (t) => { await p.waitForFunction((x) => document.querySelector('[data-testid=tutorial-title]')?.textContent?.includes(x), t, { timeout: 15000 }); };
const shot = (n) => p.screenshot({ path: `${out}/${mobile ? 'm' : 'd'}-tut-${n}.png` });
const step = async (name, fn) => { try { await fn(); console.log('OK  ', name); } catch (e) { console.log('FAIL', name, '-', e.message.slice(0, 700), '| naslov:', await title()); errors.push(`${name}: ${e.message.split('\n')[0]}`); await shot('fail-' + name); throw e; } };
const hexClickUntil = async (sel, also) => {
  const ids = await p.$$eval('[data-tid]', (els) => els.map((e) => e.getAttribute('data-tid')));
  for (const id of ids) { await p.locator(`[data-tid="${id}"]`).first().dispatchEvent('click'); await p.waitForTimeout(130); if ((await p.locator(sel).count()) && (!also || (await p.locator(also).count()))) return id; }
  throw new Error('nije pronađen teritorij za ' + sel);
};
const next = async () => { await p.click('[data-testid=tutorial-next]'); };
const submitComposer = async (name) => { await p.waitForSelector(`[data-testid=composer-${name}]`); await p.waitForSelector('[data-testid=order-preview]'); await p.waitForTimeout(500); await p.click('[data-testid=submit-order]'); };

try {
  await step('start', async () => { await p.goto(base + '/k/tutorial/karta'); await waitTitle('Dobrodošao'); await p.waitForSelector('[data-testid=hexmap]'); await p.waitForTimeout(800); await shot('01-intro'); });
  await step('intro->map', async () => { await next(); await waitTitle('Karta svijeta'); await shot('02-map'); });
  await step('map->select', async () => { await next(); await waitTitle('Odaberi svoj glavni grad'); await shot('03-select'); });
  await step('select-capital', async () => { await hexClickUntil('[data-testid=territory-actions] >> text=Novači', '[data-testid=territory-details] >> text=Glavni grad'); await waitTitle('Kartica teritorija'); await shot('04-popup'); });
  await step('popup->resources', async () => { await next(); await waitTitle('Teren i protuteže'); await next(); await waitTitle('Resursi'); await shot('05-resources'); });
  await step('resources->cp', async () => { await next(); await waitTitle('Zapovjedni bodovi'); await next(); await waitTitle('Novači vojsku'); });
  await step('recruit', async () => { await hexClickUntil('[data-testid=territory-actions] >> text=Novači'); await p.click('[data-testid="act-Novači"]'); await submitComposer('recruit'); await waitTitle('Izgradi zgradu'); await shot('06-build'); });
  await step('build', async () => { await p.waitForTimeout(400); await hexClickUntil('[data-testid="act-Gradi"]:not([disabled])'); await p.click('[data-testid="act-Gradi"]'); await submitComposer('build'); await waitTitle('Porezi'); });
  await step('tax', async () => { await p.click('[data-testid=tutorial-goto]'); await p.waitForSelector('[data-testid=kingdom-screen]'); await shot('07-tax'); await p.click('[data-testid=tax-high]'); await waitTitle('Istraživanje'); });
  await step('research', async () => { await p.click('[data-testid=tutorial-goto]'); await p.waitForSelector('[data-testid=tech-screen]'); await p.click('[data-testid=tech-eco_agri]'); await p.click('[data-testid=research-btn]'); await submitComposer('research'); await waitTitle('Opskrba'); });
  await step('spy', async () => { await next(); await waitTitle('Špijunaža'); await p.click('[data-testid=tutorial-goto]'); await p.waitForSelector('[data-testid=hexmap]'); await p.waitForTimeout(600); await hexClickUntil('[data-testid="act-Špijuniraj"]'); await shot('08-spy-popup'); await p.click('[data-testid="act-Špijuniraj"]'); await submitComposer('espionage'); await waitTitle('Diplomacija'); });
  await step('diplomacy', async () => { await p.click('[data-testid=tutorial-goto]'); await p.waitForSelector('[data-testid=diplomacy-screen]'); await p.locator('[data-testid^=offer-]').first().click(); await submitComposer('diplomacy'); await waitTitle('Savezi, izdaja'); });
  await step('conditional', async () => { await next(); await waitTitle('Uvjetna naredba'); await p.click('[data-testid=tutorial-goto]'); await p.waitForSelector('[data-testid=hexmap]'); await p.waitForTimeout(600); await hexClickUntil('[data-testid="act-Uvjetna naredba"]'); await p.click('[data-testid="act-Uvjetna naredba"]'); await p.waitForSelector('[data-testid=conditional-composer]'); await p.click('[data-testid=cond-submit]'); await waitTitle('Vojna operacija'); await shot('09-op'); });
  await step('attack-open', async () => { await hexClickUntil('[data-testid=attack-btn]', '[data-testid=territory-name]:has-text("Predstraža")'); await p.click('[data-testid=attack-btn]'); await p.waitForSelector('[data-testid=planner]'); await waitTitle('Isplaniraj napad'); await p.waitForTimeout(500); await shot('10-planner'); });
  await step('attack-plan', async () => {
    await p.click('[data-testid=planner-next]'); await p.waitForTimeout(250);
    await p.locator('[data-testid=planner] button.chip', { hasText: /^Sve$/ }).first().click(); await shot('11-planner-units');
    await p.click('[data-testid=planner-next]'); await p.waitForTimeout(250);
    await p.waitForSelector('[data-testid=order-preview]'); await p.waitForTimeout(400); await shot('12-planner-review');
    await p.click('[data-testid=planner-submit]'); await waitTitle('Tajni cilj');
  });
  await step('lock', async () => { await next(); await waitTitle('Pregledaj i zaključaj'); await p.click('[data-testid=tutorial-goto]'); await p.waitForSelector('[data-testid=orders-screen]'); await p.waitForTimeout(500); await shot('13-orders'); await p.click('[data-testid=lock-orders]'); await p.locator('[data-testid=ready-confirm]').click({ timeout: 1500 }).catch(() => undefined); await waitTitle('Razrješenje runde'); });
  await step('resolve', async () => { await p.click('[data-testid=tutorial-resolve]'); await waitTitle('Dnevni izvještaj'); });
  await step('report', async () => { await p.click('[data-testid=tutorial-goto]'); await p.waitForSelector('[data-testid=report-screen]'); await p.waitForTimeout(600); await shot('14-report'); const txt = await p.locator('[data-testid=report-screen]').innerText(); if (!/Napad uspio/i.test(txt)) throw new Error('probna bitka nije uspjela: ' + txt.slice(0, 300)); await next(); await waitTitle('Spreman si'); await shot('15-end'); });
} catch { /* već zabilježeno */ }
console.log('\nGreške:', errors.length ? '\n' + errors.join('\n') : 'nema');
await b.close();
process.exit(errors.length ? 1 : 0);
