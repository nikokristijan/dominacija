// Provjera da gospodarstvo „boli”: bot koji ne gradi/istražuje/trguje naspram normalnog. Pokretanje: npx tsx scripts/balance-econ.ts
import { createCampaignState, resolveRound, playerTerritories, unitTotal, computeScore } from '../src/engine';
import { botPlan } from '../src/engine/ai';
const NOW = '2026-01-01T08:00:00.000Z';
function run(seed: string, ignoreEcon: boolean) {
  let s = createCampaignState({ campaignId: 'c', seed, players: Array.from({ length: 6 }, (_, i) => ({ id: `p${i + 1}`, userId: null, name: `B${i + 1}`, isBot: true })) });
  for (let r = 1; r <= 7; r++) {
    for (const id of s.playerOrder) {
      botPlan(s, id, NOW);
      if (ignoreEcon && id === 'p1') for (const o of s.orders) if (o.playerId === 'p1' && o.round === s.round && (o.type === 'build' || o.type === 'research' || o.type === 'trade') && o.status === 'submitted') o.status = 'cancelled';
    }
    s = resolveRound(s, { now: NOW });
  }
  const pts = s.playerOrder.map((id) => computeScore(s, id).total);
  const t1 = playerTerritories(s, 'p1').length, others = s.playerOrder.slice(1).map((id) => playerTerritories(s, id).length);
  const rank = 1 + pts.slice(1).filter((x) => x > pts[0]).length;
  return { rank, pts: pts[0], avgOthers: pts.slice(1).reduce((a, b) => a + b, 0) / 5, t1, avgT: others.reduce((a, b) => a + b, 0) / 5 };
}
for (const ign of [false, true]) {
  const rs = ['a1', 'b2', 'c3', 'd4', 'e5', 'f6', 'g7', 'h8'].map((sd) => run(sd, ign));
  console.log(ign ? 'IGNORIRA EKONOMIJU' : 'NORMALNO        ', 'avg rank', (rs.reduce((a, r) => a + r.rank, 0) / rs.length).toFixed(2), 'pts', (rs.reduce((a, r) => a + r.pts, 0) / rs.length).toFixed(1), 'vs others', (rs.reduce((a, r) => a + r.avgOthers, 0) / rs.length).toFixed(1), 'terr', (rs.reduce((a, r) => a + r.t1, 0) / rs.length).toFixed(1), 'vs', (rs.reduce((a, r) => a + r.avgT, 0) / rs.length).toFixed(1));
}
