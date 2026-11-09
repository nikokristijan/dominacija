/**
 * Servis kampanja: jedino mjesto gdje se UI/API povezuje s engine-om i perzistencijom.
 * Sve kritične operacije (naredbe, razrješenje, bodovanje) izvršavaju se OVDJE na serveru unutar transakcije.
 */
import { randomBytes } from 'node:crypto';
import { addConditional, addOrder, removeConditional, removeOrder, reorderOrders, setReady, setTax, submitDraft, updateOrder, previewOrder } from '@/engine/orders';
import { respondToOffer, sendMessage, terminateAlliance, withdrawOffer } from '@/engine/diplomacy';
import { createCampaignState } from '@/engine/state';
import { resolveRound } from '@/engine/resolve';
import { botPlan, botGreet } from '@/engine/ai';
import { getPlayerView, type PlayerView } from '@/engine/view';
import { ranking } from '@/engine/scoring';
import { FACTION_IDS, GAME_CONFIG } from '@/engine/config';
import type { FactionId, GameState, OrderInput } from '@/engine/types';
import { nextClock } from './clock';
import type { CampaignRecord, Db, Member, NotificationRecord, Schedule } from './records';
import { getStore } from './store';
import { sendPushTo } from './push';

export class ApiError extends Error { constructor(public status: number, message: string, public details?: unknown) { super(message); } }
const nowIso = () => new Date().toISOString();
const devEnabled = () => process.env.DEV_MODE === 'true' || process.env.NODE_ENV !== 'production';

const code = () => randomBytes(4).toString('hex').toUpperCase().slice(0, 6);
const newId = (db: Db, p: string) => `${p}${(++db.counter).toString(36)}${randomBytes(3).toString('hex')}`;

function audit(db: Db, userId: string | null, kind: string, detail: string, campaignId?: string) {
  db.audit.push({ id: newId(db, 'au'), at: nowIso(), userId, campaignId, kind, detail });
  if (db.audit.length > 2000) db.audit.splice(0, db.audit.length - 2000);
}
export function logError(db: Db, where: string, e: unknown, extra: { campaignId?: string; userId?: string } = {}) {
  db.errors.push({ id: newId(db, 'er'), at: nowIso(), where, message: e instanceof Error ? e.message : String(e), stack: e instanceof Error ? e.stack?.split('\n').slice(0, 6).join('\n') : undefined, ...extra });
  if (db.errors.length > 500) db.errors.splice(0, db.errors.length - 500);
}

// ───────────── Obavijesti ─────────────
function pushNotification(db: Db, userId: string, campaignId: string | null, kind: NotificationRecord['kind'], title: string, body: string) {
  const prefs = db.profiles[userId]?.prefs;
  if (prefs && (prefs as unknown as Record<string, boolean>)[kind] === false) return;
  const n: NotificationRecord = { id: newId(db, 'n'), userId, campaignId, kind, title, body, createdAt: nowIso(), readAt: null };
  db.notifications.push(n);
  if (db.notifications.length > 5000) db.notifications.splice(0, db.notifications.length - 5000);
  if (prefs?.push) void sendPushTo(db.pushSubs.filter((s) => s.userId === userId), { title, body, url: campaignId ? `/k/${campaignId}` : '/igra' });
}
/** Ispražnjava obavijesti koje je engine stavio u red (nakon svake akcije/razrješenja). */
function drainNotifications(db: Db, c: CampaignRecord) {
  const st = c.state;
  if (!st) return;
  for (const n of st.notificationsOut) {
    const m = c.members.find((x) => x.playerId === n.playerId);
    if (m?.userId) pushNotification(db, m.userId, c.id, n.kind, n.title, n.body);
  }
  st.notificationsOut = [];
}

// ───────────── Dohvat ─────────────
function getCampaign(db: Db, id: string): CampaignRecord {
  const c = db.campaigns[id];
  if (!c) throw new ApiError(404, 'Kampanja nije pronađena.');
  return c;
}
function memberOf(c: CampaignRecord, userId: string): Member {
  const m = c.members.find((x) => x.userId === userId);
  if (!m) throw new ApiError(403, 'Nisi član ove kampanje.');
  return m;
}

export interface CampaignMeta {
  id: string; name: string; status: CampaignRecord['status']; isOwner: boolean; inviteCode: string; minPlayers: number; maxPlayers: number; devSimulation: boolean; fillBots: boolean;
  schedule: Schedule; clock: CampaignRecord['clock']; serverNow: string; members: Array<{ playerId: string; name: string; faction: FactionId | null; isBot: boolean; isOwner: boolean; isMe: boolean }>;
  myPlayerId: string | null; round: number | null; totalRounds: number; disabledReason?: string; createdAt: string;
}
function toMeta(c: CampaignRecord, userId: string): CampaignMeta {
  const me = c.members.find((m) => m.userId === userId) ?? null;
  return {
    id: c.id, name: c.name, status: c.status, isOwner: c.ownerId === userId, inviteCode: c.inviteCode, minPlayers: c.minPlayers, maxPlayers: c.maxPlayers, devSimulation: c.devSimulation, fillBots: !!c.fillBots,
    schedule: c.schedule, clock: c.clock, serverNow: nowIso(), myPlayerId: me?.playerId ?? null, round: c.state?.round ?? null, totalRounds: c.state?.totalRounds ?? GAME_CONFIG.campaign.days,
    members: c.members.map((m) => ({ playerId: m.playerId, name: m.name, faction: c.state ? c.state.players[m.playerId]?.faction ?? m.faction : m.faction, isBot: m.isBot, isOwner: m.userId === c.ownerId, isMe: m.userId === userId })),
    disabledReason: c.disabledReason, createdAt: c.createdAt,
  };
}

export async function listMyCampaigns(userId: string) {
  return getStore().read((db) => Object.values(db.campaigns).filter((c) => c.members.some((m) => m.userId === userId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((c) => {
    const p = c.state && c.members.find((m) => m.userId === userId) ? c.state.players[c.members.find((m) => m.userId === userId)!.playerId] : null;
    return { ...toMeta(c, userId), myFaction: p?.faction ?? c.members.find((m) => m.userId === userId)?.faction ?? null };
  }));
}

// ───────────── Stvaranje i ulazak ─────────────
export async function createCampaign(userId: string, body: { pace?: 'daily' | 'fast'; fillBots?: boolean; name: string; minPlayers: number; maxPlayers: number; faction?: FactionId; timezone: string; planningStartHour: number; lockHour: number; dev?: { bots: number; planningSeconds: number } }) {
  if (body.dev && !devEnabled()) throw new ApiError(403, 'Razvojni način nije dostupan.');
  if (body.minPlayers > body.maxPlayers) throw new ApiError(400, 'Minimalan broj igrača ne može biti veći od maksimalnog.');
  if (body.lockHour <= body.planningStartHour) throw new ApiError(400, 'Sat zaključavanja mora biti nakon početka planiranja.');
  try { new Intl.DateTimeFormat('en', { timeZone: body.timezone }); } catch { throw new ApiError(400, 'Nepoznata vremenska zona.'); }
  return getStore().tx((db) => {
    const prof = db.profiles[userId];
    const id = newId(db, 'k');
    const c: CampaignRecord = {
      id, name: body.name, ownerId: userId, inviteCode: code(), status: 'waiting', createdAt: nowIso(), startedAt: null, completedAt: null,
      minPlayers: body.dev ? Math.max(4, body.dev.bots + 1) : body.minPlayers, maxPlayers: body.dev ? Math.max(4, body.dev.bots + 1) : body.maxPlayers, devSimulation: !!body.dev, isPublic: false, fillBots: !body.dev && !!body.fillBots,
      schedule: body.dev
        ? { mode: 'dev', timezone: body.timezone, planningStartHour: body.planningStartHour, lockHour: body.lockHour, devPlanningSeconds: body.dev.planningSeconds, resolveWhenAllReady: true }
        : body.pace === 'fast'
          ? { mode: 'dev', timezone: body.timezone, planningStartHour: body.planningStartHour, lockHour: body.lockHour, devPlanningSeconds: 600, resolveWhenAllReady: true }
          : { mode: 'daily', timezone: body.timezone, planningStartHour: body.planningStartHour, lockHour: body.lockHour, devPlanningSeconds: 90, resolveWhenAllReady: false },
      configOverrides: Object.keys(db.balanceOverrides).length ? structuredClone(db.balanceOverrides) : null,
      members: [{ userId, playerId: 'p1', name: prof?.displayName ?? 'Kralj', faction: body.faction ?? prof?.preferredFaction ?? null, isBot: false, joinedAt: nowIso() }],
      clock: { roundOpensAt: null, roundDeadline: null }, version: 1, seed: randomBytes(8).toString('hex'), state: null,
    };
    if (body.dev) {
      for (let i = 0; i < body.dev.bots; i++) c.members.push({ userId: null, playerId: `p${i + 2}`, name: ['Marko', 'Ana', 'Ivan', 'Petra', 'Luka', 'Mia', 'Tomo'][i] ?? `Bot ${i + 1}`, faction: null, isBot: true, joinedAt: nowIso() });
    }
    db.campaigns[id] = c;
    audit(db, userId, 'campaign.create', c.name, id);
    if (body.dev) startInternal(db, c, userId);
    return toMeta(c, userId);
  });
}

export async function joinCampaign(userId: string, codeIn: string, faction?: FactionId) {
  return getStore().tx((db) => {
    const c = Object.values(db.campaigns).find((x) => x.inviteCode === codeIn.trim().toUpperCase());
    if (!c) throw new ApiError(404, 'Pozivni kod nije ispravan.');
    if (c.status !== 'waiting') throw new ApiError(409, 'Kampanja je već počela ili je završena.');
    if (c.members.some((m) => m.userId === userId)) return toMeta(c, userId);
    if (c.members.length >= c.maxPlayers) throw new ApiError(409, 'Kampanja je puna.');
    const prof = db.profiles[userId];
    const wanted = faction ?? prof?.preferredFaction ?? null;
    const taken = new Set(c.members.map((m) => m.faction).filter(Boolean));
    c.members.push({ userId, playerId: `p${c.members.length + 1}`, name: prof?.displayName ?? 'Igrač', faction: wanted && !taken.has(wanted) ? wanted : null, isBot: false, joinedAt: nowIso() });
    c.version++;
    audit(db, userId, 'campaign.join', c.name, c.id);
    if (c.ownerId !== userId) pushNotification(db, c.ownerId, c.id, 'invitation', 'Novi igrač u kampanji', `${prof?.displayName ?? 'Igrač'} se pridružio kampanji „${c.name}”.`);
    return toMeta(c, userId);
  });
}

export async function leaveCampaign(userId: string, id: string) {
  return getStore().tx((db) => {
    const c = getCampaign(db, id);
    if (c.status !== 'waiting') throw new ApiError(409, 'Nakon početka kampanje nije moguće napustiti je.');
    if (c.ownerId === userId) { delete db.campaigns[id]; return { deleted: true }; }
    c.members = c.members.filter((m) => m.userId !== userId).map((m, i) => ({ ...m, playerId: `p${i + 1}` }));
    c.version++;
    return { deleted: false };
  });
}

const BOT_NAMES = ['Marko', 'Ana', 'Ivan', 'Petra', 'Luka', 'Mia', 'Tomo'];
function startInternal(db: Db, c: CampaignRecord, by: string) {
  if (c.fillBots) {
    const target = Math.min(c.maxPlayers, Math.max(c.members.length, 5));
    const used = new Set(c.members.map((m) => m.name));
    while (c.members.length < target) {
      const name = BOT_NAMES.find((n) => !used.has(n)) ?? `Bot ${c.members.length + 1}`; used.add(name);
      c.members.push({ userId: null, playerId: `p${c.members.length + 1}`, name, faction: null, isBot: true, joinedAt: nowIso() });
    }
  }
  if (c.members.length < c.minPlayers) throw new ApiError(409, `Za početak je potrebno barem ${c.minPlayers} igrača.`);
  const ids = c.members.map((m) => m.playerId);
  c.state = createCampaignState({
    campaignId: c.id, seed: c.seed, config: c.configOverrides ?? undefined,
    players: c.members.map((m) => ({ id: m.playerId, userId: m.userId, name: m.name, faction: m.faction ?? undefined, isBot: m.isBot })),
  });
  for (const m of c.members) m.faction = c.state.players[m.playerId].faction;
  if (c.members.some((m) => m.isBot)) { botGreet(c.state, nowIso()); drainNotifications(db, c); }
  void ids;
  c.status = 'active'; c.startedAt = nowIso();
  c.clock = nextClock(c.schedule, new Date());
  c.version++;
  audit(db, by, 'campaign.start', c.name, c.id);
  for (const m of c.members) if (m.userId && m.userId !== by) pushNotification(db, m.userId, c.id, 'phase', 'Kampanja je počela!', `„${c.name}” je počela. Dan 1 — vrijeme je za planiranje.`);
}

export async function startCampaign(userId: string, id: string) {
  return getStore().tx((db) => {
    const c = getCampaign(db, id);
    if (c.ownerId !== userId) throw new ApiError(403, 'Samo vlasnik kampanje može je pokrenuti.');
    if (c.status !== 'waiting') throw new ApiError(409, 'Kampanja je već pokrenuta.');
    startInternal(db, c, userId);
    return toMeta(c, userId);
  });
}

// ───────────── Razrješenje ─────────────
function doResolve(db: Db, c: CampaignRecord, now: Date) {
  const st = c.state!;
  const iso = now.toISOString();
  // Botovi (samo razvojne simulacije) planiraju neposredno prije zaključavanja
  if (c.members.some((m) => m.isBot)) for (const m of c.members) if (m.isBot && !st.players[m.playerId].ready) botPlan(st, m.playerId, iso);
  const before = st.round;
  const next = resolveRound(st, { now: iso });
  c.state = next;
  drainNotifications(db, c);
  c.version++;
  audit(db, null, 'campaign.resolve', `Runda ${before} razriješena`, c.id);
  if (next.phase === 'completed') {
    c.status = 'completed'; c.completedAt = iso;
    finalizeProfiles(db, c);
  } else c.clock = nextClock(c.schedule, now);
}

function finalizeProfiles(db: Db, c: CampaignRecord) {
  const st = c.state!;
  const rk = ranking(st);
  rk.forEach((r, i) => {
    const m = c.members.find((x) => x.playerId === r.playerId);
    if (!m?.userId) return;
    const prof = db.profiles[m.userId];
    if (!prof) return;
    const p = st.players[r.playerId];
    prof.totals.campaigns++; if (i === 0) prof.totals.wins++;
    prof.totals.battlesWon += p.stats.battlesWon; prof.totals.territoriesCaptured += p.stats.territoriesCaptured;
    prof.achievements = [...new Set([...prof.achievements, ...p.achievements.filter((a) => !a.startsWith('__'))])];
    prof.history.unshift({ campaignId: c.id, name: c.name, rank: i + 1, players: rk.length, score: r.total, faction: p.faction, finishedAt: nowIso() });
  });
}

/** Rješava rundu ako je rok istekao (ili su svi spremni u razvojnom načinu). Idempotentno. */
export async function tickCampaign(id: string, force = false): Promise<boolean> {
  const store = getStore();
  const due = await store.read((db) => {
    const c = db.campaigns[id];
    if (!c || c.status !== 'active' || !c.state) return false;
    if (force) return true;
    if (c.clock.roundDeadline && Date.now() >= new Date(c.clock.roundDeadline).getTime()) return true;
    if (c.schedule.resolveWhenAllReady) {
      const humans = c.members.filter((m) => !m.isBot);
      return humans.length > 0 && humans.every((m) => c.state!.players[m.playerId].ready);
    }
    return false;
  });
  if (!due) return false;
  return store.tx((db) => {
    const c = db.campaigns[id];
    if (!c || c.status !== 'active' || !c.state) return false;
    try { doResolve(db, c, new Date()); return true; }
    catch (e) { logError(db, 'resolve', e, { campaignId: id }); throw e; }
  }).catch(async (e) => { await store.tx((db) => logError(db, 'resolve', e, { campaignId: id })).catch(() => undefined); return false; });
}

export async function tickAll(): Promise<number> {
  const ids = await getStore().read((db) => Object.values(db.campaigns).filter((c) => c.status === 'active').map((c) => c.id));
  let n = 0;
  for (const id of ids) if (await tickCampaign(id)) n++;
  return n;
}

// ───────────── Pogled ─────────────
export async function getCampaignView(userId: string, id: string): Promise<{ meta: CampaignMeta; view: PlayerView | null; unread: number }> {
  await tickCampaign(id);
  return getStore().read((db) => {
    const c = getCampaign(db, id);
    const m = memberOf(c, userId);
    const unread = db.notifications.filter((n) => n.userId === userId && n.campaignId === id && !n.readAt).length;
    return { meta: toMeta(c, userId), view: c.state ? getPlayerView(c.state, m.playerId) : null, unread };
  });
}
export async function getLobby(userId: string, id: string) {
  return getStore().read((db) => { const c = getCampaign(db, id); memberOf(c, userId); return toMeta(c, userId); });
}

// ───────────── Igračke akcije (sve validirano na serveru) ─────────────
async function mutate<T>(userId: string, id: string, fn: (st: GameState, playerId: string, c: CampaignRecord, db: Db) => T): Promise<T> {
  await tickCampaign(id);
  return getStore().tx((db) => {
    const c = getCampaign(db, id);
    const m = memberOf(c, userId);
    if (c.status === 'disabled') throw new ApiError(409, 'Kampanja je onemogućena.');
    if (c.status !== 'active' || !c.state) throw new ApiError(409, 'Kampanja nije aktivna.');
    const res = fn(c.state, m.playerId, c, db);
    drainNotifications(db, c);
    c.version++;
    return res;
  });
}

export async function orderActionSvc(userId: string, id: string, body: any) {
  return mutate(userId, id, (st, pid) => {
    const now = nowIso();
    switch (body.action) {
      case 'create': { const r = addOrder(st, pid, body.order as OrderInput, body.status, now); if (!r.ok) throw new ApiError(422, r.validation.errors[0] ?? 'Naredba nije valjana.', r.validation); return { order: r.order, validation: r.validation }; }
      case 'update': { const r = updateOrder(st, pid, body.orderId, body.order, now); if (!r.ok) throw new ApiError(422, r.validation.errors[0] ?? 'Naredba nije valjana.', r.validation); return { order: r.order, validation: r.validation }; }
      case 'remove': { const r = removeOrder(st, pid, body.orderId); if (!r.ok) throw new ApiError(422, r.error!); return { ok: true }; }
      case 'submit': { const r = submitDraft(st, pid, body.orderId, now); if (!r.ok) throw new ApiError(422, r.validation.errors[0] ?? 'Naredba nije valjana.', r.validation); return { order: r.order, validation: r.validation }; }
      case 'reorder': { if (!reorderOrders(st, pid, body.orderIds)) throw new ApiError(422, 'Redoslijed se ne može mijenjati.'); return { ok: true }; }
      case 'ready': { const r = setReady(st, pid, body.ready); if (!r.ok) throw new ApiError(422, r.error!); return { ok: true }; }
      case 'tax': { const r = setTax(st, pid, body.tax); if (!r.ok) throw new ApiError(422, r.error!); return { ok: true }; }
    }
    throw new ApiError(400, 'Nepoznata akcija.');
  }).then(async (r) => { await tickCampaign(id); return r; });
}

export async function previewOrderSvc(userId: string, id: string, order: OrderInput, excludeId?: string) {
  return getStore().read((db) => {
    const c = getCampaign(db, id);
    const m = memberOf(c, userId);
    if (!c.state) throw new ApiError(409, 'Kampanja nije aktivna.');
    return previewOrder(c.state, m.playerId, order, { excludeId });
  });
}

export async function conditionalActionSvc(userId: string, id: string, body: any) {
  return mutate(userId, id, (st, pid) => {
    if (body.action === 'create') {
      const r = addConditional(st, pid, { trigger: body.trigger, condition: body.condition, action: body.action_, resourceReq: body.resourceReq, priority: body.priority, expiresRound: body.expiresRound }, nowIso());
      if (!r.ok) throw new ApiError(422, r.error!);
      return { order: r.order };
    }
    const r = removeConditional(st, pid, body.id);
    if (!r.ok) throw new ApiError(422, r.error!);
    return { ok: true };
  });
}

export async function diplomacyActionSvc(userId: string, id: string, body: any) {
  return mutate(userId, id, (st, pid) => {
    let r: { ok: boolean; error?: string };
    if (body.action === 'respond') r = respondToOffer(st, pid, body.offerId, body.accept, { toTerritoryId: body.toTerritoryId });
    else if (body.action === 'withdraw') r = withdrawOffer(st, pid, body.offerId);
    else if (body.action === 'terminate') r = terminateAlliance(st, pid, body.allianceId);
    else r = sendMessage(st, pid, body.to, body.body, nowIso());
    if (!r.ok) throw new ApiError(422, r.error ?? 'Radnja nije moguća.');
    return { ok: true };
  });
}

// ───────────── Razvojni alati ─────────────
export async function devAction(userId: string, id: string, action: 'resolve' | 'resolve_all') {
  if (!devEnabled()) throw new ApiError(403, 'Razvojni način nije dostupan.');
  const c = await getStore().read((db) => getCampaign(db, id));
  const user = await getStore().read((db) => db.users[userId]);
  if (!c.devSimulation) throw new ApiError(403, 'Samo za razvojne simulacije.');
  if (c.ownerId !== userId && !user?.isAdmin) throw new ApiError(403, 'Nemaš ovlasti.');
  if (action === 'resolve') { await tickCampaign(id, true); return { resolved: 1 }; }
  let n = 0;
  for (let i = 0; i < 8; i++) {
    const active = await getStore().read((db) => db.campaigns[id]?.status === 'active');
    if (!active) break;
    await getStore().tx((db) => {
      const cc = getCampaign(db, id);
      // Ljudski igrač bez naredbi → automatska obrana (kao i u stvarnoj igri)
      doResolve(db, cc, new Date());
    });
    n++;
  }
  return { resolved: n };
}

// ───────────── Obavijesti i profil ─────────────
export async function listNotifications(userId: string, campaignId?: string) {
  return getStore().read((db) => db.notifications.filter((n) => n.userId === userId && (!campaignId || n.campaignId === campaignId)).slice(-60).reverse());
}
export async function markNotificationsRead(userId: string, ids?: string[]) {
  return getStore().tx((db) => { for (const n of db.notifications) if (n.userId === userId && !n.readAt && (!ids || ids.includes(n.id))) n.readAt = nowIso(); return { ok: true }; });
}
export async function getProfile(userId: string) { return getStore().read((db) => ({ profile: db.profiles[userId], user: { id: userId, username: db.users[userId].username, isAdmin: db.users[userId].isAdmin } })); }
export async function updateProfile(userId: string, body: { displayName?: string; preferredFaction?: FactionId | null; prefs?: Record<string, boolean> }) {
  return getStore().tx((db) => {
    const p = db.profiles[userId];
    if (body.displayName) p.displayName = body.displayName;
    if (body.preferredFaction !== undefined) p.preferredFaction = body.preferredFaction;
    if (body.prefs) p.prefs = { ...p.prefs, ...body.prefs };
    return p;
  });
}
export async function savePushSubscription(userId: string, sub: { endpoint: string; keys: { p256dh: string; auth: string } }) {
  return getStore().tx((db) => {
    db.pushSubs = db.pushSubs.filter((s) => s.endpoint !== sub.endpoint);
    db.pushSubs.push({ userId, endpoint: sub.endpoint, keys: sub.keys, createdAt: nowIso() });
    db.profiles[userId].prefs.push = true;
    return { ok: true };
  });
}

// ───────────── Administracija ─────────────
async function requireAdmin(userId: string) {
  const u = await getStore().read((db) => db.users[userId]);
  if (!u?.isAdmin) throw new ApiError(403, 'Samo za administratore.');
}
export async function adminOverview(userId: string) {
  await requireAdmin(userId);
  return getStore().read((db) => ({
    users: Object.values(db.users).map((u) => ({ id: u.id, username: u.username, isAdmin: u.isAdmin, disabled: !!u.disabled, createdAt: u.createdAt })),
    campaigns: Object.values(db.campaigns).map((c) => ({ id: c.id, name: c.name, status: c.status, members: c.members.length, round: c.state?.round ?? null, dev: c.devSimulation, deadline: c.clock.roundDeadline, version: c.version, schedule: c.schedule, disabledReason: c.disabledReason, createdAt: c.createdAt })),
    errors: db.errors.slice(-50).reverse(), audit: db.audit.slice(-80).reverse(), balanceOverrides: db.balanceOverrides, baseConfig: GAME_CONFIG,
  }));
}
export async function adminCampaignDetail(userId: string, id: string) {
  await requireAdmin(userId);
  return getStore().read((db) => {
    const c = getCampaign(db, id);
    const st = c.state;
    return {
      meta: toMeta(c, userId), members: c.members,
      players: st ? Object.values(st.players).map((p) => ({ id: p.id, name: p.name, faction: p.faction, status: p.status, resources: p.resources, stability: p.stability, techs: p.techs, autopilot: p.autopilot, missedRounds: p.missedRounds, stats: p.stats, reputation: p.reputation, objective: p.objective.title })) : [],
      events: st?.events ?? [], reports: st ? Object.values(st.reports).filter((r) => r.round === st.round - 1 || st.phase === 'completed').map((r) => ({ round: r.round, playerId: r.playerId, entries: r.entries.length, mood: r.mood })) : [],
      suspicious: st ? suspicious(st) : [],
    };
  });
}
function suspicious(st: GameState) {
  const out: string[] = [];
  for (const p of Object.values(st.players)) {
    for (const k of Object.keys(p.resources) as Array<keyof typeof p.resources>) if (p.resources[k] < 0) out.push(`${p.name}: negativan resurs ${k} (${p.resources[k]})`);
    if (p.missedRounds >= 3) out.push(`${p.name}: ${p.missedRounds} propuštene runde zaredom`);
    if (p.stats.attacksLaunched > 12) out.push(`${p.name}: neuobičajeno puno napada (${p.stats.attacksLaunched})`);
  }
  return out;
}
export async function adminAction(userId: string, body: { action: string; campaignId?: string; round?: number; type?: string; reason?: string; overrides?: unknown; targetUserId?: string; schedule?: Partial<Schedule> }) {
  await requireAdmin(userId);
  if (body.action === 'resolve' && body.campaignId) { await tickCampaign(body.campaignId, true); return { ok: true }; }
  return getStore().tx((db) => {
    switch (body.action) {
      case 'disable': { const c = getCampaign(db, body.campaignId!); c.status = 'disabled'; c.disabledReason = body.reason ?? 'Onemogućeno od strane administratora.'; c.version++; audit(db, userId, 'admin.disable', c.disabledReason, c.id); return { ok: true }; }
      case 'enable': { const c = getCampaign(db, body.campaignId!); if (c.status === 'disabled') { c.status = c.state ? (c.state.phase === 'completed' ? 'completed' : 'active') : 'waiting'; c.disabledReason = undefined; c.version++; audit(db, userId, 'admin.enable', c.name, c.id); } return { ok: true }; }
      case 'event': {
        const c = getCampaign(db, body.campaignId!);
        if (!c.state) throw new ApiError(409, 'Kampanja nije pokrenuta.');
        const ev = c.state.events.find((e) => e.round === body.round);
        if (!ev || ev.announced) throw new ApiError(409, 'Događaj je već objavljen i ne može se mijenjati.');
        const types = ['none', 'drought', 'gold_rush', 'plague', 'rebellion', 'trade_boom', 'winter', 'storm', 'harvest'];
        if (!types.includes(body.type ?? '')) throw new ApiError(400, 'Nepoznat događaj.');
        ev.type = body.type as typeof ev.type; c.version++; audit(db, userId, 'admin.event', `R${body.round}: ${body.type}`, c.id); return { ok: true };
      }
      case 'balance': {
        if (typeof body.overrides !== 'object' || body.overrides === null) throw new ApiError(400, 'Neispravne vrijednosti.');
        db.balanceOverrides = body.overrides as typeof db.balanceOverrides; audit(db, userId, 'admin.balance', JSON.stringify(body.overrides).slice(0, 300)); return { ok: true };
      }
      case 'schedule': {
        const c = getCampaign(db, body.campaignId!);
        c.schedule = { ...c.schedule, ...body.schedule }; if (c.status === 'active') c.clock = nextClock(c.schedule, new Date()); c.version++; audit(db, userId, 'admin.schedule', JSON.stringify(body.schedule), c.id); return { ok: true };
      }
      case 'disable_user': { const u = db.users[body.targetUserId!]; if (!u) throw new ApiError(404, 'Korisnik ne postoji.'); u.disabled = !u.disabled; audit(db, userId, 'admin.user', `${u.username}: disabled=${u.disabled}`); return { ok: true }; }
    }
    throw new ApiError(400, 'Nepoznata admin akcija.');
  });
}
export const FACTIONS_LIST = FACTION_IDS;
