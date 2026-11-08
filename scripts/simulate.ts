/**
 * Simulacija cijele 7-dnevne kampanje (razvojni način): botovi planiraju, server razrješuje.
 * Korištenje: npm run simulate -- [brojIgrača] [seed] [--quiet]
 */
import { createCampaignState, resolveRound, ranking, FACTIONS, playerTerritories, unitTotal } from '../src/engine';
import { botPlan } from '../src/engine/ai';

export function simulate(n: number, seed: string, quiet = false) {
  const t0 = Date.now();
  let s = createCampaignState({ campaignId: 'sim', seed, players: Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, userId: null, name: `Bot ${i + 1}`, isBot: true })) });
  const now = new Date().toISOString();
  for (let d = 1; d <= 7; d++) {
    for (const id of s.playerOrder) botPlan(s, id, now);
    const before = s.battles.length;
    s = resolveRound(s, { now });
    if (!quiet) console.log(`Dan ${d}: bitaka ${s.battles.length - before}, osvajanja ${s.battles.slice(before).filter((b) => b.captured).length}`);
  }
  const rk = ranking(s);
  if (!quiet) {
    console.log('\n=== KONAČNI REZULTATI ===');
    for (const r of rk) {
      const p = s.players[r.playerId];
      console.log(`${FACTIONS[p.faction].adjective.padEnd(11)} ${p.name.padEnd(6)} bodovi ${String(r.total).padStart(3)} | teritorija ${String(r.territoryCount).padStart(2)} gradova ${r.cityCount} | vojska ${playerTerritories(s, p.id).reduce((a, t) => a + unitTotal(t.garrison), 0)} | tehn ${p.techs.length} | cilj ${r.objectiveCompleted ? '✔' : '✘'} ${p.status === 'resistance' ? '(OTPOR)' : ''}`);
    }
    console.log(`Trajanje: ${Date.now() - t0} ms`);
  }
  return { s, rk };
}

if (process.argv[1]?.includes('simulate')) {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const n = Number(args[0] ?? 6), seed = args[1] ?? 'demo';
  if (args[0] === 'batch') {
    let spread = 0, captures = 0, resist = 0, battles = 0, done = 0;
    for (let i = 0; i < 20; i++) {
      const { s, rk } = simulate(4 + (i % 5), `batch-${i}`, true);
      spread += rk[0].total - rk[rk.length - 1].total; captures += s.battles.filter((b) => b.captured).length; battles += s.battles.length;
      resist += Object.values(s.players).filter((p) => p.achievements.includes('__resisted')).length; done += rk.filter((r) => r.objectiveCompleted).length;
    }
    console.log(`20 kampanja: prosj. razlika prvi-zadnji ${(spread / 20).toFixed(1)}, bitaka ${(battles / 20).toFixed(1)}, osvajanja ${(captures / 20).toFixed(1)}, igrača u otporu ${resist}, ispunjenih ciljeva ${done}`);
  } else simulate(n, seed, process.argv.includes('--quiet'));
}
