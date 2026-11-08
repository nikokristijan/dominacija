'use client';
import { FACTIONS } from '@/engine/config';
import { FactionBadge } from '@/components/art/Factions';
import { SectionTitle } from '@/components/ui/kit';
import { useGame } from '@/components/game/GameProvider';
import { KingdomTabs } from '@/components/game/KingdomTabs';

export function RankingScreen() {
  const g = useGame();
  const v = g.view!;
  const hist = v.history;
  const ids = v.playerOrder;
  const maxScore = Math.max(10, ...hist.flatMap((h) => Object.values(h.scores)));
  const W = 320, H = 150, px = 24, py = 12;
  const x = (i: number) => px + (i / Math.max(1, hist.length - 1)) * (W - px * 2);
  const y = (s: number) => H - py - (s / maxScore) * (H - py * 2);
  return (
    <div className="flex-1 overflow-y-auto" data-testid="ranking-screen">
      <div className="max-w-3xl mx-auto p-3 lg:p-5 space-y-4">
        <KingdomTabs />
        <h1 className="text-2xl text-secondary">Poredak</h1>
        <section className="space-y-2">
          {v.ranking.map((r, i) => { const p = v.players[r.playerId]; return (
            <div key={r.playerId} className={`card-flat flex items-center gap-3 ${r.playerId === v.me.id ? 'border-accent-600 bg-yellow-50/60' : ''}`}>
              <div className={`h-9 w-9 shrink-0 rounded-full grid place-items-center font-display font-semibold ${i === 0 ? 'bg-accent text-ink' : 'bg-primary-100 text-primary'}`}>{i + 1}</div>
              <FactionBadge faction={p.faction} size={38} />
              <div className="flex-1 min-w-0"><div className="font-display text-lg text-secondary truncate">{p.name}{p.status === 'resistance' && <span className="chip chip-bad ml-1">Otpor</span>}</div><div className="text-xs text-muted font-medium">{r.territories} teritorija · {r.cities} gradova · ugled {Math.round(p.reputation.score)}</div></div>
              <div className="font-display text-3xl text-primary">{r.score}</div>
            </div>); })}
          <p className="text-xs text-muted font-medium">Prikazani su javni bodovi. Tajni ciljevi (+5) otkrivaju se tek na kraju kampanje.</p>
        </section>
        <section className="card"><SectionTitle icon="trophy">Kretanje bodova</SectionTitle>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Kretanje bodova po danima">
            {[0, 0.5, 1].map((f) => <line key={f} x1={px} x2={W - px} y1={y(maxScore * f)} y2={y(maxScore * f)} stroke="#DCD3FF" strokeDasharray="3 4" />)}
            {hist.map((h, i) => <text key={i} x={x(i)} y={H - 1} fontSize="8" textAnchor="middle" fill="#6B628F" fontWeight="800">{h.round === 0 ? 'Start' : `D${h.round}`}</text>)}
            {ids.map((id) => { const f = FACTIONS[v.players[id].faction]; const pts = hist.map((h, i) => `${x(i)},${y(h.scores[id] ?? 0)}`).join(' '); const me = id === v.me.id; return <g key={id}><polyline points={pts} fill="none" stroke={f.color} strokeWidth={me ? 4 : 2.5} strokeLinecap="round" strokeLinejoin="round" opacity={me ? 1 : 0.8} />{hist.length > 0 && <circle cx={x(hist.length - 1)} cy={y(hist[hist.length - 1].scores[id] ?? 0)} r={me ? 4.5 : 3} fill={f.color} stroke="#fff" strokeWidth="1.5" />}</g>; })}
          </svg>
          <div className="flex flex-wrap gap-2 mt-1">{ids.map((id) => <span key={id} className="chip"><span className="h-2.5 w-2.5 rounded-full" style={{ background: FACTIONS[v.players[id].faction].color }} />{v.players[id].name}</span>)}</div>
        </section>
        <section className="card"><SectionTitle>Tvoji bodovi</SectionTitle>
          <table className="w-full text-sm"><tbody>
            {[['Običan teritorij (1)', v.scoreBreakdownMine.territories], ['Gradovi i vlastiti glavni grad (4)', v.scoreBreakdownMine.cities], ['Tuđi glavni gradovi (10)', v.scoreBreakdownMine.enemyCapitals], ['Kontrola regija (8)', v.scoreBreakdownMine.regions], ['Vojna postignuća', v.scoreBreakdownMine.military], ['Tajni cilj (5)', v.scoreBreakdownMine.objective]].map(([l, n]) => <tr key={l as string} className="border-b border-line/60 last:border-0"><td className="py-1.5 font-medium text-muted">{l}</td><td className="py-1.5 text-right font-display font-semibold">{n}</td></tr>)}
            <tr><td className="py-2 font-display text-lg text-secondary">Ukupno</td><td className="py-2 text-right font-display text-2xl text-primary">{v.scoreBreakdownMine.total}</td></tr>
          </tbody></table>
        </section>
      </div>
    </div>
  );
}
