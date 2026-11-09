import { RESOURCE_TYPES } from './config';
import { forecastEconomy } from './economy';
import { objectiveProgress } from './objectives';
import type { GameState, PlayerId, ScoreBreakdown } from './types';
import { playerTerritories, round2 } from './util';

export function computeScore(s: GameState, pid: PlayerId): ScoreBreakdown {
  const cfg = s.config.scoring;
  const p = s.players[pid];
  let territories = 0, cities = 0, enemyCapitals = 0, cityCount = 0;
  for (const t of playerTerritories(s, pid)) {
    if (t.capitalOf && t.capitalOf !== pid) { enemyCapitals += cfg.enemyCapital; continue; }
    if (t.isCapital || t.building === 'city') { cities += cfg.city; cityCount++; continue; }
    territories += cfg.territory;
  }
  const regionsControlled: string[] = [];
  for (const r of s.map.regions) {
    const n = r.territoryIds.filter((id) => s.map.territories[id].owner === pid).length;
    if (n > r.territoryIds.length * cfg.regionControlShare) regionsControlled.push(r.id);
  }
  const prog = objectiveProgress(s, pid);
  const objective = prog.done ? cfg.objective : 0;
  const ach: string[] = [];
  let military = 0;
  const a = cfg.achievements;
  if (p.stats.battlesWon >= a.iron_fist.victories) { ach.push('iron_fist'); military += a.iron_fist.points; }
  if (s.phase === 'completed' && p.stats.territoriesLost === 0) { ach.push('unshaken'); military += a.unshaken.points; }
  if (p.stats.territoriesCaptured >= a.conqueror.captures) { ach.push('conqueror'); military += a.conqueror.points; }
  const v = s.config.trade.values;
  const economicStrength = round2(RESOURCE_TYPES.reduce((sum, k) => sum + p.resources[k] * v[k], 0) + p.techs.length * 15);
  const allyCount = s.alliances.filter((x) => x.status === 'active' && x.kind === 'alliance' && (x.a === pid || x.b === pid)).length;
  const diplomaticScore = allyCount * 3 + p.reputation.keptTreaties * 2 + p.reputation.tradeCount + p.reputation.supportsGiven * 2 - p.reputation.betrayals * 3;
  const regions = regionsControlled.length * cfg.region;
  const fc = forecastEconomy(s, pid);
  const income = round2(RESOURCE_TYPES.reduce((sum, k) => sum + fc.production[k] * v[k], 0) + fc.taxes * v.gold);
  const economy = Math.max(0, Math.min(cfg.economy.cap, Math.floor((income - cfg.economy.base) / cfg.economy.step)));
  return {
    playerId: pid, territories, cities, enemyCapitals, regions, objective, military, economy, income,
    total: territories + cities + enemyCapitals + regions + objective + military + economy,
    territoryCount: playerTerritories(s, pid).length, cityCount, economicStrength, diplomaticScore,
    militaryAchievements: ach, regionsControlled, objectiveCompleted: prog.done, objectiveTitle: p.objective.title,
  };
}

/** Javni bodovi (bez tajnog cilja) — za ljestvicu tijekom kampanje. */
export function publicScore(s: GameState, pid: PlayerId): number {
  const sc = computeScore(s, pid);
  return sc.total - sc.objective;
}

export function computeAllScores(s: GameState): Record<PlayerId, ScoreBreakdown> {
  const out: Record<PlayerId, ScoreBreakdown> = {};
  for (const id of s.playerOrder) out[id] = computeScore(s, id);
  return out;
}

export function ranking(s: GameState, scores = computeAllScores(s)): ScoreBreakdown[] {
  return Object.values(scores).sort((a, b) => b.total - a.total || b.territoryCount - a.territoryCount || b.economicStrength - a.economicStrength || a.playerId.localeCompare(b.playerId));
}
