'use client';
/**
 * Lokalni "server" za vodič: ISTI engine kao u pravoj igri, ali u memoriji preglednika.
 * Nema fetch-a, nema računa, ništa se ne sprema — vježba je potpuno odvojena od pravih kampanja.
 */
import { addConditional, addOrder, previewOrder, removeConditional, removeOrder, reorderOrders, setReady, setTax, submitDraft, updateOrder } from '@/engine/orders';
import { respondToOffer, sendMessage, terminateAlliance, withdrawOffer } from '@/engine/diplomacy';
import { createCampaignState } from '@/engine/state';
import { resolveRound } from '@/engine/resolve';
import { getPlayerView } from '@/engine/view';
import { neighborIds } from '@/engine/util';
import type { GameState } from '@/engine/types';
import type { CampaignMeta } from '@/server/service';
import { ApiFail, setLocalApi } from '@/lib/api';

export const TUTORIAL_ID = 'tutorial';
let state: GameState | null = null;
let outpostId = '';

export function tutorialOutpostId() { return outpostId; }

function build(): GameState {
  const s = createCampaignState({
    campaignId: TUTORIAL_ID, seed: 'vodic-uvod', config: { campaign: { commandPointsPerDay: 16 } }, players: [
      { id: 'p1', userId: 'me', name: 'Ti', faction: 'purple' }, { id: 'p2', userId: null, name: 'Marko', faction: 'red', isBot: true },
      { id: 'p3', userId: null, name: 'Ana', faction: 'blue', isBot: true }, { id: 'p4', userId: null, name: 'Ivan', faction: 'yellow', isBot: true },
    ],
  });
  const me = s.players.p1;
  me.resources = { gold: 260, food: 130, iron: 70, wood: 90, influence: 30 };
  const cap = s.map.territories[me.capitalId];
  cap.garrison = { infantry: 14, archers: 4, spearmen: 2 };
  // Protivnička predstraža uz glavni grad: slab, ali stvaran cilj za probnu bitku
  const nb = neighborIds(s, cap.id).map((i) => s.map.territories[i]).filter((t) => !t.owner && t.terrain !== 'water' && t.terrain !== 'mountains');
  const out = nb[0];
  out.owner = 'p2'; out.name = 'Predstraža'; out.garrison = { infantry: 5 }; out.stability = 70; out.terrain = 'plains'; out.defenseLevel = 0;
  outpostId = out.id;
  return s;
}

export function resetTutorial() { state = build(); return state; }

function meta(s: GameState): CampaignMeta {
  const now = new Date();
  return {
    id: TUTORIAL_ID, name: 'Vježba', status: 'active', isOwner: true, inviteCode: '', minPlayers: 4, maxPlayers: 4, devSimulation: true,
    schedule: { mode: 'dev', timezone: 'Europe/Zagreb', planningStartHour: 8, lockHour: 20, devPlanningSeconds: 3600, resolveWhenAllReady: false },
    clock: { roundOpensAt: now.toISOString(), roundDeadline: new Date(now.getTime() + 3600_000 * 12).toISOString() }, serverNow: now.toISOString(),
    members: Object.values(s.players).map((p) => ({ playerId: p.id, name: p.name, faction: p.faction, isBot: p.isBot, isOwner: p.id === 'p1', isMe: p.id === 'p1' })),
    myPlayerId: 'p1', round: s.round, totalRounds: s.totalRounds, createdAt: now.toISOString(),
  };
}

const fail = (m: string, details?: unknown): never => { throw new ApiFail(m, 422, details); };
const iso = () => new Date().toISOString();

export function installTutorialApi() {
  if (!state) resetTutorial();
  setLocalApi((path, body: any, method) => {
    if (path.startsWith('/api/notifications')) return Promise.resolve(method === 'GET' ? { notifications: [] } : { ok: true });
    if (path.startsWith('/api/auth/me') || path.startsWith('/api/profile')) return Promise.resolve({ profile: { displayName: 'Ti', achievements: [], history: [], totals: {}, prefs: {} }, user: { id: 'me', username: 'vodic', isAdmin: false } });
    if (!path.startsWith(`/api/campaigns/${TUTORIAL_ID}`)) return undefined;
    const sub = path.slice(`/api/campaigns/${TUTORIAL_ID}`.length).replace(/^\//, '').split('?')[0];
    return (async () => {
      const s = state!;
      switch (sub) {
        case '': return { meta: meta(s), view: getPlayerView(s, 'p1'), unread: 0 };
        case 'preview': return { preview: previewOrder(s, 'p1', body.order, { excludeId: body.excludeId }) };
        case 'orders': {
          switch (body.action) {
            case 'create': { const r = addOrder(s, 'p1', body.order, body.status, iso()); if (!r.ok) fail(r.validation.errors[0] ?? 'Naredba nije valjana.', r.validation); return { order: r.order, validation: r.validation }; }
            case 'update': { const r = updateOrder(s, 'p1', body.orderId, body.order, iso()); if (!r.ok) fail(r.validation.errors[0] ?? 'Naredba nije valjana.', r.validation); return { order: r.order }; }
            case 'remove': { const r = removeOrder(s, 'p1', body.orderId); if (!r.ok) fail(r.error!); return { ok: true }; }
            case 'submit': { const r = submitDraft(s, 'p1', body.orderId, iso()); if (!r.ok) fail(r.validation.errors[0] ?? 'Naredba nije valjana.', r.validation); return { order: r.order }; }
            case 'reorder': reorderOrders(s, 'p1', body.orderIds); return { ok: true };
            case 'ready': { const r = setReady(s, 'p1', body.ready); if (!r.ok) fail(r.error!); return { ok: true }; }
            case 'tax': { const r = setTax(s, 'p1', body.tax); if (!r.ok) fail(r.error!); return { ok: true }; }
          }
          return fail('Nepoznata akcija.');
        }
        case 'conditional': {
          if (body.action === 'create') { const r = addConditional(s, 'p1', { trigger: body.trigger, condition: body.condition, action: body.action_, resourceReq: body.resourceReq, priority: body.priority, expiresRound: body.expiresRound }, iso()); if (!r.ok) fail(r.error!); return { order: r.order }; }
          const r = removeConditional(s, 'p1', body.id); if (!r.ok) fail(r.error!); return { ok: true };
        }
        case 'diplomacy': {
          let r: { ok: boolean; error?: string };
          if (body.action === 'respond') r = respondToOffer(s, 'p1', body.offerId, body.accept, { toTerritoryId: body.toTerritoryId });
          else if (body.action === 'withdraw') r = withdrawOffer(s, 'p1', body.offerId);
          else if (body.action === 'terminate') r = terminateAlliance(s, 'p1', body.allianceId);
          else r = sendMessage(s, 'p1', body.to, body.body, iso());
          if (!r.ok) fail(r.error ?? 'Radnja nije moguća.');
          return { ok: true };
        }
        case 'dev': { state = resolveRound(s, { now: iso() }); state.notificationsOut = []; return { resolved: 1 }; }
      }
      return {};
    })();
  });
}
export function uninstallTutorialApi() { setLocalApi(null); }
