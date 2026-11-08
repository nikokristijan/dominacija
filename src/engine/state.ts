/** Stvaranje početnog stanja kampanje (pošteni početni uvjeti za sve igrače). */
import { FACTION_IDS, FACTIONS, mergeConfig, type DeepPartial, type GameConfig } from './config';
import { generateEventSchedule, announceEvent } from './events';
import { generateMap } from './mapgen';
import { assignObjective } from './objectives';
import { createRng } from './rng';
import { computeAllScores } from './scoring';
import type { FactionId, GameState, ObjectiveType, PlayerId, PlayerState } from './types';
import { cloneRes } from './util';

export interface NewPlayer { id: PlayerId; userId: string | null; name: string; faction?: FactionId; isBot?: boolean }

export function createCampaignState(opts: { campaignId: string; seed: string; players: NewPlayer[]; config?: DeepPartial<GameConfig> }): GameState {
  const cfg = mergeConfig(opts.config);
  const n = opts.players.length;
  if (n < cfg.campaign.minPlayers || n > cfg.campaign.maxPlayers) throw new Error(`Kampanja zahtijeva ${cfg.campaign.minPlayers}–${cfg.campaign.maxPlayers} igrača.`);
  const { map, capitals, starters } = generateMap(opts.seed, n, cfg);
  const rng = createRng(`${opts.seed}:assign`);
  // Dodjela frakcija: tražene prve, ostalo nasumično bez ponavljanja
  const taken = new Set<FactionId>();
  const factions: FactionId[] = [];
  for (const p of opts.players) {
    if (p.faction && !taken.has(p.faction)) { taken.add(p.faction); factions.push(p.faction); } else factions.push(null as unknown as FactionId);
  }
  const free = rng.shuffle(FACTION_IDS.filter((f) => !taken.has(f)));
  for (let i = 0; i < factions.length; i++) if (!factions[i]) factions[i] = free.shift()!;
  // Raspored pozicija nasumičan (ali determinističan)
  const slotOrder = rng.shuffle(capitals.map((_, i) => i));

  const players: Record<PlayerId, PlayerState> = {};
  const now = new Date(0).toISOString();
  opts.players.forEach((np, i) => {
    const capId = capitals[slotOrder[i]];
    const faction = factions[i];
    const cap = map.territories[capId];
    cap.owner = np.id; cap.building = 'capital'; cap.buildingLevel = 1; cap.isCapital = true; cap.capitalOf = np.id;
    cap.name = FACTIONS[faction].capitalName; cap.population = cfg.start.capitalPopulation; cap.stability = cfg.start.stability;
    cap.defenseLevel = 1; cap.garrison = { ...cfg.start.garrison[0] }; cap.importance = 5;
    const [n1, n2] = starters[capId];
    const t1 = map.territories[n1], t2 = map.territories[n2];
    t1.owner = np.id; t1.building = 'farm'; t1.buildingLevel = 1; t1.population = cfg.start.neighborPopulation; t1.stability = cfg.start.stability; t1.garrison = { ...cfg.start.garrison[1] }; t1.defenseLevel = 0;
    t2.owner = np.id; t2.population = cfg.start.neighborPopulation; t2.stability = cfg.start.stability; t2.garrison = { ...cfg.start.garrison[2] }; t2.defenseLevel = 1;
    players[np.id] = {
      id: np.id, userId: np.userId, name: np.name, faction, isBot: !!np.isBot, status: 'active',
      resources: cloneRes(cfg.start.resources), stability: cfg.start.stability, tax: 'normal', techs: [], capitalId: capId,
      pendingRecruits: [],
      reputation: { score: cfg.diplomacy.reputation.start, brokenTreaties: 0, keptTreaties: 0, betrayals: 0, tradeCount: 0, supportsGiven: 0 },
      stats: { attacksLaunched: 0, battlesWon: 0, battlesLost: 0, defensesWon: 0, territoriesCaptured: 0, territoriesLost: 0, capitalsCaptured: 0, unitsLost: 0, unitsKilled: 0, spiesCaught: 0, researchDone: 0, tradesDone: 0, peakTerritories: 3 },
      objective: undefined as never, ready: false, submittedOnce: false, missedRounds: 0, autopilot: false, rebellionWarned: false,
      disinfo: null, counterIntelUntil: 0, resistance: null, achievements: [], lastIncome: cloneRes({}), joinedAt: now,
    };
  });

  const state: GameState = {
    campaignId: opts.campaignId, seed: opts.seed, config: cfg, round: 1, totalRounds: cfg.campaign.days, phase: 'planning',
    map, players, playerOrder: opts.players.map((p) => p.id), orders: [], conditionalOrders: [], offers: [], alliances: [], messages: [], intel: [],
    events: generateEventSchedule(opts.seed, cfg, map), battles: [], reportEntries: [], reports: {}, notificationsOut: [], scores: {},
    resolvedRounds: [], idCounter: 0, winnerId: null, history: [],
  };
  const takenObj = new Set<ObjectiveType>();
  for (const id of state.playerOrder) players[id].objective = assignObjective(state, id, takenObj);
  announceEvent(state, 1);
  state.scores = computeAllScores(state);
  state.history.push({
    round: 0, scores: Object.fromEntries(state.playerOrder.map((id) => [id, state.scores[id].total - state.scores[id].objective])),
    territories: Object.fromEntries(state.playerOrder.map((id) => [id, state.scores[id].territoryCount])),
  });
  return state;
}
