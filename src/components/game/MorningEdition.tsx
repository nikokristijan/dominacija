'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { animate, motion, useReducedMotion } from 'framer-motion';
import { Icon } from '@/components/art/Icons';
import { buildEdition, type EditionItem } from '@/lib/newspaper';
import { setSound, soundOn, sfx } from '@/lib/sfx';
import { useGame } from './GameProvider';

const BAR: Record<EditionItem['kind'], string> = { win: 'bg-good', loss: 'bg-bad', news: 'bg-neutral-300', diplomacy: 'bg-primary', spy: 'bg-neutral-400', good: 'bg-good', bad: 'bg-warn' };

function CountUp({ from, to, delay }: { from: number; to: number; delay: number }) {
  const [n, setN] = useState(from);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (reduce) { setN(to); return; }
    const c = animate(from, to, { delay, duration: 0.9, ease: 'easeOut', onUpdate: (x) => setN(Math.round(x)) });
    return () => c.stop();
  }, [from, to, delay, reduce]);
  return <>{n}</>;
}

/** Jutarnje izdanje: dramatičan prikaz ishoda prošle runde kad se igrač vrati u igru. */
export function MorningEdition({ round, onClose }: { round: number; onClose: () => void }) {
  const g = useGame();
  const router = useRouter();
  const v = g.view!;
  const ed = buildEdition(v, round);
  const [snd, setSnd] = useState(true);
  const played = useRef(false);
  useEffect(() => { setSnd(soundOn()); }, []);
  useEffect(() => {
    if (!ed || played.current) return; played.current = true;
    sfx.open();
    const first = ed.items.find((i) => i.kind === 'win' || i.kind === 'loss');
    const t = setTimeout(() => { if (first?.kind === 'win') sfx.win(); else if (first?.kind === 'loss') sfx.loss(); else if (ed.rank.before && ed.rank.after < ed.rank.before) sfx.rankUp(); }, 1500);
    return () => clearTimeout(t);
  }, [ed]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  if (!ed) return null;
  const delta = ed.score.after - ed.score.before;
  const up = ed.rank.before !== null && ed.rank.after < ed.rank.before, down = ed.rank.before !== null && ed.rank.after > ed.rank.before;
  const focus = ed.items.find((i) => i.territoryId);
  const D = 0.5;
  return (
    <motion.div className="fixed inset-0 z-[70] bg-white overflow-y-auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="dialog" aria-modal="true" aria-label="Jutarnje izdanje" data-testid="morning-edition">
      <div className="max-w-xl mx-auto px-5 pt-[calc(1.5rem+var(--safe-t))] pb-10 min-h-full flex flex-col">
        <div className="flex items-center justify-between">
          <span className="label">{ed.kicker}</span>
          <button className="h-9 w-9 grid place-items-center rounded-full text-neutral-400 hover:bg-neutral-50" onClick={() => { const n = !snd; setSnd(n); setSound(n); }} aria-label={snd ? 'Utišaj zvuk' : 'Uključi zvuk'} title={snd ? 'Utišaj zvuk' : 'Uključi zvuk'}><Icon name={snd ? 'bell' : 'close'} size={18} /></button>
        </div>
        <motion.h1 initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.55 }} className="mt-6 text-[2.5rem] sm:text-5xl leading-[1.05] font-semibold tracking-tight" data-testid="edition-headline">{ed.headline}</motion.h1>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: D + 0.2 }} className="mt-8 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-line p-4"><div className="label">Bodovi</div><div className="mt-1 text-3xl font-semibold tabular-nums"><CountUp from={ed.score.before} to={ed.score.after} delay={D + 0.4} /></div><div className={`text-sm font-semibold ${delta > 0 ? 'text-good' : delta < 0 ? 'text-bad' : 'text-muted'}`}>{delta > 0 ? '+' : delta < 0 ? '−' : '±'}{Math.abs(delta)} od jučer</div></div>
          <div className="rounded-xl border border-line p-4"><div className="label">Mjesto</div><div className="mt-1 text-3xl font-semibold tabular-nums">{ed.rank.after}.</div><div className={`text-sm font-semibold ${up ? 'text-good' : down ? 'text-bad' : 'text-muted'}`}>{up ? `▲ popeo se s ${ed.rank.before}.` : down ? `▼ pao s ${ed.rank.before}.` : 'bez promjene'}</div></div>
        </motion.div>

        {ed.items.length > 0 && <div className="mt-6 space-y-2">
          {ed.items.map((it, i) => (
            <motion.div key={it.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: D + 0.9 + i * 0.28 }} className="flex gap-3 rounded-xl border border-line p-3.5" data-testid="edition-item">
              <span className={`w-1 rounded-full shrink-0 ${BAR[it.kind]}`} />
              <div className="min-w-0"><div className="font-semibold leading-tight">{it.title}</div><div className="text-sm text-neutral-600 mt-0.5">{it.text}</div></div>
            </motion.div>))}
        </div>}
        {ed.items.length === 0 && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: D + 0.9 }} className="mt-6 text-neutral-500">Dan je prošao u tišini. Netko nešto sprema.</motion.p>}

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: D + 1.2 + ed.items.length * 0.28 }} className="mt-6 space-y-3">
          {ed.rival && <div className="flex items-center gap-2 text-sm"><Icon name="target" size={16} className="text-primary shrink-0" /><span><b>Rival:</b> {ed.rival}</span></div>}
          {ed.teaser && <div className="rounded-xl bg-primary-100 text-primary px-4 py-3 text-sm font-medium">{ed.teaser}</div>}
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: D + 1.4 + ed.items.length * 0.28 }} className="mt-auto pt-8 grid gap-2">
          <button className="btn btn-yellow min-h-12 text-base" onClick={onClose} autoFocus data-testid="edition-continue">Planiraj današnji potez</button>
          {focus && <button className="btn btn-ghost" onClick={() => { onClose(); g.select(focus.territoryId!); router.push(`/k/${g.id}/karta`); }} data-testid="edition-map">Pogledaj na karti</button>}
        </motion.div>
      </div>
    </motion.div>
  );
}
