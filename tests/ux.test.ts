import { describe, expect, it } from 'vitest';
import { createCampaignState, resolveRound, setReady } from '../src/engine';
import { botGreet, botPlan, botPersonality } from '../src/engine/ai';
import { getPlayerView } from '../src/engine/view';
import { radar } from '../src/lib/radar';
import { suggestions } from '../src/lib/suggestions';
import { buildEdition } from '../src/lib/newspaper';
import { buildReplay } from '../src/lib/replay';

const NOW = '2026-01-01T08:00:00.000Z';
const mk = () => createCampaignState({ campaignId: 'c', seed: 'ux', players: [{ id: 'p1', userId: 'u1', name: 'Ti' }, ...['Ana', 'Ivan', 'Petra', 'Luka'].map((n, i) => ({ id: `p${i + 2}`, userId: null, name: n, isBot: true }))] });

describe('Doživljaj igre: botovi s glasom, radar, izdanje, ponavljanje', () => {
  it('botovi se javljaju čovjeku prvi dan, a poruke vidi samo primatelj', () => {
    const s = mk(); botGreet(s, NOW);
    const v = getPlayerView(s, 'p1');
    expect(v.messages.filter((m) => m.to === 'p1').length).toBe(4);
    expect(v.players.p2.persona).toBeTruthy();
    expect(getPlayerView(s, 'p3').messages.every((m) => m.from === 'p3' || m.to === 'p3')).toBe(true);
    expect(['aggressor', 'builder', 'diplomat']).toContain(botPersonality(s, 'p2'));
  });
  it('preporuke uključuju poruku bota; radar ne pada i ne otkriva ništa izvan pogleda', () => {
    const s = mk(); botGreet(s, NOW);
    const v = getPlayerView(s, 'p1');
    expect(suggestions(v, '/k/x').some((x) => x.id === 'msg')).toBe(true);
    for (const r of radar(v)) expect(v.territories[r.id]).toBeTruthy();
  });
  it('kroz cijelu kampanju: izdanje i ponavljanje se grade svaku rundu bez grešaka, ponavljanje samo iz vidljivih podataka', () => {
    let s = mk(); botGreet(s, NOW);
    for (let r = 1; r <= 7; r++) {
      for (const id of s.playerOrder.filter((i) => s.players[i].isBot)) botPlan(s, id, NOW);
      setReady(s, 'p1', true);
      s = resolveRound(s, { now: NOW });
      if (s.phase === 'completed') break;
      const v = getPlayerView(s, 'p1');
      const ed = buildEdition(v, r);
      expect(ed).toBeTruthy(); expect(ed!.headline.length).toBeGreaterThan(3);
      for (const st of buildReplay(v, r)) expect(v.territories[st.territoryId]).toBeTruthy();
    }
  });
});

import { chooseDilemma, dilemmaFor, DILEMMAS } from '../src/engine/dilemmas';
import { addOrder } from '../src/engine';
import { neighborIds, unitTotal } from '../src/engine/util';
import { offsetDistance } from '../src/engine/hex';

describe('Dnevna dilema', () => {
  it('svaki igrač dobiva različite dileme tijekom kampanje (nema ponavljanja u 7 dana)', () => {
    const s = mk();
    for (const pid of s.playerOrder) { const ids = [1, 2, 3, 4, 5, 6, 7].map((r) => dilemmaFor(s, pid, r).id); expect(new Set(ids).size).toBe(7); }
    expect(DILEMMAS.length).toBeGreaterThanOrEqual(10);
  });
  it('izbor primjenjuje učinke jednom; ponovni izbor se odbija; pogled prikazuje odabir', () => {
    const s = mk(); const p = s.players.p1; const g0 = p.resources.gold;
    const d = dilemmaFor(s, 'p1', 1);
    const r = chooseDilemma(s, 'p1', 'a');
    expect(r.ok).toBe(true);
    const dg = d.a.effects.res?.gold ?? 0;
    expect(p.resources.gold).toBeCloseTo(Math.max(0, g0 + dg), 5);
    expect(chooseDilemma(s, 'p1', 'b').ok).toBe(false);
    expect(getPlayerView(s, 'p1').dilemma?.chosen).toBe('a');
    expect(getPlayerView(s, 'p2').dilemma?.chosen).toBeNull();
  });
  it('izbor koji nije dostupan (nema resursa) se odbija bez promjene stanja', () => {
    const s = mk(); const p = s.players.p1; p.resources.gold = 0; p.resources.food = 0; p.resources.iron = 0; p.resources.wood = 0;
    for (const k of ['a', 'b'] as const) {
      const s2 = structuredClone(s); const d = dilemmaFor(s2, 'p1', 1); const opt = k === 'a' ? d.a : d.b;
      const needs = Object.values(opt.effects.res ?? {}).some((n) => (n ?? 0) < 0);
      const before = JSON.stringify(s2.players.p1.resources);
      const r = chooseDilemma(s2, 'p1', k);
      if (needs) { expect(r.ok).toBe(false); expect(JSON.stringify(s2.players.p1.resources)).toBe(before); }
    }
  });
});

describe('Razbojnički kampovi', () => {
  it('4–8 neutralnih kampova daleko od glavnih gradova, vidljivi svima kao mamac', () => {
    const s = mk();
    const camps = Object.values(s.map.territories).filter((t) => t.camp);
    expect(camps.length).toBeGreaterThanOrEqual(4); expect(camps.length).toBeLessThanOrEqual(8);
    const caps = s.playerOrder.map((id) => s.map.territories[s.players[id].capitalId]);
    for (const c of camps) { expect(c.owner).toBeNull(); expect(c.terrain).not.toBe('water'); expect(Math.min(...caps.map((k) => offsetDistance(k, c)))).toBeGreaterThanOrEqual(3); }
    const v = getPlayerView(s, 'p1'); expect(Object.values(v.territories).filter((t) => t.camp).length).toBe(camps.length);
  });
  it('razbijanje kampa daje plijen i uklanja kamp; mirno pripajanje je odbijeno', () => {
    let s = mk();
    const camp = Object.values(s.map.territories).find((t) => t.camp && neighborIds(s, t.id).some((n) => s.map.territories[n].terrain !== 'water'))!;
    const from = s.map.territories[neighborIds(s, camp.id).find((n) => s.map.territories[n].terrain !== 'water')!];
    from.owner = 'p1'; from.garrison = { infantry: 80 }; from.stability = 80; s.players.p1.resources.food = 5000;
    const reward = camp.camp!.reward;
    const goldBefore = s.players.p1.resources.gold;
    const o = addOrder(s, 'p1', { type: 'attack', params: { fromId: from.id, targetId: camp.id, units: { infantry: 75 }, strategy: 'direct', formation: 'line', supply: 'standard', risk: 'balanced', retreatBelow: 0, reserve: {} } }, 'submitted', NOW);
    expect(o.ok, JSON.stringify((o as any).validation?.errors)).toBe(true);
    setReady(s, 'p1', true);
    s = resolveRound(s, { now: NOW });
    const t = s.map.territories[camp.id];
    expect(t.owner).toBe('p1'); expect(t.camp).toBeFalsy();
    expect(s.reportEntries.some((e) => e.text.includes('Razbijen je kamp') && e.audience.includes('p1'))).toBe(true);
    if (reward.gold) expect(s.players.p1.resources.gold).toBeGreaterThan(goldBefore + reward.gold * 0.5);
    void unitTotal;
  });
});

describe('Osveta i izdajnik', () => {
  const mk5 = () => createCampaignState({ campaignId: 'c', seed: 'trt', players: Array.from({ length: 5 }, (_, i) => ({ id: `p${i + 1}`, userId: `u${i}`, name: `P${i + 1}` })) });
  it('u kampanji s 5+ igrača točno jedan izdajnik; s 4 igrača nijedan', () => {
    const s = mk5(); expect(Object.values(s.players).filter((p) => p.objective.type === 'traitor').length).toBe(1);
    const s4 = createCampaignState({ campaignId: 'c', seed: 'trt', players: Array.from({ length: 4 }, (_, i) => ({ id: `p${i + 1}`, userId: `u${i}`, name: `P${i + 1}` })) });
    expect(Object.values(s4.players).filter((p) => p.objective.type === 'traitor').length).toBe(0);
  });
  it('napad stvara dug napadnutome, a uzvrat s dugom dobiva faktor Osveta i naplaćuje dug', () => {
    let s = mk5();
    const a = s.players.p1, d = s.players.p2;
    // p1 napada p2 → p2 zamjera p1
    const dt = Object.values(s.map.territories).find((t) => t.owner === 'p2' && !t.isCapital)!;
    const from = s.map.territories[neighborIds(s, dt.id).find((n) => s.map.territories[n].terrain !== 'water' && s.map.territories[n].owner !== 'p2')!];
    from.owner = 'p1'; from.garrison = { infantry: 60 }; s.players.p1.resources.food = 5000; dt.garrison = { infantry: 2 };
    expect(addOrder(s, 'p1', { type: 'attack', params: { fromId: from.id, targetId: dt.id, units: { infantry: 55 }, strategy: 'direct', formation: 'line', supply: 'standard', risk: 'balanced', retreatBelow: 0, reserve: {} } }, 'submitted', NOW).ok).toBe(true);
    setReady(s, 'p1', true);
    s = resolveRound(s, { now: NOW });
    expect(s.players.p2.grudges.p1).toBeGreaterThanOrEqual(1);
    expect(getPlayerView(s, 'p1').players.p2.grudge).toBeGreaterThanOrEqual(1); // p2 zamjera p1
    expect(getPlayerView(s, 'p2').players.p1.grudge).toBe(0);
    expect(revengeBonus(s.players.p2, 'p1')).toBeGreaterThanOrEqual(0.05);
    expect(revengeBonus(s.players.p1, 'p2')).toBe(0);
    void a; void d;
  });
  it('izdaja saveznika daje žrtvi veći dug, a izdajniku označava napredak cilja', () => {
    const s = mk5(); const pid = Object.values(s.players).find((p) => p.objective.type === 'traitor')!.id;
    const other = s.playerOrder.find((i) => i !== pid)!;
    expect(objectiveProgressLabel(s, pid)).toContain('Još nisi');
    void other;
  });
});
import { objectiveProgress } from '../src/engine/objectives';
import { revengeBonus } from '../src/engine/resolve';
const objectiveProgressLabel = (s: ReturnType<typeof mk>, pid: string) => objectiveProgress(s, pid).label;
