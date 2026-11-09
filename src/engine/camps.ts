/**
 * Razbojnički kameni tabori: neutralni teritoriji s jačom stražom i plijenom. Daju razlog za rano kretanje vojske
 * (prvi dan više nije prazan) i rizik/nagradu odluku. Raspored je deterministički iz sjemena kampanje.
 */
import { createRng } from './rng';
import { offsetDistance } from './hex';
import type { GameState, Resources, Territory } from './types';

export interface Camp { kind: 'treasury' | 'armory' | 'storehouse' | 'shrine'; name: string; reward: Partial<Resources> }
export const CAMP_KIND: Record<Camp['kind'], { name: string; mk: (s: number) => Partial<Resources> }> = {
  treasury: { name: 'Blago razbojnika', mk: (s) => ({ gold: 60 + s * 14 }) },
  armory: { name: 'Oružarnica razbojnika', mk: (s) => ({ iron: 28 + s * 7, gold: 25 + s * 5 }) },
  storehouse: { name: 'Skladište razbojnika', mk: (s) => ({ food: 40 + s * 8, wood: 28 + s * 6 }) },
  shrine: { name: 'Zaboravljeno svetište', mk: (s) => ({ influence: 8 + s * 2, gold: 30 + s * 6 }) },
};

const LBL: Record<string, string> = { gold: 'zlata', food: 'hrane', iron: 'željeza', wood: 'drva', influence: 'utjecaja' };
export const rewardText = (r: Partial<Resources>) => (Object.entries(r) as Array<[string, number]>).filter(([, n]) => n > 0).map(([k, n]) => `${n} ${LBL[k]}`).join(', ');

/** Postavlja 4–8 tabora na neutralna kopnena polja udaljena od glavnih gradova; garnizon se pojačava prema nagradi. */
export function placeCamps(s: GameState): void {
  const rng = createRng(`${s.seed}:camps`);
  const land = Object.values(s.map.territories).filter((t) => t.terrain !== 'water' && !t.owner && !t.isCapital);
  const caps = Object.values(s.players).map((p) => s.map.territories[p.capitalId]);
  const dCap = (t: Territory) => Math.min(...caps.map((c) => offsetDistance(c, t)));
  const target = Math.max(4, Math.min(8, Math.round(land.length / 16)));
  const pool = rng.shuffle(land.filter((t) => dCap(t) >= 3 && dCap(t) <= 7));
  const chosen: Territory[] = [];
  for (const t of pool) {
    if (chosen.length >= target) break;
    if (chosen.every((c) => offsetDistance(c, t) >= 4)) chosen.push(t);
  }
  const kinds = Object.keys(CAMP_KIND) as Camp['kind'][];
  chosen.forEach((t, i) => {
    const strength = Math.min(5, Math.max(1, dCap(t) - 2)); // dalji = bogatiji i jače čuvan
    const kind = kinds[(i + Math.floor(rng.next() * kinds.length)) % kinds.length];
    t.camp = { kind, name: CAMP_KIND[kind].name, reward: CAMP_KIND[kind].mk(strength) };
    t.garrison = { ...t.garrison, infantry: (t.garrison.infantry ?? 0) + 2 + strength, archers: (t.garrison.archers ?? 0) + 1 + Math.floor(strength / 2) };
  });
}
