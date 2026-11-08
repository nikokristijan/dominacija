/** Svjetski događaji: deterministički raspored za cijelu kampanju, objava na početku svake runde. */
import type { GameConfig } from './config';
import { createRng } from './rng';
import type { GameMap, GameState, WorldEvent, WorldEventType } from './types';

interface EventDef { type: WorldEventType; title: string; description: string; effects: string[]; scope: WorldEvent['scope'] }

export const EVENT_DEFS: Record<WorldEventType, EventDef> = {
  none: { type: 'none', title: 'Miran dan', description: 'Nema posebnih događaja. Savršeno vrijeme za planiranje.', effects: [], scope: 'global' },
  drought: { type: 'drought', title: 'Suša', description: 'Dugotrajna suša pogađa jednu regiju.', effects: ['Hrana −40% u pogođenoj regiji'], scope: 'region' },
  gold_rush: { type: 'gold_rush', title: 'Zlatna groznica', description: 'U jednoj regiji pronađene su nove žile zlata.', effects: ['Zlato +30% u pogođenoj regiji'], scope: 'region' },
  plague: { type: 'plague', title: 'Kuga', description: 'Bolest se širi gradovima.', effects: ['Stanovništvo −18% u 3 grada', 'Stabilnost pada u pogođenim gradovima'], scope: 'territories' },
  rebellion: { type: 'rebellion', title: 'Nemiri u narodu', description: 'Pobunjenički govornici podižu narod protiv visokih poreza.', effects: ['Stabilnost −8 za kraljevstva s visokim porezima'], scope: 'global' },
  trade_boom: { type: 'trade_boom', title: 'Trgovački procvat', description: 'Karavane preplavljuju tržnice.', effects: ['Trgovinski tečaj +15%', 'Kapacitet trgovine +50%'], scope: 'global' },
  winter: { type: 'winter', title: 'Oštra zima', description: 'Snijeg i mraz otežavaju opskrbu.', effects: ['Opskrba vojske +50%', 'Potrošnja hrane +20%'], scope: 'global' },
  storm: { type: 'storm', title: 'Oluja', description: 'Oluja otežava pokrete vojski.', effects: ['Napadi −5% snage', 'Opskrba +30%'], scope: 'global' },
  harvest: { type: 'harvest', title: 'Bogata žetva', description: 'Polja su puna, narod slavi.', effects: ['Hrana +30%', 'Stabilnost +3'], scope: 'global' },
};

export function generateEventSchedule(seed: string, cfg: GameConfig, map: GameMap): WorldEvent[] {
  const rng = createRng(`${seed}:events`);
  const pool: WorldEventType[] = ['drought', 'gold_rush', 'plague', 'rebellion', 'trade_boom', 'winter', 'storm', 'harvest'];
  const events: WorldEvent[] = [];
  let last: WorldEventType = 'none';
  const bag: WorldEventType[] = [];
  for (let round = 1; round <= cfg.campaign.days; round++) {
    let type: WorldEventType = 'none';
    if (round > 1 && !(round > 2 && rng.next() < 0.12)) {
      if (!bag.length) bag.push(...rng.shuffle(pool));
      type = bag.shift()!;
      if (type === last) { bag.push(type); type = bag.shift()!; }
    }
    last = type;
    const def = EVENT_DEFS[type];
    const ev: WorldEvent = { id: `ev${round}`, round, type, title: def.title, description: def.description, effects: def.effects, scope: def.scope, announced: round === 1 };
    if (def.scope === 'region') ev.regionId = rng.pick(map.regions).id;
    events.push(ev);
  }
  return events;
}

/** Dovršava događaj kad se objavljuje (npr. kuga bira gradove prema trenutnom stanju). */
export function announceEvent(s: GameState, round: number) {
  const ev = s.events.find((e) => e.round === round);
  if (!ev) return;
  ev.announced = true;
  if (ev.type === 'plague') {
    const cities = s.map.order.map((i) => s.map.territories[i]).filter((t) => t.owner && (t.building === 'city' || t.building === 'capital'));
    const rng = createRng(`${s.seed}:plague:${round}`);
    const chosen = rng.shuffle(cities).slice(0, s.config.events.plague.cities);
    ev.territoryIds = chosen.map((t) => t.id);
    ev.effects = [`Stanovništvo −${Math.round(s.config.population.plagueLoss * 100)}% u: ${chosen.map((t) => t.name).join(', ') || 'nijedan grad nije pogođen'}`, 'Stabilnost pada u pogođenim gradovima'];
  }
  if (ev.scope === 'region' && ev.regionId) {
    const r = s.map.regions.find((x) => x.id === ev.regionId);
    if (r) ev.description = `${ev.description} Pogođena regija: ${r.name}.`;
  }
}
