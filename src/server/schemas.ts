/** Zod sheme za sve ulaze s klijenta: oblik se provjerava ovdje, a pravila igre u engine-u. */
import { z } from 'zod';

const units = z.object({
  infantry: z.number().int().min(0).max(9999).optional(), archers: z.number().int().min(0).max(9999).optional(), spearmen: z.number().int().min(0).max(9999).optional(),
  knights: z.number().int().min(0).max(9999).optional(), cavalry: z.number().int().min(0).max(9999).optional(), siege: z.number().int().min(0).max(9999).optional(),
}).strict();
const res = z.object({ gold: z.number().min(0).max(100000).optional(), food: z.number().min(0).max(100000).optional(), iron: z.number().min(0).max(100000).optional(), wood: z.number().min(0).max(100000).optional(), influence: z.number().min(0).max(100000).optional() }).strict();
const resourceType = z.enum(['gold', 'food', 'iron', 'wood', 'influence']);
const unitType = z.enum(['infantry', 'archers', 'spearmen', 'knights', 'cavalry', 'siege']);
const tid = z.string().regex(/^h\d{1,2}_\d{1,2}$/);
const pid = z.string().min(1).max(40);

export const orderInput = z.discriminatedUnion('type', [
  z.object({ type: z.literal('recruit'), params: z.object({ territoryId: tid, unit: unitType, count: z.number().int().min(1).max(500) }).strict() }),
  z.object({ type: z.literal('trade'), params: z.object({ give: resourceType, receive: resourceType, amount: z.number().int().min(1).max(10000) }).strict() }),
  z.object({ type: z.literal('build'), params: z.object({ territoryId: tid, building: z.enum(['farm', 'mine', 'city', 'fortress', 'barracks', 'market', 'research_center']) }).strict() }),
  z.object({ type: z.literal('defend'), params: z.object({ territoryId: tid, stance: z.enum(['entrench', 'fortify', 'reinforce']), fromTerritoryId: tid.optional(), units: units.optional() }).strict() }),
  z.object({ type: z.literal('espionage'), params: z.object({ action: z.enum(['army', 'resources', 'buildings', 'preparations', 'routes', 'false_info', 'counter']), targetPlayerId: pid.optional(), targetTerritoryId: tid.optional() }).strict() }),
  z.object({
    type: z.literal('diplomacy'),
    params: z.object({
      kind: z.enum(['alliance', 'nap', 'trade', 'support', 'swap', 'joint_attack', 'annex', 'improve']), targetPlayerId: pid.optional(), targetTerritoryId: tid.optional(), secret: z.boolean().optional(),
      terms: z.object({ give: res.optional(), receive: res.optional(), units: units.optional(), fromTerritoryId: tid.optional(), toTerritoryId: tid.optional(), swapMine: tid.optional(), swapTheirs: tid.optional(), attackTarget: tid.optional(), durationRounds: z.number().int().min(1).max(7).optional(), message: z.string().max(300).optional() }).strict().optional(),
    }).strict(),
  }),
  z.object({
    type: z.literal('attack'),
    params: z.object({
      fromId: tid, targetId: tid, units, strategy: z.enum(['direct', 'ambush', 'encirclement', 'diversion', 'siege']), formation: z.enum(['line', 'wedge', 'phalanx', 'skirmish']),
      supply: z.enum(['minimal', 'standard', 'generous']), risk: z.enum(['cautious', 'balanced', 'bold']), retreatBelow: z.number().min(0).max(0.9), reserve: units,
    }).strict(),
  }),
  z.object({ type: z.literal('sabotage'), params: z.object({ kind: z.enum(['production', 'stability', 'fortification']), targetPlayerId: pid, targetTerritoryId: tid }).strict() }),
  z.object({ type: z.literal('research'), params: z.object({ techId: z.string().min(1).max(40) }).strict() }),
  z.object({ type: z.literal('resistance'), params: z.object({ kind: z.enum(['emergency_recruit', 'uprising']), territoryId: tid }).strict() }),
]);

export const orderAction = z.discriminatedUnion('action', [
  z.object({ action: z.literal('create'), order: orderInput, status: z.enum(['draft', 'submitted']) }),
  z.object({ action: z.literal('update'), orderId: z.string().max(40), order: orderInput }),
  z.object({ action: z.literal('remove'), orderId: z.string().max(40) }),
  z.object({ action: z.literal('submit'), orderId: z.string().max(40) }),
  z.object({ action: z.literal('reorder'), orderIds: z.array(z.string().max(40)).max(50) }),
  z.object({ action: z.literal('ready'), ready: z.boolean() }),
  z.object({ action: z.literal('tax'), tax: z.enum(['low', 'normal', 'high']) }),
]);

export const conditionalAction = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('create'),
    trigger: z.object({ type: z.enum(['territory_attacked', 'capital_attacked', 'attacked_by_player', 'territory_conquered', 'ally_loses_territory', 'territory_lost']), territoryId: tid.optional(), playerId: pid.optional() }).strict(),
    condition: z.discriminatedUnion('type', [z.object({ type: z.literal('always') }), z.object({ type: z.literal('resources'), min: res }), z.object({ type: z.literal('attacker_strength_above'), value: z.number().min(0).max(9999) })]),
    action_: z.object({ type: z.enum(['defensive_formation', 'move_reserves', 'build_fortress', 'send_support', 'emergency_recruit']), territoryId: tid.optional(), fromTerritoryId: tid.optional(), units: units.optional(), unit: unitType.optional(), count: z.number().int().min(1).max(100).optional() }).strict(),
    resourceReq: res, priority: z.number().int().min(1).max(10), expiresRound: z.number().int().min(1).max(7).optional(),
  }),
  z.object({ action: z.literal('remove'), id: z.string().max(40) }),
]);

export const diplomacyAction = z.discriminatedUnion('action', [
  z.object({ action: z.literal('respond'), offerId: z.string().max(40), accept: z.boolean(), toTerritoryId: tid.optional() }),
  z.object({ action: z.literal('withdraw'), offerId: z.string().max(40) }),
  z.object({ action: z.literal('terminate'), allianceId: z.string().max(40) }),
  z.object({ action: z.literal('message'), to: pid, body: z.string().min(1).max(1000) }),
]);

export const createCampaignBody = z.object({
  name: z.string().trim().min(3).max(40), minPlayers: z.number().int().min(4).max(8).default(4), maxPlayers: z.number().int().min(4).max(8).default(6),
  faction: z.enum(['red', 'blue', 'purple', 'green', 'yellow', 'turquoise', 'pink', 'grey']).optional(),
  timezone: z.string().max(60).default('Europe/Zagreb'), planningStartHour: z.number().int().min(0).max(23).default(8), lockHour: z.number().int().min(1).max(23).default(20),
  dev: z.object({ bots: z.number().int().min(3).max(7), planningSeconds: z.number().int().min(15).max(3600).default(90) }).optional(),
});
export const joinBody = z.object({ code: z.string().trim().min(4).max(12), faction: createCampaignBody.shape.faction });
export const authBody = z.object({ username: z.string().min(3).max(24), password: z.string().min(8).max(100), displayName: z.string().max(24).optional(), email: z.string().email().optional() });
export const loginBody = z.object({ username: z.string().min(1).max(24), password: z.string().min(1).max(100) });
export const profileBody = z.object({
  displayName: z.string().trim().min(2).max(24).optional(), preferredFaction: createCampaignBody.shape.faction.nullable().optional(),
  prefs: z.object({ invitation: z.boolean(), alliance_offer: z.boolean(), trade_offer: z.boolean(), attack: z.boolean(), resolution: z.boolean(), diplomatic: z.boolean(), campaign_complete: z.boolean(), phase: z.boolean(), achievement: z.boolean(), warning: z.boolean(), push: z.boolean() }).partial().optional(),
});
