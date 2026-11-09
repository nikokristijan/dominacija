/**
 * RAZRJEŠENJE RUNDE — srce igre.
 * Deterministično i idempotentno: isto stanje + iste naredbe = isti ishod; druga rezolucija iste runde je no-op.
 * Redoslijed: zaključavanje → protuobavještajne mjere → sabotaža → diplomacija → trgovina → istraživanje/gradnja/novačenje
 *   → obrana → vojne operacije (uz uvjetne naredbe) → ekonomija → dolasci → obavještajni izvještaji → bodovi → izvještaji → nova runda.
 */
import { rewardText } from './camps';
import { RESOURCE_TYPES, UNIT_TYPES } from './config';
import { adjustReputation, decayReputation, kindLabel } from './diplomacy';
import {
  buildingCost, currentEvent, forecastEconomy, maxPopulation, recruitCost, stabilityDelta, taxIncome, territoryProduction, upkeepOf,
} from './economy';
import { gatherIntel, runSabotage, setDisinfo } from './espionage';
import { resolveBattle, type Force } from './combat';
import { announceEvent } from './events';
import { objectiveProgress } from './objectives';
import { orderCost, attackSupplyRequirement, tradeRate } from './orders';
import { computeAllScores, publicScore, ranking } from './scoring';
import { TECH_BY_ID, getMods } from './tech';
import type {
  BattleReport, ConditionalOrder, DailyReport, GameState, Mood, Order, PlayerId, PlayerState, Resources, ResourceLedger, Territory, TerritoryId, Units,
} from './types';
import {
  activeAlliance, addUnits, canAfford, cloneRes, computeSupply, describeUnits, emit, emptyResources, hasPact, isAllied, neighborIds, nextId, notify,
  playerTerritories, pname, round2, scaleRes, subUnits, unitTotal, cleanUnits,
} from './util';

interface Ctx {
  s: GameState; R: number; now: string;
  ledger: Record<PlayerId, ResourceLedger>;
  lost: Record<PlayerId, number>; conquered: Record<PlayerId, number>; capitalLost: Record<PlayerId, boolean>;
  moods: Record<PlayerId, Mood>;
  battlesByTarget: Map<TerritoryId, Force[]>;
  attackedBy: Map<TerritoryId, PlayerId[]>;
  pendingTechs: Array<{ pid: PlayerId; techId: string }>;
  intelOrders: Order[];
  noOrders: Set<PlayerId>;
}

const pay = (c: Ctx, pid: PlayerId, cost: Partial<Resources>): boolean => {
  const p = c.s.players[pid];
  for (const k of RESOURCE_TYPES) if (p.resources[k] + 1e-9 < (cost[k] ?? 0)) return false;
  for (const k of RESOURCE_TYPES) { p.resources[k] = round2(p.resources[k] - (cost[k] ?? 0)); c.ledger[pid].spending[k] = round2(c.ledger[pid].spending[k] + (cost[k] ?? 0)); }
  return true;
};
const gain = (c: Ctx, pid: PlayerId, res: Partial<Resources>, bucket: 'trade' | 'production' = 'trade') => {
  const p = c.s.players[pid];
  for (const k of RESOURCE_TYPES) { p.resources[k] = round2(p.resources[k] + (res[k] ?? 0)); c.ledger[pid][bucket][k] = round2(c.ledger[pid][bucket][k] + (res[k] ?? 0)); }
};
const mood = (c: Ctx, pid: PlayerId, m: Mood, strong = false) => {
  const order: Mood[] = ['neutral', 'happy', 'confident', 'thinking', 'surprised', 'angry', 'defeated', 'celebrating'];
  if (strong || order.indexOf(m) > order.indexOf(c.moods[pid])) c.moods[pid] = m;
};
const done = (o: Order, ok: boolean, summary: string) => { o.status = ok ? 'executed' : 'failed'; o.result = { ok, summary }; };

function makeCtx(s: GameState, R: number, now: string): Ctx {
  const c: Ctx = {
    s, R, now, ledger: {}, lost: {}, conquered: {}, capitalLost: {}, moods: {}, battlesByTarget: new Map(), attackedBy: new Map(),
    pendingTechs: [], intelOrders: [], noOrders: new Set(),
  };
  for (const pid of s.playerOrder) {
    const p = s.players[pid];
    c.ledger[pid] = { before: cloneRes(p.resources), production: emptyResources(), taxes: 0, upkeep: emptyResources(), trade: emptyResources(), spending: emptyResources(), after: emptyResources() };
    c.lost[pid] = 0; c.conquered[pid] = 0; c.capitalLost[pid] = false; c.moods[pid] = 'neutral';
  }
  return c;
}

/** Što se razrješava u podne: špijunaža (sve) i diplomatske ponude/darovi koji ne mijenjaju kartu. Ostalo ide u večernje razrješenje. */
export const MIDDAY_DIPLOMACY = ['alliance', 'nap', 'trade', 'improve'] as const;
export const isMiddayOrder = (o: Order) => o.type === 'espionage' || (o.type === 'diplomacy' && (MIDDAY_DIPLOMACY as readonly string[]).includes(o.params.kind));

/**
 * Podnevno razrješenje: izvidnici se vraćaju, ponude stižu primateljima, prihvaćeni savezi/trgovine se izvršavaju.
 * Ne pomiče dan, ne dira kartu i idempotentno je. Večernje razrješenje (resolveRound) preuzima ostatak dana.
 */
export function resolveMidday(prev: GameState, opts: { now?: string } = {}): GameState {
  if (prev.phase !== 'planning' || prev.middayDone === prev.round) return prev;
  const s = structuredClone(prev);
  const R = s.round;
  const now = opts.now ?? new Date(0).toISOString();
  const c = makeCtx(s, R, now);
  const mid = s.orders.filter((o) => o.round === R && o.status === 'submitted' && isMiddayOrder(o));
  for (const o of mid) o.status = 'locked';
  const byType = (t: Order['type']) => mid.filter((o) => o.type === t).sort(orderSort(s));
  for (const o of byType('espionage')) {
    if (o.type !== 'espionage') continue;
    if (o.params.action === 'counter' || o.params.action === 'false_info') {
      if (!pay(c, o.playerId, orderRes(s, o))) { done(o, false, 'Nedovoljno resursa.'); continue; }
      if (o.params.action === 'counter') { s.players[o.playerId].counterIntelUntil = R; done(o, true, 'Protuobavještajne mjere aktivne danas.'); }
      else { setDisinfo(s, o.playerId); done(o, true, 'Lažne informacije su pušteni u promet.'); }
    } else c.intelOrders.push(o);
  }
  processDiplomacy(c, byType('diplomacy'));
  executeAcceptedOffers(c, MIDDAY_DIPLOMACY);
  runIntel(c);
  // Obavijest svakome čija je naredba stigla do rezultata
  for (const pid of s.playerOrder) {
    const mine = mid.filter((o) => o.playerId === pid && o.status === 'executed');
    const spy = mine.find((o) => o.type === 'espionage' && o.params.action !== 'counter' && o.params.action !== 'false_info');
    if (spy?.result) notify(s, { playerId: pid, kind: 'resolution', title: 'Izvidnici su se vratili', body: spy.result.summary.slice(0, 110) });
    else if (mine.some((o) => o.type === 'diplomacy')) notify(s, { playerId: pid, kind: 'diplomatic', title: 'Podnevno izvješće', body: 'Tvoje diplomatske poruke su stigle do primatelja.' });
  }
  for (const pid of s.playerOrder) c.ledger[pid].after = cloneRes(s.players[pid].resources);
  s.carry = { round: R, ledger: Object.fromEntries(s.playerOrder.map((pid) => [pid, { before: cloneRes(c.ledger[pid].before), spending: cloneRes(c.ledger[pid].spending), trade: cloneRes(c.ledger[pid].trade) }])) };
  s.middayDone = R;
  return s;
}

export function resolveRound(prev: GameState, opts: { now?: string } = {}): GameState {
  if (prev.phase === 'completed' || prev.resolvedRounds.includes(prev.round)) return prev; // idempotencija
  const s = structuredClone(prev);
  const R = s.round;
  const now = opts.now ?? new Date(0).toISOString();
  s.phase = 'resolution';
  const c = makeCtx(s, R, now);
  const scoreBefore: Record<PlayerId, number> = {};
  for (const pid of s.playerOrder) scoreBefore[pid] = publicScore(s, pid);
  // Večernje razrješenje nastavlja dnevni obračun započet u podne
  if (s.carry?.round === R) for (const pid of s.playerOrder) {
    const k = s.carry.ledger[pid]; if (!k) continue;
    c.ledger[pid].before = cloneRes(k.before); c.ledger[pid].spending = cloneRes(k.spending); c.ledger[pid].trade = cloneRes(k.trade);
  }

  lockOrders(c);
  const orders = s.orders.filter((o) => o.round === R && o.status === 'locked');
  const byPhase = (type: Order['type']) => orders.filter((o) => o.type === type).sort(orderSort(s));

  // 1) Protuobavještajne mjere i dezinformacije
  for (const o of byPhase('espionage')) {
    if (o.type !== 'espionage') continue;
    if (o.params.action === 'counter' || o.params.action === 'false_info') {
      if (!pay(c, o.playerId, orderRes(s, o))) { done(o, false, 'Nedovoljno resursa.'); continue; }
      if (o.params.action === 'counter') { s.players[o.playerId].counterIntelUntil = R; done(o, true, 'Protuobavještajne mjere aktivne ove runde.'); }
      else { setDisinfo(s, o.playerId); done(o, true, 'Lažne informacije su pušteni u promet.'); }
    } else c.intelOrders.push(o);
  }
  // 2) Sabotaža
  for (const o of byPhase('sabotage')) {
    if (o.type !== 'sabotage') continue;
    if (!pay(c, o.playerId, orderRes(s, o))) { done(o, false, 'Nedovoljno resursa.'); continue; }
    if (hasPact(s, o.playerId, o.params.targetPlayerId)) breakPact(c, o.playerId, o.params.targetPlayerId, 'sabotaža');
    const r = runSabotage(s, o.playerId, o.params, now);
    done(o, r.ok, r.text);
    emit(s, R, 'espionage', r.text, [o.playerId], r.ok ? 'good' : 'warn');
  }
  // 3) Diplomacija
  processDiplomacy(c, byPhase('diplomacy'));
  executeAcceptedOffers(c);
  // 4) Trgovina
  for (const o of byPhase('trade')) {
    if (o.type !== 'trade') continue;
    const p = s.players[o.playerId];
    const rate = tradeRate(s, p, o.params.give, o.params.receive);
    if (!pay(c, o.playerId, { [o.params.give]: o.params.amount })) { done(o, false, 'Nedovoljno resursa.'); continue; }
    const got = Math.floor(o.params.amount * rate);
    gain(c, o.playerId, { [o.params.receive]: got });
    p.stats.tradesDone++; p.reputation.tradeCount++;
    done(o, true, `Razmijenjeno ${o.params.amount} → ${got}.`);
    emit(s, R, 'economy', `Trgovačka ekspedicija: ${o.params.amount} ${lbl(o.params.give)} → ${got} ${lbl(o.params.receive)}.`, [o.playerId], 'good');
  }
  // 5) Istraživanje, gradnja, novačenje
  for (const o of byPhase('research')) {
    if (o.type !== 'research') continue;
    if (!pay(c, o.playerId, orderRes(s, o))) { done(o, false, 'Nedovoljno resursa.'); continue; }
    c.pendingTechs.push({ pid: o.playerId, techId: o.params.techId });
    done(o, true, 'Istraživanje završeno.');
  }
  for (const o of byPhase('build')) {
    if (o.type !== 'build') continue;
    const t = s.map.territories[o.params.territoryId];
    if (t.owner !== o.playerId || t.construction) { done(o, false, 'Teritorij više nije dostupan za gradnju.'); continue; }
    const lvl = t.building === o.params.building ? t.buildingLevel + 1 : 1;
    if (!pay(c, o.playerId, buildingCost(s.config, s.players[o.playerId], o.params.building, lvl))) { done(o, false, 'Nedovoljno resursa.'); continue; }
    t.construction = { building: o.params.building, level: lvl, completesRound: R + 1 };
    done(o, true, `Gradnja započeta: ${s.config.buildings[o.params.building].name}.`);
  }
  for (const o of byPhase('recruit')) {
    if (o.type !== 'recruit') continue;
    const t = s.map.territories[o.params.territoryId];
    const p = s.players[o.playerId];
    if (t.owner !== o.playerId) { done(o, false, 'Teritorij više nije tvoj.'); continue; }
    if (!pay(c, o.playerId, recruitCost(s.config, p, o.params.unit, o.params.count))) { done(o, false, 'Nedovoljno resursa.'); continue; }
    t.population = Math.max(10, t.population - o.params.count * s.config.units[o.params.unit].popCost);
    p.pendingRecruits.push({ territoryId: t.id, unit: o.params.unit, count: o.params.count, arrivesRound: R + 1 });
    done(o, true, `Novačenje: ${o.params.count} × ${s.config.units[o.params.unit].name}.`);
  }
  // 6) Obrana
  for (const o of byPhase('defend')) {
    if (o.type !== 'defend') continue;
    const t = s.map.territories[o.params.territoryId];
    if (t.owner !== o.playerId) { done(o, false, 'Teritorij više nije tvoj.'); continue; }
    if (o.params.stance === 'entrench') { addEffect(t, 'entrenched', R); done(o, true, `${t.name}: utvrđena obrana.`); }
    else if (o.params.stance === 'fortify') {
      if (!pay(c, o.playerId, s.config.defense.fortifyCost)) { done(o, false, 'Nedovoljno resursa.'); continue; }
      t.defenseLevel = Math.min(s.config.defense.maxDefenseLevel, t.defenseLevel + 1);
      done(o, true, `${t.name}: razina obrane ${t.defenseLevel}.`);
    } else {
      const from = s.map.territories[o.params.fromTerritoryId!];
      const u = capUnits(o.params.units ?? {}, from.garrison);
      if (from.owner !== o.playerId || !unitTotal(u)) { done(o, false, 'Nema postrojbi za pojačanje.'); continue; }
      from.garrison = subUnits(from.garrison, u); t.garrison = addUnits(t.garrison, u);
      done(o, true, `Pojačanje: ${describeUnits(u)} → ${t.name}.`);
    }
  }
  // 7) Resistance
  for (const o of byPhase('resistance')) {
    if (o.type !== 'resistance') continue;
    const p = s.players[o.playerId];
    if (p.status !== 'resistance' || !p.resistance) { done(o, false, 'Nisi u stanju Otpora.'); continue; }
    if (o.params.kind === 'emergency_recruit') {
      const t = s.map.territories[o.params.territoryId];
      if (t.owner !== o.playerId) { done(o, false, 'Teritorij više nije tvoj.'); continue; }
      t.garrison = addUnits(t.garrison, { infantry: s.config.resistance.emergencyRecruitCount });
      p.resistance.emergencyUsedRound = R;
      done(o, true, `Hitno novačenje: ${s.config.resistance.emergencyRecruitCount} milicionara u ${t.name}.`);
      emit(s, R, 'military', `Hitno novačenje: ${s.config.resistance.emergencyRecruitCount} novih boraca otpora u ${t.name}.`, [o.playerId], 'good');
    }
  }
  // 8) Vojne operacije
  processMilitary(c, byPhase('attack'), byPhase('resistance'));
  // 9) Ekonomija i naselja
  processEconomy(c);
  // 10) Dolasci (novaci, gradnje, tehnologije)
  processArrivals(c);
  // 11) Obavještajni izvještaji (stanje na početku nove runde)
  runIntel(c);
  // 12) Postignuća, bodovi, izvješća, nova runda
  updateObjectivesAndAchievements(c);
  s.scores = computeAllScores(s);
  for (const pid of s.playerOrder) c.ledger[pid].after = cloneRes(s.players[pid].resources);
  s.history.push({ round: R, scores: Object.fromEntries(s.playerOrder.map((id) => [id, s.scores[id].total - s.scores[id].objective])), territories: Object.fromEntries(s.playerOrder.map((id) => [id, s.scores[id].territoryCount])) });
  // Glasine o izdajniku (samo ako ga u kampanji uistinu ima): napetost bez otkrivanja tko je
  if (R === 3 && s.playerOrder.some((id) => s.players[id].objective.type === 'traitor')) emit(s, R, 'event', 'Glasine: među kraljevstvima šapće se da netko planira izdaju. Čuvaj leđa — i savez nije jamstvo.', s.playerOrder, 'warn');
  buildReports(c, scoreBefore);
  advance(c);
  s.carry = undefined;
  s.resolvedRounds.push(R);
  return s;
}

// ───────────────────────── pomoćno ─────────────────────────
const lbl = (k: keyof Resources) => ({ gold: 'zlato', food: 'hrana', iron: 'željezo', wood: 'drvo', influence: 'utjecaj' }[k]);
const orderSort = (s: GameState) => (a: Order, b: Order) => s.playerOrder.indexOf(a.playerId) - s.playerOrder.indexOf(b.playerId) || a.priority - b.priority || a.id.localeCompare(b.id);
function orderRes(s: GameState, o: Order): Partial<Resources> {
  return orderCost(s, s.players[o.playerId], o).res;
}

function addEffect(t: Territory, kind: 'entrenched' | 'sabotaged_production' | 'plague', untilRound: number) {
  t.effects = t.effects.filter((e) => e.kind !== kind);
  t.effects.push({ kind, untilRound });
}
const isEntrenched = (t: Territory, R: number) => t.effects.some((e) => e.kind === 'entrenched' && e.untilRound >= R);
function capUnits(want: Units, have: Units): Units {
  const o: Units = {};
  for (const k of UNIT_TYPES) { const n = Math.min(want[k] ?? 0, have[k] ?? 0); if (n > 0) o[k] = n; }
  return o;
}

function lockOrders(c: Ctx) {
  const { s, R } = c;
  s.phase = 'locked';
  for (const pid of s.playerOrder) {
    const p = s.players[pid];
    let submitted = 0;
    for (const o of s.orders) {
      if (o.playerId !== pid || o.round !== R) continue;
      if (o.status === 'submitted') { o.status = 'locked'; submitted++; }
      else if (o.status === 'draft') { o.status = 'cancelled'; o.result = { ok: false, summary: 'Nacrt nije predan prije isteka roka.' }; }
    }
    const actedAtMidday = s.orders.some((o) => o.playerId === pid && o.round === R && (o.status === 'executed' || o.status === 'failed'));
    if (actedAtMidday) submitted++;
    if (submitted === 0 && !p.ready) {
      p.missedRounds++;
      c.noOrders.add(pid);
      if (p.missedRounds >= s.config.campaign.autopilotAfterMissedRounds) p.autopilot = true;
    } else if (submitted > 0) { p.missedRounds = 0; p.autopilot = false; }
    // Automatsko obrambeno ponašanje za neaktivne igrače
    if (c.noOrders.has(pid) || p.autopilot && submitted === 0) {
      for (const t of playerTerritories(s, pid)) {
        const border = neighborIds(s, t.id).some((n) => { const ow = s.map.territories[n].owner; return ow && ow !== pid && !isAllied(s, pid, ow); });
        if (border || t.isCapital) addEffect(t, 'entrenched', R);
      }
      emit(s, R, 'notice', 'Nisi predao naredbe — kraljevstvo je automatski prešlo u obranu (granični teritoriji utvrđeni).', [pid], 'warn', { mood: 'thinking' });
    }
  }
}

function breakPact(c: Ctx, breaker: PlayerId, other: PlayerId, reason: string) {
  const { s } = c;
  const al = activeAlliance(s, breaker, other);
  if (!al) return;
  al.status = 'broken'; al.endedRound = c.R; al.endedBy = breaker;
  const b = s.players[breaker];
  const betrayal = al.kind === 'alliance';
  addGrudge(s, other, breaker, betrayal ? 3 : 2);
  if (betrayal && b.objective.type === 'traitor' && b.objective.params.base === undefined) b.objective.params.base = b.stats.territoriesCaptured;
  if (betrayal) b.reputation.betrayals++; else b.reputation.brokenTreaties++;
  adjustReputation(s, b, betrayal ? s.config.diplomacy.reputation.betrayal : s.config.diplomacy.reputation.brokenTreaty);
  emit(s, c.R, 'diplomacy', betrayal ? `IZDAJA! ${b.name} je prekršio savez s kraljevstvom ${pname(s, other)} (${reason}).` : `${b.name} je prekršio sporazum o nenapadanju s ${pname(s, other)} (${reason}).`, s.playerOrder.filter((id) => !al.secret || id === breaker || id === other), 'bad', { mood: 'surprised' });
  notify(s, { playerId: other, kind: 'diplomatic', title: betrayal ? 'Izdaja!' : 'Sporazum prekršen', body: `${b.name} je prekršio ${betrayal ? 'savez' : 'sporazum'} (${reason}).` });
  mood(c, other, betrayal ? 'surprised' : 'angry');
}

// ───────────────────────── Diplomacija ─────────────────────────
function runIntel(c: Ctx) {
  const { s, R, now } = c;
  for (const o of c.intelOrders.sort(orderSort(s))) {
    if (o.type !== 'espionage') continue;
    if (!pay(c, o.playerId, orderRes(s, o))) { done(o, false, 'Nedovoljno resursa.'); continue; }
    const r = gatherIntel(s, o.playerId, o.params, now);
    if (r.ok) {
      s.intel.push(r.report);
      done(o, true, r.report.summary);
      emit(s, R, 'espionage', r.report.summary, [o.playerId], 'info', { mood: 'thinking' });
      mood(c, o.playerId, 'thinking');
    } else {
      const tp = o.params.targetPlayerId ?? (o.params.targetTerritoryId ? s.map.territories[o.params.targetTerritoryId].owner : null);
      done(o, false, 'Špijun je uhvaćen.');
      s.intel.push({ id: nextId(s, 'i'), owner: o.playerId, target: tp, territoryId: o.params.targetTerritoryId, kind: o.params.action, round: R, createdAt: now, confidence: 'failed', data: {}, summary: 'Špijun je uhvaćen — nema podataka.' });
      emit(s, R, 'espionage', `Tvoj špijun je uhvaćen${tp ? ` u kraljevstvu ${pname(s, tp)}` : ''}. Nema novih podataka.`, [o.playerId], 'warn', { mood: 'surprised' });
      if (tp) {
        s.players[tp].stats.spiesCaught++;
        const identified = r.ratio < s.config.espionage.lowRatio * 0.85;
        emit(s, R, 'espionage', identified ? `Uhvaćen je špijun iz kraljevstva ${pname(s, o.playerId)}!` : 'Uhvaćen je špijun nepoznatog podrijetla.', [tp], 'info', { mood: 'confident' });
      }
    }
  }
}

function processDiplomacy(c: Ctx, orders: Order[]) {
  const { s, R } = c;
  const annexes = new Map<TerritoryId, Order[]>();
  for (const o of orders) {
    if (o.type !== 'diplomacy') continue;
    const p = s.players[o.playerId];
    const k = o.params.kind;
    if (k === 'annex') { const arr = annexes.get(o.params.targetTerritoryId!) ?? []; arr.push(o); annexes.set(o.params.targetTerritoryId!, arr); continue; }
    const to = s.players[o.params.targetPlayerId!];
    if (!to) { done(o, false, 'Igrač ne postoji.'); continue; }
    if (k === 'improve') {
      const gift = o.params.terms?.give ?? {};
      if (!pay(c, o.playerId, orderRes(s, o))) { done(o, false, 'Nedovoljno resursa.'); continue; }
      gain(c, to.id, gift);
      adjustReputation(s, p, 2);
      notify(s, { playerId: to.id, kind: 'diplomatic', title: 'Dar', body: `${p.name} ti je poslao dar.` });
      emit(s, R, 'diplomacy', `Primio si dar od ${p.name}.`, [to.id], 'good', { mood: 'happy' });
      done(o, true, `Dar poslan kraljevstvu ${to.name}.`);
      continue;
    }
    if (!pay(c, o.playerId, orderRes(s, o))) { done(o, false, 'Nedovoljno utjecaja.'); continue; }
    s.offers.push({
      id: nextId(s, 'f'), kind: k, from: o.playerId, to: to.id, secret: !!o.params.secret, terms: o.params.terms ?? {}, status: 'pending', createdRound: R,
      expiresRound: R + s.config.diplomacy.offerExpiryRounds,
    });
    notify(s, { playerId: to.id, kind: k === 'trade' ? 'trade_offer' : 'alliance_offer', title: 'Nova diplomatska ponuda', body: `${p.name} ti šalje ponudu: ${kindLabel(k)}.` });
    done(o, true, `Ponuda (${kindLabel(k)}) poslana kraljevstvu ${to.name}.`);
    emit(s, R, 'diplomacy', `Ponuda (${kindLabel(k)}) poslana kraljevstvu ${to.name}.`, [o.playerId], 'info');
  }
  // Pripajanje neutralnih teritorija (sukob: veći ugled pobjeđuje, zatim redoslijed igrača)
  for (const [tid, list] of [...annexes.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const t = s.map.territories[tid];
    const sorted = list.sort((a, b) => s.players[b.playerId].reputation.score - s.players[a.playerId].reputation.score || orderSort(s)(a, b));
    let won = false;
    for (const o of sorted) {
      if (won || t.owner) { done(o, false, 'Teritorij je pripojio netko drugi.'); emit(s, R, 'diplomacy', `Pripajanje ${t.name} nije uspjelo — drugi igrač je bio brži.`, [o.playerId], 'warn'); continue; }
      if (!neighborIds(s, tid).some((n) => s.map.territories[n].owner === o.playerId)) { done(o, false, 'Teritorij više nije uz tvoje kraljevstvo.'); continue; }
      if (t.camp) { done(o, false, 'Razbojnički kamp mora se razbiti silom.'); continue; }
      if (!pay(c, o.playerId, orderRes(s, o))) { done(o, false, 'Nedovoljno utjecaja.'); continue; }
      t.owner = o.playerId; t.stability = 60;
      const keep = s.config.diplomacy.annexNativeKeep;
      t.garrison = cleanUnits(Object.fromEntries(UNIT_TYPES.map((u) => [u, Math.floor((t.garrison[u] ?? 0) * keep)])) as Units);
      won = true;
      c.conquered[o.playerId]++;
      s.players[o.playerId].stats.peakTerritories = Math.max(s.players[o.playerId].stats.peakTerritories, playerTerritories(s, o.playerId).length);
      done(o, true, `Teritorij ${t.name} mirno je pripojen.`);
      emit(s, R, 'territory', `${t.name} se mirno pridružio kraljevstvu ${pname(s, o.playerId)}.`, s.playerOrder, 'good', { refs: { territoryId: tid } });
      mood(c, o.playerId, 'happy');
    }
  }
}

function executeAcceptedOffers(c: Ctx, kinds?: readonly string[]) {
  const { s, R } = c;
  for (const o of s.offers.filter((x) => x.status === 'accepted' && (!kinds || kinds.includes(x.kind))).sort((a, b) => a.id.localeCompare(b.id))) {
    const A = s.players[o.from], B = s.players[o.to];
    const fail = (t: string) => { o.status = 'failed'; o.resultText = t; emit(s, R, 'diplomacy', `${kindLabel(o.kind)} (${A.name} ↔ ${B.name}) nije izvršen: ${t}`, [A.id, B.id], 'warn'); };
    if (o.kind === 'trade') {
      const give = o.terms.give ?? {}, recv = o.terms.receive ?? {};
      if (!canAfford(A.resources, give) || !canAfford(B.resources, recv)) { fail('netko nema dovoljno resursa.'); continue; }
      for (const k of RESOURCE_TYPES) { A.resources[k] = round2(A.resources[k] - (give[k] ?? 0)); B.resources[k] = round2(B.resources[k] - (recv[k] ?? 0)); }
      const bonusA = 1 + getMods(A).treatyBonus, bonusB = 1 + getMods(B).treatyBonus;
      gain(c, B.id, scaleRes(give, bonusB)); gain(c, A.id, scaleRes(recv, bonusA));
      for (const k of RESOURCE_TYPES) { c.ledger[A.id].trade[k] = round2(c.ledger[A.id].trade[k] - (give[k] ?? 0)); c.ledger[B.id].trade[k] = round2(c.ledger[B.id].trade[k] - (recv[k] ?? 0)); }
      for (const p of [A, B]) { p.reputation.tradeCount++; p.stats.tradesDone++; adjustReputation(s, p, s.config.diplomacy.reputation.trade); }
      o.status = 'executed'; o.resultText = 'Razmjena izvršena.';
      emit(s, R, 'diplomacy', `Trgovinska razmjena ${A.name} ↔ ${B.name} izvršena.`, o.secret ? [A.id, B.id] : [A.id, B.id], 'good', { mood: 'happy' });
    } else if (o.kind === 'swap') {
      const m = s.map.territories[o.terms.swapMine!], th = s.map.territories[o.terms.swapTheirs!];
      if (!m || !th || m.owner !== A.id || th.owner !== B.id || m.isCapital || th.isCapital) { fail('teritoriji više nisu dostupni.'); continue; }
      m.owner = B.id; th.owner = A.id; m.effects = []; th.effects = [];
      o.status = 'executed'; o.resultText = 'Teritoriji razmijenjeni.';
      emit(s, R, 'territory', `Razmjena teritorija: ${m.name} ↔ ${th.name} (${A.name} i ${B.name}).`, o.secret ? [A.id, B.id] : s.playerOrder, 'info', { refs: { territoryId: m.id } });
    } else if (o.kind === 'support') {
      const from = s.map.territories[o.terms.fromTerritoryId!];
      const toT = s.map.territories[o.terms.toTerritoryId ?? B.capitalId] ?? s.map.territories[B.capitalId];
      if (!from || from.owner !== A.id || toT.owner !== B.id) { fail('izvorni ili odredišni teritorij nije dostupan.'); continue; }
      const u = capUnits(o.terms.units ?? {}, from.garrison);
      if (!unitTotal(u)) { fail('nema dostupnih postrojbi.'); continue; }
      from.garrison = subUnits(from.garrison, u); toT.garrison = addUnits(toT.garrison, u);
      A.reputation.supportsGiven++; adjustReputation(s, A, s.config.diplomacy.reputation.support);
      o.status = 'executed'; o.resultText = 'Potpora isporučena.';
      emit(s, R, 'diplomacy', `${A.name} je poslao vojnu potporu (${describeUnits(u)}) u ${toT.name}.`, [A.id, B.id], 'good', { mood: 'happy' });
    }
    // joint_attack se obrađuje nakon vojnih operacija
  }
}

// ───────────────────────── Vojska ─────────────────────────
interface Coalition { forces: Array<{ f: Force; o: Order }>; power: number }

function processMilitary(c: Ctx, attacks: Order[], resistance: Order[]) {
  const { s, R } = c;
  const forcesAll: Array<{ f: Force; o: Order; targetId: TerritoryId }> = [];
  const ev = currentEvent(s);
  // Odlazak postrojbi (istovremeno): trošenje hrane i oduzimanje garnizona
  for (const o of attacks) {
    if (o.type !== 'attack') continue;
    const p = s.players[o.playerId];
    const from = s.map.territories[o.params.fromId], target = s.map.territories[o.params.targetId];
    if (from.owner !== o.playerId) { done(o, false, 'Polazni teritorij više nije tvoj.'); continue; }
    if (target.owner === o.playerId) { done(o, false, 'Cilj je u međuvremenu postao tvoj.'); continue; }
    const units = capUnits(o.params.units, from.garrison);
    if (unitTotal(units) < 1) { done(o, false, 'Nema postrojbi za napad.'); continue; }
    const cost = Math.ceil(attackSupplyRequirement(s, o.playerId, o.params.fromId, o.params.targetId, units, o.params.strategy) * s.config.combat.supply[o.params.supply].ratio);
    if (!pay(c, o.playerId, { food: cost })) { done(o, false, 'Nedovoljno hrane za opskrbu.'); continue; }
    from.garrison = subUnits(from.garrison, units);
    p.stats.attacksLaunched++;
    if (target.owner && (isAllied(s, o.playerId, target.owner) || hasPact(s, o.playerId, target.owner))) {
      const wasAlly = isAllied(s, o.playerId, target.owner);
      breakPact(c, o.playerId, target.owner, 'napad');
      (o as any)._betrayal = wasAlly;
    }
    const f: Force = {
      playerId: o.playerId, fromId: from.id, units, strategy: o.params.strategy, formation: o.params.formation, risk: o.params.risk,
      retreatBelow: o.params.retreatBelow, supplyRatio: s.config.combat.supply[o.params.supply].ratio,
      mods: getMods(p), stability: p.stability, intelConfidence: intelConf(s, o.playerId, target.id), betrayal: !!(o as any)._betrayal, resistance: p.status === 'resistance',
      revenge: target.owner ? revengeBonus(p, target.owner) : 0,
    };
    forcesAll.push({ f, o, targetId: target.id });
    const arr = c.battlesByTarget.get(target.id) ?? []; arr.push(f); c.battlesByTarget.set(target.id, arr);
    if (target.owner) { const by = c.attackedBy.get(target.id) ?? []; by.push(o.playerId); c.attackedBy.set(target.id, by); }
  }
  // Ustanci (partizani) — napadaju nekadašnji teritorij
  for (const o of resistance) {
    if (o.type !== 'resistance' || o.params.kind !== 'uprising') continue;
    const p = s.players[o.playerId];
    const target = s.map.territories[o.params.territoryId];
    if (p.status !== 'resistance' || !p.resistance || target.owner === o.playerId) { done(o, false, 'Ustanak nije moguć.'); continue; }
    if (!pay(c, o.playerId, orderRes(s, o))) { done(o, false, 'Nedovoljno utjecaja.'); continue; }
    const n = s.config.resistance.uprisingBasePartisans + s.config.resistance.uprisingPartisansPerRound * R;
    const units: Units = { infantry: Math.ceil(n * 0.6), archers: Math.floor(n * 0.4) };
    p.resistance.partisanUsedRound = R;
    const f: Force = { playerId: o.playerId, fromId: '', units, strategy: 'ambush', formation: 'skirmish', risk: 'bold', retreatBelow: 0, supplyRatio: 1, mods: getMods(p), stability: Math.max(60, p.stability), intelConfidence: 1, betrayal: false, resistance: true };
    forcesAll.push({ f, o, targetId: target.id });
    const arr = c.battlesByTarget.get(target.id) ?? []; arr.push(f); c.battlesByTarget.set(target.id, arr);
    if (target.owner) { const by = c.attackedBy.get(target.id) ?? []; by.push(o.playerId); c.attackedBy.set(target.id, by); }
    emit(s, R, 'military', `Partizani su pokrenuli ustanak u teritoriju ${target.name}!`, [o.playerId], 'info', { mood: 'confident' });
  }

  // Uvjetne naredbe: reakcije na dolazne napade (prije bitaka)
  processConditionals(c, 'pre', forcesAll);

  // Pritisak diverzije: napadač → obrambeni igrač
  const pressure = new Set<string>();
  for (const fa of forcesAll) {
    if (fa.f.strategy === 'diversion' && unitTotal(fa.f.units) >= (s.config.combat.strategy.diversion.minSoldiers as number)) {
      const ow = s.map.territories[fa.targetId].owner;
      if (ow) pressure.add(`${fa.f.playerId}>${ow}:${fa.targetId}`);
    }
  }

  // Bitke po teritoriju (redoslijed po ID-u; garnizoni odmah nakon odlazaka)
  const targets = [...c.battlesByTarget.keys()].sort();
  const returning: Array<{ playerId: PlayerId; fromId: string; units: Units }> = [];
  const captured: Array<{ territoryId: TerritoryId; by: PlayerId; from: PlayerId | null }> = [];
  const pendingBattles: BattleReport[] = [];
  const jointAccepted = s.offers.filter((o) => o.kind === 'joint_attack' && o.status === 'accepted');
  for (const tid of targets) {
    const t = s.map.territories[tid];
    const forces = c.battlesByTarget.get(tid)!;
    // Koalicije: isti igrač ili saveznici
    const groups: Force[][] = [];
    for (const f of forces) {
      const g = groups.find((grp) => grp.some((x) => x.playerId === f.playerId || isAllied(s, x.playerId, f.playerId)));
      if (g) g.push(f); else groups.push([f]);
    }
    const coalitions = groups.map((g) => ({ forces: g, power: g.reduce((n, f) => n + unitTotal(f.units) * (f.strategy === 'diversion' ? 0.4 : 1), 0) })).sort((a, b) => b.power - a.power || s.playerOrder.indexOf(a.forces[0].playerId) - s.playerOrder.indexOf(b.forces[0].playerId));
    for (const co of coalitions) {
      const defenderId = t.owner;
      const dp = defenderId ? s.players[defenderId] : null;
      const isolated = defenderId ? !computeSupply(s, defenderId).has(t.id) && dp!.status !== 'resistance' : false;
      const under = defenderId !== null && co.forces.some((f) => [...pressure].some((k) => {
        const [pa, rest] = k.split('>'); const [dpid, tg] = rest.split(':');
        return isAllied(s, pa, f.playerId) && dpid === defenderId && tg !== tid;
      }));
      const adjacentFriendly = neighborIds(s, tid).filter((n) => { const ow = s.map.territories[n].owner; return ow && co.forces.some((f) => isAllied(s, f.playerId, ow)); }).length;
      const joint = co.forces.length > 1 && new Set(co.forces.map((f) => f.playerId)).size > 1 && jointAccepted.some((o) => co.forces.some((f) => f.playerId === o.from) && co.forces.some((f) => f.playerId === o.to) && o.terms.attackTarget === tid);
      const defenderBonus = 0;
      const result = resolveBattle(co.forces, {
        playerId: defenderId, units: t.garrison, mods: dp ? getMods(dp) : getMods({ techs: [] } as unknown as PlayerState), stability: dp ? dp.stability : 70,
        entrenched: isEntrenched(t, R), isolated, pressure: under,
      }, { terrain: t.terrain, defenseLevel: t.defenseLevel, building: t.building, buildingLevel: t.buildingLevel, isCapital: t.isCapital, siegeProgress: t.siegeProgress },
      { cfg: s.config, storm: ev?.type === 'storm', adjacentFriendly, jointAttack: joint, defenderBonus });

      const primary = co.forces.reduce((a, b) => (unitTotal(b.units) > unitTotal(a.units) ? b : a));
      const attackerIds = [...new Set(co.forces.map((f) => f.playerId))];
      const report: BattleReport = {
        id: nextId(s, 'b'), round: R, territoryId: tid, territoryName: t.name,
        attackers: co.forces.map((f) => ({ playerId: f.playerId, fromId: f.fromId, units: f.units, strategy: f.strategy, formation: f.formation })),
        defenderId, defenderUnits: { ...t.garrison }, defenderSurvivors: result.defenderSurvivors, attackerSurvivors: result.attackerSurvivors,
        attackerLosses: result.attackerLosses, defenderLosses: result.defenderLosses,
        outcome: result.outcome,
        captured: false, phases: result.phases, attackerPower: result.attackerPower, defenderPower: result.defenderPower, factors: result.factors, explanation: result.explanation,
        visibleTo: [...attackerIds, ...(defenderId ? [defenderId] : [])],
      };
      // Statistika gubitaka
      const lostA = unitTotal(result.attackerLosses), lostD = unitTotal(result.defenderLosses);
      for (const id of attackerIds) { s.players[id].stats.unitsLost += lostA / attackerIds.length; s.players[id].stats.unitsKilled += lostD / attackerIds.length; }
      if (dp) { dp.stats.unitsLost += lostD; dp.stats.unitsKilled += lostA; }
      const attackerNames = attackerIds.map((id) => pname(s, id)).join(' i ');
      // Dugovi osvete: napadnuti pamti napadača; napadač koji je uzvratio i pobijedio naplaćuje dug
      if (defenderId) for (const id of attackerIds) {
        addGrudge(s, defenderId, id, result.outcome === 'attacker_victory' ? 2 : 1);
        if (result.outcome === 'attacker_victory' && s.players[id].grudges?.[defenderId]) { s.players[id].grudges[defenderId] = 0; emit(s, R, 'military', `Osveta! Dug prema ${pname(s, defenderId)} je naplaćen.`, [id], 'good'); }
      }
      // Pobjeda napadača
      if (result.outcome === 'attacker_victory') {
        const winner = primary.playerId;
        const prevOwner = t.owner;
        // Ostali pobjednici koalicije predaju preživjele zajedničkom garnizonu
        t.garrison = result.attackerSurvivors;
        report.captured = true;
        report.outcome = 'attacker_victory';
        // Preživjeli branitelji se povlače
        if (prevOwner) retreatSurvivors(c, prevOwner, tid, result.defenderSurvivors);
        captureTerritory(c, tid, winner, prevOwner);
        captured.push({ territoryId: tid, by: winner, from: prevOwner });
        for (const id of attackerIds) { s.players[id].stats.battlesWon++; }
        if (prevOwner) {
          const dpp = s.players[prevOwner];
          dpp.stats.battlesLost++;
          const sc = publicScore(s, prevOwner) > publicScore(s, winner);
          if (sc) { const ob = s.players[winner].objective; if (ob.type === 'defeat_stronger') ob.params.progress = 1; }
        }
        emit(s, R, 'military', `${attackerNames} su osvojili ${t.name}${prevOwner ? ` od kraljevstva ${pname(s, prevOwner)}` : ''}.`, s.playerOrder.filter((id) => !attackerIds.includes(id) && id !== prevOwner), 'info', { refs: { territoryId: tid, battleId: report.id } });
        for (const id of attackerIds) { emit(s, R, 'military', `Pobjeda! ${t.name} je naš. Izgubljeno: ${describeUnits(result.attackerLosses)}.`, [id], 'good', { refs: { territoryId: tid, battleId: report.id }, mood: 'celebrating' }); mood(c, id, 'celebrating'); notify(s, { playerId: id, kind: 'attack', title: 'Teritorij osvojen', body: `Tvoja vojska osvojila je novi teritorij: ${t.name}!` }); }
        if (prevOwner) {
          emit(s, R, 'military', `${t.name} je izgubljen! Napao nas je ${attackerNames}. Naši gubici: ${describeUnits(result.defenderLosses)}.`, [prevOwner], 'bad', { refs: { territoryId: tid, battleId: report.id }, mood: 'surprised' });
          mood(c, prevOwner, 'surprised'); notify(s, { playerId: prevOwner, kind: 'attack', title: 'Izgubljen teritorij', body: `${attackerNames} je osvojio ${t.name}!` });
        }
      } else {
        // Obrana je izdržala ili napadač povukao
        t.garrison = result.defenderSurvivors;
        if (defenderId) { s.players[defenderId].stats.defensesWon++; mood(c, defenderId, 'confident'); }
        if (co.forces.some((f) => f.strategy === 'siege')) {
          t.siegeProgress = Math.min(s.config.combat.siegeProgressMax, t.siegeProgress + 1); t.siegeBy = primary.playerId;
        }
        for (const id of attackerIds) s.players[id].stats.battlesLost += result.outcome === 'defender_victory' ? 1 : 0;
        for (const f of co.forces) {
          const ratio = 1;
          void ratio;
          const surv = proportional(f.units, result.attackerSurvivors, co.forces);
          returning.push({ playerId: f.playerId, fromId: f.fromId, units: surv });
        }
        const verb = result.outcome === 'retreat' ? 'povukli su se' : 'napad je odbijen';
        for (const id of attackerIds) { emit(s, R, 'military', `Napad na ${t.name}: ${verb}. Gubici: ${describeUnits(result.attackerLosses)}.`, [id], 'bad', { refs: { territoryId: tid, battleId: report.id }, mood: 'defeated' }); mood(c, id, 'defeated'); }
        if (defenderId) { emit(s, R, 'military', `Obrana ${t.name} uspješna protiv ${attackerNames}! Neprijateljski gubici: ${describeUnits(result.attackerLosses)}.`, [defenderId], 'good', { refs: { territoryId: tid, battleId: report.id }, mood: 'confident' }); notify(s, { playerId: defenderId, kind: 'attack', title: 'Napad odbijen', body: `${attackerNames} je napao ${t.name}, ali si obranio teritorij.` }); }
      }
      if (result.outcome === 'attacker_victory') {
        // povratak preživjelih saveznika nije potreban — svi ostaju u osvojenom teritoriju
      }
      pendingBattles.push(report);
      s.battles.push(report);
    }
  }
  // Povratak poraženih postrojbi
  for (const r of returning) {
    if (!unitTotal(r.units)) continue;
    const from = s.map.territories[r.fromId];
    if (from && from.owner === r.playerId) from.garrison = addUnits(from.garrison, r.units);
    else {
      const alt = playerTerritories(s, r.playerId).find((t) => from && neighborIds(s, from.id).includes(t.id)) ?? playerTerritories(s, r.playerId)[0];
      if (alt) alt.garrison = addUnits(alt.garrison, r.units);
    }
  }
  // Slabo napadnuti teritoriji: opsada se smanjuje ako nitko ne opsjeda
  for (const t of Object.values(s.map.territories)) {
    if (t.siegeProgress > 0 && !c.battlesByTarget.has(t.id)) { t.siegeProgress = Math.max(0, t.siegeProgress - 1); if (!t.siegeProgress) t.siegeBy = null; }
  }
  // Označi izvršene naredbe
  for (const fa of forcesAll) if (fa.o.status === 'locked') done(fa.o, true, 'Napad izvršen.');
  // Zajednički napadi
  for (const o of s.offers.filter((x) => x.kind === 'joint_attack' && x.status === 'accepted')) {
    const tgt = o.terms.attackTarget!;
    const did = (pid: PlayerId) => forcesAll.some((x) => x.targetId === tgt && x.f.playerId === pid);
    const a = did(o.from), b = did(o.to);
    if (a && b) { o.status = 'executed'; o.resultText = 'Zajednički napad izveden.'; for (const id of [o.from, o.to]) adjustReputation(s, s.players[id], 3); emit(s, R, 'diplomacy', `Zajednički napad na ${s.map.territories[tgt].name} uspješno koordiniran.`, [o.from, o.to], 'good'); }
    else { o.status = 'failed'; o.resultText = 'Dogovor nije ispunjen.'; for (const id of [o.from, o.to]) if (!did(id)) { s.players[id].reputation.brokenTreaties++; adjustReputation(s, s.players[id], -5); emit(s, R, 'diplomacy', `Nisi ispunio dogovor o zajedničkom napadu na ${s.map.territories[tgt].name}.`, [id], 'warn'); } }
  }
  // Uvjetne naredbe nakon bitaka
  processConditionals(c, 'post', forcesAll, captured);
  void pendingBattles;
}

function proportional(orig: Units, survivorsTotal: Units, forces: Array<{ units: Units }>): Units {
  const totalOrig = forces.reduce((n, f) => n + unitTotal(f.units), 0) || 1;
  const share = unitTotal(orig) / totalOrig;
  const out: Units = {};
  for (const u of UNIT_TYPES) { const n = Math.round((survivorsTotal[u] ?? 0) * share); if (n > 0) out[u] = Math.min(n, orig[u] ?? 0); }
  return out;
}

function intelConf(s: GameState, pid: PlayerId, territoryId: TerritoryId): number {
  const r = s.intel.filter((x) => x.owner === pid && x.territoryId === territoryId && x.kind === 'army' && x.confidence !== 'failed' && s.round - x.round <= s.config.espionage.staleAfterRounds).sort((a, b) => b.round - a.round)[0];
  return r ? (r.confidence === 'high' ? 1 : r.confidence === 'medium' ? 0.6 : 0.3) : 0;
}

function retreatSurvivors(c: Ctx, owner: PlayerId, fromTid: TerritoryId, survivors: Units) {
  const { s } = c;
  if (!unitTotal(survivors)) return;
  const nb = neighborIds(s, fromTid).map((n) => s.map.territories[n]).filter((t) => t.owner === owner).sort((a, b) => unitTotal(b.garrison) - unitTotal(a.garrison) || a.id.localeCompare(b.id));
  const dest = nb[0];
  if (!dest) return;
  const rate = s.config.combat.retreatSurvivorRate;
  const out: Units = {};
  for (const u of UNIT_TYPES) { const n = Math.floor((survivors[u] ?? 0) * rate); if (n > 0) out[u] = n; }
  dest.garrison = addUnits(dest.garrison, out);
}

/** Bonus osvete: 5% po bodu duga, najviše 15%. */
export const revengeBonus = (p: PlayerState, against: PlayerId) => Math.min(0.15, (p.grudges?.[against] ?? 0) * 0.05);
export function addGrudge(s: GameState, holder: PlayerId, against: PlayerId, n: number) {
  const h = s.players[holder]; if (!h || holder === against) return;
  h.grudges ??= {}; h.grudges[against] = Math.min(5, (h.grudges[against] ?? 0) + n);
}

function captureTerritory(c: Ctx, tid: TerritoryId, winner: PlayerId, prevOwner: PlayerId | null) {
  const { s, R } = c;
  const t = s.map.territories[tid];
  const cfg = s.config;
  t.owner = winner; t.stability = cfg.stability.conqueredStability; t.siegeProgress = 0; t.siegeBy = null; t.construction = null; t.effects = [];
  t.population = Math.max(10, Math.floor(t.population * (1 - cfg.combat.conqueredPopulationLoss)));
  t.defenseLevel = Math.max(0, t.defenseLevel - 1);
  if (t.building === 'fortress' || t.building === 'barracks') { t.buildingLevel -= 1; if (t.buildingLevel <= 0) { t.building = null; t.buildingLevel = 0; } }
  const w = s.players[winner];
  if (!prevOwner && !t.camp) { const g0 = Math.round(cfg.combat.neutralPlunderBase + cfg.combat.neutralPlunderPerImportance * t.importance); if (g0 > 0) { gain(c, winner, { gold: g0 }); emit(s, R, 'economy', `${t.name}: domaći su predali zalihe — plijen ${g0} zlata.`, [winner], 'good', { refs: { territoryId: tid } }); } }
  if (!prevOwner && t.camp) {
    const camp = t.camp; t.camp = null;
    gain(c, winner, camp.reward);
    const loot = rewardText(camp.reward);
    emit(s, R, 'military', `Razbijen je kamp kod ${t.name}! Plijen: ${loot}.`, [winner], 'good', { refs: { territoryId: tid }, mood: 'celebrating' });
    emit(s, R, 'military', `${w.name} je razbio razbojnički kamp kod ${t.name}.`, s.playerOrder.filter((id) => id !== winner), 'info', { refs: { territoryId: tid } });
  }
  w.stats.territoriesCaptured += prevOwner ? 1 : 0;
  w.stats.peakTerritories = Math.max(w.stats.peakTerritories, playerTerritories(s, winner).length);
  c.conquered[winner]++;
  if (prevOwner) {
    const d = s.players[prevOwner];
    d.stats.territoriesLost++; c.lost[prevOwner]++;
    if (d.resistance) d.resistance.formerTerritories = [...new Set([...d.resistance.formerTerritories, tid])];
    // Plijen
    if (t.building === 'city' || t.isCapital) {
      const loot = Math.min(d.resources.gold, cfg.combat.plunderMax, Math.round(cfg.combat.plunderBase + t.population * cfg.combat.plunderPerPop));
      d.resources.gold = round2(d.resources.gold - loot); gain(c, winner, { gold: loot });
      c.ledger[prevOwner].trade.gold = round2(c.ledger[prevOwner].trade.gold - loot);
    }
    if (t.isCapital && t.capitalOf === prevOwner) {
      w.stats.capitalsCaptured++;
      c.capitalLost[prevOwner] = true;
      enterResistance(c, prevOwner, tid);
      emit(s, R, 'territory', `GLAVNI GRAD ${t.name} pao je u ruke kraljevstva ${w.name}! ${d.name} prelazi u Otpor.`, s.playerOrder, 'bad', { refs: { territoryId: tid }, mood: 'surprised' });
      notify(s, { playerId: prevOwner, kind: 'attack', title: 'Glavni grad pao!', body: 'Tvoje kraljevstvo prelazi u Otpor. Pokreni ustanak!' });
      mood(c, prevOwner, 'defeated', true);
    }
  }
  // Oslobađanje vlastitog glavnog grada
  if (t.isCapital && t.capitalOf === winner && w.status === 'resistance') {
    w.status = 'active'; w.resistance = null; w.stability = Math.min(100, w.stability + 15); t.stability = 55;
    emit(s, R, 'territory', `${w.name} je oslobodio glavni grad ${t.name}! Otpor je pobijedio.`, s.playerOrder, 'good', { refs: { territoryId: tid }, mood: 'celebrating' });
    mood(c, winner, 'celebrating', true);
  }
}

function enterResistance(c: Ctx, pid: PlayerId, capitalTid: TerritoryId) {
  const { s, R } = c;
  const p = s.players[pid];
  p.status = 'resistance';
  p.resistance = { since: R, partisanUsedRound: 0, emergencyUsedRound: 0, formerTerritories: [capitalTid] };
  p.stability = Math.max(s.config.resistance.stabilityFloor, p.stability + s.config.resistance.capitalCaptureStability);
  p.ready = false;
}

// ───────────────────────── Uvjetne naredbe ─────────────────────────
function processConditionals(c: Ctx, phase: 'pre' | 'post', forces: Array<{ f: Force; o: Order; targetId: TerritoryId }>, captured: Array<{ territoryId: TerritoryId; by: PlayerId; from: PlayerId | null }> = []) {
  const { s, R } = c;
  const list = s.conditionalOrders.filter((x) => x.status === 'active' && x.expiresRound >= R).sort((a, b) => s.playerOrder.indexOf(a.playerId) - s.playerOrder.indexOf(b.playerId) || a.priority - b.priority || a.id.localeCompare(b.id));
  for (const co of list) {
    const p = s.players[co.playerId];
    const tr = co.trigger;
    let targetTid: TerritoryId | undefined;
    let attackStrength = 0;
    let lostTid: TerritoryId | undefined;
    let allyId: PlayerId | undefined;
    if (phase === 'pre') {
      const incoming = forces.filter((x) => s.map.territories[x.targetId].owner === co.playerId);
      const match = incoming.filter((x) => {
        const t = s.map.territories[x.targetId];
        if (tr.type === 'territory_attacked') return !tr.territoryId || tr.territoryId === x.targetId;
        if (tr.type === 'capital_attacked') return t.isCapital;
        if (tr.type === 'attacked_by_player') return x.f.playerId === tr.playerId && (!tr.territoryId || tr.territoryId === x.targetId);
        return false;
      });
      if (!match.length) continue;
      targetTid = match[0].targetId;
      attackStrength = match.filter((x) => x.targetId === targetTid).reduce((n, x) => n + unitTotal(x.f.units), 0);
    } else {
      if (tr.type === 'territory_conquered') { const cap = captured.find((x) => x.by === co.playerId && (!tr.territoryId || x.territoryId === tr.territoryId)); if (!cap) continue; targetTid = cap.territoryId; }
      else if (tr.type === 'territory_lost') { const l = captured.find((x) => x.from === co.playerId && (!tr.territoryId || x.territoryId === tr.territoryId)); if (!l) continue; lostTid = l.territoryId; }
      else if (tr.type === 'ally_loses_territory') { const l = captured.find((x) => x.from && x.from !== co.playerId && isAllied(s, co.playerId, x.from) && (!tr.playerId || tr.playerId === x.from)); if (!l) continue; lostTid = l.territoryId; allyId = l.from!; }
      else continue;
    }
    const isPre = ['territory_attacked', 'capital_attacked', 'attacked_by_player'].includes(tr.type);
    if ((phase === 'pre') !== isPre) continue;
    // Uvjet
    const cond = co.condition;
    if (cond.type === 'resources' && !canAfford(p.resources, cond.min)) { co.status = 'failed'; co.result = 'Uvjet resursa nije ispunjen.'; continue; }
    if (cond.type === 'attacker_strength_above' && !(attackStrength > cond.value)) { continue; }
    if (!canAfford(p.resources, co.resourceReq)) { co.status = 'failed'; co.result = 'Nedovoljno resursa za izvršenje.'; emit(s, R, 'notice', 'Uvjetna naredba nije izvršena: nedovoljno resursa.', [co.playerId], 'warn'); continue; }
    const act = co.action;
    let ok = false; let text = '';
    if (act.type === 'defensive_formation') {
      const tid = act.territoryId ?? targetTid; const t = tid ? s.map.territories[tid] : undefined;
      if (t && t.owner === co.playerId) { addEffect(t, 'entrenched', R); ok = true; text = `Obrambena formacija aktivirana u ${t.name}.`; }
    } else if (act.type === 'move_reserves') {
      const from = s.map.territories[act.fromTerritoryId!];
      const dest = s.map.territories[act.territoryId ?? targetTid ?? lostTid ?? p.capitalId];
      if (from?.owner === co.playerId && dest?.owner === co.playerId && neighborIds(s, from.id).includes(dest.id)) {
        const u = capUnits(act.units ?? {}, from.garrison);
        if (unitTotal(u)) { from.garrison = subUnits(from.garrison, u); dest.garrison = addUnits(dest.garrison, u); ok = true; text = `Rezerve (${describeUnits(u)}) premještene u ${dest.name}.`; }
      }
    } else if (act.type === 'emergency_recruit') {
      const t = s.map.territories[act.territoryId ?? targetTid ?? p.capitalId];
      if (t?.owner === co.playerId && act.unit && act.count) {
        const cost = scaleRes(recruitCost(s.config, p, act.unit, act.count), s.config.defense.conditionalRecruitPremium);
        if (canAfford(p.resources, cost) && t.population > act.count + 20) {
          pay(c, co.playerId, cost); t.garrison = addUnits(t.garrison, { [act.unit]: act.count }); t.population -= act.count;
          ok = true; text = `Hitno novačenje: ${act.count} × ${s.config.units[act.unit].name} u ${t.name}.`;
        }
      }
    } else if (act.type === 'build_fortress') {
      const t = s.map.territories[act.territoryId ?? targetTid!];
      if (t && t.owner === co.playerId && !t.construction && (!t.building || t.building === 'fortress') && s.config.buildings.fortress.allowedTerrain.includes(t.terrain)) {
        const lvl = t.building === 'fortress' ? t.buildingLevel + 1 : 1;
        if (lvl <= s.config.buildings.fortress.maxLevel) { const cost = buildingCost(s.config, p, 'fortress', lvl); if (canAfford(p.resources, cost)) { pay(c, co.playerId, cost); t.construction = { building: 'fortress', level: lvl, completesRound: R + 1 }; ok = true; text = `Gradnja tvrđave započeta u ${t.name}.`; } }
      }
    } else if (act.type === 'send_support') {
      const from = s.map.territories[act.fromTerritoryId!];
      const lost = lostTid ? s.map.territories[lostTid] : undefined;
      const dest = lost ? neighborIds(s, lost.id).map((n) => s.map.territories[n]).find((t) => t.owner === allyId) : undefined;
      if (from?.owner === co.playerId && dest) {
        const u = capUnits(act.units ?? {}, from.garrison);
        if (unitTotal(u)) { from.garrison = subUnits(from.garrison, u); dest.garrison = addUnits(dest.garrison, u); p.reputation.supportsGiven++; adjustReputation(s, p, s.config.diplomacy.reputation.support); ok = true; text = `Vojna potpora (${describeUnits(u)}) poslana saveniku u ${dest.name}.`; }
      }
    }
    if (ok) {
      pay(c, co.playerId, co.resourceReq);
      co.status = 'triggered'; co.result = text;
      emit(s, R, 'military', `Uvjetna naredba izvršena: ${text}`, [co.playerId], 'good', { mood: 'confident' });
    } else { co.status = 'failed'; co.result = 'Radnja nije bila izvediva.'; emit(s, R, 'notice', 'Uvjetna naredba nije se mogla izvršiti (uvjeti nisu zadovoljeni).', [co.playerId], 'warn'); }
  }
}

// ───────────────────────── Ekonomija ─────────────────────────
function processEconomy(c: Ctx) {
  const { s, R } = c;
  const cfg = s.config;
  const ev = currentEvent(s);
  // Kuga
  if (ev?.type === 'plague') for (const id of ev.territoryIds ?? []) {
    const t = s.map.territories[id];
    t.population = Math.max(10, Math.floor(t.population * (1 - cfg.population.plagueLoss))); t.stability = Math.max(0, t.stability - 8);
    if (t.owner) emit(s, R, 'event', `Kuga je pogodila ${t.name}: stanovništvo je smanjeno.`, [t.owner], 'bad', { refs: { territoryId: id } });
  }
  for (const pid of s.playerOrder) {
    const p = s.players[pid];
    const fc = forecastEconomy(s, pid);
    const sup = computeSupply(s, pid);
    // Izolacija i odsječene vojske
    for (const t of playerTerritories(s, pid)) {
      if (p.status !== 'resistance' && !sup.has(t.id)) {
        t.isolatedDays++;
        const loss = Math.min(cfg.combat.isolatedAttritionMax, cfg.combat.isolatedAttritionPerDay * t.isolatedDays);
        const total = unitTotal(t.garrison);
        if (total) {
          const r = applyLossSimple(t.garrison, loss); t.garrison = r.survivors;
          if (unitTotal(r.losses)) emit(s, R, 'military', `Odsječena vojska u ${t.name} slabi bez opskrbe (−${unitTotal(r.losses)}).`, [pid], 'warn', { refs: { territoryId: t.id } });
        }
      } else t.isolatedDays = 0;
    }
    // Proizvodnja i porezi
    const production = emptyResources(); let taxes = 0;
    for (const t of playerTerritories(s, pid)) { const tp = territoryProduction(s, t, sup); for (const k of RESOURCE_TYPES) production[k] = round2(production[k] + tp.total[k]); taxes += taxIncome(s, p, t); }
    taxes = round2(taxes);
    const up = upkeepOf(s, pid);
    gain(c, pid, production, 'production');
    c.ledger[pid].production = { ...production }; c.ledger[pid].taxes = taxes;
    p.resources.gold = round2(p.resources.gold + taxes - up.gold);
    p.resources.food = round2(p.resources.food - up.food);
    c.ledger[pid].upkeep = { gold: up.gold, food: up.food, iron: 0, wood: 0, influence: 0 };
    p.lastIncome = { ...production, gold: round2(production.gold + taxes - up.gold), food: round2(production.food - up.food) };
    let stabChange = stabilityDelta(s, p);
    // Nestašice
    let starving = false;
    if (p.resources.food < 0) {
      starving = true; p.resources.food = 0; stabChange += cfg.stability.foodShortage;
      for (const t of playerTerritories(s, pid)) { t.garrison = applyLossSimple(t.garrison, 0.1).survivors; t.population = Math.max(10, Math.floor(t.population * (1 - cfg.population.famineLoss))); }
      emit(s, R, 'economy', 'GLAD! Nema dovoljno hrane — vojska dezertira, narod nezadovoljan.', [pid], 'bad', { mood: 'angry' }); mood(c, pid, 'angry');
      notify(s, { playerId: pid, kind: 'warning', title: 'Glad u kraljevstvu', body: 'Hrane nema dovoljno! Stabilnost pada.' });
    }
    if (p.resources.gold < 0) {
      p.resources.gold = 0; stabChange += cfg.stability.goldShortage;
      for (const t of playerTerritories(s, pid)) t.garrison = applyLossSimple(t.garrison, 0.15).survivors;
      emit(s, R, 'economy', 'Riznica je prazna — plaće nisu isplaćene, dio vojnika dezertirao.', [pid], 'bad', { mood: 'angry' });
    }
    stabChange += c.lost[pid] * cfg.stability.perTerritoryLost + c.conquered[pid] * cfg.stability.perTerritoryConquered;
    if (c.capitalLost[pid]) stabChange += 0;
    p.stability = clamp(p.stability + stabChange, 0, cfg.stability.max);
    if (p.status === 'resistance') p.stability = Math.max(cfg.resistance.stabilityFloor, p.stability);
    if (p.objective.type === 'stability') p.objective.params.minSeen = Math.min(p.objective.params.minSeen as number, p.stability);
    // Pobuna (predvidljiva: najavljena upozorenjem u prethodnoj rundi)
    if (p.stability < cfg.stability.rebellionBelow && p.rebellionWarned) rebellion(c, pid);
    p.rebellionWarned = p.stability < cfg.stability.warnRed;
    // Stabilnost teritorija i rast stanovništva
    const growth = cfg.population.growthRate * (1 + getMods(p).popGrowth);
    for (const t of playerTerritories(s, pid)) {
      t.stability = clamp(t.stability + (p.stability - t.stability) * cfg.stability.territoryConvergence, 0, 100);
      if (!starving && t.stability > 40) t.population = Math.min(maxPopulation(cfg, t), Math.round(t.population + t.population * growth + 1));
    }
    if (p.stability < cfg.stability.warnYellow) emit(s, R, 'notice', p.stability < cfg.stability.warnRed ? `OPASNOST: stabilnost ${Math.round(p.stability)} — prijeti pobuna! Snizi poreze i osiguraj hranu.` : `Upozorenje: stabilnost pada (${Math.round(p.stability)}).`, [pid], p.stability < cfg.stability.warnRed ? 'bad' : 'warn');
    void fc;
  }
  // Istek privremenih učinaka
  for (const t of Object.values(s.map.territories)) t.effects = t.effects.filter((e) => e.untilRound > R);
}

function rebellion(c: Ctx, pid: PlayerId) {
  const { s, R } = c;
  const p = s.players[pid];
  const cfg = s.config;
  const cands = playerTerritories(s, pid).filter((t) => !t.isCapital).sort((a, b) => a.stability - b.stability || a.id.localeCompare(b.id));
  const t = cands[0];
  if (t) {
    const rebels = Math.floor(unitTotal(t.garrison) * 0.4) + 5;
    t.owner = null; t.garrison = { infantry: rebels }; t.stability = 50; t.construction = null; t.effects = [];
    p.stats.territoriesLost++;
    emit(s, R, 'territory', `POBUNA! ${t.name} se otcijepio od kraljevstva ${p.name}.`, s.playerOrder, 'bad', { refs: { territoryId: t.id }, mood: 'surprised' });
  }
  for (const tt of playerTerritories(s, pid)) tt.garrison = applyLossSimple(tt.garrison, cfg.stability.rebellionArmyLoss).survivors;
  p.stability = cfg.stability.afterRebellion;
  notify(s, { playerId: pid, kind: 'warning', title: 'Pobuna!', body: t ? `${t.name} se pobunio i otcijepio.` : 'Pobuna u kraljevstvu.' });
  mood(c, pid, 'defeated');
}

function applyLossSimple(u: Units, frac: number) {
  // lokalni alias radi izbjegavanja kružnog uvoza
  const total = unitTotal(u);
  const lossTotal = Math.min(total, Math.round(total * frac));
  const losses: Units = {};
  let left = lossTotal;
  const order = [...UNIT_TYPES].sort((a, b) => (u[b] ?? 0) - (u[a] ?? 0) || UNIT_TYPES.indexOf(a) - UNIT_TYPES.indexOf(b));
  let i = 0;
  while (left > 0 && i < 10000) { const k = order[i % order.length]; if ((u[k] ?? 0) - (losses[k] ?? 0) > 0) { losses[k] = (losses[k] ?? 0) + 1; left--; } i++; }
  return { survivors: subUnits(u, losses), losses };
}
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

// ───────────────────────── Dolasci ─────────────────────────
function processArrivals(c: Ctx) {
  const { s, R } = c;
  for (const pid of s.playerOrder) {
    const p = s.players[pid];
    const keep = [];
    for (const r of p.pendingRecruits) {
      if (r.arrivesRound > R + 1) { keep.push(r); continue; }
      const t = s.map.territories[r.territoryId];
      if (t.owner === pid) { t.garrison = addUnits(t.garrison, { [r.unit]: r.count }); emit(s, R, 'military', `Novaci stigli: ${r.count} × ${s.config.units[r.unit].name} u ${t.name}.`, [pid], 'good', { refs: { territoryId: t.id } }); }
    }
    p.pendingRecruits = keep;
  }
  for (const t of Object.values(s.map.territories)) {
    if (t.construction && t.construction.completesRound <= R + 1) {
      t.building = t.construction.building; t.buildingLevel = t.construction.level;
      if (t.owner) { emit(s, R, 'economy', `Gradnja dovršena: ${s.config.buildings[t.building].name} (razina ${t.buildingLevel}) u ${t.name}.`, [t.owner], 'good', { refs: { territoryId: t.id }, mood: 'happy' }); mood(c, t.owner, 'happy'); }
      t.construction = null;
    }
  }
  for (const pt of c.pendingTechs) {
    const p = s.players[pt.pid];
    if (!p.techs.includes(pt.techId)) {
      p.techs.push(pt.techId); p.stats.researchDone++;
      const def = TECH_BY_ID[pt.techId];
      emit(s, R, 'research', `Istraživanje dovršeno: ${def.name}. ${def.description}`, [pt.pid], 'good', { mood: 'celebrating' }); mood(c, pt.pid, 'celebrating');
      notify(s, { playerId: pt.pid, kind: 'achievement', title: 'Istraživanje dovršeno', body: def.name });
    }
  }
}

// ───────────────────────── Postignuća ─────────────────────────
export const ACHIEVEMENTS: Array<{ id: string; title: string; description: string; check: (s: GameState, p: PlayerState) => boolean }> = [
  { id: 'first_blood', title: 'Prva pobjeda', description: 'Dobij prvu bitku.', check: (_s, p) => p.stats.battlesWon >= 1 },
  { id: 'iron_fist', title: 'Željezna šaka', description: 'Dobij 3 bitke.', check: (_s, p) => p.stats.battlesWon >= 3 },
  { id: 'defender', title: 'Čvrsti zid', description: 'Obrani teritorij od napada.', check: (_s, p) => p.stats.defensesWon >= 1 },
  { id: 'expansion', title: 'Širenje carstva', description: 'Kontroliraj 8 teritorija.', check: (_s, p) => p.stats.peakTerritories >= 8 },
  { id: 'diplomat', title: 'Diplomat', description: 'Sklopi savez.', check: (s, p) => s.alliances.some((a) => a.kind === 'alliance' && (a.a === p.id || a.b === p.id)) },
  { id: 'merchant', title: 'Trgovac', description: 'Provedi 3 razmjene.', check: (_s, p) => p.stats.tradesDone >= 3 },
  { id: 'scholar', title: 'Učenjak', description: 'Istraži 3 tehnologije.', check: (_s, p) => p.techs.length >= 3 },
  { id: 'spymaster', title: 'Majstor špijunaže', description: 'Uhvati neprijateljskog špijuna.', check: (_s, p) => p.stats.spiesCaught >= 1 },
  { id: 'regicide', title: 'Rušitelj prijestolja', description: 'Osvoji protivnički glavni grad.', check: (_s, p) => p.stats.capitalsCaptured >= 1 },
  { id: 'phoenix', title: 'Feniks', description: 'Oslobodi glavni grad iz Otpora.', check: (s, p) => p.status === 'active' && p.stats.territoriesLost > 0 && s.map.territories[p.capitalId].owner === p.id && p.achievements.includes('__resisted') },
];

function updateObjectivesAndAchievements(c: Ctx) {
  const { s, R } = c;
  for (const pid of s.playerOrder) {
    const p = s.players[pid];
    p.objective.completed = objectiveProgress(s, pid).done;
    if (p.status === 'resistance' && !p.achievements.includes('__resisted')) p.achievements.push('__resisted');
    for (const a of ACHIEVEMENTS) {
      if (p.achievements.includes(a.id)) continue;
      if (a.check(s, p)) {
        p.achievements.push(a.id);
        emit(s, R, 'achievement', `Postignuće otključano: ${a.title} — ${a.description}`, [pid], 'good', { mood: 'celebrating' });
        notify(s, { playerId: pid, kind: 'achievement', title: 'Postignuće otključano', body: a.title });
        mood(c, pid, 'celebrating');
      }
    }
  }
}

// ───────────────────────── Izvještaji i nova runda ─────────────────────────
function buildReports(c: Ctx, scoreBefore: Record<PlayerId, number>) {
  const { s, R } = c;
  const ev = s.events.find((e) => e.round === R);
  if (ev && ev.type !== 'none') emit(s, R, 'event', `Događaj dana: ${ev.title}. ${ev.effects.join(' · ')}`, s.playerOrder, 'info');
  for (const pid of s.playerOrder) {
    const entries = s.reportEntries.filter((e) => e.round === R && e.audience.includes(pid));
    const report: DailyReport = { round: R, playerId: pid, entries, ledger: c.ledger[pid], mood: c.moods[pid], scoreBefore: scoreBefore[pid], scoreAfter: publicScore(s, pid) };
    s.reports[`${R}:${pid}`] = report;
    notify(s, { playerId: pid, kind: 'resolution', title: `Izvještaj za dan ${R} je spreman`, body: 'Pogledaj što se dogodilo u kraljevstvu.' });
  }
}

function advance(c: Ctx) {
  const { s, R } = c;
  decayReputation(s);
  // Istek ponuda
  for (const o of s.offers) if (o.status === 'pending' && o.expiresRound <= R) o.status = 'expired';
  for (const o of s.conditionalOrders) if (o.status === 'active' && o.expiresRound <= R) o.status = 'expired';
  if (R >= s.totalRounds) {
    s.phase = 'completed';
    const rk = ranking(s);
    s.winnerId = rk[0]?.playerId ?? null;
    for (const pid of s.playerOrder) notify(s, { playerId: pid, kind: 'campaign_complete', title: 'Kampanja završena!', body: `Pobjednik: ${pname(s, s.winnerId)}. Pogledaj konačne rezultate.` });
    return;
  }
  s.round = R + 1;
  s.phase = 'planning';
  announceEvent(s, s.round);
  for (const a of s.alliances) {
    if (a.status === 'active' && a.endsRound !== null && a.endsRound <= s.round) {
      a.status = 'ended'; a.endedRound = R;
      for (const id of [a.a, a.b]) { s.players[id].reputation.keptTreaties++; adjustReputation(s, s.players[id], s.config.diplomacy.reputation.keptTreaty); }
      emit(s, R, 'diplomacy', `${a.kind === 'alliance' ? 'Savez' : 'Sporazum'} ${pname(s, a.a)} ↔ ${pname(s, a.b)} je istekao u dogovorenom roku.`, [a.a, a.b], 'info');
    }
  }
  for (const pid of s.playerOrder) {
    const p = s.players[pid];
    p.ready = false;
    p.stats.peakTerritories = Math.max(p.stats.peakTerritories, playerTerritories(s, pid).length);
    notify(s, { playerId: pid, kind: 'phase', title: 'Počela je nova faza planiranja', body: `Dan ${s.round}/${s.totalRounds}.` });
  }
  const nev = s.events.find((e) => e.round === s.round);
  if (nev && nev.type !== 'none') for (const pid of s.playerOrder) emit(s, R, 'event', `Sutrašnji događaj: ${nev.title}. ${nev.effects.join(' · ')}`, [pid], 'info');
}

