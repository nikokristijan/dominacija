/**
 * CENTRALNA KONFIGURACIJA IGRE
 * --------------------------------------------------------------
 * Sve balansne vrijednosti žive ovdje. Nijedna komponenta ni modul
 * ne smije imati "magične brojeve" — uvijek čitaj iz konfiguracije.
 * Svaka kampanja sprema svoju kopiju (state.config) pa je razrješenje
 * runde deterministično čak i ako se globalne vrijednosti promijene.
 */
import type {
  BuildingType, ResourceType, TerrainType, UnitType, FactionId, TaxLevel,
  AttackStrategy, Formation, RiskPref, SupplyLevel, OrderType,
} from './types';

export const RESOURCE_TYPES: ResourceType[] = ['gold', 'food', 'iron', 'wood', 'influence'];
export const UNIT_TYPES: UnitType[] = ['infantry', 'archers', 'spearmen', 'knights', 'cavalry', 'siege'];

const unitDefs = {
  infantry: {
    name: 'Pješadija', attack: 4, defense: 5, movement: 1,
    cost: { gold: 8, food: 2, iron: 2, wood: 0, influence: 0 },
    upkeep: { gold: 0.4, food: 0.4 },
    requiresBuilding: null as BuildingType | null,
    popCost: 1,
    /** Množitelj snage ovisno o terenu na kojem se bori. */
    terrain: { plains: 1, forest: 1, mountains: 1, desert: 1, water: 1, special: 1 } as Record<TerrainType, number>,
  },
  archers: {
    name: 'Strijelci', attack: 5, defense: 2, movement: 1,
    cost: { gold: 10, food: 2, iron: 0, wood: 3, influence: 0 },
    upkeep: { gold: 0.5, food: 0.4 },
    requiresBuilding: null as BuildingType | null,
    popCost: 1,
    terrain: { plains: 1, forest: 1.1, mountains: 1.1, desert: 0.95, water: 1, special: 1 } as Record<TerrainType, number>,
  },
  spearmen: {
    name: 'Kopljanici', attack: 3, defense: 6, movement: 1,
    cost: { gold: 9, food: 2, iron: 1, wood: 2, influence: 0 },
    upkeep: { gold: 0.4, food: 0.4 },
    requiresBuilding: null as BuildingType | null,
    popCost: 1,
    terrain: { plains: 1, forest: 1.1, mountains: 1.05, desert: 1, water: 1, special: 1 } as Record<TerrainType, number>,
  },
  knights: {
    name: 'Vitezovi', attack: 9, defense: 7, movement: 1,
    cost: { gold: 26, food: 3, iron: 8, wood: 0, influence: 0 },
    upkeep: { gold: 1.2, food: 0.8 },
    requiresBuilding: 'barracks' as BuildingType | null,
    popCost: 1,
    terrain: { plains: 1.05, forest: 0.85, mountains: 0.75, desert: 0.95, water: 1, special: 1 } as Record<TerrainType, number>,
  },
  cavalry: {
    name: 'Konjica', attack: 7, defense: 3, movement: 2,
    cost: { gold: 18, food: 4, iron: 3, wood: 0, influence: 0 },
    upkeep: { gold: 0.9, food: 0.9 },
    requiresBuilding: 'barracks' as BuildingType | null,
    popCost: 1,
    terrain: { plains: 1.15, forest: 0.8, mountains: 0.7, desert: 1, water: 1, special: 1 } as Record<TerrainType, number>,
  },
  siege: {
    name: 'Opsadna oruđa', attack: 12, defense: 1, movement: 1,
    cost: { gold: 30, food: 2, iron: 10, wood: 15, influence: 0 },
    upkeep: { gold: 1.0, food: 0.4 },
    requiresBuilding: 'barracks' as BuildingType | null,
    popCost: 1,
    terrain: { plains: 1, forest: 0.8, mountains: 0.6, desert: 1, water: 1, special: 1 } as Record<TerrainType, number>,
  },
};

/** Odnos "tko koga tuče": counter[napadač][branitelj] = množitelj snage napadača. */
const counters: Record<UnitType, Record<UnitType, number>> = {
  infantry: { infantry: 1, archers: 1.2, spearmen: 0.85, knights: 0.9, cavalry: 1, siege: 1.3 },
  archers: { infantry: 1.2, archers: 1, spearmen: 1, knights: 0.85, cavalry: 0.85, siege: 1.1 },
  spearmen: { infantry: 1, archers: 1, spearmen: 1, knights: 1.3, cavalry: 1.5, siege: 1 },
  knights: { infantry: 1.1, archers: 1.15, spearmen: 0.8, knights: 1, cavalry: 1.1, siege: 1.3 },
  cavalry: { infantry: 1, archers: 1.4, spearmen: 0.65, knights: 0.9, cavalry: 1, siege: 1.4 },
  siege: { infantry: 1, archers: 1, spearmen: 1, knights: 1, cavalry: 1, siege: 1 },
};

const terrainDefs: Record<TerrainType, {
  name: string; defense: number; passable: boolean;
  production: Partial<Record<ResourceType, number>>; supplyCost: number; maxPopulation: number; nativeGarrison: number;
}> = {
  plains: { name: 'Ravnica', defense: 1.0, passable: true, production: { food: 2, gold: 2 }, supplyCost: 1, maxPopulation: 160, nativeGarrison: 3 },
  forest: { name: 'Šuma', defense: 1.15, passable: true, production: { wood: 6 }, supplyCost: 1.2, maxPopulation: 90, nativeGarrison: 4 },
  mountains: { name: 'Planina', defense: 1.35, passable: true, production: { iron: 1 }, supplyCost: 1.5, maxPopulation: 70, nativeGarrison: 6 },
  desert: { name: 'Pustinja', defense: 1.0, passable: true, production: { gold: 3 }, supplyCost: 1.4, maxPopulation: 60, nativeGarrison: 3 },
  water: { name: 'Voda', defense: 1.0, passable: false, production: {}, supplyCost: 99, maxPopulation: 0, nativeGarrison: 0 },
  special: { name: 'Poseban resurs', defense: 1.1, passable: true, production: { influence: 3, gold: 4 }, supplyCost: 1.2, maxPopulation: 100, nativeGarrison: 7 },
};

const buildingDefs: Record<BuildingType, {
  name: string; cost: Partial<Record<ResourceType, number>>; allowedTerrain: TerrainType[];
  production: Partial<Record<ResourceType, number>>; maxLevel: number; description: string; points: number;
}> = {
  capital: { name: 'Glavni grad', cost: {}, allowedTerrain: ['plains'], production: { gold: 12, food: 4, influence: 2 }, maxLevel: 1, description: 'Srce kraljevstva. Gubitak donosi Otpor.', points: 4 },
  farm: { name: 'Farma', cost: { gold: 20, wood: 15 }, allowedTerrain: ['plains', 'forest', 'desert'], production: { food: 10 }, maxLevel: 3, description: 'Proizvodi hranu.', points: 0 },
  mine: { name: 'Rudnik', cost: { gold: 25, wood: 20 }, allowedTerrain: ['mountains', 'special', 'desert'], production: { iron: 6 }, maxLevel: 3, description: 'Proizvodi željezo.', points: 0 },
  city: { name: 'Grad', cost: { gold: 40, wood: 30, iron: 5 }, allowedTerrain: ['plains', 'forest', 'desert', 'special'], production: { gold: 9, influence: 0.5 }, maxLevel: 3, description: 'Proizvodi zlato, povećava stanovništvo. 4 boda.', points: 4 },
  fortress: { name: 'Tvrđava', cost: { gold: 35, wood: 20, iron: 20 }, allowedTerrain: ['plains', 'forest', 'mountains', 'desert', 'special'], production: {}, maxLevel: 3, description: 'Snažno povećava obranu teritorija.', points: 0 },
  barracks: { name: 'Barake', cost: { gold: 30, wood: 25, iron: 10 }, allowedTerrain: ['plains', 'forest', 'desert', 'special'], production: {}, maxLevel: 3, description: 'Omogućuje vitezove, konjicu i opsadna oruđa.', points: 0 },
  market: { name: 'Tržnica', cost: { gold: 35, wood: 20 }, allowedTerrain: ['plains', 'desert', 'special'], production: { gold: 4 }, maxLevel: 3, description: 'Poboljšava trgovinu i donosi zlato.', points: 0 },
  research_center: { name: 'Istraživački centar', cost: { gold: 45, wood: 15, iron: 10 }, allowedTerrain: ['plains', 'forest', 'special'], production: { influence: 1 }, maxLevel: 3, description: 'Snižava cijenu istraživanja tehnologija.', points: 0 },
};

export const FACTIONS: Record<FactionId, { name: string; adjective: string; color: string; dark: string; light: string; emblem: string; capitalName: string }> = {
  red: { name: 'Crvena Kraljevina', adjective: 'Crvena', color: '#EF4444', dark: '#991B1B', light: '#FCA5A5', emblem: 'crown', capitalName: 'Kamengrad' },
  blue: { name: 'Plava Kraljevina', adjective: 'Plava', color: '#3B82F6', dark: '#1E3A8A', light: '#93C5FD', emblem: 'lily', capitalName: 'Ljiljanovo' },
  purple: { name: 'Ljubičasta Kraljevina', adjective: 'Ljubičasta', color: '#8B5CF6', dark: '#4C1D95', light: '#C4B5FD', emblem: 'eagle', capitalName: 'Orlovgrad' },
  green: { name: 'Zelena Kraljevina', adjective: 'Zelena', color: '#22C55E', dark: '#14532D', light: '#86EFAC', emblem: 'swords', capitalName: 'Hrastovac' },
  yellow: { name: 'Žuta Kraljevina', adjective: 'Žuta', color: '#F5B800', dark: '#92400E', light: '#FDE68A', emblem: 'deer', capitalName: 'Jelenovo' },
  turquoise: { name: 'Tirkizna Kraljevina', adjective: 'Tirkizna', color: '#14B8A6', dark: '#115E59', light: '#99F6E4', emblem: 'octopus', capitalName: 'Valovac' },
  pink: { name: 'Ružičasta Kraljevina', adjective: 'Ružičasta', color: '#EC4899', dark: '#9D174D', light: '#F9A8D4', emblem: 'flower', capitalName: 'Cvjetnik' },
  grey: { name: 'Siva Kraljevina', adjective: 'Siva', color: '#6B7280', dark: '#1F2937', light: '#D1D5DB', emblem: 'wolf', capitalName: 'Vučigrad' },
};
export const FACTION_IDS = Object.keys(FACTIONS) as FactionId[];

export const GAME_CONFIG = {
  campaign: {
    minPlayers: 4,
    maxPlayers: 8,
    days: 7,
    commandPointsPerDay: 10,
    mapWidth: 15,
    mapHeight: 13,
    /** Broj teritorija otoka (organski oblik, ~100–120). */
    territoryTarget: 118,
    regionCount: 7,
    /** Zadani raspored dana (lokalno vrijeme kampanje). */
    planningStartHour: 8,
    lockHour: 20,
    maxConditionalOrdersPerRound: 3,
    /** Nakon ovoliko propuštenih rundi igrač prelazi na automatsku obranu. */
    autopilotAfterMissedRounds: 2,
    /** Razvojni način: trajanje faze planiranja u sekundama. */
    devPlanningSeconds: 90,
  },
  start: {
    resources: { gold: 100, food: 50, iron: 20, wood: 30, influence: 10 } as Record<ResourceType, number>,
    stability: 80,
    capitalPopulation: 120,
    neighborPopulation: 70,
    /** Raspored 10 početnih vojnika: [kapital, farma, šuma]. */
    garrison: [
      { infantry: 4, archers: 2 },
      { spearmen: 2 },
      { infantry: 2 },
    ] as Array<Partial<Record<UnitType, number>>>,
  },
  orderCosts: {
    recruit: 1, trade: 1, build: 2, defend: 2, espionage: 2, diplomacy: 2,
    attack: 3, sabotage: 3, research: 3, resistance: 2,
  } as Record<OrderType, number>,
  units: unitDefs,
  counters,
  terrain: terrainDefs,
  buildings: buildingDefs,
  /** Cijena nadogradnje = osnovna × (1 + upgradeCostGrowth × (novaRazina-1)). */
  upgradeCostGrowth: 0.7,
  production: {
    /** Proizvodnja zgrade množi se s razinom: 1 + levelGrowth×(razina-1). */
    levelGrowth: 0.6,
    depositMultiplier: 1.4,
    /** Utjecaj stabilnosti teritorija na proizvodnju: min + (1-min)×stab/100. */
    stabilityMinFactor: 0.7,
    isolatedFactor: 0.5,
    populationRefProduction: 100,
  },
  tax: {
    low: { goldPerPop: 0.03, stability: 3, label: 'Niski' },
    normal: { goldPerPop: 0.05, stability: 0, label: 'Normalni' },
    high: { goldPerPop: 0.085, stability: -5, label: 'Visoki' },
  } as Record<TaxLevel, { goldPerPop: number; stability: number; label: string }>,
  population: {
    growthRate: 0.03,
    foodPerPop: 0.02,
    cityPopulationBonus: 45,
    capitalPopulationBonus: 60,
    plagueLoss: 0.18,
    famineLoss: 0.04,
  },
  stability: {
    max: 100,
    foodShortage: -12,
    goldShortage: -5,
    perTerritoryLost: -4,
    perTerritoryConquered: 1,
    capitalLost: -20,
    naturalRecovery: 1,
    /** Upozorenja za pobunu (vidljiva igraču). */
    warnYellow: 40,
    warnRed: 30,
    rebellionBelow: 20,
    afterRebellion: 45,
    rebellionArmyLoss: 0.25,
    territoryConvergence: 0.4,
    conqueredStability: 35,
  },
  trade: {
    values: { gold: 1, food: 0.8, iron: 2.5, wood: 1.2, influence: 4 } as Record<ResourceType, number>,
    spread: 0.22,
    baseCap: 30,
    capPerMarketLevel: 20,
    marketRateBonusPerLevel: 0.03,
  },
  recruitment: {
    baseCap: 12,
    capPerBarracksLevel: 8,
    capPerCityLevel: 4,
    capitalCap: 8,
    /** Smanjenje cijene u stanju Otpora. */
    resistanceDiscount: 0.35,
  },
  construction: { costDiscountPerTech: 0.15 },
  defense: {
    entrenchBonus: 0.25,
    maxDefenseLevel: 5,
    levelBonus: 0.08,
    fortressBonusPerLevel: 0.45,
    capitalBonus: 0.35,
    fortifyCost: { gold: 12, wood: 10, iron: 4, food: 0, influence: 0 } as Record<ResourceType, number>,
    reinforceMaxDistance: 1,
    conditionalRecruitPremium: 1.5,
  },
  combat: {
    phases: 4,
    damageRate: 0.2,
    maxLossFraction: 0.97,
    strategy: {
      direct: { attack: 1.15, receivedDamage: 1.2, label: 'Izravni napad' },
      ambush: { attack: 0.8, receivedDamage: 0.9, intelBonus: 0.5, label: 'Zasjeda' },
      encirclement: { attack: 1.0, receivedDamage: 1.0, perAdjacentDefenseCut: 0.06, maxDefenseCut: 0.24, minAdjacent: 2, label: 'Opkoljavanje' },
      diversion: { attack: 0.5, receivedDamage: 0.5, pressureDefenseCut: 0.15, minSoldiers: 4, label: 'Diverzija' },
      siege: { attack: 0.75, receivedDamage: 0.85, fortressCutPerProgress: 0.3, supplyMultiplier: 1.6, label: 'Opsada' },
    } as Record<AttackStrategy, Record<string, number | string>>,
    formation: {
      line: { attack: 1.0, defense: 1.0, label: 'Linija' },
      wedge: { attack: 1.12, defense: 0.9, label: 'Klin' },
      phalanx: { attack: 0.92, defense: 1.15, label: 'Falanga' },
      skirmish: { attack: 1.0, defense: 1.0, rangedBonus: 1.15, heavyPenalty: 0.9, label: 'Raspršeno' },
    } as Record<Formation, Record<string, number | string>>,
    risk: {
      cautious: { attack: 0.95, receivedDamage: 0.85, defaultRetreat: 0.55, label: 'Oprezno' },
      balanced: { attack: 1.0, receivedDamage: 1.0, defaultRetreat: 0.35, label: 'Uravnoteženo' },
      bold: { attack: 1.1, receivedDamage: 1.2, defaultRetreat: 0.0, label: 'Hrabro' },
    } as Record<RiskPref, { attack: number; receivedDamage: number; defaultRetreat: number; label: string }>,
    supply: {
      minimal: { ratio: 0.6, label: 'Minimalne' },
      standard: { ratio: 1.0, label: 'Standardne' },
      generous: { ratio: 1.4, label: 'Obilne' },
    } as Record<SupplyLevel, { ratio: number; label: string }>,
    /** Hrana po vojniku za jedan marš. */
    foodPerSoldier: 1,
    distanceCostGrowth: 0.35,
    supplyStrengthFloor: 0.6,
    wellFedBonus: 0.04,
    moraleFloor: 0.85,
    coalitionBonusPerForce: 0.05,
    coalitionBonusMax: 0.15,
    betrayalSurprise: 0.1,
    resistanceBonus: 0.2,
    isolatedDefensePenalty: 0.85,
    isolatedAttritionPerDay: 0.12,
    isolatedAttritionMax: 0.4,
    retreatSurvivorRate: 0.6,
    plunderBase: 6,
    plunderPerPop: 0.1,
    plunderMax: 30,
    conqueredPopulationLoss: 0.15,
    stormAttackFactor: 0.95,
    siegeProgressMax: 3,
  },
  espionage: {
    costs: {
      army: { influence: 2, gold: 0 },
      resources: { influence: 2, gold: 5 },
      buildings: { influence: 2, gold: 0 },
      preparations: { influence: 3, gold: 0 },
      routes: { influence: 3, gold: 0 },
      false_info: { influence: 4, gold: 5 },
      counter: { influence: 2, gold: 0 },
    } as Record<string, { influence: number; gold: number }>,
    basePower: 1.0,
    techPower: 0.35,
    counterBase: 1.0,
    counterOpBonus: 0.6,
    highRatio: 1.6, mediumRatio: 1.05, lowRatio: 0.65,
    error: { high: 0.1, medium: 0.25, low: 0.45 },
    disinfoSkew: 0.4,
    sabotageCosts: {
      production: { influence: 4, gold: 10 },
      stability: { influence: 4, gold: 10 },
      fortification: { influence: 5, gold: 15 },
    } as Record<string, { influence: number; gold: number }>,
    sabotageProductionFactor: 0.5,
    sabotageStabilityHit: 9,
    sabotageFortificationHit: 1,
    /** Procjena je zastarjela nakon ovoliko rundi. */
    staleAfterRounds: 2,
  },
  diplomacy: {
    offerCost: { influence: 2 },
    offerExpiryRounds: 2,
    annexBaseInfluence: 8,
    annexInfluencePerImportance: 2,
    annexNativeKeep: 0.5,
    reputation: {
      start: 50, min: 0, max: 100,
      betrayal: -18, brokenTreaty: -10, keptTreaty: 3, trade: 1, support: 4,
      decayToward: 50, decayRate: 0.25,
      costFactorMin: 0.7, costFactorMax: 1.5,
    },
    allianceDefaultDuration: 4,
    napDefaultDuration: 3,
    jointAttackBonus: 0.08,
  },
  research: {
    baseInfluence: 0,
    researchCenterDiscount: 0.1,
  },
  resistance: {
    cpPerDay: 6,
    emergencyRecruitCount: 5,
    emergencyRecruitCooldown: 1,
    uprisingBasePartisans: 6,
    uprisingPartisansPerRound: 1,
    uprisingInfluence: 5,
    uprisingCost: { gold: 0, food: 0, iron: 0, wood: 0, influence: 5 } as Record<ResourceType, number>,
    stabilityFloor: 50,
    capitalCaptureStability: -20,
  },
  events: {
    drought: { foodFactor: 0.6 },
    goldRush: { goldFactor: 1.3 },
    plague: { cities: 3 },
    rebellionEvent: { stabilityHit: 8, highTaxOnly: true },
    tradeBoom: { rateBonus: 0.15, capFactor: 1.5 },
    winter: { supplyFactor: 1.5, foodUpkeepFactor: 1.2 },
    storm: { attackFactor: 0.95, supplyFactor: 1.3 },
    harvest: { foodFactor: 1.3, stabilityBonus: 3 },
  },
  scoring: {
    territory: 1,
    city: 4,
    enemyCapital: 10,
    region: 8,
    objective: 5,
    /** Vojna postignuća (konfigurabilno). */
    achievements: {
      iron_fist: { points: 2, title: 'Željezna šaka', description: 'Dobij 3 bitke kao napadač.', victories: 3 },
      unshaken: { points: 2, title: 'Nepokolebljivi', description: 'Obrani sve teritorije kroz cijelu kampanju.', victories: 0 },
      conqueror: { points: 2, title: 'Osvajač', description: 'Osvoji 5 protivničkih teritorija.', captures: 5 },
    },
    regionControlShare: 0.5,
  },
  ai: { baseSeed: 'bot' },
};

export type GameConfig = typeof GAME_CONFIG;
export type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

export function mergeConfig(overrides?: DeepPartial<GameConfig>): GameConfig {
  const clone = structuredClone(GAME_CONFIG) as GameConfig;
  if (!overrides) return clone;
  const merge = (target: any, src: any) => {
    for (const k of Object.keys(src)) {
      if (src[k] && typeof src[k] === 'object' && !Array.isArray(src[k]) && typeof target[k] === 'object') merge(target[k], src[k]);
      else target[k] = src[k];
    }
  };
  merge(clone, overrides);
  return clone;
}
