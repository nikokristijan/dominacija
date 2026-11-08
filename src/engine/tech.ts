/** Stablo tehnologija: 5 kategorija × 4 tehnologije. Učinci su množitelji/zbrojevi koje čita ostatak engine-a. */
import type { GameConfig } from './config';
import type { GameState, PlayerState, Resources } from './types';

export type TechCategory = 'military' | 'economy' | 'governance' | 'espionage' | 'diplomacy';
export interface TechDef {
  id: string; category: TechCategory; tier: number; name: string; description: string;
  cost: Partial<Resources>; requires: string[];
  mods: Partial<Record<ModKey, number>>;
}

export type ModKey =
  | 'infantryAttack' | 'infantryDefense' | 'archerAttack' | 'cavalryAttack' | 'siegeAttack' | 'fortressIgnore'
  | 'foodProd' | 'ironProd' | 'goldProd' | 'tradeCap' | 'tradeRate' | 'taxStabilityRelief'
  | 'stabilityBase' | 'popGrowth' | 'constructionDiscount' | 'upkeepDiscount'
  | 'spyPower' | 'counterPower' | 'sabotagePower'
  | 'diplomacyDiscount' | 'influenceProd' | 'treatyBonus';

export const TECH_CATEGORIES: Record<TechCategory, { name: string; color: string; icon: string }> = {
  military: { name: 'Vojska', color: '#EF4444', icon: 'sword' },
  economy: { name: 'Gospodarstvo', color: '#F59E0B', icon: 'coin' },
  governance: { name: 'Upravljanje', color: '#22C55E', icon: 'crown' },
  espionage: { name: 'Špijunaža', color: '#6366F1', icon: 'eye' },
  diplomacy: { name: 'Diplomacija', color: '#0EA5E9', icon: 'handshake' },
};

export const TECHS: TechDef[] = [
  // Vojska
  { id: 'mil_infantry', category: 'military', tier: 1, name: 'Bolja pješadija', description: 'Pješadija i kopljanici: +12% napad i obrana.', cost: { gold: 30, iron: 10 }, requires: [], mods: { infantryAttack: 0.12, infantryDefense: 0.12 } },
  { id: 'mil_archery', category: 'military', tier: 2, name: 'Napredno streljaštvo', description: 'Strijelci: +18% napad.', cost: { gold: 35, wood: 15 }, requires: ['mil_infantry'], mods: { archerAttack: 0.18 } },
  { id: 'mil_cavalry', category: 'military', tier: 3, name: 'Taktika konjice', description: 'Konjica i vitezovi: +15% napad.', cost: { gold: 45, iron: 15 }, requires: ['mil_archery'], mods: { cavalryAttack: 0.15 } },
  { id: 'mil_siege', category: 'military', tier: 4, name: 'Opsadno inženjerstvo', description: 'Opsadna oruđa: +25% napad; opsada zaobilazi dodatnih 15% utvrda.', cost: { gold: 55, iron: 25, wood: 20 }, requires: ['mil_cavalry'], mods: { siegeAttack: 0.25, fortressIgnore: 0.15 } },
  // Gospodarstvo
  { id: 'eco_agri', category: 'economy', tier: 1, name: 'Poboljšana poljoprivreda', description: '+20% proizvodnje hrane.', cost: { gold: 30, wood: 15 }, requires: [], mods: { foodProd: 0.2 } },
  { id: 'eco_mining', category: 'economy', tier: 2, name: 'Učinkovito rudarstvo', description: '+25% proizvodnje željeza.', cost: { gold: 35, wood: 15 }, requires: ['eco_agri'], mods: { ironProd: 0.25 } },
  { id: 'eco_trade', category: 'economy', tier: 3, name: 'Razvoj trgovine', description: '+40% kapaciteta trgovine i +8% bolji tečaj.', cost: { gold: 40, iron: 5 }, requires: ['eco_mining'], mods: { tradeCap: 0.4, tradeRate: 0.08 } },
  { id: 'eco_tax', category: 'economy', tier: 4, name: 'Porezna uprava', description: '+12% zlata; porezi smanjuju stabilnost 2 manje.', cost: { gold: 50, influence: 4 }, requires: ['eco_trade'], mods: { goldProd: 0.12, taxStabilityRelief: 2 } },
  // Upravljanje
  { id: 'gov_order', category: 'governance', tier: 1, name: 'Javni red', description: '+2 stabilnosti svaki dan.', cost: { gold: 30, influence: 2 }, requires: [], mods: { stabilityBase: 2 } },
  { id: 'gov_pop', category: 'governance', tier: 2, name: 'Upravljanje stanovništvom', description: '+40% rasta stanovništva.', cost: { gold: 35, food: 20 }, requires: ['gov_order'], mods: { popGrowth: 0.4 } },
  { id: 'gov_admin', category: 'governance', tier: 3, name: 'Učinkovita uprava', description: 'Gradnja 15% jeftinija.', cost: { gold: 40, wood: 10, influence: 3 }, requires: ['gov_pop'], mods: { constructionDiscount: 0.15 } },
  { id: 'gov_logistics', category: 'governance', tier: 4, name: 'Vojna logistika', description: 'Održavanje vojske 15% jeftinije.', cost: { gold: 50, iron: 10, influence: 3 }, requires: ['gov_admin'], mods: { upkeepDiscount: 0.15 } },
  // Špijunaža
  { id: 'spy_intel', category: 'espionage', tier: 1, name: 'Bolje obavještavanje', description: '+35% snage špijuna (preciznije procjene).', cost: { gold: 25, influence: 3 }, requires: [], mods: { spyPower: 0.35 } },
  { id: 'spy_counter', category: 'espionage', tier: 2, name: 'Protuobavještajna služba', description: '+35% obrane od špijuna; skriva dio postrojbi.', cost: { gold: 30, influence: 3 }, requires: ['spy_intel'], mods: { counterPower: 0.35 } },
  { id: 'spy_ops', category: 'espionage', tier: 3, name: 'Tajne operacije', description: '+40% snage sabotaže.', cost: { gold: 40, influence: 5 }, requires: ['spy_counter'], mods: { sabotagePower: 0.4 } },
  { id: 'spy_network', category: 'espionage', tier: 4, name: 'Mreža doušnika', description: '+35% snage špijuna, +35% protuobavještajne snage.', cost: { gold: 45, influence: 6 }, requires: ['spy_ops'], mods: { spyPower: 0.35, counterPower: 0.35 } },
  // Diplomacija
  { id: 'dip_envoys', category: 'diplomacy', tier: 1, name: 'Bolji sporazumi', description: 'Diplomatske misije 25% jeftinije u utjecaju.', cost: { gold: 25, influence: 2 }, requires: [], mods: { diplomacyDiscount: 0.25 } },
  { id: 'dip_influence', category: 'diplomacy', tier: 2, name: 'Rast utjecaja', description: '+25% proizvodnje utjecaja.', cost: { gold: 35, influence: 3 }, requires: ['dip_envoys'], mods: { influenceProd: 0.25 } },
  { id: 'dip_trade', category: 'diplomacy', tier: 3, name: 'Trgovački odnosi', description: 'Razmjena resursa s drugim igračima donosi +10% objema stranama.', cost: { gold: 40, influence: 4 }, requires: ['dip_influence'], mods: { treatyBonus: 0.1 } },
  { id: 'dip_union', category: 'diplomacy', tier: 4, name: 'Veliki savez', description: '+12% proizvodnje utjecaja, savezi donose +2 stabilnosti dnevno po savezu (do 2).', cost: { gold: 50, influence: 6 }, requires: ['dip_trade'], mods: { influenceProd: 0.12, treatyBonus: 0.1 } },
];

export const TECH_BY_ID: Record<string, TechDef> = Object.fromEntries(TECHS.map((t) => [t.id, t]));

export type Mods = Record<ModKey, number>;
const ZERO: Mods = {
  infantryAttack: 0, infantryDefense: 0, archerAttack: 0, cavalryAttack: 0, siegeAttack: 0, fortressIgnore: 0,
  foodProd: 0, ironProd: 0, goldProd: 0, tradeCap: 0, tradeRate: 0, taxStabilityRelief: 0,
  stabilityBase: 0, popGrowth: 0, constructionDiscount: 0, upkeepDiscount: 0,
  spyPower: 0, counterPower: 0, sabotagePower: 0, diplomacyDiscount: 0, influenceProd: 0, treatyBonus: 0,
};

export function getMods(player: PlayerState): Mods {
  const m = { ...ZERO };
  for (const id of player.techs) {
    const t = TECH_BY_ID[id];
    if (!t) continue;
    for (const [k, v] of Object.entries(t.mods)) m[k as ModKey] += v as number;
  }
  return m;
}

/** Cijena istraživanja nakon popusta istraživačkih centara. */
export function techCost(state: GameState, player: PlayerState, techId: string, cfg: GameConfig): Partial<Resources> {
  const t = TECH_BY_ID[techId];
  if (!t) return {};
  let levels = 0;
  for (const tt of Object.values(state.map.territories)) {
    if (tt.owner === player.id && tt.building === 'research_center') levels += tt.buildingLevel;
  }
  const discount = Math.min(0.4, levels * cfg.research.researchCenterDiscount);
  const out: Partial<Resources> = {};
  for (const [k, v] of Object.entries(t.cost)) out[k as keyof Resources] = Math.ceil((v as number) * (1 - discount));
  return out;
}
