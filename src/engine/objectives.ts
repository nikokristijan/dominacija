/** Tajni ciljevi — privatni; napredak je vidljiv samo vlasniku. */
import { createRng } from './rng';
import type { GameState, ObjectiveType, PlayerId, SecretObjective } from './types';
import { playerTerritories, isAllied } from './util';

interface ObjDef { type: ObjectiveType; title: (p: Record<string, number | string>, s?: GameState) => string; description: (p: Record<string, number | string>, s?: GameState) => string }

export const OBJECTIVES: ObjDef[] = [
  { type: 'mines', title: () => 'Rudarski magnat', description: (p) => `Na kraju kampanje kontroliraj ${p.count} rudnika.` },
  { type: 'capture_capital', title: () => 'Rušitelj prijestolja', description: () => 'Osvoji glavni grad protivničkog kraljevstva.' },
  { type: 'alliances', title: () => 'Majstor saveza', description: (p) => `Na kraju kampanje održavaj ${p.count} aktivna saveza.` },
  { type: 'region', title: () => 'Gospodar regije', description: (p, s) => `Kontroliraj većinu teritorija regije „${s?.map.regions.find((r) => r.id === p.regionId)?.name ?? '?'}“.` },
  { type: 'gold', title: () => 'Zlatna riznica', description: (p) => `Na kraju kampanje posjeduj najmanje ${p.amount} zlata.` },
  { type: 'defeat_stronger', title: () => 'David protiv Golijata', description: () => 'Pobijedi u napadu protiv igrača koji trenutno ima više bodova od tebe.' },
  { type: 'stability', title: () => 'Mirna vladavina', description: (p) => `Završi kampanju sa stabilnošću ≥ ${p.final} i nikad ne padni ispod ${p.floor}.` },
  { type: 'merchant', title: () => 'Veliki trgovac', description: (p) => `Provedi ${p.count} trgovačkih razmjena (tržište ili igrači).` },
  { type: 'scholar', title: () => 'Mudri učenjak', description: (p) => `Istraži ${p.count} tehnologija.` },
];

export function assignObjective(s: GameState, pid: PlayerId, taken: Set<ObjectiveType>): SecretObjective {
  const rng = createRng(`${s.seed}:obj:${pid}`);
  const options = OBJECTIVES.filter((o) => !taken.has(o.type) || taken.size >= OBJECTIVES.length);
  const def = rng.pick(options.length ? options : OBJECTIVES);
  taken.add(def.type);
  const params: Record<string, number | string> = {};
  if (def.type === 'mines') params.count = 3;
  if (def.type === 'alliances') params.count = 2;
  if (def.type === 'gold') params.amount = 350;
  if (def.type === 'stability') { params.final = 70; params.floor = 40; params.minSeen = 100; }
  if (def.type === 'merchant') params.count = 4;
  if (def.type === 'scholar') params.count = 5;
  if (def.type === 'defeat_stronger') params.progress = 0;
  if (def.type === 'region') {
    const home = s.map.territories[s.players[pid].capitalId].regionId;
    const regs = s.map.regions.filter((r) => r.id !== home && r.territoryIds.length >= 4);
    params.regionId = rng.pick(regs.length ? regs : s.map.regions).id;
  }
  const o: SecretObjective = { id: `obj-${pid}`, type: def.type, title: def.title(params, s), description: def.description(params, s), params, completed: false };
  return o;
}

export interface ObjectiveProgress { current: number; target: number; done: boolean; label: string }

export function objectiveProgress(s: GameState, pid: PlayerId): ObjectiveProgress {
  const p = s.players[pid];
  const o = p.objective;
  const mine = playerTerritories(s, pid);
  switch (o.type) {
    case 'mines': { const n = mine.filter((t) => t.building === 'mine').length; return { current: n, target: o.params.count as number, done: n >= (o.params.count as number), label: `${n}/${o.params.count} rudnika` }; }
    case 'capture_capital': { const n = p.stats.capitalsCaptured; return { current: n, target: 1, done: n >= 1, label: n ? 'Glavni grad osvojen' : 'Još nije osvojen' }; }
    case 'alliances': {
      const n = s.alliances.filter((a) => a.status === 'active' && a.kind === 'alliance' && (a.a === pid || a.b === pid)).length;
      return { current: n, target: o.params.count as number, done: n >= (o.params.count as number), label: `${n}/${o.params.count} saveza` };
    }
    case 'region': {
      const r = s.map.regions.find((x) => x.id === o.params.regionId)!;
      const n = r.territoryIds.filter((id) => s.map.territories[id].owner === pid || (s.map.territories[id].owner && isAllied(s, pid, s.map.territories[id].owner!) && false)).length;
      const need = Math.floor(r.territoryIds.length * s.config.scoring.regionControlShare) + 1;
      return { current: n, target: need, done: n >= need, label: `${n}/${need} teritorija` };
    }
    case 'gold': return { current: Math.floor(p.resources.gold), target: o.params.amount as number, done: p.resources.gold >= (o.params.amount as number), label: `${Math.floor(p.resources.gold)}/${o.params.amount} zlata` };
    case 'defeat_stronger': { const d = (o.params.progress as number) >= 1; return { current: d ? 1 : 0, target: 1, done: d, label: d ? 'Ostvareno' : 'Još nije ostvareno' }; }
    case 'stability': {
      const ok = p.stability >= (o.params.final as number) && (o.params.minSeen as number) >= (o.params.floor as number);
      return { current: Math.round(p.stability), target: o.params.final as number, done: ok, label: `Stabilnost ${Math.round(p.stability)} (najniže ${Math.round(o.params.minSeen as number)})` };
    }
    case 'merchant': return { current: p.stats.tradesDone, target: o.params.count as number, done: p.stats.tradesDone >= (o.params.count as number), label: `${p.stats.tradesDone}/${o.params.count} razmjena` };
    case 'scholar': return { current: p.techs.length, target: o.params.count as number, done: p.techs.length >= (o.params.count as number), label: `${p.techs.length}/${o.params.count} tehnologija` };
  }
}
