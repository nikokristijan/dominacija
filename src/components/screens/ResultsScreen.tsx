'use client';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { FactionBadge } from '@/components/art/Factions';
import { SectionTitle, Empty } from '@/components/ui/kit';
import { useGame } from '@/components/game/GameProvider';
import { ACHIEVEMENTS } from '@/engine/resolve';

export function ResultsScreen() {
  const g = useGame();
  const v = g.view!;
  if (!v.final) return <div className="flex-1 overflow-y-auto"><Empty title="Kampanja još traje" text="Konačni rezultati pojavljuju se nakon sedmog dana." /></div>;
  const rk = v.final.scores;
  const top = rk.slice(0, 3);
  const winner = v.players[rk[0].playerId];
  const iWon = rk[0].playerId === v.me.id;
  const myRank = rk.findIndex((r) => r.playerId === v.me.id) + 1;
  const names: Record<string, string> = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a.title])); names.iron_fist = 'Željezna šaka'; names.unshaken = 'Nepokolebljivi'; names.conqueror = 'Osvajač';
  return (
    <div className="flex-1 overflow-y-auto bg-white" data-testid="results-screen">
      <div className="max-w-3xl mx-auto p-4 space-y-5">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-center pt-4">
          <div className="label">Kampanja završena</div>
          <h1 className="text-4xl mt-1">{iWon ? 'Pobjeda, kralju!' : `Pobjednik: ${winner.name}`}</h1>
          <p className="text-neutral-500 mt-2">Tvoje mjesto: <span className="text-2xl font-semibold text-primary">{myRank}.</span> od {rk.length}</p>
        </motion.div>
        <div className="grid grid-cols-3 gap-2 items-end">
          {[top[1], top[0], top[2]].map((r, i) => r && (
            <motion.div key={r.playerId} initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 + i * 0.12 }} className="flex flex-col items-center gap-1">
              <FactionBadge faction={v.players[r.playerId].faction} size={i === 1 ? 52 : 40} /><div className="font-semibold text-sm truncate max-w-full">{v.players[r.playerId].name}</div>
              <div className={`w-full rounded-t-2xl grid place-items-center text-3xl font-semibold ${i === 1 ? 'h-28 bg-primary-100 text-primary' : i === 0 ? 'h-20 bg-neutral-100' : 'h-14 bg-neutral-50'}`}>{i === 1 ? 1 : i === 0 ? 2 : 3}<span className="text-xs font-medium text-muted -mt-1">{r.total} bod.</span></div>
            </motion.div>))}
        </div>
        <section className="card space-y-2">
          <SectionTitle icon="trophy">Konačna ljestvica</SectionTitle>
          <div className="overflow-x-auto"><table className="w-full text-xs min-w-[34rem]"><thead><tr className="text-muted text-left"><th className="py-1">#</th><th>Igrač</th><th className="text-right">Teritor.</th><th className="text-right">Gradovi</th><th className="text-right">Gl. gradovi</th><th className="text-right">Regije</th><th className="text-right">Vojna</th><th className="text-right">Cilj</th><th className="text-right">Ukupno</th></tr></thead><tbody>
            {rk.map((r, i) => <tr key={r.playerId} className={`border-t border-line ${r.playerId === v.me.id ? 'bg-primary-100/60' : ''}`}><td className="py-2 font-semibold">{i + 1}</td><td><span className="inline-flex items-center gap-1.5 font-semibold"><FactionBadge faction={v.players[r.playerId].faction} size={22} />{v.players[r.playerId].name}</span></td><td className="text-right">{r.territories}</td><td className="text-right">{r.cities}</td><td className="text-right">{r.enemyCapitals}</td><td className="text-right">{r.regions}</td><td className="text-right">{r.military}</td><td className="text-right">{r.objective}</td><td className="text-right text-lg font-semibold text-primary">{r.total}</td></tr>)}</tbody></table></div>
        </section>
        <section className="card space-y-2">
          <SectionTitle icon="target">Otkriveni tajni ciljevi</SectionTitle>
          {rk.map((r) => <div key={r.playerId} className="flex items-center gap-2 rounded-xl bg-neutral-50 p-2"><FactionBadge faction={v.players[r.playerId].faction} size={28} /><div className="flex-1 text-sm"><b>{v.players[r.playerId].name}</b>: {r.objectiveTitle}</div><span className={`chip ${r.objectiveCompleted ? 'chip-good' : ''}`}>{r.objectiveCompleted ? '+5' : 'neispunjen'}</span></div>)}
          <div className="text-xs text-muted">Gospodarska snaga i diplomatski uspjeh (informativno): {rk.map((r) => `${v.players[r.playerId].name} ${Math.round(r.economicStrength)} / ${r.diplomaticScore}`).join(' · ')}</div>
          <div className="text-xs text-muted">Vojna postignuća: {rk.map((r) => `${v.players[r.playerId].name}: ${r.militaryAchievements.map((a) => names[a] ?? a).join(', ') || '—'}`).join(' · ')}</div>
        </section>
        <div className="grid grid-cols-2 gap-3 pb-4"><Link href="/igra" className="btn btn-yellow">Nova kampanja</Link><Link href={`/k/${g.id}/izvjestaji`} className="btn btn-ghost">Izvještaji</Link></div>
      </div>
    </div>
  );
}
