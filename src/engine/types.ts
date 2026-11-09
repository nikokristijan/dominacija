/** Temeljni tipovi igrinog engine-a. Engine ne ovisi o UI-ju ni o bazi. */
import type { GameConfig } from './config';

export type ResourceType = 'gold' | 'food' | 'iron' | 'wood' | 'influence';
export type Resources = Record<ResourceType, number>;
export type TerrainType = 'plains' | 'forest' | 'mountains' | 'desert' | 'water' | 'special';
export type UnitType = 'infantry' | 'archers' | 'spearmen' | 'knights' | 'cavalry' | 'siege';
export type Units = Partial<Record<UnitType, number>>;
export type BuildingType = 'capital' | 'farm' | 'mine' | 'city' | 'fortress' | 'barracks' | 'market' | 'research_center';
export type FactionId = 'red' | 'blue' | 'purple' | 'green' | 'yellow' | 'turquoise' | 'pink' | 'grey';
export type TaxLevel = 'low' | 'normal' | 'high';
export type AttackStrategy = 'direct' | 'ambush' | 'encirclement' | 'diversion' | 'siege';
export type Formation = 'line' | 'wedge' | 'phalanx' | 'skirmish';
export type RiskPref = 'cautious' | 'balanced' | 'bold';
export type SupplyLevel = 'minimal' | 'standard' | 'generous';
export type PlayerId = string;
export type TerritoryId = string;
export type Mood = 'neutral' | 'happy' | 'celebrating' | 'angry' | 'thinking' | 'surprised' | 'defeated' | 'confident';

export type CampaignPhase = 'waiting' | 'preparation' | 'planning' | 'locked' | 'resolution' | 'report' | 'completed';

// ───────────────────────── Karta ─────────────────────────
export interface Territory {
  id: TerritoryId;
  name: string;
  col: number; row: number; // offset koordinate (odd-r)
  q: number; r: number; // aksijalne koordinate
  terrain: TerrainType;
  /** Prirodno nalazište — pojačava odgovarajuću zgradu. */
  resource: ResourceType | null;
  owner: PlayerId | null;
  building: BuildingType | null;
  buildingLevel: number;
  construction: { building: BuildingType; level: number; completesRound: number } | null;
  defenseLevel: number;
  garrison: Units;
  population: number;
  stability: number;
  importance: number; // 1–5
  regionId: string;
  isCapital: boolean;
  /** Originalni vlasnik glavnog grada (za Otpor i bodove). */
  capitalOf: PlayerId | null;
  siegeProgress: number;
  siegeBy: PlayerId | null;
  isolatedDays: number;
  /** Privremeni učinci (sabotaža, utvrđivanje): vrijede do kraja navedene runde. */
  effects: TerritoryEffect[];
  /** Razbojnički kamp (neutralni): jača straža + plijen pri razbijanju. */
  camp?: { kind: 'treasury' | 'armory' | 'storehouse' | 'shrine'; name: string; reward: Partial<Resources> } | null;
}
export interface TerritoryEffect { kind: 'sabotaged_production' | 'entrenched' | 'plague'; untilRound: number; by?: PlayerId }

export interface Region { id: string; name: string; territoryIds: TerritoryId[]; color: string }
export interface GameMap { width: number; height: number; territories: Record<TerritoryId, Territory>; regions: Region[]; order: TerritoryId[] }

// ───────────────────────── Igrač ─────────────────────────
export interface Reputation {
  score: number; brokenTreaties: number; keptTreaties: number; betrayals: number; tradeCount: number; supportsGiven: number;
}
export interface PlayerStats {
  attacksLaunched: number; battlesWon: number; battlesLost: number; defensesWon: number; territoriesCaptured: number; territoriesLost: number;
  capitalsCaptured: number; unitsLost: number; unitsKilled: number; spiesCaught: number; researchDone: number; tradesDone: number;
  peakTerritories: number;
}
export interface PendingRecruit { territoryId: TerritoryId; unit: UnitType; count: number; arrivesRound: number }
export type PlayerStatus = 'active' | 'resistance';

export interface PlayerState {
  id: PlayerId;
  userId: string | null;
  name: string;
  faction: FactionId;
  isBot: boolean;
  status: PlayerStatus;
  resources: Resources;
  stability: number;
  tax: TaxLevel;
  techs: string[];
  capitalId: TerritoryId;
  pendingRecruits: PendingRecruit[];
  reputation: Reputation;
  stats: PlayerStats;
  objective: SecretObjective;
  ready: boolean; // zaključao naredbe
  submittedOnce: boolean;
  missedRounds: number;
  autopilot: boolean;
  rebellionWarned: boolean;
  disinfo: { untilRound: number; skew: number } | null;
  counterIntelUntil: number;
  resistance: { since: number; partisanUsedRound: number; emergencyUsedRound: number; formerTerritories: TerritoryId[] } | null;
  achievements: string[];
  /** Rezervirani resursi zbog predanih naredbi računaju se izvedeno. */
  lastIncome: Resources;
  joinedAt: string;
  /** Odabiri dnevnih dilema po rundi. */
  dilemmas: Record<number, 'a' | 'b'>;
  /** Dugovi osvete: koliko ti je koji igrač „dužan” (0..5). Uzvrat napada daje bonus dok se dug ne naplati. */
  grudges: Record<PlayerId, number>;
}

export interface SecretObjective {
  id: string;
  type: ObjectiveType;
  title: string;
  description: string;
  params: Record<string, number | string>;
  completed: boolean;
}
export type ObjectiveType = 'mines' | 'capture_capital' | 'alliances' | 'region' | 'gold' | 'defeat_stronger' | 'stability' | 'merchant' | 'scholar' | 'traitor';

// ───────────────────────── Naredbe ─────────────────────────
export type OrderType = 'recruit' | 'trade' | 'build' | 'defend' | 'espionage' | 'diplomacy' | 'attack' | 'sabotage' | 'research' | 'resistance';
export type EspionageAction = 'army' | 'resources' | 'buildings' | 'preparations' | 'routes' | 'false_info' | 'counter';
export type SabotageKind = 'production' | 'stability' | 'fortification';
export type DefendStance = 'entrench' | 'fortify' | 'reinforce';
export type DiplomacyKind = 'alliance' | 'nap' | 'trade' | 'support' | 'swap' | 'joint_attack' | 'annex' | 'improve';

export interface OrderParamsMap {
  recruit: { territoryId: TerritoryId; unit: UnitType; count: number };
  trade: { give: ResourceType; receive: ResourceType; amount: number };
  build: { territoryId: TerritoryId; building: BuildingType };
  defend: { territoryId: TerritoryId; stance: DefendStance; fromTerritoryId?: TerritoryId; units?: Units };
  espionage: { action: EspionageAction; targetPlayerId?: PlayerId; targetTerritoryId?: TerritoryId };
  diplomacy: {
    kind: DiplomacyKind; targetPlayerId?: PlayerId; targetTerritoryId?: TerritoryId; secret?: boolean;
    terms?: { give?: Partial<Resources>; receive?: Partial<Resources>; units?: Units; fromTerritoryId?: TerritoryId; toTerritoryId?: TerritoryId; swapMine?: TerritoryId; swapTheirs?: TerritoryId; attackTarget?: TerritoryId; durationRounds?: number; message?: string };
  };
  attack: {
    fromId: TerritoryId; targetId: TerritoryId; units: Units;
    strategy: AttackStrategy; formation: Formation; supply: SupplyLevel; risk: RiskPref; retreatBelow: number; reserve: Units;
  };
  sabotage: { kind: SabotageKind; targetPlayerId: PlayerId; targetTerritoryId: TerritoryId };
  research: { techId: string };
  resistance: { kind: 'emergency_recruit' | 'uprising'; territoryId: TerritoryId };
}
export type OrderStatus = 'draft' | 'submitted' | 'locked' | 'executed' | 'failed' | 'cancelled';
export type OrderInput = { [K in OrderType]: { type: K; params: OrderParamsMap[K] } }[OrderType];
export type Order = OrderInput & {
  id: string; playerId: PlayerId; round: number; status: OrderStatus; priority: number; cpCost: number;
  createdAt: string; updatedAt: string; result?: { ok: boolean; summary: string };
};

// ───────────────────────── Uvjetne naredbe ─────────────────────────
export type TriggerType = 'territory_attacked' | 'capital_attacked' | 'attacked_by_player' | 'territory_conquered' | 'ally_loses_territory' | 'territory_lost';
export type ConditionalActionType = 'defensive_formation' | 'move_reserves' | 'build_fortress' | 'send_support' | 'emergency_recruit';
export interface ConditionalOrder {
  id: string; playerId: PlayerId; round: number;
  trigger: { type: TriggerType; territoryId?: TerritoryId; playerId?: PlayerId };
  condition: { type: 'always' } | { type: 'resources'; min: Partial<Resources> } | { type: 'attacker_strength_above'; value: number };
  action: { type: ConditionalActionType; territoryId?: TerritoryId; fromTerritoryId?: TerritoryId; units?: Units; unit?: UnitType; count?: number };
  resourceReq: Partial<Resources>;
  priority: number;
  expiresRound: number;
  status: 'active' | 'triggered' | 'failed' | 'expired' | 'cancelled';
  createdAt: string;
  result?: string;
}

// ───────────────────────── Diplomacija ─────────────────────────
export interface DiplomaticOffer {
  id: string; kind: DiplomacyKind; from: PlayerId; to: PlayerId; secret: boolean;
  terms: NonNullable<OrderParamsMap['diplomacy']['terms']>;
  status: 'pending' | 'accepted' | 'rejected' | 'expired' | 'executed' | 'failed' | 'withdrawn';
  createdRound: number; expiresRound: number; respondedRound?: number; resultText?: string;
}
export interface Alliance {
  id: string; kind: 'alliance' | 'nap'; a: PlayerId; b: PlayerId; startedRound: number; endsRound: number | null;
  secret: boolean; status: 'active' | 'ended' | 'broken'; endedRound?: number; endedBy?: PlayerId; terms: { sharedVision: boolean };
}
export interface Message { id: string; from: PlayerId; to: PlayerId; body: string; createdAt: string; round: number }

// ───────────────────────── Obavještajna služba ─────────────────────────
export type Confidence = 'low' | 'medium' | 'high';
export interface IntelReport {
  id: string; owner: PlayerId; target: PlayerId | null; territoryId?: TerritoryId; kind: EspionageAction | 'sabotage' | 'alert';
  round: number; createdAt: string; confidence: Confidence | 'failed';
  data: Record<string, unknown>;
  summary: string;
}

// ───────────────────────── Događaji, izvještaji ─────────────────────────
export type WorldEventType = 'none' | 'drought' | 'gold_rush' | 'plague' | 'rebellion' | 'trade_boom' | 'winter' | 'storm' | 'harvest';
export interface WorldEvent {
  id: string; round: number; type: WorldEventType; title: string; description: string; effects: string[];
  scope: 'global' | 'territories' | 'region'; territoryIds?: TerritoryId[]; regionId?: string; announced: boolean;
}
export interface BattleFactor { label: string; value: string; side: 'attacker' | 'defender' | 'neutral'; impact: 'positive' | 'negative' | 'neutral' }
export interface BattlePhase { n: number; attackerPower: number; defenderPower: number; attackerLossPct: number; defenderLossPct: number }
export interface BattleReport {
  id: string; round: number; territoryId: TerritoryId; territoryName: string;
  attackers: Array<{ playerId: PlayerId; fromId: TerritoryId; units: Units; strategy: AttackStrategy; formation: Formation }>;
  defenderId: PlayerId | null;
  defenderUnits: Units; defenderSurvivors: Units; attackerSurvivors: Units; attackerLosses: Units; defenderLosses: Units;
  outcome: 'attacker_victory' | 'defender_victory' | 'retreat' | 'feint';
  captured: boolean; phases: BattlePhase[];
  attackerPower: number; defenderPower: number; factors: BattleFactor[]; explanation: string[];
  visibleTo: PlayerId[];
}
export type ReportCategory = 'military' | 'territory' | 'economy' | 'diplomacy' | 'event' | 'achievement' | 'espionage' | 'notice' | 'research';
export interface ReportEntry {
  id: string; round: number; category: ReportCategory; text: string; severity: 'good' | 'bad' | 'info' | 'warn';
  audience: PlayerId[]; refs?: { territoryId?: TerritoryId; battleId?: string; playerId?: PlayerId }; mood?: Mood;
}
export interface ResourceLedger { before: Resources; production: Resources; taxes: number; upkeep: Resources; trade: Resources; spending: Resources; after: Resources }
export interface DailyReport {
  round: number; playerId: PlayerId; entries: ReportEntry[]; ledger: ResourceLedger; mood: Mood;
  scoreBefore: number; scoreAfter: number;
}
export interface NotificationDraft { playerId: PlayerId; kind: NotificationKind; title: string; body: string; data?: Record<string, unknown> }
export type NotificationKind = 'invitation' | 'alliance_offer' | 'trade_offer' | 'attack' | 'resolution' | 'diplomatic' | 'campaign_complete' | 'phase' | 'achievement' | 'warning';

// ───────────────────────── Rezultati ─────────────────────────
export interface ScoreBreakdown {
  playerId: PlayerId; territories: number; cities: number; enemyCapitals: number; regions: number; objective: number; military: number;
  total: number; territoryCount: number; cityCount: number; economicStrength: number; diplomaticScore: number;
  militaryAchievements: string[]; regionsControlled: string[]; objectiveCompleted: boolean; objectiveTitle?: string;
}

// ───────────────────────── Stanje igre ─────────────────────────
export interface GameState {
  campaignId: string;
  seed: string;
  config: GameConfig;
  round: number;
  totalRounds: number;
  phase: CampaignPhase;
  map: GameMap;
  players: Record<PlayerId, PlayerState>;
  playerOrder: PlayerId[];
  orders: Order[];
  conditionalOrders: ConditionalOrder[];
  offers: DiplomaticOffer[];
  alliances: Alliance[];
  messages: Message[];
  intel: IntelReport[];
  events: WorldEvent[];
  battles: BattleReport[];
  reportEntries: ReportEntry[];
  reports: Record<string, DailyReport>; // `${round}:${playerId}`
  notificationsOut: NotificationDraft[];
  scores: Record<PlayerId, ScoreBreakdown>;
  resolvedRounds: number[]; // idempotencija
  idCounter: number;
  winnerId: PlayerId | null;
  history: Array<{ round: number; scores: Record<PlayerId, number>; territories: Record<PlayerId, number> }>;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  cpCost: number;
  resourceCost: Partial<Resources>;
}

export interface OrderPreview {
  validation: ValidationResult;
  title: string;
  known: Array<{ label: string; value: string }>;
  estimated: Array<{ label: string; value: string; confidence: Confidence | 'none' }>;
  unknown: string[];
  risks: Array<{ level: 'low' | 'medium' | 'high'; text: string }>;
  countermeasures: string[];
  outlook?: 'favorable' | 'uncertain' | 'unfavorable';
}
