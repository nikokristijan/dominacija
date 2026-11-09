import type { PlayerView } from '@/engine/view';
import type { MapArrow } from '@/components/game/HexMap';

export interface ReplayStep {
  id: string; territoryId: string; arrows: MapArrow[];
  march: { title: string; sub: string }; result: { title: string; sub: string };
  tone: 'good' | 'bad' | 'neutral';
}

/** Koraci ponavljanja prošle runde: vlastite i vidljive bitke (sa strelicama), a uz njih i javne vijesti o osvajanjima. */
export function buildReplay(v: PlayerView, round: number): ReplayStep[] {
  const out: ReplayStep[] = [];
  const nm = (id: string | null | undefined) => (id ? v.players[id]?.name ?? 'Nepoznat' : 'Neutralni');
  const seen = new Set<string>();
  for (const b of v.battles.filter((x) => x.round === round)) {
    const won = b.outcome === 'attacker_victory';
    const mineAtt = b.attackers.some((a) => a.playerId === v.me.id), mineDef = b.defenderId === v.me.id;
    const att = nm(b.attackers[0]?.playerId);
    seen.add(b.territoryId);
    out.push({
      id: b.id, territoryId: b.territoryId, arrows: b.attackers.map((a) => ({ from: a.fromId, to: b.territoryId, kind: 'attack' as const })),
      march: { title: `${att} napada ${b.territoryName}`, sub: `Branitelj: ${nm(b.defenderId)}` },
      result: { title: won ? `${b.territoryName} pada!` : `${b.territoryName} drži!`, sub: won ? `${att} osvaja teritorij od: ${nm(b.defenderId)}.` : `${att} je odbijen.` },
      tone: (won && mineAtt) || (!won && mineDef) ? 'good' : (won && mineDef) || (!won && mineAtt) ? 'bad' : 'neutral',
    });
  }
  const rep = v.reports.find((r) => r.round === round);
  for (const e of rep?.entries ?? []) {
    const tid = e.refs?.territoryId;
    if (!tid || e.refs?.battleId || seen.has(tid) || !v.territories[tid] || (e.category !== 'military' && e.category !== 'territory')) continue;
    seen.add(tid);
    out.push({ id: e.id, territoryId: tid, arrows: [], march: { title: 'Glasnici donose vijesti', sub: v.territories[tid].name }, result: { title: v.territories[tid].name, sub: e.text }, tone: e.severity === 'bad' ? 'bad' : 'neutral' });
  }
  return out.slice(0, 8);
}
