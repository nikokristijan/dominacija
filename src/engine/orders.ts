/**
 * Naredbe: troškovi, validacija, pregled posljedica i životni ciklus (nacrt → predano → zaključano).
 * Sva kritična pravila provode se ovdje (na serveru), nikad samo u UI-ju.
 */
import { RESOURCE_TYPES, UNIT_TYPES } from './config';
import { buildingCost, currentEvent, recruitCost } from './economy';
import { estimateGarrison, fmtRange, assumedComposition, freshIntelOnTerritory } from './intel';
import { forcePower, resolveBattle, type Force } from './combat';
import { TECH_BY_ID, getMods, techCost } from './tech';
import type {
  ConditionalOrder, GameState, Order, OrderInput, OrderPreview, OrderStatus, PlayerId, PlayerState, Resources, Territory, TerritoryId, Units, ValidationResult,
} from './types';
import {
  activeAlliance, addUnits, canAfford, cloneRes, computeSupply, emptyResources, hasPact, hasUnits, isAllied, neighborIds, nextId,
  normalizeUnits, playerTerritories, round2, unitTotal, describeUnits, pname, subUnits,
} from './util';

export const cpAvailable = (s: GameState, p: PlayerState) => (p.status === 'resistance' ? s.config.resistance.cpPerDay : s.config.campaign.commandPointsPerDay);
const ACTIVE: OrderStatus[] = ['submitted', 'locked'];
export const activeOrders = (s: GameState, pid: PlayerId) => s.orders.filter((o) => o.playerId === pid && o.round === s.round && ACTIVE.includes(o.status));
export const cpUsed = (s: GameState, pid: PlayerId) => activeOrders(s, pid).reduce((n, o) => n + o.cpCost, 0);

export function reservedResources(s: GameState, pid: PlayerId, excludeId?: string): Resources {
  const r = emptyResources();
  for (const o of activeOrders(s, pid)) {
    if (o.id === excludeId) continue;
    const c = orderCost(s, s.players[pid], o).res;
    for (const k of RESOURCE_TYPES) r[k] += c[k] ?? 0;
  }
  return r;
}
export function availableResources(s: GameState, pid: PlayerId, excludeId?: string): Resources {
  const res = reservedResources(s, pid, excludeId);
  const have = s.players[pid].resources;
  const out = emptyResources();
  for (const k of RESOURCE_TYPES) out[k] = round2(have[k] - res[k]);
  return out;
}

export function diplomacyInfluenceCost(s: GameState, p: PlayerState, kind: string, importance = 0): number {
  const rep = s.config.diplomacy.reputation;
  const f = Math.max(rep.costFactorMin, Math.min(rep.costFactorMax, 1.5 - p.reputation.score / 100));
  const disc = 1 - getMods(p).diplomacyDiscount;
  const base = kind === 'annex' ? s.config.diplomacy.annexBaseInfluence + s.config.diplomacy.annexInfluencePerImportance * importance : s.config.diplomacy.offerCost.influence;
  return Math.ceil(base * f * disc);
}

export function tradeCap(s: GameState, p: PlayerState): number {
  const cfg = s.config.trade;
  let lv = 0;
  for (const t of playerTerritories(s, p.id)) if (t.building === 'market') lv += t.buildingLevel;
  let cap = (cfg.baseCap + cfg.capPerMarketLevel * lv) * (1 + getMods(p).tradeCap);
  if (currentEvent(s)?.type === 'trade_boom') cap *= s.config.events.tradeBoom.capFactor;
  return Math.floor(cap);
}
export function tradeRate(s: GameState, p: PlayerState, give: keyof Resources, receive: keyof Resources): number {
  const cfg = s.config.trade;
  let lv = 0;
  for (const t of playerTerritories(s, p.id)) if (t.building === 'market') lv += t.buildingLevel;
  let eff = 1 - cfg.spread + cfg.marketRateBonusPerLevel * lv + getMods(p).tradeRate;
  if (currentEvent(s)?.type === 'trade_boom') eff += s.config.events.tradeBoom.rateBonus;
  eff = Math.min(0.98, eff);
  return (cfg.values[give] / cfg.values[receive]) * eff;
}

export function recruitCap(s: GameState, t: Territory): number {
  const rc = s.config.recruitment;
  let cap = rc.baseCap;
  if (t.building === 'barracks') cap += rc.capPerBarracksLevel * t.buildingLevel;
  if (t.building === 'city') cap += rc.capPerCityLevel * t.buildingLevel;
  if (t.building === 'capital') cap += rc.capitalCap;
  return cap;
}

export function attackSupplyRequirement(s: GameState, pid: PlayerId, fromId: TerritoryId, targetId: TerritoryId, units: Units, strategy: string): number {
  const c = s.config.combat;
  const supply = computeSupply(s, pid);
  const path = supply.get(fromId) ?? 3;
  const ev = currentEvent(s);
  let m = 1 + c.distanceCostGrowth * path;
  m *= s.config.terrain[s.map.territories[targetId].terrain].supplyCost;
  if (strategy === 'siege') m *= c.strategy.siege.supplyMultiplier as number;
  if (ev?.type === 'winter') m *= s.config.events.winter.supplyFactor;
  if (ev?.type === 'storm') m *= s.config.events.storm.supplyFactor;
  return unitTotal(units) * c.foodPerSoldier * m;
}

export function orderCost(s: GameState, p: PlayerState, o: OrderInput): { cp: number; res: Partial<Resources> } {
  const cfg = s.config;
  const cp = cfg.orderCosts[o.type];
  const res: Partial<Resources> = {};
  switch (o.type) {
    case 'recruit': Object.assign(res, recruitCost(cfg, p, o.params.unit, Math.max(0, Math.floor(o.params.count)))); break;
    case 'trade': res[o.params.give] = Math.max(0, Math.floor(o.params.amount)); break;
    case 'build': {
      const t = s.map.territories[o.params.territoryId];
      const lvl = t && t.building === o.params.building ? t.buildingLevel + 1 : 1;
      Object.assign(res, buildingCost(cfg, p, o.params.building, lvl));
      break;
    }
    case 'defend': if (o.params.stance === 'fortify') Object.assign(res, cfg.defense.fortifyCost); break;
    case 'espionage': { const c = cfg.espionage.costs[o.params.action]; if (c) { res.influence = c.influence; res.gold = c.gold; } break; }
    case 'sabotage': { const c = cfg.espionage.sabotageCosts[o.params.kind]; if (c) { res.influence = c.influence; res.gold = c.gold; } break; }
    case 'diplomacy': {
      const t = o.params.targetTerritoryId ? s.map.territories[o.params.targetTerritoryId] : undefined;
      res.influence = diplomacyInfluenceCost(s, p, o.params.kind, t?.importance ?? 0);
      if (o.params.kind === 'improve') { for (const k of RESOURCE_TYPES) res[k] = (res[k] ?? 0) + (o.params.terms?.give?.[k] ?? 0); }
      break;
    }
    case 'attack': res.food = Math.ceil(attackSupplyRequirement(s, p.id, o.params.fromId, o.params.targetId, o.params.units, o.params.strategy) * cfg.combat.supply[o.params.supply].ratio); break;
    case 'research': Object.assign(res, techCost(s, p, o.params.techId, cfg)); break;
    case 'resistance': if (o.params.kind === 'uprising') Object.assign(res, cfg.resistance.uprisingCost); break;
  }
  const clean: Partial<Resources> = {};
  for (const k of RESOURCE_TYPES) if ((res[k] ?? 0) > 0) clean[k] = res[k];
  return { cp, res: clean };
}

/** Jedinice već obećane drugim predanim naredbama iz istog teritorija (sprječava dvostruko trošenje vojnika). */
export function committedUnits(s: GameState, pid: PlayerId, territoryId: TerritoryId, excludeId?: string): Units {
  let u: Units = {};
  for (const o of activeOrders(s, pid)) {
    if (o.id === excludeId) continue;
    if (o.type === 'attack' && o.params.fromId === territoryId) u = addUnits(u, o.params.units);
    if (o.type === 'defend' && o.params.stance === 'reinforce' && o.params.fromTerritoryId === territoryId && o.params.units) u = addUnits(u, o.params.units);
    if (o.type === 'diplomacy' && o.params.kind === 'support' && o.params.terms?.fromTerritoryId === territoryId && o.params.terms.units) u = addUnits(u, o.params.terms.units);
  }
  return u;
}

export function normalizeInput(o: OrderInput): OrderInput {
  const c = structuredClone(o) as any;
  if (c.type === 'attack') { c.params.units = normalizeUnits(c.params.units); c.params.reserve = normalizeUnits(c.params.reserve); c.params.retreatBelow = Math.max(0, Math.min(0.9, Number(c.params.retreatBelow ?? 0.35))); }
  if (c.type === 'defend' && c.params.units) c.params.units = normalizeUnits(c.params.units);
  if (c.type === 'recruit') c.params.count = Math.floor(Number(c.params.count));
  if (c.type === 'trade') c.params.amount = Math.floor(Number(c.params.amount));
  if (c.type === 'diplomacy' && c.params.terms?.units) c.params.terms.units = normalizeUnits(c.params.terms.units);
  return c;
}

export function validateOrder(s: GameState, pid: PlayerId, input: OrderInput, opts: { excludeId?: string; draft?: boolean } = {}): ValidationResult {
  const p = s.players[pid];
  const errors: string[] = [];
  const warnings: string[] = [];
  const cfg = s.config;
  const o = normalizeInput(input);
  const { cp, res } = orderCost(s, p, o);
  const fail = (m: string) => errors.push(m);
  const T = (id: TerritoryId | undefined) => (id ? s.map.territories[id] : undefined);
  const mine = (id: TerritoryId | undefined) => { const t = T(id); return t && t.owner === pid ? t : undefined; };
  const otherPlayer = (id?: PlayerId) => (id && id !== pid && s.players[id] ? s.players[id] : undefined);

  if (s.phase !== 'planning') fail('Faza planiranja je završila.');
  if (p.status === 'resistance' && !['recruit', 'defend', 'attack', 'espionage', 'resistance', 'trade', 'build'].includes(o.type)) fail('U stanju Otpora ova naredba nije dostupna.');

  switch (o.type) {
    case 'recruit': {
      const t = mine(o.params.territoryId);
      if (!t) { fail('Odaberi vlastiti teritorij.'); break; }
      const n = o.params.count;
      if (!(n >= 1)) fail('Broj postrojbi mora biti barem 1.');
      const def = cfg.units[o.params.unit];
      if (!def) { fail('Nepoznata vrsta postrojbe.'); break; }
      if (def.requiresBuilding && t.building !== def.requiresBuilding && t.building !== 'capital') fail(`${def.name} zahtijevaju ${cfg.buildings[def.requiresBuilding].name} (ili glavni grad) u teritoriju.`);
      const queued = activeOrders(s, pid).filter((x) => x.type === 'recruit' && x.params.territoryId === t.id && x.id !== opts.excludeId).reduce((a, x) => a + (x as any).params.count, 0);
      const cap = recruitCap(s, t);
      if (n + queued > cap) fail(`Teritorij može novačiti najviše ${cap} postrojbi po rundi (već planirano: ${queued}).`);
      const popNeed = n * def.popCost;
      if (t.population - popNeed < 20) fail('Nedovoljno stanovništva za novačenje.');
      if (t.siegeBy) warnings.push('Teritorij je pod opsadom — novaci stižu tek idućeg dana.');
      break;
    }
    case 'trade': {
      const { give, receive, amount } = o.params;
      if (give === receive) fail('Ne možeš mijenjati resurs za isti resurs.');
      if (!(amount >= 1)) fail('Količina mora biti barem 1.');
      const cap = tradeCap(s, p);
      if (amount > cap) fail(`Trgovačka ekspedicija može prenijeti najviše ${cap} jedinica.`);
      break;
    }
    case 'build': {
      const t = mine(o.params.territoryId);
      if (!t) { fail('Odaberi vlastiti teritorij.'); break; }
      const bd = cfg.buildings[o.params.building];
      if (!bd || o.params.building === 'capital') { fail('Ta zgrada se ne može graditi.'); break; }
      if (t.construction) fail('Na ovom teritoriju gradnja je već u tijeku.');
      if (t.isCapital) fail('Glavni grad se ne može preuređivati.');
      if (!bd.allowedTerrain.includes(t.terrain)) fail(`${bd.name} se ne može graditi na terenu: ${cfg.terrain[t.terrain].name}.`);
      if (t.building && t.building !== o.params.building) fail('Teritorij već ima drugu zgradu.');
      if (t.building === o.params.building && t.buildingLevel >= bd.maxLevel) fail('Zgrada je već na najvišoj razini.');
      if (activeOrders(s, pid).some((x) => x.type === 'build' && x.params.territoryId === t.id && x.id !== opts.excludeId)) fail('Za ovaj teritorij već postoji naredba za gradnju.');
      if (o.params.building === 'mine' && t.terrain === 'desert' && t.resource !== 'iron') warnings.push('Rudnik bez nalazišta željeza slabije se isplati.');
      break;
    }
    case 'defend': {
      const t = mine(o.params.territoryId);
      if (!t) { fail('Odaberi vlastiti teritorij.'); break; }
      if (o.params.stance === 'fortify' && t.defenseLevel >= cfg.defense.maxDefenseLevel) fail('Obrana je već na najvišoj razini.');
      if (o.params.stance === 'reinforce') {
        const from = mine(o.params.fromTerritoryId);
        if (!from) { fail('Odaberi teritorij iz kojeg dolazi pojačanje.'); break; }
        if (!neighborIds(s, t.id).includes(from.id)) fail('Pojačanje mora doći iz susjednog teritorija.');
        const u = normalizeUnits(o.params.units);
        if (!unitTotal(u)) fail('Odaberi postrojbe za pojačanje.');
        const avail = subUnits(from.garrison, committedUnits(s, pid, from.id, opts.excludeId));
        if (!hasUnits(avail, u)) fail('Izvorni teritorij nema dovoljno slobodnih postrojbi.');
      }
      if (activeOrders(s, pid).some((x) => x.type === 'defend' && x.params.territoryId === t.id && x.params.stance === o.params.stance && x.id !== opts.excludeId)) warnings.push('Već imaš istu obrambenu naredbu za ovaj teritorij.');
      break;
    }
    case 'espionage': {
      const a = o.params.action;
      if (!cfg.espionage.costs[a]) { fail('Nepoznata špijunska radnja.'); break; }
      if (a === 'counter' || a === 'false_info') break;
      const tp = otherPlayer(o.params.targetPlayerId);
      if (!tp && !o.params.targetTerritoryId) { fail('Odaberi ciljanog igrača.'); break; }
      if (o.params.targetTerritoryId) {
        const tt = T(o.params.targetTerritoryId);
        if (!tt || tt.terrain === 'water') fail('Neispravan ciljani teritorij.');
        else if (tt.owner === pid) fail('Ne možeš špijunirati vlastiti teritorij.');
      } else if (a === 'army' && !tp) fail('Odaberi cilj.');
      break;
    }
    case 'sabotage': {
      const tp = otherPlayer(o.params.targetPlayerId);
      const tt = T(o.params.targetTerritoryId);
      if (!tp) fail('Odaberi ciljanog igrača.');
      else if (!tt || tt.owner !== tp.id) fail('Teritorij mora pripadati ciljanom igraču.');
      if (!cfg.espionage.sabotageCosts[o.params.kind]) fail('Nepoznata vrsta sabotaže.');
      if (tp && hasPact(s, pid, tp.id)) warnings.push('Sabotiranje partnera po sporazumu je kršenje sporazuma.');
      break;
    }
    case 'diplomacy': {
      const k = o.params.kind;
      if (k === 'annex') {
        const t = T(o.params.targetTerritoryId);
        if (!t || t.terrain === 'water') { fail('Odaberi neutralni teritorij.'); break; }
        if (t.owner) fail('Pripajanje je moguće samo za neutralne teritorije.');
        if (!neighborIds(s, t.id).some((n) => s.map.territories[n].owner === pid)) fail('Teritorij mora biti uz tvoje kraljevstvo.');
        if (activeOrders(s, pid).some((x) => x.type === 'diplomacy' && x.params.kind === 'annex' && x.params.targetTerritoryId === t.id && x.id !== opts.excludeId)) fail('Već planiraš pripojiti ovaj teritorij.');
        break;
      }
      const tp = otherPlayer(o.params.targetPlayerId);
      if (!tp) { fail('Odaberi igrača.'); break; }
      const terms = o.params.terms ?? {};
      if (k === 'alliance' && activeAlliance(s, pid, tp.id, 'alliance')) fail('Već ste saveznici.');
      if (k === 'nap' && activeAlliance(s, pid, tp.id)) fail('Već imate aktivan sporazum.');
      if (k === 'trade') {
        const g = terms.give ?? {}, r = terms.receive ?? {};
        const gs = RESOURCE_TYPES.reduce((a, x) => a + (g[x] ?? 0), 0), rs = RESOURCE_TYPES.reduce((a, x) => a + (r[x] ?? 0), 0);
        if (gs <= 0 && rs <= 0) fail('Odredi što razmjenjuješ.');
      }
      if (k === 'support') {
        const from = mine(terms.fromTerritoryId);
        if (!from) fail('Odaberi teritorij iz kojeg šalješ vojnu potporu.');
        else if (!unitTotal(terms.units) ) fail('Odaberi postrojbe za potporu.');
        else if (!hasUnits(subUnits(from.garrison, committedUnits(s, pid, from.id, opts.excludeId)), terms.units!)) fail('Nedovoljno slobodnih postrojbi za potporu.');
        if (!isAllied(s, pid, tp.id)) fail('Vojna potpora moguća je samo saveznicima.');
      }
      if (k === 'swap') {
        if (!mine(terms.swapMine)) fail('Odaberi vlastiti teritorij za razmjenu.');
        const th = T(terms.swapTheirs);
        if (!th || th.owner !== tp.id) fail('Odabrani teritorij mora pripadati drugom igraču.');
        if (T(terms.swapMine)?.isCapital || th?.isCapital) fail('Glavni gradovi se ne mogu razmjenjivati.');
      }
      if (k === 'joint_attack') { const tt = T(terms.attackTarget); if (!tt || tt.owner === pid || tt.terrain === 'water') fail('Odaberi ciljani teritorij zajedničkog napada.'); if (!isAllied(s, pid, tp.id)) fail('Zajednički napad moguć je samo sa saveznikom.'); }
      if (k === 'improve') { const g = terms.give ?? {}; if (RESOURCE_TYPES.reduce((a, x) => a + (g[x] ?? 0), 0) <= 0) fail('Odredi dar.'); }
      if (s.offers.some((x) => x.status === 'pending' && x.from === pid && x.to === tp.id && x.kind === k)) warnings.push('Već postoji neodgovorena ponuda iste vrste.');
      break;
    }
    case 'attack': {
      const p2 = o.params;
      const from = mine(p2.fromId);
      const target = T(p2.targetId);
      if (!from) { fail('Polazni teritorij mora biti tvoj.'); break; }
      if (!target || target.terrain === 'water') { fail('Neispravan cilj napada.'); break; }
      if (!neighborIds(s, from.id).includes(target.id)) fail('Cilj mora biti susjedan polaznom teritoriju.');
      if (target.owner === pid) fail('Ne možeš napasti vlastiti teritorij.');
      const units = p2.units;
      if (unitTotal(units) < 1) fail('Odaberi barem jednu postrojbu.');
      const avail = subUnits(from.garrison, committedUnits(s, pid, from.id, opts.excludeId));
      if (!hasUnits(avail, units)) fail('Polazni teritorij nema toliko slobodnih postrojbi.');
      else if (!hasUnits(subUnits(avail, units), p2.reserve)) fail('Napad bi povukao postrojbe koje si namijenio rezervi.');
      if (!cfg.combat.strategy[p2.strategy]) fail('Nepoznata strategija.');
      if (!cfg.combat.formation[p2.formation]) fail('Nepoznata formacija.');
      if (!cfg.combat.risk[p2.risk]) fail('Nepoznata sklonost riziku.');
      if (!cfg.combat.supply[p2.supply]) fail('Nepoznata razina opskrbe.');
      if (p2.strategy === 'encirclement') {
        const adj = neighborIds(s, target.id).filter((n) => { const ow = s.map.territories[n].owner; return ow && isAllied(s, pid, ow); }).length;
        if (adj < (cfg.combat.strategy.encirclement.minAdjacent as number)) fail(`Opkoljavanje zahtijeva barem ${cfg.combat.strategy.encirclement.minAdjacent} susjedna prijateljska teritorija (imaš ${adj}).`);
      }
      if (p2.strategy === 'siege') {
        if (!(units.siege ?? 0)) fail('Opsada zahtijeva barem jedno opsadno oruđe.');
        if (target.building !== 'fortress' && !target.isCapital && target.building !== 'city') warnings.push('Opsada je najučinkovitija protiv utvrđenih gradova.');
      }
      if (p2.strategy === 'diversion' && unitTotal(units) < (cfg.combat.strategy.diversion.minSoldiers as number)) fail(`Diverzija zahtijeva barem ${cfg.combat.strategy.diversion.minSoldiers} vojnika.`);
      if (p2.strategy === 'ambush' && !freshIntelOnTerritory(s, pid, target.id)) warnings.push('Zasjeda bez svježe špijunaže je slabija (nema obavještajne prednosti).');
      if (target.owner && isAllied(s, pid, target.owner)) warnings.push('Napad na saveznika je IZDAJA: prekida savez i narušava ugled.');
      else if (target.owner && hasPact(s, pid, target.owner)) warnings.push('Napad krši sporazum o nenapadanju i narušava ugled.');
      const left = unitTotal(subUnits(from.garrison, units));
      if (left < 2) warnings.push('Polazni teritorij ostaje gotovo bez obrane.');
      if (p.stability < 40) warnings.push('Niska stabilnost slabi moral vojske.');
      break;
    }
    case 'research': {
      const t = TECH_BY_ID[o.params.techId];
      if (!t) { fail('Nepoznata tehnologija.'); break; }
      if (p.techs.includes(t.id)) fail('Tehnologija je već istražena.');
      for (const r of t.requires) if (!p.techs.includes(r)) fail(`Prvo istraži: ${TECH_BY_ID[r].name}.`);
      if (activeOrders(s, pid).some((x) => x.type === 'research' && x.params.techId === t.id && x.id !== opts.excludeId)) fail('Ova tehnologija je već u planu.');
      break;
    }
    case 'resistance': {
      if (p.status !== 'resistance') { fail('Dostupno samo u stanju Otpora.'); break; }
      const t = T(o.params.territoryId);
      if (o.params.kind === 'emergency_recruit') {
        if (!t || t.owner !== pid) fail('Hitno novačenje moguće je u vlastitom teritoriju.');
        if (p.resistance && p.resistance.emergencyUsedRound >= s.round) fail('Hitno novačenje već je iskorišteno ove runde.');
      } else {
        if (!t || t.owner === pid) fail('Ustanak cilja teritorij koji je zauzeo neprijatelj.');
        else if (!p.resistance?.formerTerritories.includes(t.id)) fail('Ustanak je moguć samo u nekadašnjem vlastitom teritoriju.');
        if (p.resistance && p.resistance.partisanUsedRound >= s.round) fail('Ustanak je već planiran ove runde.');
      }
      break;
    }
  }

  // Zajednička pravila: CP i resursi (samo za predane naredbe)
  const used = cpUsed(s, pid) - (opts.excludeId ? (s.orders.find((x) => x.id === opts.excludeId && ACTIVE.includes(x.status))?.cpCost ?? 0) : 0);
  if (!opts.draft) {
    if (used + cp > cpAvailable(s, p)) fail(`Nedovoljno zapovjednih bodova (potrebno ${cp}, preostalo ${cpAvailable(s, p) - used}).`);
    const avail = availableResources(s, pid, opts.excludeId);
    for (const k of RESOURCE_TYPES) if ((res[k] ?? 0) > avail[k] + 1e-9) fail(`Nedovoljno resursa: ${resName(k)} (treba ${res[k]}, slobodno ${Math.floor(avail[k])}).`);
  } else {
    const avail = availableResources(s, pid, opts.excludeId);
    for (const k of RESOURCE_TYPES) if ((res[k] ?? 0) > avail[k] + 1e-9) warnings.push(`Trenutno nemaš dovoljno resursa: ${resName(k)}.`);
  }
  return { ok: errors.length === 0, errors, warnings, cpCost: cp, resourceCost: res };
}

const resName = (k: keyof Resources) => ({ gold: 'zlato', food: 'hrana', iron: 'željezo', wood: 'drvo', influence: 'utjecaj' }[k]);

// ───────────── Životni ciklus ─────────────
export function addOrder(s: GameState, pid: PlayerId, input: OrderInput, status: 'draft' | 'submitted', now: string, priority?: number): { ok: boolean; order?: Order; validation: ValidationResult } {
  const p = s.players[pid];
  if (p.ready && status === 'submitted') return { ok: false, validation: { ok: false, errors: ['Naredbe su označene kao spremne — prvo ih otključaj.'], warnings: [], cpCost: 0, resourceCost: {} } };
  const clean = normalizeInput(input);
  const validation = validateOrder(s, pid, clean, { draft: status === 'draft' });
  if (!validation.ok) return { ok: false, validation };
  const existing = s.orders.filter((o) => o.playerId === pid && o.round === s.round && o.status !== 'cancelled');
  const order = {
    ...clean, id: nextId(s, 'o'), playerId: pid, round: s.round, status, priority: priority ?? (existing.length ? Math.max(...existing.map((o) => o.priority)) + 1 : 1),
    cpCost: validation.cpCost, createdAt: now, updatedAt: now,
  } as Order;
  s.orders.push(order);
  if (status === 'submitted') p.submittedOnce = true;
  return { ok: true, order, validation };
}

export function submitDraft(s: GameState, pid: PlayerId, orderId: string, now: string) {
  const o = s.orders.find((x) => x.id === orderId && x.playerId === pid);
  if (!o || o.round !== s.round) return { ok: false, validation: bad('Naredba nije pronađena.') };
  if (s.players[pid].ready) return { ok: false, validation: bad('Naredbe su označene kao spremne — prvo ih otključaj.') };
  if (o.status !== 'draft') return { ok: false, validation: bad('Naredba nije nacrt.') };
  const validation = validateOrder(s, pid, o as OrderInput, { excludeId: o.id });
  if (!validation.ok) return { ok: false, validation };
  o.status = 'submitted'; o.cpCost = validation.cpCost; o.updatedAt = now;
  s.players[pid].submittedOnce = true;
  return { ok: true, validation, order: o };
}

export function updateOrder(s: GameState, pid: PlayerId, orderId: string, input: OrderInput, now: string) {
  const o = s.orders.find((x) => x.id === orderId && x.playerId === pid);
  if (!o || o.round !== s.round || o.status === 'cancelled') return { ok: false, validation: bad('Naredba nije pronađena.') };
  if (o.status === 'locked' || s.phase !== 'planning') return { ok: false, validation: bad('Naredbe su zaključane.') };
  if (s.players[pid].ready) return { ok: false, validation: bad('Naredbe su označene kao spremne — prvo ih otključaj.') };
  const clean = normalizeInput(input);
  const validation = validateOrder(s, pid, clean, { excludeId: o.id, draft: o.status === 'draft' });
  if (!validation.ok) return { ok: false, validation };
  Object.assign(o, clean, { cpCost: validation.cpCost, updatedAt: now });
  return { ok: true, validation, order: o };
}

export function removeOrder(s: GameState, pid: PlayerId, orderId: string) {
  const i = s.orders.findIndex((x) => x.id === orderId && x.playerId === pid);
  if (i < 0) return { ok: false, error: 'Naredba nije pronađena.' };
  const o = s.orders[i];
  if (o.status === 'locked' || s.phase !== 'planning') return { ok: false, error: 'Naredbe su zaključane.' };
  if (s.players[pid].ready) return { ok: false, error: 'Naredbe su označene kao spremne — prvo ih otključaj.' };
  s.orders.splice(i, 1);
  return { ok: true };
}

export function reorderOrders(s: GameState, pid: PlayerId, orderIds: string[]) {
  if (s.phase !== 'planning' || s.players[pid].ready) return false;
  let pr = 1;
  for (const id of orderIds) {
    const o = s.orders.find((x) => x.id === id && x.playerId === pid && x.round === s.round);
    if (o) o.priority = pr++;
  }
  return true;
}

export function setReady(s: GameState, pid: PlayerId, ready: boolean): { ok: boolean; error?: string } {
  if (s.phase !== 'planning') return { ok: false, error: 'Faza planiranja je završila.' };
  s.players[pid].ready = ready;
  return { ok: true };
}

const bad = (m: string): ValidationResult => ({ ok: false, errors: [m], warnings: [], cpCost: 0, resourceCost: {} });

export function setTax(s: GameState, pid: PlayerId, tax: 'low' | 'normal' | 'high') {
  if (s.phase !== 'planning') return { ok: false, error: 'Faza planiranja je završila.' };
  if (!s.config.tax[tax]) return { ok: false, error: 'Nepoznata razina poreza.' };
  s.players[pid].tax = tax;
  return { ok: true };
}

// ───────────── Uvjetne naredbe ─────────────
export function addConditional(s: GameState, pid: PlayerId, c: Omit<ConditionalOrder, 'id' | 'playerId' | 'round' | 'status' | 'createdAt' | 'expiresRound'> & { expiresRound?: number }, now: string): { ok: boolean; error?: string; order?: ConditionalOrder } {
  if (s.phase !== 'planning') return { ok: false, error: 'Faza planiranja je završila.' };
  if (s.players[pid].ready) return { ok: false, error: 'Naredbe su označene kao spremne.' };
  const active = s.conditionalOrders.filter((x) => x.playerId === pid && x.status === 'active' && x.round === s.round);
  if (active.length >= s.config.campaign.maxConditionalOrdersPerRound) return { ok: false, error: `Najviše ${s.config.campaign.maxConditionalOrdersPerRound} uvjetne naredbe po rundi.` };
  const t = c.trigger;
  if (t.territoryId && s.map.territories[t.territoryId]?.terrain === 'water') return { ok: false, error: 'Neispravan teritorij okidača.' };
  const need = ['territory_attacked', 'territory_conquered', 'territory_lost'].includes(t.type) ? 'territory' : null;
  if (need === 'territory' && t.type !== 'territory_conquered' && t.type !== 'territory_lost' && (!t.territoryId || s.map.territories[t.territoryId]?.owner !== pid)) return { ok: false, error: 'Okidač zahtijeva vlastiti teritorij.' };
  if (t.type === 'attacked_by_player' && (!t.playerId || t.playerId === pid || !s.players[t.playerId])) return { ok: false, error: 'Odaberi igrača čiji napad čekaš.' };
  if (t.type === 'ally_loses_territory' && t.playerId && !isAllied(s, pid, t.playerId)) return { ok: false, error: 'Odabrani igrač nije tvoj saveznik.' };
  const a = c.action;
  const own = (id?: TerritoryId) => !!id && s.map.territories[id]?.owner === pid;
  if (a.type === 'move_reserves' || a.type === 'defensive_formation') { /* teritorij se određuje okidačem ako nije naveden */ }
  if (a.type === 'move_reserves') {
    if (!own(a.fromTerritoryId)) return { ok: false, error: 'Rezerve moraju dolaziti iz vlastitog teritorija.' };
    if (!unitTotal(normalizeUnits(a.units))) return { ok: false, error: 'Odaberi postrojbe rezerve.' };
  }
  if (a.type === 'build_fortress' && a.territoryId && !own(a.territoryId) && t.type !== 'territory_conquered') return { ok: false, error: 'Utvrda se gradi u vlastitom teritoriju.' };
  if (a.type === 'send_support' && (!own(a.fromTerritoryId) || !unitTotal(normalizeUnits(a.units)))) return { ok: false, error: 'Odaberi izvor i postrojbe za potporu.' };
  if (a.type === 'emergency_recruit' && (!own(a.territoryId) || !a.unit || !((a.count ?? 0) >= 1))) return { ok: false, error: 'Odaberi teritorij, vrstu i broj novaka.' };
  if (a.units) a.units = normalizeUnits(a.units);
  const order: ConditionalOrder = {
    ...c, id: nextId(s, 'c'), playerId: pid, round: s.round, status: 'active', createdAt: now,
    expiresRound: Math.max(s.round, Math.min(s.totalRounds, c.expiresRound ?? s.round)),
  };
  s.conditionalOrders.push(order);
  return { ok: true, order };
}

export function removeConditional(s: GameState, pid: PlayerId, id: string) {
  const c = s.conditionalOrders.find((x) => x.id === id && x.playerId === pid);
  if (!c) return { ok: false, error: 'Nije pronađeno.' };
  if (s.phase !== 'planning' || s.players[pid].ready) return { ok: false, error: 'Naredbe su zaključane.' };
  c.status = 'cancelled';
  return { ok: true };
}

// ───────────── Pregled strateških posljedica ─────────────
export function previewOrder(s: GameState, pid: PlayerId, input: OrderInput, opts: { excludeId?: string } = {}): OrderPreview {
  const p = s.players[pid];
  const o = normalizeInput(input);
  const validation = validateOrder(s, pid, o, { excludeId: opts.excludeId, draft: true });
  const cfg = s.config;
  const known: OrderPreview['known'] = [];
  const estimated: OrderPreview['estimated'] = [];
  const unknown: string[] = [];
  const risks: OrderPreview['risks'] = [];
  const counter: string[] = [];
  let title = 'Naredba';
  let outlook: OrderPreview['outlook'];
  const cost = orderCost(s, p, o);
  known.push({ label: 'Zapovjedni bodovi', value: `${cost.cp}` });
  for (const k of RESOURCE_TYPES) if ((cost.res[k] ?? 0) > 0) known.push({ label: `Trošak: ${resName(k)}`, value: `${cost.res[k]}` });

  switch (o.type) {
    case 'attack': {
      const a = o.params;
      const from = s.map.territories[a.fromId], target = s.map.territories[a.targetId];
      title = `Napad na ${target?.name ?? '?'}`;
      if (!from || !target) break;
      known.push({ label: 'Tvoje postrojbe', value: describeUnits(a.units) });
      known.push({ label: 'Teren cilja', value: cfg.terrain[target.terrain].name });
      known.push({ label: 'Strategija / formacija', value: `${cfg.combat.strategy[a.strategy].label} / ${cfg.combat.formation[a.formation].label}` });
      const supplyRatio = cfg.combat.supply[a.supply].ratio;
      const force: Force = {
        playerId: pid, fromId: a.fromId, units: a.units, strategy: a.strategy, formation: a.formation, risk: a.risk, retreatBelow: a.retreatBelow,
        supplyRatio, mods: getMods(p), stability: p.stability, intelConfidence: confToNum(freshIntelOnTerritory(s, pid, target.id)?.confidence), betrayal: !!target.owner && isAllied(s, pid, target.owner), resistance: p.status === 'resistance',
      };
      const est = estimateGarrison(s, pid, target);
      const bt = { terrain: target.terrain, defenseLevel: target.defenseLevel, building: target.building, buildingLevel: target.buildingLevel, isCapital: target.isCapital, siegeProgress: target.siegeProgress };
      const ev = currentEvent(s);
      const ctxBase = { cfg, storm: ev?.type === 'storm', adjacentFriendly: neighborIds(s, target.id).filter((n) => { const ow = s.map.territories[n].owner; return ow && isAllied(s, pid, ow); }).length, jointAttack: false };
      const own = fp(s, force, bt);
      known.push({ label: 'Tvoja procijenjena snaga', value: `${Math.round(own)}` });
      if (est.confidence === 'none') {
        estimated.push({ label: 'Branitelji', value: 'Nepoznato (udaljen teritorij)', confidence: 'none' });
        unknown.push('Veličina garnizona nepoznata — pošalji špijuna ili napadni iz susjedstva.');
        outlook = 'uncertain';
      } else {
        let lo: number, hi: number, comp: Units | undefined;
        if (est.exact) { lo = hi = unitTotal(est.exact); comp = est.exact; } else { lo = est.range!.min; hi = est.range!.max; }
        estimated.push({ label: 'Branitelji', value: est.exact ? `${lo} (točno)` : `${fmtRange({ min: lo, max: hi })}`, confidence: est.confidence });
        const mk = (n: number): Units => comp && est.exact ? comp : assumedComposition(n);
        const run = (n: number) => resolveBattle([force], { playerId: target.owner, units: mk(n), mods: target.owner ? getMods(s.players[target.owner]) : getMods(p) && zeroMods(), stability: target.owner ? s.players[target.owner].stability : 70, entrenched: false, isolated: false, pressure: false }, bt, { ...ctxBase, defenderBonus: 0 });
        const rLo = run(lo), rHi = run(hi);
        const wins = [rLo, rHi].filter((r) => r.outcome === 'attacker_victory').length;
        outlook = wins === 2 ? 'favorable' : wins === 0 ? 'unfavorable' : 'uncertain';
        estimated.push({ label: 'Procijenjeni gubici (napadač)', value: `${unitTotalOf(rHi.attackerLosses)}–${unitTotalOf(rLo.attackerLosses)}`, confidence: est.confidence });
        if (wins === 0) risks.push({ level: 'high', text: 'Prema procjeni napad najvjerojatnije neće uspjeti.' });
        else if (wins === 1) risks.push({ level: 'medium', text: 'Ishod ovisi o stvarnoj veličini garnizona.' });
      }
      unknown.push('Protivnik može pojačati obranu, uvjetnim naredbama ili povući trupe.');
      unknown.push('Drugi igrači mogu istovremeno napasti isti teritorij.');
      const remain = unitTotal(subUnits(from.garrison, a.units));
      if (remain < 3) risks.push({ level: remain < 1 ? 'high' : 'medium', text: `Polazni teritorij ostaje s ${remain} branitelja.` });
      const sup = computeSupply(s, pid);
      if (!sup.has(from.id)) risks.push({ level: 'high', text: 'Polazni teritorij je odsječen od opskrbe — vojska slabi.' });
      if (supplyRatio < 1) risks.push({ level: 'medium', text: 'Minimalne zalihe smanjuju snagu napada.' });
      if (currentEvent(s)?.type === 'storm') risks.push({ level: 'low', text: 'Oluja smanjuje snagu napada.' });
      if (target.owner) {
        const adj = neighborIds(s, from.id).filter((n) => s.map.territories[n].owner === target.owner && n !== target.id);
        if (adj.length) risks.push({ level: 'medium', text: `Protivnik ima ${adj.length} susjedna teritorija uz tvoj polazni teritorij — moguć protuudar.` });
      }
      counter.push('Zadrži rezervu u polaznom teritoriju.', 'Uvjetna naredba može automatski pojačati teritorij nakon napada.', 'Povećaj izviđanje cilja prije napada.');
      break;
    }
    case 'recruit': {
      title = `Novačenje: ${cfg.units[o.params.unit]?.name ?? ''}`;
      known.push({ label: 'Stižu', value: 'početkom iduće runde' });
      known.push({ label: 'Održavanje po danu', value: `${round2(cfg.units[o.params.unit].upkeep.gold * o.params.count)} zlata, ${round2(cfg.units[o.params.unit].upkeep.food * o.params.count)} hrane` });
      unknown.push('Novaci neće sudjelovati u bitkama ove runde.');
      break;
    }
    case 'build': {
      const t = s.map.territories[o.params.territoryId];
      title = `Gradnja: ${cfg.buildings[o.params.building]?.name ?? ''}`;
      known.push({ label: 'Gotovo', value: 'početkom iduće runde' });
      const pr = cfg.buildings[o.params.building]?.production;
      if (pr) known.push({ label: 'Proizvodnja (razina 1)', value: Object.entries(pr).map(([k, v]) => `${v} ${resName(k as keyof Resources)}`).join(', ') || 'bez proizvodnje' });
      if (t && !t.building && o.params.building === 'fortress') known.push({ label: 'Obrana', value: `+${Math.round(cfg.defense.fortressBonusPerLevel * 100)}% po razini` });
      break;
    }
    case 'trade': {
      title = 'Trgovačka ekspedicija';
      const rate = tradeRate(s, p, o.params.give, o.params.receive);
      known.push({ label: 'Tečaj', value: `1 ${resName(o.params.give)} → ${rate.toFixed(2)} ${resName(o.params.receive)}` });
      known.push({ label: 'Dobivaš', value: `${Math.floor(o.params.amount * rate)} ${resName(o.params.receive)}` });
      unknown.push('Tečaj ovisi o događajima dana izvršenja.');
      break;
    }
    case 'defend': {
      title = `Obrana: ${s.map.territories[o.params.territoryId]?.name ?? ''}`;
      if (o.params.stance === 'entrench') known.push({ label: 'Učinak', value: `+${Math.round(cfg.defense.entrenchBonus * 100)}% obrane ove runde` });
      if (o.params.stance === 'fortify') known.push({ label: 'Učinak', value: `+1 trajna razina obrane (+${Math.round(cfg.defense.levelBonus * 100)}%)` });
      if (o.params.stance === 'reinforce') known.push({ label: 'Učinak', value: 'Postrojbe prelaze prije bitaka' });
      unknown.push('Ne znaš hoće li protivnik napasti ovaj teritorij.');
      break;
    }
    case 'espionage': {
      title = 'Špijunaža';
      estimated.push({ label: 'Očekivana pouzdanost', value: 'ovisi o protivnikovoj protuobavještajnoj službi', confidence: 'medium' });
      known.push({ label: 'Snaga tvojih špijuna', value: spyPowerLabel(s, pid) });
      unknown.push('Protivnik možda ima protuobavještajne mjere i lažne informacije.');
      risks.push({ level: 'low', text: 'Neuspjeh otkriva špijuna protivniku.' });
      break;
    }
    case 'sabotage': {
      title = 'Sabotaža';
      unknown.push('Uspjeh ovisi o protivnikovoj protuobavještajnoj snazi.');
      risks.push({ level: 'medium', text: 'Uhvaćeni saboter šteti ugledu i otkriva te protivniku.' });
      break;
    }
    case 'diplomacy': {
      title = 'Diplomatska misija';
      known.push({ label: 'Ponuda stiže', value: 'nakon rješavanja runde' });
      unknown.push('Drugi igrač može odbiti ponudu.');
      if (o.params.kind === 'annex') known.push({ label: 'Pripajanje', value: 'Neutralni stanovnici predaju se uz dio postrojbi' });
      break;
    }
    case 'research': {
      const t = TECH_BY_ID[o.params.techId];
      title = `Istraživanje: ${t?.name ?? ''}`;
      if (t) known.push({ label: 'Učinak', value: t.description });
      break;
    }
    case 'resistance': title = o.params.kind === 'uprising' ? 'Ustanak partizana' : 'Hitno novačenje'; break;
  }
  for (const w of validation.warnings) risks.push({ level: 'medium', text: w });
  return { validation, title, known, estimated, unknown, risks, countermeasures: counter, outlook };
}

const zeroMods = () => getMods({ techs: [] } as unknown as PlayerState);
const confToNum = (c?: string) => (c === 'high' ? 1 : c === 'medium' ? 0.6 : c === 'low' ? 0.3 : 0);
const unitTotalOf = (u: Units) => unitTotal(u);
function fp(s: GameState, f: Force, bt: any) {
  const defUnits: Units = {};
  return forcePower(s.config, f, bt, defUnits, { storm: currentEvent(s)?.type === 'storm' }).power;
}
function spyPowerLabel(s: GameState, pid: PlayerId) { return (s.config.espionage.basePower + getMods(s.players[pid]).spyPower).toFixed(2); }

export { cloneRes, pname, UNIT_TYPES };
