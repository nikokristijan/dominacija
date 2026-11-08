// E2E: dvoje pravih korisnika — vlasnik stvara brzu partiju s botovima, prijatelj se pridružuje kodom, oboje označe "spremno" → razrješenje.
// node tests/e2e/friends.mjs <baseUrl>
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const base = process.argv[2] ?? 'http://localhost:3100';
const errors = [];
const b = await chromium.launch();
const mk = async () => { const c = await b.newContext({ viewport: { width: 1440, height: 900 } }); await c.addInitScript(() => { try { localStorage.setItem('dom_no_edition', '1'); } catch {} }); const p = await c.newPage(); p.on('pageerror', (e) => errors.push('pageerror: ' + e.message)); return p; };
const step = async (n, fn) => { try { await fn(); console.log('OK  ', n); } catch (e) { console.log('FAIL', n, '-', e.message.slice(0, 400)); errors.push(n); } };
const reg = async (p, user, name) => {
  await p.goto(base + '/prijava?mode=register'); await p.fill('[data-testid=username]', user); await p.fill('[data-testid=displayname]', name); await p.fill('[data-testid=password]', 'lozinka123');
  await p.click('[data-testid=auth-submit]'); await p.waitForURL('**/igra'); await p.waitForSelector('[data-testid=new-campaign]');
};
const a = await mk(), f = await mk();
const u = Date.now() % 1000000;
let code, url;
await step('vlasnik: registracija + brza partija s botovima', async () => {
  await reg(a, 'vlasnik' + u, 'Vlasnik');
  await a.click('[data-testid=new-campaign]'); await a.waitForSelector('[data-testid=create-sheet]');
  await a.fill('[data-testid=campaign-name]', 'Prijatelji'); await a.click('[data-testid=create-submit]'); await a.waitForSelector('[data-testid=lobby]');
  code = (await a.locator('[data-testid=invite-code]').textContent()).trim(); url = a.url();
  if (!/^[A-Z0-9]{4,8}$/.test(code)) throw new Error('kod: ' + code);
});
await step('prijatelj: registracija + ulazak kodom', async () => {
  await reg(f, 'prijatelj' + u, 'Prijatelj');
  await f.click('[data-testid=join-campaign]'); await f.fill('[data-testid=join-code]', code); await f.click('[data-testid=join-submit]'); await f.waitForSelector('[data-testid=lobby]');
});
await step('vlasnik pokreće (botovi popunjavaju)', async () => {
  await a.reload(); await a.waitForSelector('text=Prijatelj'); await a.click('[data-testid=start-campaign]'); await a.waitForSelector('[data-testid=dashboard]', { timeout: 15000 });
  await f.reload(); await f.waitForSelector('[data-testid=dashboard]', { timeout: 15000 });
});
await step('oboje spremni → dan 2 (botovi igraju)', async () => {
  await a.click('[data-testid=ready-toggle]'); await a.waitForTimeout(500);
  await f.click('[data-testid=ready-toggle]');
  await f.waitForSelector('text=Dan 2', { timeout: 20000 });
  await a.reload(); await a.waitForSelector('text=Dan 2', { timeout: 20000 });
});
console.log('\nGreške:', errors.length ? errors.join(', ') : 'nema');
await b.close();
process.exit(errors.length ? 1 : 0);
