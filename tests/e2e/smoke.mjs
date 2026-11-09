// E2E: node tests/e2e/smoke.mjs <baseUrl> <outDir>
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const base = process.argv[2] ?? 'http://localhost:3100';
const out = process.argv[3] ?? '/tmp';
const errors = [];
const log = (...a) => console.log(...a);
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); await ctx.addInitScript(() => { try { localStorage.setItem('dom_no_edition', '1'); } catch {} });
const p = await ctx.newPage();
p.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
p.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
p.on('response', (r) => { if (r.status() >= 500) errors.push(`HTTP ${r.status()} ${r.url()}`); });
const shot = (n) => p.screenshot({ path: `${out}/${n}.png` });
const step = async (name, fn) => { try { await fn(); log('OK  ', name); } catch (e) { log('FAIL', name, '-', e.message.split('\n')[0]); errors.push(`step ${name}: ${e.message.split('\n')[0]}`); await shot('fail-' + name.replace(/\W+/g, '_')).catch(() => {}); } };

await step('welcome', async () => { await p.goto(base + '/'); await p.waitForSelector('[data-testid=start-game]'); await shot('01-welcome'); });
await step('register', async () => {
  await p.click('[data-testid=start-game]'); await p.waitForSelector('[data-testid=auth-form]');
  await p.fill('[data-testid=username]', 'admin'); await p.fill('[data-testid=displayname]', 'Lovrin'); await p.fill('[data-testid=password]', 'lozinka123');
  await p.click('[data-testid=auth-submit]'); await p.waitForURL('**/igra'); await p.waitForSelector('[data-testid=new-campaign]'); await shot('02-hub');
});
let campaignUrl;
await step('create-dev-campaign', async () => {
  await p.click('[data-testid=new-campaign]'); await p.waitForSelector('[data-testid=create-sheet]');
  await p.click('text=Simulacija (botovi)'); await p.selectOption('[data-testid=create-sheet] select >> nth=1', '600'); await p.fill('[data-testid=campaign-name]', 'Testna kampanja');
  await p.click('[data-testid=create-submit]'); await p.waitForURL(/\/k\//); campaignUrl = p.url();
  await p.waitForSelector('[data-testid=dashboard]'); await p.waitForTimeout(600); await shot('03-dashboard');
});
await step('map', async () => { await p.click('[data-testid=nav-map]'); await p.waitForSelector('[data-testid=hexmap]'); await p.waitForTimeout(800); await shot('04-map'); });
await step('select-own-territory', async () => {
  const hex = p.locator('[data-tid]').filter({ has: p.locator('svg') }).first();
  // odaberi glavni grad: prvi hex s kapitalom koji je vlastiti — klik na bilo koji vlastiti kroz API nije moguć, pa uzimamo sve i tražimo naslov
  const ids = await p.$$eval('[data-tid]', (els) => els.map((e) => e.getAttribute('data-tid')));
  let found = false;
  for (const id of ids) { await p.locator(`[data-tid="${id}"]`).first().dispatchEvent("click"); await p.waitForTimeout(140); const vis = await p.locator('[data-testid=territory-actions] >> text=Novači').count(); if (vis) { found = true; break; } }
  if (!found) throw new Error('nije pronađen vlastiti teritorij');
  await p.waitForTimeout(500); await shot('05-territory-sheet');
});
await step('recruit-order', async () => {
  await p.click('[data-testid="act-Novači"]'); await p.waitForSelector('[data-testid=composer-recruit]');
  await p.waitForSelector('[data-testid=order-preview]'); await shot('06-composer');
  await p.click('[data-testid=submit-order]'); await p.waitForSelector('text=Naredba predana'); 
});
await step('orders-screen', async () => { await p.keyboard.press('Escape'); await p.goto(campaignUrl + '/naredbe'); await p.waitForSelector('[data-testid=orders-screen]'); await p.waitForSelector('[data-testid=order-row]'); await shot('07-orders'); });
await step('draft+edit+remove', async () => {
  await p.click('[data-testid=more-orders]'); await p.click('[data-testid=new-trade]'); await p.waitForSelector('[data-testid=composer-trade]'); await p.waitForSelector('[data-testid=order-preview]');
  await p.click('[data-testid=save-draft]'); await p.waitForSelector('text=Nacrt spremljen');
  await p.waitForSelector('[data-testid=submit-draft]'); await shot('08-draft');
  await p.click('[data-testid=submit-draft]'); await p.waitForSelector('text=Naredba predana');
  await p.locator('[data-testid=remove-order]').last().click(); await p.waitForSelector('text=Naredba uklonjena');
});
await step('conditional', async () => {
  await p.click('[data-testid=advanced]'); await p.click('[data-testid=new-conditional]'); await p.waitForSelector('[data-testid=conditional-composer]'); await p.click('[data-testid=cond-submit]'); await p.waitForSelector('text=Uvjetna naredba spremljena'); await p.waitForSelector('[data-testid=cond-row]'); await shot('09-conditional');
});
await step('planner', async () => {
  await p.goto(campaignUrl + '/karta');
  await p.waitForSelector('[data-testid=hexmap]'); await p.waitForTimeout(500);
  const ids = await p.$$eval('[data-tid]', (els) => els.map((e) => e.getAttribute('data-tid')));
  let ok = false;
  for (const id of ids) { await p.locator(`[data-tid="${id}"]`).first().dispatchEvent("click"); await p.waitForTimeout(140); if (await p.locator('[data-testid=attack-btn]').count()) { ok = true; break; } }
  if (!ok) throw new Error('nema mete za napad');
  await p.click('[data-testid=attack-btn]'); await p.waitForSelector('[data-testid=planner]'); await p.waitForTimeout(500); await shot('10-planner-1');
  await p.click('[data-testid=planner-next]'); await p.waitForTimeout(300);
  await p.locator('[data-testid=planner] button.chip', { hasText: /^Sve$/ }).first().click(); await shot('11-planner-2');
  await p.click('[data-testid=planner-next]'); await p.waitForTimeout(250);
  await p.waitForSelector('[data-testid=order-preview]'); await shot('12-planner-review');
  await p.click('[data-testid=planner-submit]'); await p.waitForSelector('text=Napad predan'); await p.goto(campaignUrl + '/naredbe'); await p.waitForSelector('[data-testid=order-row]');
});
await step('diplomacy', async () => { await p.goto(campaignUrl + '/diplomacija'); await p.waitForSelector('[data-testid=diplomacy-screen]'); await p.waitForTimeout(300); await shot('13-diplomacy'); await p.click('[role=tab]:has-text("Pregovori")'); await p.waitForSelector('[data-testid=messages]'); await p.fill('[data-testid=message-input]', 'Pozdrav, savezniče?'); await p.click('[data-testid=message-send]'); await p.waitForSelector('text=Pozdrav, savezniče?'); });
await step('tech', async () => { await p.goto(campaignUrl + '/tehnologija'); await p.waitForSelector('[data-testid=tech-screen]'); await shot('14-tech'); });
await step('kingdom', async () => { await p.goto(campaignUrl + '/kraljevstvo'); await p.waitForSelector('[data-testid=kingdom-screen]'); await p.click('[data-testid=tax-low]'); await p.waitForSelector('text=Porezna razina promijenjena'); await shot('15-kingdom'); });
await step('profile+more+ranking', async () => { await p.goto(campaignUrl + '/profil'); await p.waitForSelector('[data-testid=profile-screen]'); await shot('16-profile'); await p.goto(campaignUrl + '/vise'); await p.waitForSelector('[data-testid=more-screen]'); await shot('17-more'); await p.goto(campaignUrl + '/ljestvica'); await p.waitForSelector('[data-testid=ranking-screen]'); });
await step('lock+resolve', async () => {
  await p.goto(campaignUrl); await p.waitForSelector('[data-testid=dev-resolve]'); await p.click('[data-testid=ready-toggle]'); await p.locator('[data-testid=ready-confirm]').click({ timeout: 1500 }).catch(() => undefined); await p.waitForTimeout(600);
  await p.click('[data-testid=dev-resolve]'); await p.waitForSelector('text=Dan 2 / 7'); await p.waitForTimeout(700); await shot('18-day2');
  await p.goto(campaignUrl + '/izvjestaji'); await p.waitForSelector('[data-testid=report-screen]'); await shot('19-report');
});
await step('notifications', async () => { await p.goto(campaignUrl + '/obavijesti'); await p.waitForSelector('[data-testid=notifications-screen]'); await p.waitForTimeout(400); await shot('20-notifications'); });
await step('full-campaign+results', async () => {
  await p.goto(campaignUrl); await p.waitForSelector('[data-testid=dev-resolve-all]'); await p.click('[data-testid=dev-resolve-all]'); await p.waitForSelector('text=Kampanja završena', { timeout: 20000 });
  await p.goto(campaignUrl + '/rezultati'); await p.waitForSelector('[data-testid=results-screen]'); await p.waitForTimeout(1500); await p.click('[data-testid=results-skip]'); await p.waitForSelector('text=Priznanja'); await shot('21-results');
});
await step('admin', async () => { await p.goto(base + '/admin'); await p.waitForSelector('[data-testid=admin]'); await p.waitForSelector('[data-testid=admin-campaign]'); await shot('22-admin'); });
// Desktop
await step('desktop-map', async () => {
  await p.setViewportSize({ width: 1440, height: 900 }); await p.goto(campaignUrl + '/karta'); await p.waitForSelector('[data-testid=hexmap]'); await p.waitForTimeout(800); await shot('23-desktop-map');
});
log('\nGreške:', errors.length ? '\n' + errors.join('\n') : 'nema');
await b.close();
process.exit(errors.length ? 1 : 0);
