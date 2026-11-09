/**
 * Botovi — SAMO za razvojnu simulaciju i testove (kampanje označene devSimulation).
 * Botovi koriste isti API i ista ograničenja informacija kao i igrači (procjene, ne stvarno stanje).
 */
import { UNIT_TYPES } from './config';
import { respondToOffer, kindLabel, sendMessage } from './diplomacy';
import { currentEvent, forecastEconomy } from './economy';
import { hash01 } from './rng';
import { addOrder, cpAvailable, cpUsed, previewOrder, setReady, setTax } from './orders';
import { TECHS } from './tech';
import type { GameState, OrderInput, PlayerId, Territory, Units } from './types';
import { isAllied, neighborIds, playerTerritories, unitTotal, subUnits } from './util';

type Personality = 'aggressor' | 'builder' | 'diplomat';
const personality = (s: GameState, pid: PlayerId): Personality => {
  const h = hash01(`${s.seed}:bot:${pid}`);
  return h < 0.4 ? 'aggressor' : h < 0.75 ? 'builder' : 'diplomat';
};

export const botPersonality = personality;
export const PERSONA_LABEL: Record<Personality, string> = { aggressor: 'ratoboran', builder: 'graditelj', diplomat: 'diplomat' };

const LINES: Record<Personality, { hello: string; hit: string; won: string; lead: string; grudge: string }> = {
  aggressor: { hello: 'Čuo sam da si novi kralj. Drži granice — ja ne praštam.', hit: 'Napao si moje! Ovo se pamti. Osveta stiže.', won: '{t} je sada moj. Bolje se brani sljedeći put.', lead: 'Vodiš? Ne zadugo.', grudge: 'Brojim tvoje dugove. Naplata je blizu.' },
  builder: { hello: 'Mirno kraljevstvo je bogato kraljevstvo. Ne diraj moje farme.', hit: 'Prijatelju, ovo nije bilo potrebno. Razmisli o miru.', won: 'Nisam htio rat, ali {t} sada pripada meni.', lead: 'Dobro ti ide. Možda trgovina?', grudge: 'Imaš dug prema meni. Mir ili porez?' },
  diplomat: { hello: 'Pozdrav, kralju! Savez bi nam obojici koristio. Što kažeš?', hit: 'Razočaran sam. Ali još se možemo dogovoriti.', won: 'Ne uzmi osobno — {t} mi je bio nužan.', lead: 'Svi te gledaju. Pametno je imati prijatelje.', grudge: 'Zamjeram ti, ali razgovorom se sve rješava.' },
};
const humans = (s: GameState) => s.playerOrder.filter((id) => !s.players[id].isBot);

/** Prvi dan: svaki bot se javlja svakom čovjeku — likovi dobivaju glas prije nego išta zaigraš. */
export function botGreet(s: GameState, now: string) {
  for (const b of s.playerOrder.filter((id) => s.players[id].isBot)) for (const h of humans(s)) sendMessage(s, b, h, LINES[personality(s, b)].hello, now);
}

/** Reakcije na prošlu rundu: osveta, hvalisanje, ruganje vodećem. Samo na temelju javnih ishoda bitki. */
export function botReact(s: GameState, pid: PlayerId, now: string) {
  const L = LINES[personality(s, pid)];
  const last = s.battles.filter((b) => b.round === s.round - 1);
  for (const b of last) {
    const att = b.attackers[0]?.playerId;
    if (b.defenderId === pid && att && !s.players[att].isBot) sendMessage(s, pid, att, L.hit, now);
    else if (att === pid && b.outcome === 'attacker_victory' && b.defenderId && !s.players[b.defenderId].isBot) sendMessage(s, pid, b.defenderId, L.won.replace('{t}', b.territoryName), now);
  }
  for (const h of humans(s)) if ((s.players[pid].grudges?.[h] ?? 0) >= 2 && hash01(`${s.seed}:gr:${s.round}:${pid}:${h}`) < 0.5) sendMessage(s, pid, h, L.grudge, now);
  const top = [...s.playerOrder].sort((a, b) => s.scores[b].total - s.scores[a].total)[0];
  if (top && !s.players[top].isBot && hash01(`${s.seed}:lead:${s.round}:${pid}`) < 0.22) sendMessage(s, pid, top, L.lead, now);
}

export function botRespondToOffers(s: GameState, pid: PlayerId) {
  const pers = personality(s, pid);
  for (const o of s.offers.filter((x) => x.to === pid && x.status === 'pending')) {
    const h = hash01(`${s.seed}:resp:${o.id}:${pid}`);
    let accept = false;
    if (o.kind === 'alliance' || o.kind === 'nap') accept = pers === 'diplomat' ? true : h < 0.45;
    else if (o.kind === 'trade') {
      const g = Object.values(o.terms.give ?? {}).reduce((a, b) => a + (b ?? 0), 0), r = Object.values(o.terms.receive ?? {}).reduce((a, b) => a + (b ?? 0), 0);
      accept = g >= r * 0.9;
    } else if (o.kind === 'support' || o.kind === 'swap') accept = h < 0.5;
    else if (o.kind === 'joint_attack') accept = pers !== 'builder';
    respondToOffer(s, pid, o.id, accept);
  }
}

export function botPlan(s: GameState, pid: PlayerId, now: string) {
  const p = s.players[pid];
  const cfg = s.config;
  const pers = personality(s, pid);
  const R = s.round;
  botRespondToOffers(s, pid);
  if (R > 1) botReact(s, pid, now);
  const submit = (o: OrderInput) => addOrder(s, pid, o, 'submitted', now);
  const left = () => cpAvailable(s, p) - cpUsed(s, pid);
  const mine = () => playerTerritories(s, pid);
  const fc = forecastEconomy(s, pid);
  setTax(s, pid, p.stability < 55 ? 'low' : p.stability > 82 && pers !== 'builder' ? 'high' : 'normal');

  // 1) Hrana i stabilnost
  if (fc.net.food < 3 && left() >= 2) {
    const spot = mine().find((t) => !t.building && !t.construction && cfg.buildings.farm.allowedTerrain.includes(t.terrain));
    if (spot) submit({ type: 'build', params: { territoryId: spot.id, building: 'farm' } });
  }
  // 2) Obrana graničnih teritorija s jačim susjedom
  const threatened = mine().filter((t) => neighborIds(s, t.id).some((n) => { const ow = s.map.territories[n].owner; return ow && !isAllied(s, pid, ow) && unitTotal(s.map.territories[n].garrison) > unitTotal(t.garrison) * 0.8; }));
  for (const t of threatened.sort((a, b) => Number(b.isCapital) - Number(a.isCapital)).slice(0, 2)) if (left() >= 5) submit({ type: 'defend', params: { territoryId: t.id, stance: 'entrench' } });

  // 3) Napadi na povoljne ciljeve (procjena preko previewOrder)
  const attackBudget = pers === 'aggressor' ? 2 : pers === 'builder' ? 1 : 1;
  let attacks = 0;
  const candidates: Array<{ from: Territory; target: Territory; units: Units; score: number }> = [];
  for (const from of mine()) {
    const free = subUnits(from.garrison, {});
    const total = unitTotal(free);
    if (total < 4) continue;
    const keep = from.isCapital ? 4 : 1;
    const send: Units = {};
    let toSend = Math.max(0, total - keep);
    for (const u of UNIT_TYPES) { const n = Math.min(free[u] ?? 0, toSend); if (n > 0) { send[u] = n; toSend -= n; } }
    if (unitTotal(send) < 3) continue;
    for (const n of neighborIds(s, from.id)) {
      const target = s.map.territories[n];
      if (target.owner === pid || (target.owner && isAllied(s, pid, target.owner))) continue;
      const score = target.importance + (target.isCapital ? 6 : 0) + (target.building === 'city' ? 2 : 0) + (target.owner ? 1 : 0) + (target.camp ? 3 : 0) + (target.owner ? Math.min(3, p.grudges?.[target.owner] ?? 0) : 0) + (pers === 'aggressor' ? 1 : 0) - (target.owner ? 0 : 0) + hash01(`${s.seed}:${R}:${pid}:${target.id}`);
      candidates.push({ from, target, units: send, score });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  for (const cnd of candidates) {
    if (attacks >= attackBudget || left() < 3) break;
    const strategy = (cnd.units.siege ?? 0) > 0 && (cnd.target.building === 'fortress' || cnd.target.isCapital) ? 'siege' : 'direct';
    const order: OrderInput = { type: 'attack', params: { fromId: cnd.from.id, targetId: cnd.target.id, units: cnd.units, strategy, formation: 'line', supply: 'standard', risk: 'balanced', retreatBelow: 0.35, reserve: {} } };
    const pv = previewOrder(s, pid, order);
    if (!pv.validation.ok) continue;
    if (pv.outlook !== 'favorable' && !(pv.outlook === 'uncertain' && pers === 'aggressor' && hash01(`${s.seed}:${R}:${cnd.target.id}:${pid}`) < 0.5)) continue;
    const r = submit(order);
    if (r.ok) attacks++;
  }

  // 4) Pripajanje neutralnih teritorija utjecajem
  if (left() >= 2 && p.resources.influence >= 12) {
    for (const t of mine()) {
      const n = neighborIds(s, t.id).map((x) => s.map.territories[x]).find((x) => !x.owner && x.importance >= 2);
      if (n && submit({ type: 'diplomacy', params: { kind: 'annex', targetTerritoryId: n.id } }).ok) break;
    }
  }
  // 5) Novačenje
  const army = mine().reduce((n, t) => n + unitTotal(t.garrison), 0) + p.pendingRecruits.reduce((n, r) => n + r.count, 0);
  const targetArmy = 10 + R * (pers === 'aggressor' ? 5 : 3);
  for (let i = 0; i < 2 && army < targetArmy && left() >= 1; i++) {
    const cap = s.map.territories[p.capitalId];
    const home = cap.owner === pid ? cap : mine()[0];
    if (!home) break;
    const unit = i === 0 ? 'infantry' : (R > 2 && p.resources.iron >= 20 ? 'knights' : 'archers');
    const count = Math.min(10, Math.max(3, Math.floor((targetArmy - army) / (i + 1))));
    for (let c = count; c >= 2; c -= 2) if (submit({ type: 'recruit', params: { territoryId: home.id, unit, count: c } }).ok) break;
  }
  // 6) Gradnja
  if (left() >= 2) {
    const order: Array<[string, (t: Territory) => boolean]> = [
      ['mine', (t) => t.terrain === 'mountains' && !t.building],
      ['city', (t) => (t.terrain === 'plains' || t.terrain === 'special') && !t.building && !t.isCapital],
      ['market', (t) => t.terrain === 'plains' && !t.building],
      ['barracks', (t) => t.terrain === 'plains' && !t.building && pers === 'aggressor'],
      ['fortress', (t) => !t.building && neighborIds(s, t.id).some((n) => { const ow = s.map.territories[n].owner; return ow && ow !== pid; })],
    ];
    for (const [b, pred] of order) {
      const t = mine().find((x) => pred(x) && !x.construction);
      if (t && submit({ type: 'build', params: { territoryId: t.id, building: b as any } }).ok) break;
    }
  }
  // 7) Tehnologija
  if (left() >= 3) {
    const prefer = pers === 'aggressor' ? 'military' : pers === 'builder' ? 'economy' : 'diplomacy';
    const options = TECHS.filter((t) => !p.techs.includes(t.id) && t.requires.every((r) => p.techs.includes(r))).sort((a, b) => Number(b.category === prefer) - Number(a.category === prefer) || a.tier - b.tier);
    for (const t of options) if (submit({ type: 'research', params: { techId: t.id } }).ok) break;
  }
  // 8) Diplomacija i špijunaža
  if (left() >= 2 && pers === 'diplomat' && R <= 4) {
    const other = s.playerOrder.filter((id) => id !== pid && !isAllied(s, pid, id) && !s.offers.some((o) => o.from === pid && o.to === id && o.status === 'pending'))[Math.floor(hash01(`${s.seed}:${R}:${pid}`) * (s.playerOrder.length - 1))];
    if (other) submit({ type: 'diplomacy', params: { kind: 'alliance', targetPlayerId: other } });
  }
  if (left() >= 2 && R >= 2) {
    const nb = mine().flatMap((t) => neighborIds(s, t.id)).map((id) => s.map.territories[id]).find((t) => t.owner && t.owner !== pid && !isAllied(s, pid, t.owner));
    if (nb) submit({ type: 'espionage', params: { action: 'army', targetTerritoryId: nb.id } });
  }
  if (p.status === 'resistance') {
    const former = p.resistance?.formerTerritories.map((id) => s.map.territories[id]).find((t) => t.owner !== pid);
    if (former) submit({ type: 'resistance', params: { kind: 'uprising', territoryId: former.id } });
    const home = mine()[0];
    if (home) submit({ type: 'resistance', params: { kind: 'emergency_recruit', territoryId: home.id } });
  }
  // Uvjetna naredba: obrana glavnog grada
  setReady(s, pid, true);
  void kindLabel; void currentEvent;
}
