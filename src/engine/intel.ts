/**
 * Magla rata i obavještajna služba.
 * Tri razine informacija: vlastiti teritorij (potpuno), susjedni (djelomično), udaljeni (ograničeno).
 * Špijunaža stvara procjene s razinom pouzdanosti — nikad savršene podatke.
 */
import { getMods } from './tech';
import { hash01 } from './rng';
import type { Confidence, GameState, IntelReport, PlayerId, Territory, TerritoryId, Units } from './types';
import { UNIT_TYPES } from './config';
import { isAllied, neighborIds, unitTotal } from './util';

export type Visibility = 'own' | 'near' | 'far';

export function visibilityOf(s: GameState, viewer: PlayerId, t: Territory): Visibility {
  if (t.owner === viewer) return 'own';
  // Saveznici dijele vid
  if (t.owner && s.alliances.some((a) => a.status === 'active' && a.kind === 'alliance' && a.terms.sharedVision && ((a.a === viewer && a.b === t.owner) || (a.b === viewer && a.a === t.owner)))) return 'near';
  for (const n of neighborIds(s, t.id)) {
    const nt = s.map.territories[n];
    if (nt.owner === viewer) return 'near';
    if (nt.owner && s.alliances.some((a) => a.status === 'active' && a.kind === 'alliance' && a.terms.sharedVision && ((a.a === viewer && a.b === nt.owner) || (a.b === viewer && a.a === nt.owner)))) return 'near';
  }
  return 'far';
}

export function errorFor(c: Confidence): number {
  return c === 'high' ? 0.1 : c === 'medium' ? 0.25 : 0.45;
}

/** Raspon koji uvijek sadrži pravu vrijednost (osim kod dezinformacija). Širina ∝ pogreška. */
export function estimateRange(value: number, conf: Confidence, key: string, skew = 0): { min: number; max: number } {
  const v = value * (1 + skew);
  const width = Math.max(conf === 'high' ? 1 : 2, 2 * errorFor(conf) * Math.max(v, 1));
  const h = hash01(key);
  const lo = v - width * h;
  return { min: Math.max(0, Math.round(lo)), max: Math.max(0, Math.round(lo + width)) };
}

export const fmtRange = (r: { min: number; max: number }) => (r.min === r.max ? `${r.min}` : `${r.min}–${r.max}`);

export function spyPower(s: GameState, pid: PlayerId): number {
  return s.config.espionage.basePower + getMods(s.players[pid]).spyPower;
}
export function counterPower(s: GameState, pid: PlayerId): number {
  const p = s.players[pid];
  return s.config.espionage.counterBase + getMods(p).counterPower + (p.counterIntelUntil >= s.round ? s.config.espionage.counterOpBonus : 0);
}
export function confidenceFromRatio(cfg: GameState['config'], ratio: number): Confidence | 'failed' {
  const e = cfg.espionage;
  return ratio >= e.highRatio ? 'high' : ratio >= e.mediumRatio ? 'medium' : ratio >= e.lowRatio ? 'low' : 'failed';
}

/** Najsvježije izvješće o teritoriju za promatrača (ne starije od staleAfterRounds). */
export function freshIntelOnTerritory(s: GameState, viewer: PlayerId, territoryId: TerritoryId): IntelReport | undefined {
  const reports = s.intel.filter((r) => r.owner === viewer && r.territoryId === territoryId && r.kind === 'army' && r.confidence !== 'failed');
  const best = reports.sort((a, b) => b.round - a.round)[0];
  if (best && s.round - best.round <= s.config.espionage.staleAfterRounds) return best;
  return undefined;
}

export interface GarrisonEstimate {
  exact?: Units;
  range?: { min: number; max: number };
  confidence: Confidence | 'none';
  source: 'own' | 'passive' | 'intel' | 'unknown';
  round?: number;
}

/** Što igrač smije znati o postrojbama na teritoriju. */
export function estimateGarrison(s: GameState, viewer: PlayerId, t: Territory): GarrisonEstimate {
  const vis = visibilityOf(s, viewer, t);
  if (vis === 'own') return { exact: t.garrison, confidence: 'high', source: 'own' };
  const total = unitTotal(t.garrison);
  const intel = freshIntelOnTerritory(s, viewer, t.id);
  if (intel && typeof (intel.data as any).min === 'number') {
    const d = intel.data as { min: number; max: number };
    return { range: { min: d.min, max: d.max }, confidence: intel.confidence as Confidence, source: 'intel', round: intel.round };
  }
  if (vis === 'near') {
    const cover = t.owner ? getMods(s.players[t.owner]).counterPower : 0;
    const conf: Confidence = 'low';
    const skewAmt = cover > 0 ? -0.15 : 0;
    return { range: estimateRange(total, conf, `${s.seed}:${s.round}:${viewer}:${t.id}`, skewAmt), confidence: conf, source: 'passive' };
  }
  return { confidence: 'none', source: 'unknown' };
}

/** Uzmi sastav postrojbi pretpostavljen za procjenu (najčešće pješadija). */
export function assumedComposition(total: number): Units {
  return { infantry: Math.max(0, Math.round(total * 0.6)), spearmen: Math.round(total * 0.2), archers: Math.max(0, total - Math.round(total * 0.6) - Math.round(total * 0.2)) };
}

export function visibleUnitsTotal(u: Units) {
  return UNIT_TYPES.reduce((a, k) => a + (u[k] ?? 0), 0);
}

export { isAllied };
