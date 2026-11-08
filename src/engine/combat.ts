/**
 * Deterministički bojni račun. Nema slučajnosti: isti ulaz → isti ishod.
 * Snaga = Σ (broj × vrijednost × modifikatori). Bitka teče u fazama (Lanchesterov linearni zakon),
 * a ishod se objašnjava listom čimbenika koja ide u bojno izvješće.
 */
import { UNIT_TYPES, type GameConfig } from './config';
import type { Mods } from './tech';
import type {
  AttackStrategy, BattleFactor, BattlePhase, BuildingType, Formation, PlayerId, RiskPref, TerrainType, UnitType, Units,
} from './types';
import { applyLossFraction, round2, unitTotal } from './util';

export interface Force {
  playerId: PlayerId; fromId: string; units: Units; strategy: AttackStrategy; formation: Formation; risk: RiskPref; retreatBelow: number;
  /** Omjer opskrbe 0..1.4 (1 = standardne zalihe). */
  supplyRatio: number;
  mods: Mods; stability: number; intelConfidence: number; betrayal: boolean; resistance: boolean;
}
export interface Defender {
  playerId: PlayerId | null; units: Units; mods: Mods; stability: number; entrenched: boolean; isolated: boolean; pressure: boolean;
}
export interface BattleTerritory {
  terrain: TerrainType; defenseLevel: number; building: BuildingType | null; buildingLevel: number; isCapital: boolean; siegeProgress: number;
}
export interface BattleContext {
  cfg: GameConfig; storm: boolean; adjacentFriendly: number; jointAttack: boolean; defenderBonus?: number;
}
export interface BattleResult {
  outcome: 'attacker_victory' | 'defender_victory' | 'retreat';
  attackerPower: number; defenderPower: number; phases: BattlePhase[];
  attackerSurvivors: Units; attackerLosses: Units; defenderSurvivors: Units; defenderLosses: Units;
  factors: BattleFactor[]; explanation: string[];
  /** Koliko se utvrde smanjilo opsadom (0..1). */
  fortificationCut: number;
}

const atkMod = (u: UnitType, m: Mods) => (u === 'infantry' || u === 'spearmen' ? m.infantryAttack : u === 'archers' ? m.archerAttack : u === 'cavalry' || u === 'knights' ? m.cavalryAttack : m.siegeAttack);
const defMod = (u: UnitType, m: Mods) => (u === 'infantry' || u === 'spearmen' ? m.infantryDefense : 0);

function counterFactor(cfg: GameConfig, u: UnitType, enemy: Units): number {
  const total = unitTotal(enemy);
  if (!total) return 1;
  let f = 0;
  for (const d of UNIT_TYPES) f += ((enemy[d] ?? 0) / total) * cfg.counters[u][d];
  return f;
}

function formationUnitFactor(cfg: GameConfig, f: Formation, u: UnitType, side: 'attack' | 'defense'): number {
  const fc = cfg.combat.formation[f] as Record<string, number | string>;
  let m = fc[side] as number;
  if (f === 'skirmish') {
    if (u === 'archers' || u === 'cavalry') m *= fc.rangedBonus as number;
    if (u === 'knights' || u === 'siege') m *= fc.heavyPenalty as number;
  }
  return m;
}

export function strategyAttackFactor(cfg: GameConfig, f: Force): number {
  const sc = cfg.combat.strategy[f.strategy] as Record<string, number>;
  if (f.strategy === 'ambush') return sc.attack + sc.intelBonus * Math.max(0, Math.min(1, f.intelConfidence));
  return sc.attack;
}

/** Snaga jedne postrojbe (bez obrane): koristi se i za procjene u pregledu naredbe. */
export function forcePower(cfg: GameConfig, f: Force, target: BattleTerritory, enemy: Units, ctx: Pick<BattleContext, 'storm'>) {
  let base = 0;
  for (const u of UNIT_TYPES) {
    const n = f.units[u] ?? 0;
    if (!n) continue;
    const d = cfg.units[u];
    base += n * d.attack * (1 + atkMod(u, f.mods)) * d.terrain[target.terrain] * counterFactor(cfg, u, enemy) * formationUnitFactor(cfg, f.formation, u, 'attack');
  }
  const supply = cfg.combat.supplyStrengthFloor + (1 - cfg.combat.supplyStrengthFloor) * Math.min(1, f.supplyRatio) + (f.supplyRatio > 1 ? cfg.combat.wellFedBonus : 0);
  const morale = cfg.combat.moraleFloor + (1 - cfg.combat.moraleFloor) * (f.stability / 100);
  const risk = cfg.combat.risk[f.risk].attack;
  const strat = strategyAttackFactor(cfg, f);
  const weather = ctx.storm ? cfg.combat.stormAttackFactor : 1;
  const betrayal = f.betrayal ? 1 + cfg.combat.betrayalSurprise : 1;
  const resist = f.resistance ? 1 + cfg.combat.resistanceBonus : 1;
  return { power: base * strat * risk * supply * morale * weather * betrayal * resist, base, supply, morale, risk, strat, weather, betrayal, resist };
}

export function defenderPower(cfg: GameConfig, d: Defender, t: BattleTerritory, attackers: Units, attackerMods: Mods[], ctx: BattleContext, siegeStrategy: boolean) {
  let base = 0;
  for (const u of UNIT_TYPES) {
    const n = d.units[u] ?? 0;
    if (!n) continue;
    const def = cfg.units[u];
    base += n * def.defense * (1 + defMod(u, d.mods)) * def.terrain[t.terrain] * counterFactor(cfg, u, attackers);
  }
  const terrain = cfg.terrain[t.terrain].defense;
  const dc = cfg.defense;
  let fortBonus = 0, fortCap = 0;
  if (t.building === 'fortress') fortCap += dc.fortressBonusPerLevel * t.buildingLevel;
  if (t.isCapital) fortCap += dc.capitalBonus;
  const ignore = attackerMods.reduce((m, x) => Math.max(m, x.fortressIgnore), 0);
  const cut = Math.min(1, (t.siegeProgress + (siegeStrategy ? 1 : 0)) * (cfg.combat.strategy.siege.fortressCutPerProgress as number) + (siegeStrategy ? ignore : 0));
  fortBonus = fortCap * (1 - cut);
  const level = t.defenseLevel * dc.levelBonus;
  const fort = 1 + level + fortBonus;
  const stance = d.entrenched ? 1 + dc.entrenchBonus : 1;
  const morale = d.playerId ? cfg.combat.moraleFloor + (1 - cfg.combat.moraleFloor) * (d.stability / 100) : 1;
  const isolated = d.isolated ? cfg.combat.isolatedDefensePenalty : 1;
  const pressure = d.pressure ? 1 - (cfg.combat.strategy.diversion.pressureDefenseCut as number) : 1;
  const enc = ctx.adjacentFriendly >= (cfg.combat.strategy.encirclement.minAdjacent as number)
    ? 1 - Math.min(cfg.combat.strategy.encirclement.maxDefenseCut as number, (ctx.adjacentFriendly - 1) * (cfg.combat.strategy.encirclement.perAdjacentDefenseCut as number)) : 1;
  const extra = 1 + (ctx.defenderBonus ?? 0);
  return { power: base * terrain * fort * stance * morale * isolated * pressure * extra, base, terrain, fort, stance, morale, isolated, pressure, enc, cut, extra };
}

export function resolveBattle(forces: Force[], defender: Defender, t: BattleTerritory, ctx: BattleContext): BattleResult {
  const cfg = ctx.cfg;
  const allAttackers: Units = {};
  for (const f of forces) for (const u of UNIT_TYPES) if (f.units[u]) allAttackers[u] = (allAttackers[u] ?? 0) + (f.units[u] as number);
  const primary = forces.reduce((a, b) => (unitTotal(b.units) > unitTotal(a.units) ? b : a), forces[0]);
  const siegeStrategy = forces.some((f) => f.strategy === 'siege');
  const encirclementUsed = forces.some((f) => f.strategy === 'encirclement');
  const fps = forces.map((f) => forcePower(cfg, f, t, defender.units, ctx));
  let sA = fps.reduce((s, x) => s + x.power, 0);
  const coalition = 1 + Math.min(cfg.combat.coalitionBonusMax, cfg.combat.coalitionBonusPerForce * (forces.length - 1)) + (ctx.jointAttack ? cfg.diplomacy.jointAttackBonus : 0);
  sA *= coalition;
  const dp = defenderPower(cfg, defender, t, allAttackers, forces.map((f) => f.mods), ctx, siegeStrategy);
  let sD = dp.power * (encirclementUsed ? dp.enc : 1);
  const sA0 = sA, sD0 = sD;

  const recv = forces.reduce((m, f) => m + (cfg.combat.strategy[f.strategy].receivedDamage as number) * cfg.combat.risk[f.risk].receivedDamage, 0) / forces.length;
  const retreatBelow = primary.retreatBelow;
  const phases: BattlePhase[] = [];
  let retreated = false;
  let a = sA, d = sD;
  for (let i = 1; i <= cfg.combat.phases; i++) {
    const dmgD = a * cfg.combat.damageRate;
    const dmgA = d * cfg.combat.damageRate * recv;
    const na = Math.max(0, a - dmgA), nd = Math.max(0, d - dmgD);
    phases.push({ n: i, attackerPower: round2(a), defenderPower: round2(d), attackerLossPct: sA0 ? round2((1 - na / sA0) * 100) : 100, defenderLossPct: sD0 ? round2((1 - nd / sD0) * 100) : 100 });
    a = na; d = nd;
    if (d <= 0.0001 || a <= 0.0001) break;
    if (retreatBelow > 0 && a / sA0 < retreatBelow && d > a) { retreated = true; break; }
  }
  const lossA = sA0 > 0 ? Math.min(cfg.combat.maxLossFraction, 1 - a / sA0) : 0;
  const lossD = sD0 > 0 ? Math.min(cfg.combat.maxLossFraction, 1 - d / sD0) : 1;
  const attackerWins = !retreated && d <= a && !(a <= 0.0001 && d <= 0.0001 && unitTotal(defender.units) > 0);
  const outcome: BattleResult['outcome'] = retreated ? 'retreat' : attackerWins ? 'attacker_victory' : 'defender_victory';

  // Raspodjela gubitaka postrojbama napadača — razmjerno broju postrojbi svake sile
  const totalAtt = forces.reduce((s, f) => s + unitTotal(f.units), 0);
  const attackerSurv: Units = {}, attackerLoss: Units = {};
  for (const f of forces) {
    const r = applyLossFraction(f.units, lossA);
    for (const u of UNIT_TYPES) { if (r.survivors[u]) attackerSurv[u] = (attackerSurv[u] ?? 0) + (r.survivors[u] as number); if (r.losses[u]) attackerLoss[u] = (attackerLoss[u] ?? 0) + (r.losses[u] as number); }
  }
  void totalAtt;
  const dr = applyLossFraction(defender.units, lossD);

  // Čimbenici i objašnjenje
  const factors: BattleFactor[] = [];
  const pct = (x: number) => `${x >= 1 ? '+' : ''}${Math.round((x - 1) * 100)}%`;
  const push = (label: string, x: number, side: 'attacker' | 'defender', goodWhenHigh = true) => {
    if (Math.abs(x - 1) < 0.005) return;
    factors.push({ label, value: pct(x), side, impact: (x > 1) === goodWhenHigh ? 'positive' : 'negative' });
  };
  const f0 = fps[0];
  const sc = cfg.combat.strategy[primary.strategy].label as string;
  push(`Strategija: ${sc}`, f0.strat, 'attacker');
  push(`Formacija: ${cfg.combat.formation[primary.formation].label}`, formationUnitFactor(cfg, primary.formation, 'infantry', 'attack'), 'attacker');
  push('Opskrba', f0.supply, 'attacker');
  push('Moral', f0.morale, 'attacker');
  push(`Sklonost riziku: ${cfg.combat.risk[primary.risk].label}`, f0.risk, 'attacker');
  if (f0.weather !== 1) push('Oluja', f0.weather, 'attacker');
  if (f0.betrayal !== 1) push('Iznenađenje (izdaja saveznika)', f0.betrayal, 'attacker');
  if (f0.resist !== 1) push('Borba otpora', f0.resist, 'attacker');
  if (forces.length > 1) push('Koordinirani napad', coalition, 'attacker');
  const comp = counterFactor(cfg, UNIT_TYPES.find((u) => primary.units[u])!, defender.units);
  push('Sastav postrojbi (protivnici)', comp, 'attacker');
  push(`Teren: ${cfg.terrain[t.terrain].name}`, dp.terrain, 'defender');
  push('Utvrde', dp.fort, 'defender');
  if (dp.cut > 0) factors.push({ label: 'Opsada oslabila utvrde', value: `−${Math.round(dp.cut * 100)}%`, side: 'attacker', impact: 'positive' });
  push('Utvrđena obrana', dp.stance, 'defender');
  push('Moral branitelja', dp.morale, 'defender');
  if (defender.isolated) push('Odsječeni od opskrbe', dp.isolated, 'defender');
  if (defender.pressure) push('Diverzija je oslabila obranu', dp.pressure, 'defender');
  if (encirclementUsed && dp.enc < 1) push('Opkoljenost', dp.enc, 'defender');
  if ((ctx.defenderBonus ?? 0) !== 0) push('Dodatna obrana (uvjetne naredbe)', dp.extra, 'defender');

  const explanation: string[] = [];
  explanation.push(`Napadač je skupio snagu ${Math.round(sA0)} protiv obrambene snage ${Math.round(sD0)}.`);
  if (outcome === 'attacker_victory') explanation.push(`Obrana je slomljena nakon ${phases.length}. faze; napadačeva snaga bila je ${sD0 > 0 ? (sA0 / sD0).toFixed(2) : '∞'}× veća.`);
  else if (outcome === 'retreat') explanation.push(`Napadač je pao ispod praga povlačenja (${Math.round(retreatBelow * 100)}%) i odustao od napada.`);
  else explanation.push(`Obrana je izdržala; napadačeva snaga bila je samo ${sD0 > 0 ? (sA0 / sD0).toFixed(2) : '0'}× obrambene.`);
  const top = factors.filter((x) => x.impact !== 'neutral').sort((x, y) => Math.abs(parseFloat(y.value)) - Math.abs(parseFloat(x.value))).slice(0, 3);
  for (const x of top) explanation.push(`${x.label}: ${x.value} (${x.side === 'attacker' ? 'napadač' : 'branitelj'}).`);

  return {
    outcome, attackerPower: round2(sA0), defenderPower: round2(sD0), phases,
    attackerSurvivors: attackerSurv, attackerLosses: attackerLoss, defenderSurvivors: dr.survivors, defenderLosses: dr.losses,
    factors, explanation, fortificationCut: dp.cut,
  };
}
