import { RESOURCE_TYPES, UNIT_TYPES } from './config';
import { neighborOffsets, tid } from './hex';
import type { GameState, PlayerId, Resources, Territory, TerritoryId, Units, UnitType, ReportEntry, NotificationDraft, ReportCategory, Mood, ResourceType } from './types';

export const emptyResources = (): Resources => ({ gold: 0, food: 0, iron: 0, wood: 0, influence: 0 });
export const cloneRes = (r: Partial<Resources>): Resources => ({ gold: r.gold ?? 0, food: r.food ?? 0, iron: r.iron ?? 0, wood: r.wood ?? 0, influence: r.influence ?? 0 });
export function addRes(a: Resources, b: Partial<Resources>, mult = 1): Resources {
  const out = { ...a };
  for (const k of RESOURCE_TYPES) out[k] = round2(out[k] + (b[k] ?? 0) * mult);
  return out;
}
export function canAfford(have: Resources, cost: Partial<Resources>): boolean {
  return RESOURCE_TYPES.every((k) => have[k] + 1e-9 >= (cost[k] ?? 0));
}
export function scaleRes(r: Partial<Resources>, m: number): Resources {
  const o = emptyResources();
  for (const k of RESOURCE_TYPES) o[k] = round2((r[k] ?? 0) * m);
  return o;
}
export const round2 = (n: number) => Math.round(n * 100) / 100;

export const unitTotal = (u: Units | undefined): number => (u ? UNIT_TYPES.reduce((s, k) => s + (u[k] ?? 0), 0) : 0);
export function addUnits(a: Units, b: Units): Units {
  const o: Units = { ...a };
  for (const k of UNIT_TYPES) if (b[k]) o[k] = (o[k] ?? 0) + (b[k] as number);
  return o;
}
export function subUnits(a: Units, b: Units): Units {
  const o: Units = { ...a };
  for (const k of UNIT_TYPES) if (b[k]) o[k] = Math.max(0, (o[k] ?? 0) - (b[k] as number));
  return cleanUnits(o);
}
export function cleanUnits(u: Units): Units {
  const o: Units = {};
  for (const k of UNIT_TYPES) if ((u[k] ?? 0) > 0) o[k] = u[k];
  return o;
}
export function hasUnits(have: Units, need: Units): boolean {
  return UNIT_TYPES.every((k) => (have[k] ?? 0) >= (need[k] ?? 0));
}
export function normalizeUnits(u: Units | undefined): Units {
  const o: Units = {};
  if (!u) return o;
  for (const k of UNIT_TYPES) {
    const n = Math.floor(Number(u[k] ?? 0));
    if (Number.isFinite(n) && n > 0) o[k] = n;
  }
  return o;
}
/** Primijeni gubitke (udio 0..1) na postrojbe determinističkim zaokruživanjem (najveći ostatak). */
export function applyLossFraction(units: Units, frac: number): { survivors: Units; losses: Units } {
  const f = Math.max(0, Math.min(1, frac));
  const total = unitTotal(units);
  const lossTotal = Math.min(total, Math.round(total * f));
  const raw = UNIT_TYPES.map((k) => ({ k, exact: (units[k] ?? 0) * f }));
  const losses: Units = {};
  let assigned = 0;
  for (const r of raw) { const fl = Math.floor(r.exact); if (fl > 0) losses[r.k] = fl; assigned += fl; }
  const rem = raw.map((r) => ({ k: r.k, frac: r.exact - Math.floor(r.exact), have: (units[r.k] ?? 0) - (losses[r.k] ?? 0) }))
    .sort((a, b) => b.frac - a.frac || UNIT_TYPES.indexOf(a.k) - UNIT_TYPES.indexOf(b.k));
  for (const r of rem) {
    if (assigned >= lossTotal) break;
    if (r.have > 0) { losses[r.k] = (losses[r.k] ?? 0) + 1; assigned++; }
  }
  return { survivors: subUnits(units, losses), losses: cleanUnits(losses) };
}

export const terr = (s: GameState, id: TerritoryId): Territory => s.map.territories[id];
export function neighborIds(s: GameState, id: TerritoryId): TerritoryId[] {
  const t = s.map.territories[id];
  return neighborOffsets(t.col, t.row, s.map.width, s.map.height).map((o) => tid(o.col, o.row)).filter((n) => !!s.map.territories[n] && s.map.territories[n].terrain !== 'water');
}
export const playerTerritories = (s: GameState, pid: PlayerId): Territory[] => s.map.order.map((i) => s.map.territories[i]).filter((t) => t.owner === pid);

export function activeAlliance(s: GameState, a: PlayerId, b: PlayerId, kind?: 'alliance' | 'nap') {
  return s.alliances.find((x) => x.status === 'active' && ((x.a === a && x.b === b) || (x.a === b && x.b === a)) && (kind ? x.kind === kind : true));
}
export const isAllied = (s: GameState, a: PlayerId, b: PlayerId) => a === b || !!activeAlliance(s, a, b, 'alliance');
export const hasPact = (s: GameState, a: PlayerId, b: PlayerId) => a !== b && !!activeAlliance(s, a, b);

/**
 * Opskrbni lanac: BFS od gradova i glavnog grada kroz vlastite teritorije.
 * Vraća udaljenost (u koracima) do najbližeg opskrbnog središta; teritorij koji nije u mapi je izoliran.
 */
export function computeSupply(s: GameState, pid: PlayerId): Map<TerritoryId, number> {
  const dist = new Map<TerritoryId, number>();
  const p = s.players[pid];
  const mine = playerTerritories(s, pid);
  const sources = p.status === 'resistance' ? mine : mine.filter((t) => t.building === 'city' || t.building === 'capital');
  const queue: TerritoryId[] = [];
  for (const t of sources) { dist.set(t.id, 0); queue.push(t.id); }
  while (queue.length) {
    const cur = queue.shift()!;
    for (const n of neighborIds(s, cur)) {
      if (s.map.territories[n].owner !== pid || dist.has(n)) continue;
      dist.set(n, dist.get(cur)! + 1);
      queue.push(n);
    }
  }
  return dist;
}

export function nextId(s: GameState, prefix: string): string {
  s.idCounter += 1;
  return `${prefix}${s.idCounter.toString(36)}`;
}

export function emit(s: GameState, round: number, category: ReportCategory, text: string, audience: PlayerId[], severity: ReportEntry['severity'] = 'info', extra?: { refs?: ReportEntry['refs']; mood?: Mood }) {
  if (!audience.length) return;
  s.reportEntries.push({ id: nextId(s, 'e'), round, category, text, audience: [...new Set(audience)], severity, ...extra });
}
export function notify(s: GameState, n: NotificationDraft) { s.notificationsOut.push(n); }

export function pname(s: GameState, id: PlayerId | null): string {
  if (!id) return 'Neutralni stanovnici';
  const p = s.players[id];
  return p ? p.name : 'Nepoznat';
}
export const resLabel: Record<ResourceType, string> = { gold: 'zlato', food: 'hrana', iron: 'željezo', wood: 'drvo', influence: 'utjecaj' };
export const unitLabel = (u: UnitType) => ({ infantry: 'pješadija', archers: 'strijelci', spearmen: 'kopljanici', knights: 'vitezovi', cavalry: 'konjica', siege: 'opsadna oruđa' }[u]);
export function describeUnits(u: Units): string {
  const parts = UNIT_TYPES.filter((k) => (u[k] ?? 0) > 0).map((k) => `${u[k]} ${unitLabel(k)}`);
  return parts.length ? parts.join(', ') : 'nema postrojbi';
}
