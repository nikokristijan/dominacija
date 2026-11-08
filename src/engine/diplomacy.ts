/** Diplomacija: ponude, savezi, sporazumi, poruke i ugled. Besplatne radnje (odgovori, poruke) izvršavaju se odmah. */
import type { Alliance, DiplomaticOffer, GameState, Message, PlayerId, PlayerState } from './types';
import { activeAlliance, emit, nextId, notify, pname } from './util';

export function adjustReputation(s: GameState, p: PlayerState, delta: number) {
  const r = s.config.diplomacy.reputation;
  p.reputation.score = Math.max(r.min, Math.min(r.max, Math.round((p.reputation.score + delta) * 10) / 10));
}

/** Ugled se postupno vraća prema neutralnoj vrijednosti — igrač nije trajno kažnjen. */
export function decayReputation(s: GameState) {
  const r = s.config.diplomacy.reputation;
  for (const p of Object.values(s.players)) {
    const d = (r.decayToward - p.reputation.score) * r.decayRate;
    p.reputation.score = Math.round((p.reputation.score + d) * 10) / 10;
  }
}

export function createAlliance(s: GameState, kind: 'alliance' | 'nap', a: PlayerId, b: PlayerId, duration: number | undefined, secret: boolean): Alliance {
  const dur = duration ?? (kind === 'alliance' ? s.config.diplomacy.allianceDefaultDuration : s.config.diplomacy.napDefaultDuration);
  const al: Alliance = {
    id: nextId(s, 'a'), kind, a, b, startedRound: s.round, endsRound: Math.min(s.totalRounds + 1, s.round + dur), secret, status: 'active',
    terms: { sharedVision: kind === 'alliance' },
  };
  s.alliances.push(al);
  return al;
}

export function respondToOffer(s: GameState, pid: PlayerId, offerId: string, accept: boolean, opts: { toTerritoryId?: string } = {}): { ok: boolean; error?: string } {
  const o = s.offers.find((x) => x.id === offerId);
  if (!o || o.to !== pid) return { ok: false, error: 'Ponuda nije pronađena.' };
  if (o.status !== 'pending') return { ok: false, error: 'Na ponudu je već odgovoreno.' };
  if (s.round > o.expiresRound) { o.status = 'expired'; return { ok: false, error: 'Ponuda je istekla.' }; }
  if (s.phase !== 'planning') return { ok: false, error: 'Odgovori na ponude moguće su tijekom faze planiranja.' };
  o.respondedRound = s.round;
  const from = s.players[o.from], me = s.players[pid];
  if (!accept) {
    o.status = 'rejected';
    notify(s, { playerId: o.from, kind: 'diplomatic', title: 'Ponuda odbijena', body: `${me.name} je odbio tvoju ponudu.` });
    return { ok: true };
  }
  switch (o.kind) {
    case 'alliance':
      if (activeAlliance(s, o.from, pid, 'alliance')) { o.status = 'failed'; return { ok: false, error: 'Već ste saveznici.' }; }
      createAlliance(s, 'alliance', o.from, pid, o.terms.durationRounds, o.secret);
      o.status = 'executed'; o.resultText = 'Savez sklopljen.';
      break;
    case 'nap':
      createAlliance(s, 'nap', o.from, pid, o.terms.durationRounds, o.secret);
      o.status = 'executed'; o.resultText = 'Sporazum o nenapadanju sklopljen.';
      break;
    case 'trade': case 'swap': case 'support': case 'joint_attack':
      if (o.kind === 'support' && opts.toTerritoryId) o.terms.toTerritoryId = opts.toTerritoryId;
      o.status = 'accepted';
      break;
    default: o.status = 'accepted';
  }
  if (!o.secret) emit(s, s.round, 'diplomacy', `${me.name} i ${from.name}: ${kindLabel(o.kind)} prihvaćen.`, s.playerOrder, 'info');
  else emit(s, s.round, 'diplomacy', `Tajni dogovor s ${from.name} je prihvaćen (${kindLabel(o.kind)}).`, [o.from, pid], 'good');
  notify(s, { playerId: o.from, kind: 'diplomatic', title: 'Ponuda prihvaćena', body: `${me.name} je prihvatio: ${kindLabel(o.kind)}.` });
  return { ok: true };
}

export function withdrawOffer(s: GameState, pid: PlayerId, offerId: string) {
  const o = s.offers.find((x) => x.id === offerId && x.from === pid);
  if (!o || o.status !== 'pending') return { ok: false, error: 'Ponuda se ne može povući.' };
  o.status = 'withdrawn';
  return { ok: true };
}

export function terminateAlliance(s: GameState, pid: PlayerId, allianceId: string): { ok: boolean; error?: string } {
  const a = s.alliances.find((x) => x.id === allianceId && x.status === 'active' && (x.a === pid || x.b === pid));
  if (!a) return { ok: false, error: 'Sporazum nije pronađen.' };
  if (s.phase !== 'planning') return { ok: false, error: 'Dostupno samo tijekom faze planiranja.' };
  const other = a.a === pid ? a.b : a.a;
  const early = a.endsRound !== null && a.endsRound > s.round + 1;
  a.status = 'ended'; a.endedRound = s.round; a.endedBy = pid;
  const me = s.players[pid];
  if (early) { me.reputation.brokenTreaties++; adjustReputation(s, me, s.config.diplomacy.reputation.brokenTreaty / 2); }
  notify(s, { playerId: other, kind: 'diplomatic', title: a.kind === 'alliance' ? 'Savez raskinut' : 'Sporazum raskinut', body: `${me.name} je raskinuo ${a.kind === 'alliance' ? 'savez' : 'sporazum o nenapadanju'} s tobom.` });
  emit(s, s.round, 'diplomacy', `${me.name} je raskinuo ${a.kind === 'alliance' ? 'savez' : 'sporazum'} s ${pname(s, other)}.`, [pid, other], 'warn');
  return { ok: true };
}

export function sendMessage(s: GameState, from: PlayerId, to: PlayerId, body: string, now: string): { ok: boolean; error?: string; message?: Message } {
  if (!s.players[to] || to === from) return { ok: false, error: 'Neispravan primatelj.' };
  const text = body.trim().slice(0, 1000);
  if (!text) return { ok: false, error: 'Poruka je prazna.' };
  const m: Message = { id: nextId(s, 'm'), from, to, body: text, createdAt: now, round: s.round };
  s.messages.push(m);
  notify(s, { playerId: to, kind: 'diplomatic', title: `Poruka od ${s.players[from].name}`, body: text.slice(0, 80) });
  return { ok: true, message: m };
}

export const kindLabel = (k: DiplomaticOffer['kind']) => ({ alliance: 'savez', nap: 'sporazum o nenapadanju', trade: 'trgovinska razmjena', support: 'vojna potpora', swap: 'razmjena teritorija', joint_attack: 'zajednički napad', annex: 'pripajanje', improve: 'dar' }[k]);
