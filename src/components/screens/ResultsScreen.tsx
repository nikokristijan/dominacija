'use client';
import { motion, useReducedMotion } from 'framer-motion';
import Link from 'next/link';
import { Penguin } from '@/components/art/Penguin';
import { FactionBanner, FactionBadge } from '@/components/art/Factions';
import { Sparkle } from '@/components/art/Effects';
import { SectionTitle, Empty } from '@/components/ui/kit';
import { useGame } from '@/components/game/GameProvider';
import { ACHIEVEMENTS } from '@/engine/resolve';

export function ResultsScreen() {
  const g = useGame();
  const v = g.view!;
  const reduce = useReducedMotion();
  if (!v.final) return <div className="flex-1 overflow-y-auto"><Empty title="Kampanja još traje" text="Konačni rezultati pojavljuju se nakon sedmog dana." mood="thinking" /></div>;
  const rk = v.final.scores;
  const top = rk.slice(0, 3);
  const winner = v.players[rk[0].playerId];
  const iWon = rk[0].playerId === v.me.id;
  const myRank = rk.findIndex((r) => r.playerId === v.me.id) + 1;
  const names: Record<string, string> = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a.title])); names.iron_fist = 'Željezna šaka'; names.unshaken = 'Nepokolebljivi'; names.conqueror = 'Osvajač';
  return (
    <div className="flex-1 overflow-y-auto bg-kingdom text-white" data-testid="results-screen">
      <div className="max-w-3xl mx-auto p-4 space-y-5 relative">
        {!reduce && Array.from({ length: 18 }).map((_, i) => <motion.span key={i} className="absolute top-0 pointer-events-none" style={{ left: `${(i * 37) % 100}%` }} initial={{ y: -20, opacity: 0 }} animate={{ y: 420, opacity: [0, 1, 0], rotate: 180 }} transition={{ duration: 3.2 + (i % 5) * 0.4, delay: (i % 7) * 0.3, repeat: Infinity }}><Sparkle size={10 + (i % 4) * 4} color={['#FFD23F', '#EC4899', '#38BDF8', '#22C55E'][i % 4]} /></motion.span>)}
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', damping: 14 }} className="text-center pt-2">
          <div className="text-sm font-extrabold uppercase tracking-widest text-white/80">Kampanja završena</div>
          <h1 className="text-4xl text-accent drop-shadow">{iWon ? 'Pobjeda, kralju!' : `Pobjednik: ${winner.name}`}</h1>
          <div className="flex justify-center -mb-2"><Penguin mood={iWon ? 'celebrating' : myRank <= 3 ? 'happy' : 'confident'} size={170} /></div>
          <p className="font-bold text-white/90">Tvoje mjesto: <span className="font-display text-2xl text-accent">{myRank}.</span> od {rk.length}</p>
        </motion.div>
        <div className="grid grid-cols-3 gap-2 items-end">
          {[top[1], top[0], top[2]].map((r, i) => r && (<motion.div key={r.playerId} initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 + i * 0.15 }} className="flex flex-col items-center">
            <FactionBanner faction={v.players[r.playerId].faction} size={i === 1 ? 70 : 54} /><div className="font-display text-sm truncate max-w-full">{v.players[r.playerId].name}</div>
            <div className={`w-full rounded-t-2xl grid place-items-center font-display text-3xl text-ink ${i === 1 ? 'h-28 bg-accent' : i === 0 ? 'h-20 bg-slate-200' : 'h-14 bg-orange-300'}`}>{i === 1 ? 1 : i === 0 ? 2 : 3}<span className="text-xs font-bold -mt-1">{r.total} bod.</span></div></motion.div>))}
        </div>
        <section className="rounded-3xl bg-white text-ink p-3 space-y-2">
          <SectionTitle icon="trophy">Konačna ljestvica</SectionTitle>
          <div className="overflow-x-auto"><table className="w-full text-xs min-w-[34rem]"><thead><tr className="text-muted text-left"><th className="py-1">#</th><th>Igrač</th><th className="text-right">Teritor.</th><th className="text-right">Gradovi</th><th className="text-right">Gl. gradovi</th><th className="text-right">Regije</th><th className="text-right">Vojna</th><th className="text-right">Cilj</th><th className="text-right">Ukupno</th></tr></thead><tbody>
            {rk.map((r, i) => <tr key={r.playerId} className={`border-t border-line ${r.playerId === v.me.id ? 'bg-yellow-50' : ''}`}><td className="py-2 font-black">{i + 1}</td><td><span className="inline-flex items-center gap-1.5 font-extrabold"><FactionBadge faction={v.players[r.playerId].faction} size={22} />{v.players[r.playerId].name}</span></td><td className="text-right font-bold">{r.territories}</td><td className="text-right font-bold">{r.cities}</td><td className="text-right font-bold">{r.enemyCapitals}</td><td className="text-right font-bold">{r.regions}</td><td className="text-right font-bold">{r.military}</td><td className="text-right font-bold">{r.objective}</td><td className="text-right font-display text-lg text-primary">{r.total}</td></tr>)}</tbody></table></div>
        </section>
        <section className="rounded-3xl bg-white text-ink p-3 space-y-2">
          <SectionTitle icon="target">Otkriveni tajni ciljevi</SectionTitle>
          {rk.map((r) => <div key={r.playerId} className="flex items-center gap-2 rounded-2xl bg-primary-100/50 p-2"><FactionBadge faction={v.players[r.playerId].faction} size={28} /><div className="flex-1 text-sm"><b>{v.players[r.playerId].name}</b>: {r.objectiveTitle}</div><span className={`chip ${r.objectiveCompleted ? 'chip-good' : ''}`}>{r.objectiveCompleted ? '+5' : 'neispunjen'}</span></div>)}
          <div className="text-xs text-muted font-bold">Gospodarska snaga i diplomatski uspjeh (informativno): {rk.map((r) => `${v.players[r.playerId].name} ${Math.round(r.economicStrength)} / ${r.diplomaticScore}`).join(' · ')}</div>
          <div className="text-xs text-muted font-bold">Vojna postignuća: {rk.map((r) => `${v.players[r.playerId].name}: ${r.militaryAchievements.map((a) => names[a] ?? a).join(', ') || '—'}`).join(' · ')}</div>
        </section>
        <div className="grid grid-cols-2 gap-3 pb-4"><Link href="/igra" className="btn btn-yellow">Nova kampanja</Link><Link href={`/k/${g.id}/izvjestaji`} className="btn btn-ghost">Izvještaji</Link></div>
      </div>
    </div>
  );
}
