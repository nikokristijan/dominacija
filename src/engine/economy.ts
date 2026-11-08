/** Ekonomija: proizvodnja, porezi, održavanje, stanovništvo, stabilnost, pobune. Sve čiste funkcije. */
import { RESOURCE_TYPES, UNIT_TYPES, type GameConfig } from './config';
import { getMods } from './tech';
import type { BuildingType, GameState, PlayerId, PlayerState, Resources, Territory, WorldEvent } from './types';
import { cloneRes, computeSupply, emptyResources, playerTerritories, round2, unitTotal } from './util';

export function currentEvent(s: GameState): WorldEvent | undefined {
  return s.events.find((e) => e.round === s.round);
}

export function buildingMultiplier(cfg: GameConfig, level: number) {
  return 1 + cfg.production.levelGrowth * (Math.max(1, level) - 1);
}

export interface ProductionLine { label: string; resource: keyof Resources; amount: number }

export interface TerritoryProduction { total: Resources; lines: ProductionLine[]; stabilityFactor: number; notes: string[] }

/** Proizvodnja jednog teritorija (resursi bez poreza). */
export function territoryProduction(s: GameState, t: Territory, supply?: Map<string, number>): TerritoryProduction {
  const cfg = s.config;
  const out = emptyResources();
  const lines: ProductionLine[] = [];
  const notes: string[] = [];
  if (!t.owner) return { total: out, lines, stabilityFactor: 1, notes };
  const p = s.players[t.owner];
  const mods = getMods(p);
  const ev = currentEvent(s);
  const tc = cfg.terrain[t.terrain];
  const add = (res: keyof Resources, amount: number, label: string) => {
    if (amount <= 0) return;
    out[res] += amount;
    lines.push({ label, resource: res, amount });
  };
  const deposit = (res: keyof Resources) => (t.resource === res ? cfg.production.depositMultiplier : 1);
  for (const [r, v] of Object.entries(tc.production)) add(r as keyof Resources, (v as number) * deposit(r as keyof Resources), `Teren: ${tc.name}`);
  if (t.building) {
    const bd = cfg.buildings[t.building];
    const mult = buildingMultiplier(cfg, t.buildingLevel);
    for (const [r, v] of Object.entries(bd.production)) add(r as keyof Resources, (v as number) * mult * deposit(r as keyof Resources), `${bd.name} ${t.buildingLevel}`);
  }
  // Tehnologije i događaji
  out.food *= 1 + mods.foodProd; out.iron *= 1 + mods.ironProd; out.gold *= 1 + mods.goldProd; out.influence *= 1 + mods.influenceProd;
  if (mods.foodProd) notes.push(`Tehnologija hrane +${Math.round(mods.foodProd * 100)}%`);
  if (ev) {
    const applies = ev.scope === 'global' || (ev.territoryIds?.includes(t.id) ?? false) || (ev.scope === 'region' && ev.regionId === t.regionId);
    if (applies) {
      if (ev.type === 'drought') { out.food *= cfg.events.drought.foodFactor; notes.push('Suša: hrana −40%'); }
      if (ev.type === 'gold_rush') { out.gold *= cfg.events.goldRush.goldFactor; notes.push('Zlatna groznica: zlato +30%'); }
      if (ev.type === 'harvest') { out.food *= cfg.events.harvest.foodFactor; notes.push('Žetva: hrana +30%'); }
    }
  }
  const sab = t.effects.find((e) => e.kind === 'sabotaged_production' && e.untilRound >= s.round);
  if (sab) { for (const k of RESOURCE_TYPES) out[k] *= cfg.espionage.sabotageProductionFactor; notes.push('Sabotirano: proizvodnja −50%'); }
  const pf = cfg.production;
  const stabilityFactor = pf.stabilityMinFactor + (1 - pf.stabilityMinFactor) * (t.stability / 100);
  for (const k of RESOURCE_TYPES) out[k] *= stabilityFactor;
  const sup = supply ?? computeSupply(s, t.owner);
  if (p.status !== 'resistance' && !sup.has(t.id)) { for (const k of RESOURCE_TYPES) out[k] *= pf.isolatedFactor; notes.push('Izolirano: proizvodnja −50%'); }
  for (const k of RESOURCE_TYPES) out[k] = round2(out[k]);
  return { total: out, lines, stabilityFactor, notes };
}

export function taxIncome(s: GameState, p: PlayerState, t: Territory): number {
  const cfg = s.config;
  const ev = currentEvent(s);
  const mods = getMods(p);
  let g = t.population * cfg.tax[p.tax].goldPerPop * (1 + mods.goldProd);
  if (ev?.type === 'gold_rush') g *= cfg.events.goldRush.goldFactor;
  const stab = cfg.production.stabilityMinFactor + (1 - cfg.production.stabilityMinFactor) * (t.stability / 100);
  return round2(g * stab);
}

export function upkeepOf(s: GameState, pid: PlayerId): { gold: number; food: number; popFood: number; soldiers: number } {
  const cfg = s.config;
  const p = s.players[pid];
  const mods = getMods(p);
  const ev = currentEvent(s);
  let gold = 0, food = 0, popFood = 0, soldiers = 0;
  for (const t of playerTerritories(s, pid)) {
    for (const u of UNIT_TYPES) {
      const n = t.garrison[u] ?? 0;
      soldiers += n;
      gold += n * cfg.units[u].upkeep.gold;
      food += n * cfg.units[u].upkeep.food;
    }
    popFood += t.population * cfg.population.foodPerPop;
  }
  const disc = 1 - mods.upkeepDiscount;
  const wf = ev?.type === 'winter' ? cfg.events.winter.foodUpkeepFactor : 1;
  return { gold: round2(gold * disc), food: round2((food * disc + popFood) * wf), popFood: round2(popFood), soldiers };
}

export interface EconomyForecast {
  production: Resources; taxes: number; upkeepGold: number; upkeepFood: number; net: Resources;
  perTerritory: Record<string, TerritoryProduction>;
  foodShortageRisk: boolean; goldShortageRisk: boolean; stabilityDelta: number; projectedStability: number;
  rebellionWarning: 'none' | 'yellow' | 'red';
  soldiers: number;
}

export function stabilityDelta(s: GameState, p: PlayerState): number {
  const cfg = s.config;
  const mods = getMods(p);
  const taxS = cfg.tax[p.tax].stability;
  const relief = taxS < 0 ? Math.min(-taxS, mods.taxStabilityRelief) : 0;
  let d = taxS + relief + mods.stabilityBase;
  if (p.stability < 80) d += cfg.stability.naturalRecovery;
  const ev = currentEvent(s);
  if (ev?.type === 'harvest') d += cfg.events.harvest.stabilityBonus;
  if (ev?.type === 'rebellion' && (!cfg.events.rebellionEvent.highTaxOnly || p.tax === 'high')) d -= cfg.events.rebellionEvent.stabilityHit;
  const alliances = s.alliances.filter((a) => a.status === 'active' && a.kind === 'alliance' && (a.a === p.id || a.b === p.id)).length;
  if (mods.treatyBonus >= 0.2) d += Math.min(2, alliances) * 2;
  return d;
}

export function forecastEconomy(s: GameState, pid: PlayerId): EconomyForecast {
  const p = s.players[pid];
  const supply = computeSupply(s, pid);
  const production = emptyResources();
  const perTerritory: Record<string, TerritoryProduction> = {};
  let taxes = 0;
  for (const t of playerTerritories(s, pid)) {
    const tp = territoryProduction(s, t, supply);
    perTerritory[t.id] = tp;
    for (const k of RESOURCE_TYPES) production[k] = round2(production[k] + tp.total[k]);
    taxes += taxIncome(s, p, t);
  }
  taxes = round2(taxes);
  const up = upkeepOf(s, pid);
  const net = cloneRes(production);
  net.gold = round2(net.gold + taxes - up.gold);
  net.food = round2(net.food - up.food);
  const delta = stabilityDelta(s, p);
  const proj = Math.max(0, Math.min(100, p.stability + delta + (p.resources.food + net.food < 0 ? s.config.stability.foodShortage : 0)));
  const sc = s.config.stability;
  return {
    production, taxes, upkeepGold: up.gold, upkeepFood: up.food, net, perTerritory,
    foodShortageRisk: p.resources.food + net.food < 0,
    goldShortageRisk: p.resources.gold + net.gold < 0,
    stabilityDelta: delta, projectedStability: proj,
    rebellionWarning: p.stability < sc.warnRed ? 'red' : p.stability < sc.warnYellow ? 'yellow' : 'none',
    soldiers: up.soldiers,
  };
}

export function maxPopulation(cfg: GameConfig, t: Territory): number {
  let m = cfg.terrain[t.terrain].maxPopulation;
  if (t.building === 'city') m += cfg.population.cityPopulationBonus * t.buildingLevel;
  if (t.building === 'capital') m += cfg.population.capitalPopulationBonus;
  if (t.building === 'farm') m += 20 * t.buildingLevel;
  return m;
}

export function buildingCost(cfg: GameConfig, player: PlayerState, building: BuildingType, newLevel: number): Partial<Resources> {
  const mods = getMods(player);
  const base = cfg.buildings[building].cost;
  const grow = 1 + cfg.upgradeCostGrowth * (newLevel - 1);
  const disc = Math.max(0.4, 1 - mods.constructionDiscount);
  const out: Partial<Resources> = {};
  for (const [k, v] of Object.entries(base)) out[k as keyof Resources] = Math.ceil((v as number) * grow * disc);
  return out;
}

export function recruitCost(cfg: GameConfig, player: PlayerState, unit: (typeof UNIT_TYPES)[number], count: number): Resources {
  const c = cfg.units[unit].cost;
  const m = player.status === 'resistance' ? 1 - cfg.recruitment.resistanceDiscount : 1;
  const out = emptyResources();
  for (const k of RESOURCE_TYPES) out[k] = Math.ceil(c[k] * count * m);
  return out;
}

export function armySize(s: GameState, pid: PlayerId): number {
  return playerTerritories(s, pid).reduce((n, t) => n + unitTotal(t.garrison), 0);
}
