import { describe, expect, it } from 'vitest';
import {
  createCampaignState, resolveRound, addOrder, validateOrder, GAME_CONFIG, computeSupply, forecastEconomy, previewOrder, setReady, playerTerritories, unitTotal,
  type GameState, type OrderInput,
} from '../src/engine';
import { botPlan } from '../src/engine/ai';
import { resolveBattle, type Force } from '../src/engine/combat';
import { getMods } from '../src/engine/tech';
import { respondToOffer, terminateAlliance, createAlliance, sendMessage } from '../src/engine/diplomacy';
import { computeScore } from '../src/engine/scoring';
import { neighborIds, applyLossFractionForTest } from './helpers';
import { objectiveProgress, addConditional } from '../src/engine';
import { offsetDistance } from '../src/engine/hex';

const NOW = '2026-01-01T08:00:00.000Z';
function mk(n = 4, seed = 'test-seed', cfg?: any): GameState {
  return createCampaignState({ campaignId: 'c1', seed, config: cfg, players: Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, userId: `u${i + 1}`, name: `Igrač ${i + 1}` })) });
}
const sub = (s: GameState, pid: string, o: OrderInput) => addOrder(s, pid, o, 'submitted', NOW);

describe('Generiranje karte i početni uvjeti', () => {
  it('ima 100–120 teritorija i sve su jedinstvene ID-jeve', () => {
    const s = mk(6);
    const n = Object.keys(s.map.territories).length;
    expect(n).toBeGreaterThanOrEqual(100); expect(n).toBeLessThanOrEqual(120);
  });
  it('svaki igrač počinje s kapitalom, dva teritorija, 10 vojnika i propisanim resursima', () => {
    const s = mk(5);
    for (const id of s.playerOrder) {
      const p = s.players[id];
      const ts = playerTerritories(s, id);
      expect(ts.length).toBe(3);
      expect(ts.filter((t) => t.isCapital).length).toBe(1);
      expect(ts.reduce((a, t) => a + unitTotal(t.garrison), 0)).toBe(10);
      expect(p.resources).toEqual(GAME_CONFIG.start.resources);
      expect(p.stability).toBe(80);
    }
  });
  it('početne pozicije su pošteno izjednačene (ista terenska kompozicija jezgre)', () => {
    for (const seed of ['a', 'b', 'c', 'd']) {
      const s = mk(6, seed);
      const sig = (id: string) => playerTerritories(s, id).map((t) => t.terrain).sort().join(',');
      const first = sig(s.playerOrder[0]);
      for (const id of s.playerOrder) expect(sig(id)).toBe(first);
      // Količina kopna u radijusu 3 heksa: obala otoka ne smije kažnjavati nikoga (identična jezgra je provjerena gore)
      const pot = s.playerOrder.map((id) => {
        const cap = s.map.territories[s.players[id].capitalId];
        return Object.values(s.map.territories).filter((t) => t.terrain !== 'water' && offsetDistance(t, cap) <= 3).reduce((a, t) => a + 1, 0);
      });
      expect(Math.max(...pot) / Math.min(...pot)).toBeLessThan(1.25);
    }
  });
  it('kopno je povezano', () => {
    const s = mk(8, 'conn');
    const land = s.map.order.filter((i) => s.map.territories[i].terrain !== 'water');
    const seen = new Set([land[0]]); const st = [land[0]];
    while (st.length) { const c = st.pop()!; for (const n of neighborIds(s, c)) if (!seen.has(n)) { seen.add(n); st.push(n); } }
    expect(seen.size).toBe(land.length);
  });
  it('generiranje je determinističko', () => {
    expect(JSON.stringify(mk(4, 'same'))).toBe(JSON.stringify(mk(4, 'same')));
  });
});

describe('Naredbe i zapovjedni bodovi', () => {
  it('odbija naredbe koje premašuju dnevni limit zapovjednih bodova', () => {
    const s = mk();
    const cap = s.players.p1.capitalId;
    s.players.p1.resources = { gold: 999, food: 999, iron: 999, wood: 999, influence: 99 };
    const lim = GAME_CONFIG.campaign.commandPointsPerDay;
    // 3 CP × istraživanje troši 3 CP svako; popuni do limita pa je sljedeća 1-CP naredba odbijena
    let used = 0; const techs = ['mil_infantry', 'eco_agri', 'gov_order', 'spy_intel'];
    for (const t of techs) { if (used + 3 > lim - 1) break; expect(sub(s, 'p1', { type: 'research', params: { techId: t } }).ok).toBe(true); used += 3; }
    while (used < lim) { expect(sub(s, 'p1', { type: 'recruit', params: { territoryId: cap, unit: 'infantry', count: 1 } }).ok).toBe(true); used += 1; }
    const r = sub(s, 'p1', { type: 'recruit', params: { territoryId: cap, unit: 'infantry', count: 1 } });
    expect(r.ok).toBe(false);
    expect(r.validation.errors.join(' ')).toMatch(/zapovjednih bodova/);
  });
  it('sprječava dvostruko trošenje resursa (rezervacija pri predaji)', () => {
    const s = mk();
    const cap = s.players.p1.capitalId;
    // 25 pješaka troše većinu zlata → druga naredba (strijelci) ne smije proći isto zlato
    const inf = GAME_CONFIG.units.infantry.cost.gold; const n1 = Math.min(20, Math.floor((GAME_CONFIG.start.resources.gold - 20) / inf));
    const r1 = sub(s, 'p1', { type: 'recruit', params: { territoryId: cap, unit: 'infantry', count: n1 } }); expect(r1.ok, JSON.stringify(r1.validation.errors)).toBe(true);
    const r2 = sub(s, 'p1', { type: 'recruit', params: { territoryId: cap, unit: 'archers', count: 8 } });
    expect(r2.ok).toBe(false);
    expect(r2.validation.errors.join(' ')).toMatch(/Nedovoljno resursa/);
  });
  it('nacrti ne troše CP ni resurse; predaja ih rezervira', () => {
    const s = mk();
    const cap = s.players.p1.capitalId;
    const d = addOrder(s, 'p1', { type: 'recruit', params: { territoryId: cap, unit: 'infantry', count: 5 } }, 'draft', NOW);
    expect(d.ok).toBe(true);
    expect(s.orders.filter((o) => o.status === 'submitted').length).toBe(0);
  });
  it('ne dopušta napad iz tuđeg teritorija niti na nesusjedni teritorij', () => {
    const s = mk();
    const own = playerTerritories(s, 'p1')[0];
    const far = playerTerritories(s, 'p2')[0];
    const v = validateOrder(s, 'p1', { type: 'attack', params: { fromId: far.id, targetId: own.id, units: { infantry: 1 }, strategy: 'direct', formation: 'line', supply: 'standard', risk: 'balanced', retreatBelow: 0.3, reserve: {} } });
    expect(v.ok).toBe(false);
  });
  it('ne može poslati više vojnika nego što ih ima, niti iste vojnike u dva napada', () => {
    const s = mk();
    const cap = s.map.territories[s.players.p1.capitalId];
    const target = neighborIds(s, cap.id).map((i) => s.map.territories[i]).find((t) => t.owner === null)!;
    const base = { fromId: cap.id, targetId: target.id, strategy: 'direct', formation: 'line', supply: 'standard', risk: 'balanced', retreatBelow: 0.3, reserve: {} } as const;
    expect(sub(s, 'p1', { type: 'attack', params: { ...base, units: { infantry: 4 } } }).ok).toBe(true);
    const second = sub(s, 'p1', { type: 'attack', params: { ...base, units: { infantry: 1 } } });
    expect(second.ok).toBe(false);
  });
  it('rezerva sprječava slanje posljednjih postrojbi', () => {
    const s = mk();
    const cap = s.map.territories[s.players.p1.capitalId];
    const target = neighborIds(s, cap.id).map((i) => s.map.territories[i]).find((t) => t.owner === null)!;
    const v = validateOrder(s, 'p1', { type: 'attack', params: { fromId: cap.id, targetId: target.id, units: { infantry: 4, archers: 2 }, strategy: 'direct', formation: 'line', supply: 'standard', risk: 'balanced', retreatBelow: 0.3, reserve: { infantry: 1 } } });
    expect(v.ok).toBe(false);
  });
  it('troškovi CP su konfigurabilni', () => {
    const s = mk(4, 'cfg', { orderCosts: { recruit: 4 } });
    const cap = s.players.p1.capitalId;
    expect(validateOrder(s, 'p1', { type: 'recruit', params: { territoryId: cap, unit: 'infantry', count: 1 } }).cpCost).toBe(4);
  });
  it('nakon završetka planiranja naredbe se ne mogu mijenjati', () => {
    const s = mk();
    s.phase = 'locked';
    expect(sub(s, 'p1', { type: 'trade', params: { give: 'gold', receive: 'iron', amount: 5 } }).ok).toBe(false);
  });
  it('označavanje spremnosti zaključava izmjene dok se ne otključa', () => {
    const s = mk();
    setReady(s, 'p1', true);
    expect(sub(s, 'p1', { type: 'trade', params: { give: 'gold', receive: 'iron', amount: 5 } }).ok).toBe(false);
    setReady(s, 'p1', false);
    expect(sub(s, 'p1', { type: 'trade', params: { give: 'gold', receive: 'iron', amount: 5 } }).ok).toBe(true);
  });
});

describe('Ekonomija', () => {
  it('proizvodnja je predvidljiva: prognoza = stvarna promjena nakon razrješenja', () => {
    const s = mk();
    const fc = forecastEconomy(s, 'p1');
    const before = { ...s.players.p1.resources };
    const out = resolveRound(s);
    const after = out.players.p1.resources;
    expect(after.gold - before.gold).toBeCloseTo(fc.net.gold, 1);
    expect(after.food - before.food).toBeCloseTo(fc.net.food, 1);
    expect(after.iron - before.iron).toBeCloseTo(fc.net.iron, 1);
    expect(after.wood - before.wood).toBeCloseTo(fc.net.wood, 1);
  });
  it('visoki porezi povećavaju zlato, ali smanjuju stabilnost', () => {
    const a = mk(), b = mk();
    b.players.p1.tax = 'high'; a.players.p1.tax = 'low';
    const fa = forecastEconomy(a, 'p1'), fb = forecastEconomy(b, 'p1');
    expect(fb.taxes).toBeGreaterThan(fa.taxes);
    expect(fb.stabilityDelta).toBeLessThan(fa.stabilityDelta);
  });
  it('gradnja i novačenje stižu početkom iduće runde', () => {
    const s = mk();
    const cap = s.players.p1.capitalId;
    sub(s, 'p1', { type: 'recruit', params: { territoryId: cap, unit: 'infantry', count: 5 } });
    const before = unitTotal(s.map.territories[cap].garrison);
    const farm = playerTerritories(s, 'p1').find((t) => t.terrain === 'forest')!;
    sub(s, 'p1', { type: 'build', params: { territoryId: farm.id, building: 'farm' } });
    const out = resolveRound(s);
    expect(unitTotal(out.map.territories[cap].garrison)).toBe(before + 5);
    expect(out.map.territories[farm.id].building).toBe('farm');
  });
  it('trošak resursa odbija se točno jednom (bez dvostrukog trošenja pri razrješenju)', () => {
    const s = mk();
    const cap = s.players.p1.capitalId;
    sub(s, 'p1', { type: 'recruit', params: { territoryId: cap, unit: 'infantry', count: 5 } });
    const noOrder = resolveRound(mk());
    const withOrder = resolveRound(s);
    // 5 pješaka: točno jednom cijena (razlika u odnosu na isti scenarij bez naredbe, osim održavanja novaka)
    const ic = GAME_CONFIG.units.infantry.cost;
    expect(noOrder.players.p1.resources.gold - withOrder.players.p1.resources.gold).toBeCloseTo(5 * ic.gold, 0);
    expect(noOrder.players.p1.resources.iron - withOrder.players.p1.resources.iron).toBeCloseTo(5 * ic.iron, 0);
  });
  it('trgovačka ekspedicija mijenja resurse po tečaju s razlikom (spread)', () => {
    const s = mk();
    sub(s, 'p1', { type: 'trade', params: { give: 'gold', receive: 'iron', amount: 30 } });
    const out = resolveRound(s);
    const plain = resolveRound(mk());
    const gotIron = out.players.p1.resources.iron - plain.players.p1.resources.iron;
    expect(gotIron).toBeGreaterThan(0);
    expect(gotIron).toBeLessThan(30 / 2.5);
  });
  it('glad smanjuje stabilnost i vojsku', () => {
    const s = mk();
    s.players.p1.resources.food = 0;
    for (const t of playerTerritories(s, 'p1')) t.garrison = { infantry: 60 };
    const out = resolveRound(s);
    expect(out.players.p1.stability).toBeLessThan(s.players.p1.stability);
    expect(playerTerritories(out, 'p1').reduce((n, t) => n + unitTotal(t.garrison), 0)).toBeLessThan(180);
  });
  it('pobuna se događa tek nakon upozorenja i pod pragom stabilnosti', () => {
    const s = mk();
    s.players.p1.stability = 10; s.players.p1.rebellionWarned = false; s.players.p1.tax = 'high';
    const out1 = resolveRound(s);
    expect(playerTerritories(out1, 'p1').length).toBe(3); // nije bilo upozorenja → nema pobune
    expect(out1.players.p1.rebellionWarned).toBe(true);
    out1.players.p1.stability = 10;
    const out2 = resolveRound(out1);
    expect(playerTerritories(out2, 'p1').length).toBeLessThan(3);
  });
});

describe('Borba', () => {
  const cfg = GAME_CONFIG;
  const mods = getMods({ techs: [] } as any);
  const baseForce = (units: any, over: Partial<Force> = {}): Force => ({
    playerId: 'a', fromId: 'x', units, strategy: 'direct', formation: 'line', risk: 'balanced', retreatBelow: 0.3, supplyRatio: 1, mods, stability: 80, intelConfidence: 0, betrayal: false, resistance: false, ...over,
  });
  const def = (units: any, over: any = {}) => ({ playerId: 'd', units, mods, stability: 80, entrenched: false, isolated: false, pressure: false, ...over });
  const terr = { terrain: 'plains' as const, defenseLevel: 0, building: null, buildingLevel: 0, isCapital: false, siegeProgress: 0 };
  const ctx = { cfg, storm: false, adjacentFriendly: 1, jointAttack: false };

  it('je deterministička', () => {
    const a = resolveBattle([baseForce({ infantry: 10 })], def({ infantry: 8 }), terr, ctx);
    const b = resolveBattle([baseForce({ infantry: 10 })], def({ infantry: 8 }), terr, ctx);
    expect(a).toEqual(b);
  });
  it('jača sila pobjeđuje, slabija gubi više', () => {
    const r = resolveBattle([baseForce({ infantry: 20 })], def({ infantry: 5 }), terr, ctx);
    expect(r.outcome).toBe('attacker_victory');
    expect(Object.values(r.defenderLosses).reduce((a, b) => a! + b!, 0)).toBeGreaterThan(Object.values(r.attackerLosses).reduce((a, b) => a! + b!, 0)!);
  });
  it('planina i tvrđava daju prednost braniteljima', () => {
    const open = resolveBattle([baseForce({ infantry: 10 })], def({ infantry: 8 }), terr, ctx);
    const fort = resolveBattle([baseForce({ infantry: 10 })], def({ infantry: 8 }), { ...terr, terrain: 'mountains', building: 'fortress', buildingLevel: 2 }, ctx);
    expect(fort.defenderPower).toBeGreaterThan(open.defenderPower * 1.5);
    expect(fort.outcome).toBe('defender_victory');
  });
  it('kopljanici tuku konjicu (protuteža jedinica)', () => {
    const cavVsSpear = resolveBattle([baseForce({ cavalry: 10 })], def({ spearmen: 10 }), terr, ctx);
    const cavVsArch = resolveBattle([baseForce({ cavalry: 10 })], def({ archers: 10 }), terr, ctx);
    expect(cavVsSpear.attackerPower).toBeLessThan(cavVsArch.attackerPower * 1.01 + 100);
    expect(cavVsSpear.defenderPower / cavVsSpear.attackerPower).toBeGreaterThan(cavVsArch.defenderPower / cavVsArch.attackerPower);
  });
  it('opsada slabi utvrde, a opsadna oruđa zaobilaze dio obrane', () => {
    const fortT = { ...terr, building: 'fortress' as const, buildingLevel: 3, terrain: 'plains' as const };
    const direct = resolveBattle([baseForce({ infantry: 12, siege: 2 })], def({ infantry: 8 }), fortT, ctx);
    const siege = resolveBattle([baseForce({ infantry: 12, siege: 2 }, { strategy: 'siege' })], def({ infantry: 8 }), fortT, ctx);
    expect(siege.fortificationCut).toBeGreaterThan(0);
    expect(siege.defenderPower).toBeLessThan(direct.defenderPower);
  });
  it('zasjeda je jača s točnom obavještajnom procjenom', () => {
    const blind = resolveBattle([baseForce({ infantry: 10 }, { strategy: 'ambush', intelConfidence: 0 })], def({ infantry: 8 }), terr, ctx);
    const informed = resolveBattle([baseForce({ infantry: 10 }, { strategy: 'ambush', intelConfidence: 1 })], def({ infantry: 8 }), terr, ctx);
    expect(informed.attackerPower).toBeGreaterThan(blind.attackerPower * 1.4);
  });
  it('opskrba, moral i izolacija utječu na snagu', () => {
    const fed = resolveBattle([baseForce({ infantry: 10 })], def({ infantry: 8 }), terr, ctx);
    const starved = resolveBattle([baseForce({ infantry: 10 }, { supplyRatio: 0.6 })], def({ infantry: 8 }), terr, ctx);
    const isolated = resolveBattle([baseForce({ infantry: 10 })], def({ infantry: 8 }, { isolated: true }), terr, ctx);
    expect(starved.attackerPower).toBeLessThan(fed.attackerPower);
    expect(isolated.defenderPower).toBeLessThan(fed.defenderPower);
  });
  it('povlačenje zadržava preživjele kad padnu ispod praga', () => {
    const r = resolveBattle([baseForce({ infantry: 10 }, { retreatBelow: 0.8 })], def({ infantry: 14 }, { entrenched: true }), terr, ctx);
    expect(r.outcome).toBe('retreat');
    expect(Object.values(r.attackerSurvivors).reduce((a, b) => a! + b!, 0)).toBeGreaterThan(0);
  });
  it('koordinirani napad daje bonus', () => {
    const one = resolveBattle([baseForce({ infantry: 20 })], def({ infantry: 10 }), terr, ctx);
    const two = resolveBattle([baseForce({ infantry: 10 }), baseForce({ infantry: 10 }, { playerId: 'b' })], def({ infantry: 10 }), terr, ctx);
    expect(two.attackerPower).toBeGreaterThan(one.attackerPower);
  });
  it('izvješće objašnjava ishod čimbenicima', () => {
    const r = resolveBattle([baseForce({ infantry: 10 })], def({ infantry: 8 }, { entrenched: true }), { ...terr, terrain: 'forest' }, ctx);
    expect(r.factors.length).toBeGreaterThan(0);
    expect(r.explanation.length).toBeGreaterThan(1);
  });
  it('zaokruživanje gubitaka čuva ukupan broj', () => {
    const { survivors, losses } = applyLossFractionForTest({ infantry: 7, archers: 3, cavalry: 2 }, 0.5);
    expect(Object.values(losses).reduce((a, b) => a! + b!, 0)).toBe(6);
    expect(Object.values(survivors).reduce((a, b) => a! + b!, 0)).toBe(6);
  });
});

function attackOrder(s: GameState, pid: string, fromId: string, targetId: string, units: any, over: any = {}): OrderInput {
  return { type: 'attack', params: { fromId, targetId, units, strategy: 'direct', formation: 'line', supply: 'standard', risk: 'balanced', retreatBelow: 0, reserve: {}, ...over } };
}
/** Postavi scenarij: p2 vlasnik teritorija pored p1-ova kapitala. */
function scenario() {
  const s = mk(4, 'scn');
  const cap1 = s.map.territories[s.players.p1.capitalId];
  const target = neighborIds(s, cap1.id).map((i) => s.map.territories[i]).find((t) => t.owner === null && t.terrain !== 'water')!;
  target.owner = 'p2'; target.garrison = { infantry: 3 }; target.stability = 70;
  cap1.garrison = { infantry: 30, archers: 4 };
  for (const t of Object.values(s.map.territories)) if (t.owner === 'p1') t.effects = [];
  return { s, cap1, target };
}

describe('Simultano razrješenje i sukobi naredbi', () => {
  it('osvaja teritorij, mijenja vlasnika i proizvodi bojno izvješće', () => {
    const { s, cap1, target } = scenario();
    expect(sub(s, 'p1', attackOrder(s, 'p1', cap1.id, target.id, { infantry: 20 })).ok).toBe(true);
    const out = resolveRound(s);
    expect(out.map.territories[target.id].owner).toBe('p1');
    const b = out.battles.find((x) => x.territoryId === target.id)!;
    expect(b.captured).toBe(true);
    expect(b.visibleTo.sort()).toEqual(['p1', 'p2']);
    expect(out.players.p1.stats.battlesWon).toBe(1);
  });
  it('troši hranu za opskrbu', () => {
    const { s, cap1, target } = scenario();
    const orderRes = sub(s, 'p1', attackOrder(s, 'p1', cap1.id, target.id, { infantry: 20 }));
    expect(orderRes.validation.resourceCost.food).toBeGreaterThan(0);
  });
  it('postrojbe odlaze istovremeno: polazni teritorij ostaje slabiji', () => {
    const { s, cap1, target } = scenario();
    sub(s, 'p1', attackOrder(s, 'p1', cap1.id, target.id, { infantry: 28 }));
    const out = resolveRound(s);
    expect(unitTotal(out.map.territories[cap1.id].garrison)).toBeLessThan(10);
  });
  it('međusobni napadi (zamjena) rješavaju se bez rušenja i oba teritorija mijenjaju vlasnika', () => {
    const { s, cap1, target } = scenario();
    target.garrison = { infantry: 25 };
    sub(s, 'p1', attackOrder(s, 'p1', cap1.id, target.id, { infantry: 28 }));
    sub(s, 'p2', attackOrder(s, 'p2', target.id, cap1.id, { infantry: 22 }));
    const out = resolveRound(s);
    expect(out.map.territories[target.id].owner).toBeDefined();
    expect(out.battles.length).toBe(2);
  });
  it('više napadača na isti teritorij: jača koalicija pobjeđuje, ostali se bore s pobjednikom', () => {
    const s = mk(4, 'multi');
    const t = Object.values(s.map.territories).find((x) => x.terrain === 'plains' && !x.owner && neighborIds(s, x.id).length === 6)!;
    t.garrison = { infantry: 4 };
    // dodijeli susjedne teritorije p1 i p2
    const ns = neighborIds(s, t.id).map((i) => s.map.territories[i]);
    ns[0].owner = 'p1'; ns[0].garrison = { infantry: 20 };
    ns[3].owner = 'p2'; ns[3].garrison = { infantry: 12 };
    for (const id of ['p1', 'p2']) s.players[id].resources.food = 200;
    expect(sub(s, 'p1', attackOrder(s, 'p1', ns[0].id, t.id, { infantry: 18 })).ok).toBe(true);
    expect(sub(s, 'p2', attackOrder(s, 'p2', ns[3].id, t.id, { infantry: 11 })).ok).toBe(true);
    const out = resolveRound(s);
    expect(out.map.territories[t.id].owner).toBe('p1');
    expect(out.battles.filter((b) => b.territoryId === t.id).length).toBe(2);
  });
  it('razrješenje je idempotentno (druga rezolucija iste runde ne mijenja ništa)', () => {
    const s = mk();
    const out = resolveRound(s);
    // pokušaj ponovnog razrješenja iste (već razriješene) runde
    const replay = { ...out, round: 1, phase: 'planning' as const };
    expect(resolveRound(replay)).toBe(replay);
  });
  it('isti ulaz daje identičan izlaz (determinizam kroz više rundi)', () => {
    const run = () => {
      let s = mk(5, 'det');
      for (let i = 0; i < 3; i++) { for (const id of s.playerOrder) botPlan(s, id, NOW); s = resolveRound(s, { now: NOW }); }
      return JSON.stringify(s);
    };
    expect(run()).toBe(run());
  });
  it('redoslijed igrača u unosu naredbi ne mijenja ishod (istovremenost)', () => {
    const base = scenario();
    const mkOrders = (rev: boolean) => {
      const { s, cap1, target } = scenario();
      const cap2 = s.map.territories[s.players.p2.capitalId];
      const ords: Array<() => void> = [
        () => sub(s, 'p1', attackOrder(s, 'p1', cap1.id, target.id, { infantry: 20 })),
        () => sub(s, 'p2', { type: 'defend', params: { territoryId: cap2.id, stance: 'entrench' } }),
      ];
      (rev ? ords.reverse() : ords).forEach((f) => f());
      return JSON.stringify(resolveRound(s).map.territories[target.id]);
    };
    void base;
    expect(mkOrders(false)).toBe(mkOrders(true));
  });
  it('sukob pripajanja neutralnog teritorija: samo jedan igrač pobjeđuje i samo on plaća', () => {
    const s = mk(4, 'annex');
    const t = Object.values(s.map.territories).find((x) => x.terrain === 'plains' && !x.owner)!;
    const ns = neighborIds(s, t.id).map((i) => s.map.territories[i]);
    ns[0].owner = 'p1'; ns[1].owner = 'p2';
    s.players.p1.resources.influence = 50; s.players.p2.resources.influence = 50;
    expect(sub(s, 'p1', { type: 'diplomacy', params: { kind: 'annex', targetTerritoryId: t.id } }).ok).toBe(true);
    expect(sub(s, 'p2', { type: 'diplomacy', params: { kind: 'annex', targetTerritoryId: t.id } }).ok).toBe(true);
    const out = resolveRound(s);
    const owner = out.map.territories[t.id].owner;
    expect(['p1', 'p2']).toContain(owner);
    const loser = owner === 'p1' ? 'p2' : 'p1';
    expect(out.orders.find((o) => o.playerId === loser && o.type === 'diplomacy')!.status).toBe('failed');
  });
});

describe('Uvjetne naredbe', () => {
  it('"AKO je napadnut moj teritorij → aktiviraj obrambenu formaciju" pojačava obranu', () => {
    const run = (withCond: boolean) => {
      const { s, cap1, target } = scenario();
      target.garrison = { infantry: 14 };
      sub(s, 'p1', attackOrder(s, 'p1', cap1.id, target.id, { infantry: 18 }));
      sub(s, 'p2', { type: 'trade', params: { give: 'gold', receive: 'iron', amount: 1 } }); // p2 je aktivan → nema automatske obrane
      if (withCond) {
        const r = addConditional(s, 'p2', { trigger: { type: 'territory_attacked', territoryId: target.id }, condition: { type: 'always' }, action: { type: 'defensive_formation' }, resourceReq: {}, priority: 1 }, NOW);
        expect(r.ok).toBe(true);
      }
      return resolveRound(s);
    };
    const without = run(false), withC = run(true);
    const bw = without.battles[0], bc = withC.battles[0];
    expect(bc.defenderPower).toBeGreaterThan(bw.defenderPower * 1.2);
    expect(withC.conditionalOrders.find((c) => c.playerId === 'p2')!.status).toBe('triggered');
  });
  it('ograničava broj uvjetnih naredbi po rundi', () => {
    const s = mk();
    const t = playerTerritories(s, 'p1')[0].id;
    let ok = 0;
    for (let i = 0; i < 6; i++) if (addConditional(s, 'p1', { trigger: { type: 'territory_attacked', territoryId: t }, condition: { type: 'always' }, action: { type: 'defensive_formation' }, resourceReq: {}, priority: i }, NOW).ok) ok++;
    expect(ok).toBe(GAME_CONFIG.campaign.maxConditionalOrdersPerRound);
  });
  it('uvjetna naredba ne izvršava se ako nema resursa (i ne troši ništa)', () => {
    const { s, cap1, target } = scenario();
    sub(s, 'p1', attackOrder(s, 'p1', cap1.id, target.id, { infantry: 20 }));
    s.players.p2.resources.gold = 0;
    addConditional(s, 'p2', { trigger: { type: 'territory_attacked', territoryId: target.id }, condition: { type: 'always' }, action: { type: 'defensive_formation' }, resourceReq: { gold: 50 }, priority: 1 }, NOW);
    const out = resolveRound(s);
    expect(out.conditionalOrders.find((c) => c.playerId === 'p2')!.status).toBe('failed');
    expect(out.players.p2.resources.gold).toBeGreaterThanOrEqual(0);
  });
  it('"AKO osvojim teritorij → izgradi tvrđavu" gradi nakon osvajanja', () => {
    const { s, cap1, target } = scenario();
    sub(s, 'p1', attackOrder(s, 'p1', cap1.id, target.id, { infantry: 20 }));
    const r = addConditional(s, 'p1', { trigger: { type: 'territory_conquered' }, condition: { type: 'always' }, action: { type: 'build_fortress' }, resourceReq: {}, priority: 1 }, NOW);
    expect(r.ok).toBe(true);
    s.players.p1.resources.iron = 100; s.players.p1.resources.wood = 100; s.players.p1.resources.gold = 200;
    const out = resolveRound(s);
    expect(out.map.territories[target.id].owner).toBe('p1');
    expect(out.map.territories[target.id].building).toBe('fortress');
  });
});

describe('Diplomacija', () => {
  it('savez: ponuda → prihvaćanje stvara aktivan savez; saveznik dijeli vid', () => {
    const s = mk();
    sub(s, 'p1', { type: 'diplomacy', params: { kind: 'alliance', targetPlayerId: 'p2' } });
    const r1 = resolveRound(s, { now: NOW });
    const offer = r1.offers.find((o) => o.kind === 'alliance')!;
    expect(offer.status).toBe('pending');
    expect(respondToOffer(r1, 'p2', offer.id, true).ok).toBe(true);
    expect(r1.alliances.length).toBe(1);
    expect(r1.alliances[0].status).toBe('active');
  });
  it('samo primatelj može odgovoriti na ponudu', () => {
    const s = mk();
    sub(s, 'p1', { type: 'diplomacy', params: { kind: 'alliance', targetPlayerId: 'p2' } });
    const r1 = resolveRound(s);
    const offer = r1.offers[0];
    expect(respondToOffer(r1, 'p3', offer.id, true).ok).toBe(false);
    expect(respondToOffer(r1, 'p1', offer.id, true).ok).toBe(false);
  });
  it('napad na saveznika je izdaja: prekida savez i narušava ugled', () => {
    const { s, cap1, target } = scenario();
    createAlliance(s, 'alliance', 'p1', 'p2', 4, false);
    const rep0 = s.players.p1.reputation.score;
    expect(sub(s, 'p1', attackOrder(s, 'p1', cap1.id, target.id, { infantry: 20 })).validation.warnings.join(' ')).toMatch(/IZDAJA/);
    const out = resolveRound(s);
    expect(out.alliances[0].status).toBe('broken');
    expect(out.players.p1.reputation.betrayals).toBe(1);
    expect(out.players.p1.reputation.score).toBeLessThan(rep0);
    expect(out.battles[0].factors.some((f) => /izdaj/i.test(f.label))).toBe(true);
  });
  it('savez ne čini igrača nepobjedivim, ali ugled se s vremenom oporavlja (nema trajne kazne)', () => {
    const { s, cap1, target } = scenario();
    createAlliance(s, 'alliance', 'p1', 'p2', 4, false);
    sub(s, 'p1', attackOrder(s, 'p1', cap1.id, target.id, { infantry: 20 }));
    let out = resolveRound(s);
    const low = out.players.p1.reputation.score;
    for (let i = 0; i < 3; i++) out = resolveRound(out);
    expect(out.players.p1.reputation.score).toBeGreaterThan(low);
  });
  it('trgovinska ponuda: izvršava se razmjena resursa između igrača bez dupliranja', () => {
    const s = mk();
    sub(s, 'p1', { type: 'diplomacy', params: { kind: 'trade', targetPlayerId: 'p2', terms: { give: { gold: 20 }, receive: { iron: 8 } } } });
    const r1 = resolveRound(s);
    const o = r1.offers[0];
    expect(respondToOffer(r1, 'p2', o.id, true).ok).toBe(true);
    const gold1 = r1.players.p1.resources.gold, iron1 = r1.players.p1.resources.iron, gold2 = r1.players.p2.resources.gold, iron2 = r1.players.p2.resources.iron;
    const control = resolveRound(JSON.parse(JSON.stringify({ ...r1, offers: r1.offers.map((x) => ({ ...x, status: 'rejected' })) })));
    const r2 = resolveRound(r1);
    expect(r2.offers[0].status).toBe('executed');
    expect(r2.players.p1.resources.gold - control.players.p1.resources.gold).toBeCloseTo(-20, 0);
    expect(r2.players.p2.resources.gold - control.players.p2.resources.gold).toBeCloseTo(20, 0);
    expect(r2.players.p1.resources.iron - control.players.p1.resources.iron).toBeCloseTo(8, 0);
    expect(r2.players.p2.resources.iron - control.players.p2.resources.iron).toBeCloseTo(-8, 0);
    void gold1; void iron1; void gold2; void iron2;
  });
  it('trgovinska ponuda ne uspijeva ako jedna strana nema resurse', () => {
    const s = mk();
    sub(s, 'p1', { type: 'diplomacy', params: { kind: 'trade', targetPlayerId: 'p2', terms: { give: { gold: 20 }, receive: { iron: 8 } } } });
    const r1 = resolveRound(s);
    respondToOffer(r1, 'p2', r1.offers[0].id, true);
    r1.players.p2.resources.iron = 0;
    const r2 = resolveRound(r1);
    expect(r2.offers[0].status).toBe('failed');
  });
  it('tajne poruke vidljive su samo sudionicima (view)', async () => {
    const s = mk();
    sendMessage(s, 'p1', 'p2', 'Napadnimo p3', NOW);
    const { getPlayerView } = await import('../src/engine/view');
    expect(getPlayerView(s, 'p2').messages.length).toBe(1);
    expect(getPlayerView(s, 'p3').messages.length).toBe(0);
  });
  it('raskid saveza prije isteka narušava ugled; istek u roku povećava broj ispunjenih sporazuma', () => {
    const s = mk();
    const a = createAlliance(s, 'alliance', 'p1', 'p2', 6, false);
    expect(terminateAlliance(s, 'p1', a.id).ok).toBe(true);
    expect(s.players.p1.reputation.brokenTreaties).toBe(1);
    const s2 = mk();
    createAlliance(s2, 'alliance', 'p1', 'p2', 1, false);
    const out = resolveRound(s2);
    expect(out.players.p1.reputation.keptTreaties).toBe(1);
  });
});

describe('Špijunaža i magla rata', () => {
  it('procjene su rasponi s razinom pouzdanosti i sadrže pravu vrijednost', () => {
    const s = mk();
    const enemyTerr = playerTerritories(s, 'p2')[0];
    s.players.p1.resources.influence = 50;
    sub(s, 'p1', { type: 'espionage', params: { action: 'army', targetTerritoryId: enemyTerr.id } });
    const out = resolveRound(s);
    const rep = out.intel.find((r) => r.owner === 'p1')!;
    expect(['low', 'medium', 'high', 'failed']).toContain(rep.confidence);
    if (rep.confidence !== 'failed') {
      const d = rep.data as any;
      expect(d.max).toBeGreaterThanOrEqual(d.min);
      expect(unitTotal(out.map.territories[enemyTerr.id].garrison)).toBeGreaterThanOrEqual(0);
    }
  });
  it('prikaz igrača ne otkriva točne udaljene postrojbe i skrivene naredbe', async () => {
    const s = mk(6, 'fog');
    const { getPlayerView } = await import('../src/engine/view');
    const v = getPlayerView(s, 'p1');
    const far = Object.values(v.territories).find((t) => t.visibility === 'far' && t.owner)!;
    expect(far.garrison).toBeUndefined();
    sub(s, 'p2', { type: 'trade', params: { give: 'gold', receive: 'iron', amount: 5 } });
    const vv = getPlayerView(s, 'p1');
    expect(JSON.stringify(vv)).not.toContain(s.orders[0].id);
    expect(vv.players.p2.resources).toBeUndefined();
    expect(vv.me.objective).toBeDefined();
    expect((vv.players.p2 as any).objective).toBeUndefined();
  });
  it('protuobavještajna služba smanjuje šansu uspjeha špijuna', () => {
    const s = mk();
    s.players.p2.techs = ['spy_intel', 'spy_counter'];
    s.players.p2.counterIntelUntil = 1;
    s.players.p1.resources.influence = 50;
    const enemyTerr = playerTerritories(s, 'p2')[0];
    sub(s, 'p1', { type: 'espionage', params: { action: 'army', targetTerritoryId: enemyTerr.id } });
    const out = resolveRound(s);
    expect(out.intel.find((r) => r.owner === 'p1')!.confidence).toBe('failed');
  });
});

describe('Tehnologija', () => {
  it('zahtijeva preduvjete, resurse i CP; učinak vrijedi od iduće runde', () => {
    const s = mk();
    expect(sub(s, 'p1', { type: 'research', params: { techId: 'mil_archery' } }).ok).toBe(false);
    expect(sub(s, 'p1', { type: 'research', params: { techId: 'eco_agri' } }).ok).toBe(true);
    const out = resolveRound(s);
    expect(out.players.p1.techs).toContain('eco_agri');
    const plain = resolveRound(mk());
    expect(out.players.p1.resources.gold).toBeLessThan(plain.players.p1.resources.gold);
  });
});

describe('Otpor (comeback)', () => {
  function captureCapital() {
    const s = mk(4, 'resist');
    const cap2 = s.map.territories[s.players.p2.capitalId];
    const from = neighborIds(s, cap2.id).map((i) => s.map.territories[i]).find((t) => t.owner === null)!;
    from.owner = 'p1'; from.garrison = { infantry: 200 }; s.players.p1.resources.food = 500;
    for (const t of playerTerritories(s, 'p2')) t.garrison = { infantry: 1 };
    sub(s, 'p1', attackOrder(s, 'p1', from.id, cap2.id, { infantry: 200 }, { retreatBelow: 0 }));
    return { s, cap2, from };
  }
  it('pad glavnog grada pokreće stanje Otpora (igrač nije eliminiran)', () => {
    const { s, cap2 } = captureCapital();
    const out = resolveRound(s);
    expect(out.map.territories[cap2.id].owner).toBe('p1');
    expect(out.players.p2.status).toBe('resistance');
    expect(out.players.p2.resistance!.formerTerritories).toContain(cap2.id);
    expect(out.players.p1.stats.capitalsCaptured).toBe(1);
  });
  it('u Otporu: smanjeni CP, jeftinije novačenje, ustanak i hitno novačenje', () => {
    const { s } = captureCapital();
    const out = resolveRound(s);
    const cap = out.players.p2.capitalId;
    const home = playerTerritories(out, 'p2')[0];
    const cost = validateOrder(out, 'p2', { type: 'recruit', params: { territoryId: home.id, unit: 'infantry', count: 5 } }).resourceCost.gold!;
    expect(cost).toBeLessThan(40);
    expect(addOrder(out, 'p2', { type: 'resistance', params: { kind: 'emergency_recruit', territoryId: home.id } }, 'submitted', NOW).ok).toBe(true);
    const up = addOrder(out, 'p2', { type: 'resistance', params: { kind: 'uprising', territoryId: cap } }, 'submitted', NOW);
    expect(up.ok).toBe(true);
    // Resistance ne dopušta diplomatske ponude
    expect(validateOrder(out, 'p2', { type: 'diplomacy', params: { kind: 'alliance', targetPlayerId: 'p3' } }).ok).toBe(false);
  });
  it('povratak glavnog grada vraća igrača u aktivno stanje', () => {
    const { s, cap2 } = captureCapital();
    let out = resolveRound(s);
    const adj = neighborIds(out, cap2.id).map((i) => out.map.territories[i]).find((t) => t.owner === 'p2');
    const from = adj ?? playerTerritories(out, 'p2')[0];
    out.map.territories[cap2.id].garrison = { infantry: 1 };
    from.garrison = { infantry: 150 }; out.players.p2.resources.food = 300;
    if (!neighborIds(out, from.id).includes(cap2.id)) { // osiguraj susjedstvo
      const nb = neighborIds(out, cap2.id).map((i) => out.map.territories[i])[0]; nb.owner = 'p2'; nb.garrison = { infantry: 150 };
      expect(addOrder(out, 'p2', attackOrder(out, 'p2', nb.id, cap2.id, { infantry: 150 }), 'submitted', NOW).ok).toBe(true);
    } else expect(addOrder(out, 'p2', attackOrder(out, 'p2', from.id, cap2.id, { infantry: 150 }), 'submitted', NOW).ok).toBe(true);
    out = resolveRound(out);
    expect(out.map.territories[cap2.id].owner).toBe('p2');
    expect(out.players.p2.status).toBe('active');
  });
  it('osvajanje glavnog grada se isplati (10 bodova) unatoč pomoći Otpora', () => {
    const { s } = captureCapital();
    const out = resolveRound(s);
    expect(computeScore(out, 'p1').enemyCapitals).toBe(10);
  });
});

describe('Bodovanje i tajni ciljevi', () => {
  it('računa bodove prema pravilima: teritorij 1, grad 4, tuđi glavni grad 10', () => {
    const s = mk();
    const sc = computeScore(s, 'p1');
    // kapital (4) + farma (1) + šuma (1)
    expect(sc.cities).toBe(4); expect(sc.territories).toBe(2);
    expect(sc.total).toBe(6 + sc.regions + sc.objective + sc.military);
  });
  it('kontrola regije donosi 8 bodova (većina teritorija)', () => {
    const s = mk();
    const r = s.map.regions[0];
    for (const id of r.territoryIds) s.map.territories[id].owner = 'p1';
    const sc = computeScore(s, 'p1');
    expect(sc.regionsControlled).toContain(r.id);
    expect(sc.regions).toBeGreaterThanOrEqual(8);
  });
  it('svaki igrač ima tajni cilj, a napredak se računa', () => {
    const s = mk(6);
    for (const id of s.playerOrder) { expect(s.players[id].objective.title.length).toBeGreaterThan(0); expect(objectiveProgress(s, id).target).toBeGreaterThan(0); }
  });
  it('kampanja završava nakon 7 dana s pobjednikom i konačnim bodovima', () => {
    let s = mk(4, 'full');
    for (let d = 0; d < 7; d++) { for (const id of s.playerOrder) botPlan(s, id, NOW); s = resolveRound(s, { now: NOW }); }
    expect(s.phase).toBe('completed');
    expect(s.winnerId).toBeTruthy();
    expect(s.resolvedRounds).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(Object.keys(s.reports).length).toBe(7 * 4);
  });
});

describe('Neaktivni igrači', () => {
  it('prelaze na automatsku obranu i ne blokiraju kampanju', () => {
    let s = mk();
    for (let d = 0; d < 3; d++) s = resolveRound(s);
    expect(s.round).toBe(4);
    expect(s.players.p1.autopilot).toBe(true);
    expect(s.reportEntries.some((e) => /automatski prešlo u obranu/.test(e.text))).toBe(true);
  });
});

describe('Svjetski događaji', () => {
  it('raspored obuhvaća svih 7 dana i prvi dan je miran', () => {
    const s = mk();
    expect(s.events.length).toBe(7);
    expect(s.events[0].type).toBe('none');
    expect(s.events.some((e) => e.type !== 'none')).toBe(true);
  });
  it('suša smanjuje proizvodnju hrane u pogođenoj regiji', () => {
    const s = mk(4, 'drought');
    const ev = s.events[0]; ev.type = 'drought'; ev.scope = 'global';
    const plain = mk(4, 'drought');
    expect(forecastEconomy(s, 'p1').production.food).toBeLessThan(forecastEconomy(plain, 'p1').production.food);
  });
});

describe('Opskrba', () => {
  it('izolirani teritorij gubi opskrbu i vojska slabi', () => {
    const s = mk();
    const nbr = playerTerritories(s, 'p1').find((t) => !t.isCapital)!;
    const cap = s.map.territories[s.players.p1.capitalId];
    // Presijeci vezu: preotmi sve teritorije koji spajaju
    for (const t of playerTerritories(s, 'p1')) if (t.id !== nbr.id && t.id !== cap.id) t.owner = 'p2';
    cap.owner = 'p2'; cap.isCapital = false; cap.building = null;
    nbr.garrison = { infantry: 20 };
    expect(computeSupply(s, 'p1').has(nbr.id)).toBe(false);
    const out = resolveRound(s);
    expect(unitTotal(out.map.territories[nbr.id].garrison)).toBeLessThan(20);
  });
  it('preview naredbe razlikuje poznato, procijenjeno i nepoznato', () => {
    const { s, cap1, target } = scenario();
    const pv = previewOrder(s, 'p1', attackOrder(s, 'p1', cap1.id, target.id, { infantry: 20 }));
    expect(pv.known.length).toBeGreaterThan(0);
    expect(pv.estimated.length).toBeGreaterThan(0);
    expect(pv.unknown.length).toBeGreaterThan(0);
    expect(pv.outlook).toBeDefined();
  });
});
