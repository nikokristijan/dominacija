/**
 * Pogled igrača: jedina funkcija koja iz omniscijentnog stanja izdvaja ono što igrač smije znati.
 * Sve što napusti server prema klijentu prolazi kroz ovu funkciju (nema skrivenih naredbi, tuđih ciljeva ni točnih udaljenih vojski).
 */
import { forecastEconomy, territoryProduction, type EconomyForecast, type TerritoryProduction } from './economy';
import { estimateGarrison, visibilityOf, type GarrisonEstimate, type Visibility } from './intel';
import { objectiveProgress, type ObjectiveProgress } from './objectives';
import { availableResources, cpAvailable, cpUsed, tradeCap } from './orders';
import { publicScore, ranking, computeScore } from './scoring';
import type {
  Alliance, BattleReport, BuildingType, ConditionalOrder, DailyReport, DiplomaticOffer, FactionId, GameState, IntelReport, Message, Order, PlayerId, PlayerState, Region,
  Reputation, Resources, TerrainType, TerritoryEffect, TerritoryId, Units, WorldEvent, ResourceType, ScoreBreakdown,
} from './types';
import { botPersonality, PERSONA_LABEL } from './ai';
import { dilemmaFor, describeEffects } from './dilemmas';
import { activeAlliance, computeSupply, playerTerritories, unitTotal } from './util';

export interface TerritoryView {
  id: TerritoryId; name: string; col: number; row: number; terrain: TerrainType; resource: ResourceType | null; owner: PlayerId | null; visibility: Visibility;
  isCapital: boolean; capitalOf: PlayerId | null; regionId: string; importance: number;
  building?: BuildingType | null; buildingLevel?: number; construction?: { building: BuildingType; level: number; completesRound: number } | null;
  defenseLevel?: number; garrison?: Units; armyEstimate?: GarrisonEstimate; population?: number; stability?: number;
  production?: TerritoryProduction; supplied?: boolean; effects?: TerritoryEffect[]; siegeProgress?: number;
  /** Kamp je javan mamac (vidi se na karti i bez obavještajnih podataka). */
  camp?: { name: string; reward: Partial<Resources> } | null;
}
export interface PublicPlayer {
  id: PlayerId; name: string; faction: FactionId; isBot: boolean; status: PlayerState['status']; score: number; territoryCount: number; cityCount: number;
  capitalId: TerritoryId; reputation: Pick<Reputation, 'score' | 'brokenTreaties' | 'keptTreaties' | 'betrayals' | 'tradeCount' | 'supportsGiven'>;
  relation: 'self' | 'ally' | 'pact' | 'neutral'; autopilot: boolean;
  /** Je li igrač označio „spremno” (javno: društveni pritisak, ne otkriva naredbe). */
  ready: boolean;
  /** Karakter bota (ratoboran/graditelj/diplomat) — vidljiv jer su botovi jasno označeni. */
  persona?: string;
  /** Koliko ti taj igrač zamjera (dug osvete prema tebi, 0..5) — javno jer se vidi iz poruka i ponašanja. */
  grudge: number;
  resources?: undefined;
}
export interface PlayerView {
  campaignId: string; seed?: undefined; round: number; totalRounds: number; phase: GameState['phase']; config: GameState['config'];
  me: PlayerState & { objectiveProgress: ObjectiveProgress };
  cp: { used: number; available: number }; availableResources: Resources; forecast: EconomyForecast; tradeCap: number;
  players: Record<PlayerId, PublicPlayer>; playerOrder: PlayerId[];
  map: { width: number; height: number; regions: Region[]; order: TerritoryId[] };
  territories: Record<TerritoryId, TerritoryView>;
  orders: Order[]; conditionalOrders: ConditionalOrder[]; offers: DiplomaticOffer[]; alliances: Alliance[]; messages: Message[]; intel: IntelReport[];
  events: WorldEvent[]; battles: BattleReport[]; reports: DailyReport[];
  ranking: Array<{ playerId: PlayerId; score: number; territories: number; cities: number }>;
  history: GameState['history'];
  final?: { winnerId: PlayerId | null; scores: ScoreBreakdown[] };
  recentEntries: GameState['reportEntries'];
  scoreBreakdownMine: ScoreBreakdown;
  /** Podnevno razrješenje za današnju rundu već je odrađeno. */
  middayDone: boolean;
  /** Današnja dilema (samo vlastita, samo u fazi planiranja). */
  dilemma: { id: string; title: string; text: string; a: { label: string; hint: string }; b: { label: string; hint: string }; chosen: 'a' | 'b' | null; result?: string } | null;
}

function dilemmaView(s: GameState, pid: PlayerId): PlayerView['dilemma'] {
  if (s.phase !== 'planning') return null;
  const d = dilemmaFor(s, pid, s.round);
  const chosen = s.players[pid].dilemmas?.[s.round] ?? null;
  return { id: d.id, title: d.title, text: d.text, a: { label: d.a.label, hint: describeEffects(d.a.effects) }, b: { label: d.b.label, hint: describeEffects(d.b.effects) }, chosen, result: chosen ? (chosen === 'a' ? d.a : d.b).result : undefined };
}

export function getPlayerView(s: GameState, pid: PlayerId): PlayerView {
  const me = s.players[pid];
  const sup = computeSupply(s, pid);
  const territories: Record<TerritoryId, TerritoryView> = {};
  for (const id of s.map.order) {
    const t = s.map.territories[id];
    const vis = visibilityOf(s, pid, t);
    const v: TerritoryView = {
      id, name: t.name, col: t.col, row: t.row, terrain: t.terrain, resource: t.resource, owner: t.owner, visibility: vis,
      isCapital: t.isCapital, capitalOf: t.capitalOf, regionId: t.regionId, importance: t.importance,
      camp: t.camp && !t.owner ? { name: t.camp.name, reward: t.camp.reward } : null,
    };
    if (t.terrain !== 'water') {
      if (vis === 'own') {
        Object.assign(v, {
          building: t.building, buildingLevel: t.buildingLevel, construction: t.construction, defenseLevel: t.defenseLevel, garrison: t.garrison,
          population: t.population, stability: Math.round(t.stability), production: territoryProduction(s, t, sup), supplied: sup.has(t.id) || me.status === 'resistance',
          effects: t.effects, siegeProgress: t.siegeProgress,
        });
      } else {
        if (vis === 'near') { v.building = t.building; v.defenseLevel = t.defenseLevel; }
        v.armyEstimate = estimateGarrison(s, pid, t);
      }
    }
    territories[id] = v;
  }
  const players: Record<PlayerId, PublicPlayer> = {};
  for (const id of s.playerOrder) {
    const p = s.players[id];
    const al = id === pid ? undefined : activeAlliance(s, pid, id);
    const visibleAl = al && (!al.secret || al.a === pid || al.b === pid);
    players[id] = {
      id, name: p.name, faction: p.faction, isBot: p.isBot, status: p.status, score: publicScore(s, id),
      territoryCount: playerTerritories(s, id).length, cityCount: playerTerritories(s, id).filter((t) => t.isCapital || t.building === 'city').length,
      capitalId: p.capitalId,
      reputation: { score: p.reputation.score, brokenTreaties: p.reputation.brokenTreaties, keptTreaties: p.reputation.keptTreaties, betrayals: p.reputation.betrayals, tradeCount: p.reputation.tradeCount, supportsGiven: p.reputation.supportsGiven },
      relation: id === pid ? 'self' : visibleAl ? (al!.kind === 'alliance' ? 'ally' : 'pact') : 'neutral', autopilot: p.autopilot, ready: p.ready, persona: p.isBot ? PERSONA_LABEL[botPersonality(s, id)] : undefined, grudge: id === pid ? 0 : p.grudges?.[pid] ?? 0,
    };
  }
  const mine = (a: PlayerId, b: PlayerId) => a === pid || b === pid;
  const rk = ranking(s).map((x) => ({ playerId: x.playerId, score: publicScore(s, x.playerId), territories: x.territoryCount, cities: x.cityCount }))
    .sort((a, b) => b.score - a.score || b.territories - a.territories);
  const completed = s.phase === 'completed';
  const { objective: _o, ...meRest } = me;
  void _o; void meRest;
  const view: PlayerView = {
    campaignId: s.campaignId, round: s.round, totalRounds: s.totalRounds, phase: s.phase, config: s.config,
    me: { ...structuredClone(me), objectiveProgress: objectiveProgress(s, pid) },
    cp: { used: cpUsed(s, pid), available: cpAvailable(s, me) }, availableResources: availableResources(s, pid), forecast: forecastEconomy(s, pid), tradeCap: tradeCap(s, me),
    players, playerOrder: s.playerOrder, map: { width: s.map.width, height: s.map.height, regions: s.map.regions, order: s.map.order }, territories,
    orders: s.orders.filter((o) => o.playerId === pid), conditionalOrders: s.conditionalOrders.filter((c) => c.playerId === pid),
    offers: s.offers.filter((o) => mine(o.from, o.to)), alliances: s.alliances.filter((a) => !a.secret || mine(a.a, a.b)),
    messages: s.messages.filter((m) => mine(m.from, m.to)), intel: s.intel.filter((r) => r.owner === pid),
    events: s.events.filter((e) => e.announced), battles: s.battles.filter((b) => b.visibleTo.includes(pid)),
    reports: Object.values(s.reports).filter((r) => r.playerId === pid).sort((a, b) => a.round - b.round),
    ranking: rk, history: s.history.map((h) => ({ ...h })), recentEntries: [],
    scoreBreakdownMine: computeScore(s, pid),
    dilemma: dilemmaView(s, pid), middayDone: s.middayDone === s.round,
  };
  if (completed) view.final = { winnerId: s.winnerId, scores: ranking(s) };
  return view;
}
