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
