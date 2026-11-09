// Mjerenje tempa igre sa 6 botova kroz 7 dana (teritoriji, vojska, bitke, zlato/željezo). Pokretanje: npx tsx scripts/balance.ts [JSON preinaka konfiguracije]
import { createCampaignState, resolveRound, forecastEconomy, playerTerritories, unitTotal } from '../src/engine';
import { botPlan } from '../src/engine/ai';
const NOW = '2026-01-01T08:00:00.000Z';
export function sim(seed: string, cfg: any, n = 6) {
  let s = createCampaignState({ campaignId: 'c', seed, config: cfg, players: Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, userId: null, name: `B${i + 1}`, isBot: true })) });
  const out: any[] = [];
  for (let r = 1; r <= 7; r++) {
    for (const id of s.playerOrder) botPlan(s, id, NOW);
    s = resolveRound(s, { now: NOW });
    const ps = s.playerOrder.map((id) => s.players[id]);
    const terr = ps.map((p) => playerTerritories(s, p.id).length);
    const army = ps.map((p) => playerTerritories(s, p.id).reduce((a, t) => a + unitTotal(t.garrison), 0));
    out.push({ r, terrAvg: terr.reduce((a, b) => a + b, 0) / n, terrMax: Math.max(...terr), armyAvg: army.reduce((a, b) => a + b, 0) / n, armyMax: Math.max(...army), battles: s.battles.filter((b) => b.round === r).length, iron: ps.reduce((a, p) => a + p.resources.iron, 0) / n, gold: ps.reduce((a, p) => a + p.resources.gold, 0) / n, income: ps.reduce((a, p) => a + forecastEconomy(s, p.id).net.gold, 0) / n });
  }
  return out;
}
const cfg = JSON.parse(process.argv[2] ?? '{}');
const seeds = ['a1', 'b2', 'c3', 'd4'];
const runs = seeds.map((sd) => sim(sd, cfg));
for (let i = 0; i < 7; i++) {
  const f = (k: string) => (runs.reduce((a, r) => a + r[i][k], 0) / runs.length).toFixed(1);
  console.log(`D${i + 1} terr ${f('terrAvg')} (max ${f('terrMax')}) army ${f('armyAvg')} (max ${f('armyMax')}) battles ${f('battles')} gold ${f('gold')} iron ${f('iron')} income ${f('income')}`);
}
