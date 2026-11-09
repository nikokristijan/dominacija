// E2E: špijun poslan ujutro → rezultat u podne (prije večernjeg razrješenja). node tests/e2e/midday.mjs <baseUrl> <outDir>
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const base = process.argv[2] ?? 'http://localhost:3100', out = process.argv[3] ?? '/tmp';
const errors = [];
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1100, height: 1000 } }); await ctx.addInitScript(() => { try { localStorage.setItem('dom_no_edition', '1'); } catch {} });
const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
const step = async (n, fn) => { try { await fn(); console.log('OK  ', n); } catch (e) { console.log('FAIL', n, '-', e.message.slice(0, 500)); errors.push(n); } };
let id;
const api = async (path, body) => (body ? p.request.post(base + path, { data: body }) : p.request.get(base + path));
await step('priprema: simulacija s podnevom', async () => {
  await p.goto(base + '/prijava?mode=register'); await p.fill('[data-testid=username]', 'md' + (Date.now() % 1000000)); await p.fill('[data-testid=displayname]', 'Podne'); await p.fill('[data-testid=password]', 'lozinka123');
  await p.click('[data-testid=auth-submit]'); await p.waitForURL('**/igra'); await p.click('[data-testid=new-campaign]'); await p.click('text=Simulacija (botovi)');
  await p.selectOption('[data-testid=create-sheet] select >> nth=1', '600'); await p.click('[data-testid=create-submit]'); await p.waitForURL(/\/k\//); await p.waitForSelector('[data-testid=dashboard]');
  id = p.url().split('/k/')[1].split('/')[0];
  await p.waitForSelector('[data-testid=day-timeline]');
});
await step('špijun predan ujutro, još bez rezultata', async () => {
  const r = await (await api(`/api/campaigns/${id}`)).json(); const v = r.view;
  const tgt = Object.values(v.territories).find((t) => t.owner && t.owner !== v.me.id && t.terrain !== 'water');
  const o = await api(`/api/campaigns/${id}/orders`, { action: 'create', order: { type: 'espionage', params: { action: 'army', targetTerritoryId: tgt.id } }, status: 'submitted' });
  if (!o.ok()) throw new Error('naredba: ' + (await o.text()));
  const v2 = (await (await api(`/api/campaigns/${id}`)).json()).view;
  if (v2.middayDone) throw new Error('podne ne smije biti odrađeno'); if (v2.intel.some((i) => i.round === 1 && i.owner === v2.me.id)) throw new Error('izvješće prerano');
  await p.goto(`${base}/k/${id}/naredbe`); await p.waitForSelector('[data-testid=order-row]'); await p.waitForSelector('text=Podne');
});
await step('podne: izvješće stiže, ZB ostaju potrošeni, dan ostaje isti', async () => {
  const before = (await (await api(`/api/campaigns/${id}`)).json()).view.cp.used;
  const d = await api(`/api/campaigns/${id}/dev`, { action: 'midday' }); if (!d.ok()) throw new Error('dev midday: ' + (await d.text()));
  const v = (await (await api(`/api/campaigns/${id}`)).json()).view;
  if (!v.middayDone) throw new Error('middayDone=false'); if (v.round !== 1) throw new Error('dan se pomaknuo');
  if (!v.intel.some((i) => i.round === 1 && i.owner === v.me.id)) throw new Error('nema izvješća');
  if (v.cp.used !== before) throw new Error(`ZB: ${before} → ${v.cp.used}`);
  if (!v.orders.some((o) => o.type === 'espionage' && o.status === 'executed')) throw new Error('naredba nije izvršena');
});
await step('sučelje: podnevni ishod i preporuka', async () => {
  await p.goto(`${base}/k/${id}/naredbe`); await p.waitForSelector('[data-testid=midday-outcome]');
  await p.goto(`${base}/k/${id}`); await p.waitForSelector('[data-testid=suggestions] >> text=Izvidnici su se vratili'); await p.screenshot({ path: `${out}/midday-home.png` });
});
await step('večer: dan 2, špijunaža nije obrađena dvaput', async () => {
  const intel1 = (await (await api(`/api/campaigns/${id}`)).json()).view.intel.filter((i) => i.round === 1).length;
  await api(`/api/campaigns/${id}/orders`, { action: 'ready', ready: true });
  // u simulaciji se dan razrješava čim su svi ljudi spremni
  const v = (await (await api(`/api/campaigns/${id}`)).json()).view;
  if (v.round !== 2) throw new Error('nije dan 2'); if (v.intel.filter((i) => i.round === 1).length !== intel1) throw new Error('dvostruka obrada');
  if (v.middayDone) throw new Error('middayDone mora biti reset za novi dan');
});
console.log('\nGreške:', errors.length ? errors.join(', ') : 'nema');
await b.close(); process.exit(errors.length ? 1 : 0);
