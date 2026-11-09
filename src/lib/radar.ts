import type { PlayerView } from '@/engine/view';
import { unitTotal } from '@/engine/util';
import { rewardText } from '@/engine/camps';

export interface RadarHit { id: string; kind: 'threat' | 'chance'; title: string; text: string; ratio: number }

const EVEN = [[1, 0], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1]];
const ODD = [[1, 0], [1, 1], [0, 1], [-1, 0], [0, -1], [1, -1]];
const nbrs = (v: PlayerView, id: string) => { const t = v.territories[id]; return (t.row % 2 === 0 ? EVEN : ODD).map(([c, r]) => v.territories[`h${t.col + c}_${t.row + r}`]).filter(Boolean); };
const estimate = (t: PlayerView['territories'][string]): number | null => {
  const e = t.armyEstimate; if (!e) return null;
  if (e.exact) return unitTotal(e.exact);
  if (e.range) return (e.range.min + e.range.max) / 2;
  return null;
};

/** Radar prijetnji i prilika — isključivo iz procjena koje igrač ionako vidi (magla rata ostaje). */
export function radar(v: PlayerView): RadarHit[] {
  if (v.phase !== 'planning' || v.me.status === 'resistance') return [];
  const out: RadarHit[] = [];
  const hostile = (t: PlayerView['territories'][string]) => !!t.owner && t.owner !== v.me.id && v.players[t.owner]?.relation !== 'ally' && v.players[t.owner]?.relation !== 'pact';
  const mine = Object.values(v.territories).filter((t) => t.owner === v.me.id);
  for (const t of mine) {
    const own = unitTotal(t.garrison ?? {});
    const foes: Array<{ name: string; owner: string; est: number; grudge: number }> = [];
    for (const n of nbrs(v, t.id)) {
      if (!hostile(n) || n.terrain === 'water') continue;
      const e = estimate(n); if (e === null) continue;
      foes.push({ name: n.name, owner: v.players[n.owner!].name, est: e, grudge: v.players[n.owner!].grudge ?? 0 });
    }
    foes.sort((a, b) => b.est - a.est);
    const worst = foes[0];
    if (worst && worst.est >= Math.max(3, own * 0.8)) {
      const list = foes.slice(0, 3).map((f) => `${f.owner} kod ${f.name} ≈${Math.round(f.est)}${f.grudge > 0 ? ' (zamjera ti)' : ''}`).join('; ');
      out.push({ id: t.id, kind: 'threat', title: `Prijetnja: ${t.name}`, text: `Uz granicu: ${list}. Tvoja straža: ${own}.`, ratio: worst.est / Math.max(1, own) });
    }
  }
  const chance = new Map<string, RadarHit>();
  for (const t of Object.values(v.territories)) {
    if (t.owner === v.me.id || t.terrain === 'water') continue;
    const e = estimate(t); if (e === null) continue;
    const near = nbrs(v, t.id).filter((n) => n.owner === v.me.id);
    if (!near.length) continue;
    const best = Math.max(...near.map((n) => unitTotal(n.garrison ?? {})));
    if (t.camp && best >= 5 && e * 1.15 <= best) {
      chance.set(t.id, { id: t.id, kind: 'chance', title: `Kamp s plijenom: ${t.name}`, text: `${t.camp.name} (plijen: ${rewardText(t.camp.reward)}). Straža ~${Math.round(e)}, a ti kraj njega imaš ${best}.`, ratio: best / Math.max(1, e) + 1 });
    } else if (best >= 4 && e * 1.6 <= best) {
      const who = t.owner ? v.players[t.owner]?.name ?? 'Protivnik' : 'neutralni';
      chance.set(t.id, { id: t.id, kind: 'chance', title: `Prilika: ${t.name}`, text: `Slabo branjen (~${Math.round(e)}), a ti kraj njega imaš ${best}. (${who})`, ratio: best / Math.max(1, e) });
    }
  }
  out.push(...chance.values());
  return out.sort((a, b) => (a.kind === b.kind ? b.ratio - a.ratio : a.kind === 'threat' ? -1 : 1));
}
