'use client';
import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
import { FactionBadge } from '@/components/art/Factions';
import { SectionTitle, Empty } from '@/components/ui/kit';
import { useGame } from '@/components/game/GameProvider';
import { ACHIEVEMENTS } from '@/engine/resolve';
import { sfx } from '@/lib/sfx';
import { renderShareCard, shareImage } from '@/lib/shareCard';
import { FACTIONS } from '@/engine/config';
import { Icon } from '@/components/art/Icons';

const GAP = 1100;

/** Završetak kampanje kao događaj: poredak se otkriva od posljednjeg prema pobjedniku, pa nagrade i tajni ciljevi. */
export function ResultsScreen() {
  const g = useGame();
  const v = g.view!;
  const key = `dom_results_${g.id}`;
  const rk = v.final?.scores ?? [];
  const [shown, setShown] = useState(() => { try { return localStorage.getItem(key) ? 999 : 0; } catch { return 0; } }); // koliko je mjesta otkriveno (od zadnjeg); već viđeno = sve
  const total = rk.length;
  const [sharing, setSharing] = useState(false);
  useEffect(() => {
    if (!total || shown >= total) { if (total && shown >= total) try { localStorage.setItem(key, '1'); } catch { /* */ } return; }
    const t = setTimeout(() => {
      const next = shown + 1; const placeIdx = total - next; const r = rk[placeIdx];
      if (next === total) (r.playerId === v.me.id ? sfx.win : sfx.rankUp)(); else if (r.playerId === v.me.id) sfx.rankUp(); else sfx.tick();
      setShown(next);
    }, shown === 0 ? 1200 : GAP);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown, total]);

  const names: Record<string, string> = useMemo(() => ({ ...Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a.title])), iron_fist: 'Željezna šaka', unshaken: 'Nepokolebljivi', conqueror: 'Osvajač' }), []);
  if (!v.final) return <div className="flex-1 overflow-y-auto"><Empty title="Kampanja još traje" text="Konačni rezultati pojavljuju se nakon sedmog dana." /></div>;
  const done = shown >= total;
  const winner = v.players[rk[0].playerId];
  const iWon = rk[0].playerId === v.me.id;
  const myRank = rk.findIndex((r) => r.playerId === v.me.id) + 1;
  const best = <T,>(f: (r: (typeof rk)[number]) => number, min = 1) => { const top = [...rk].sort((a, b) => f(b) - f(a))[0]; return f(top) >= min ? top : null; };
  const share = async () => {
    setSharing(true);
    try {
      const blob = await renderShareCard({
        headline: iWon ? 'Pobijedio sam u 7 dana!' : `Završio sam ${myRank}. od ${total}`,
        sub: iWon ? `${rk[0].total} bodova · ${v.players[rk[0].playerId].name}` : `Pobjednik: ${winner.name} (${rk[0].total} bod.)`,
        campaign: g.meta?.name ?? 'Kampanja',
        rows: rk.map((r, i) => ({ place: i + 1, name: v.players[r.playerId].name, points: r.total, color: FACTIONS[v.players[r.playerId].faction].color, me: r.playerId === v.me.id })),
      });
      const r = await shareImage(blob, 'dominacija-rezultat.png', iWon ? 'Pobijedio sam u Dominaciji!' : 'Moj rezultat u Dominaciji');
      if (r === 'downloaded') g.toast('Slika je spremljena — pošalji je prijateljima.', 'good');
    } catch { g.toast('Slika se nije mogla stvoriti.', 'bad'); } finally { setSharing(false); }
  };
  const awards = [
    { t: 'Najveće carstvo', r: best((r) => r.territoryCount), s: (r: (typeof rk)[number]) => `${r.territoryCount} teritorija` },
    { t: 'Najbogatije kraljevstvo', r: best((r) => r.economicStrength), s: (r: (typeof rk)[number]) => `snaga ${Math.round(r.economicStrength)}` },
    { t: 'Najbolji diplomat', r: best((r) => r.diplomaticScore), s: (r: (typeof rk)[number]) => `${r.diplomaticScore} diplomatskih bod.` },
    { t: 'Najviše vojnih postignuća', r: best((r) => r.militaryAchievements.length), s: (r: (typeof rk)[number]) => r.militaryAchievements.map((a) => names[a] ?? a).join(', ') },
  ].filter((a) => a.r);

  return (
    <div className="flex-1 overflow-y-auto bg-white" data-testid="results-screen">
      <div className="max-w-xl mx-auto px-4 py-6 space-y-6">
        <div className="text-center pt-2">
          <div className="label">Kampanja završena</div>
          <h1 className="text-4xl mt-1 leading-tight" data-testid="results-title">{!done ? 'Konačni poredak…' : iWon ? 'Pobjeda, kralju!' : `Pobjednik: ${winner.name}`}</h1>
          <p className="text-neutral-500 mt-2 min-h-6">{done ? <>Tvoje mjesto: <span className="text-2xl font-semibold text-primary">{myRank}.</span> od {total}</> : 'Otkrivamo mjesta, od posljednjeg do prvog'}</p>
        </div>

        <div className="space-y-2" data-testid="results-list">
          {rk.map((r, i) => {
            const open = i >= total - shown; const p = v.players[r.playerId]; const me = r.playerId === v.me.id; const first = i === 0;
            return (
              <AnimatePresence key={r.playerId} mode="popLayout" initial={false}>
                {open ? (
                  <motion.div key="on" initial={{ opacity: 0, y: 14, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', damping: 22, stiffness: 260 }}
                    className={`flex items-center gap-3 rounded-xl border p-3.5 ${first ? 'border-primary bg-primary-100' : me ? 'border-primary/50 bg-primary-100/50' : 'border-line'}`} data-testid="results-row">
                    <div className={`w-9 text-center text-2xl font-semibold tabular-nums ${first ? 'text-primary' : ''}`}>{i + 1}.</div>
                    <FactionBadge faction={p.faction} size={first ? 44 : 36} />
                    <div className="flex-1 min-w-0"><div className="font-semibold truncate">{p.name}{me && <span className="chip ml-2">Ti</span>}{p.isBot && <span className="chip ml-1">bot</span>}</div>
                      <div className="text-xs text-muted">{r.territoryCount} teritorija · {r.cityCount} gradova{r.objectiveCompleted ? ' · tajni cilj ✓' : ''}</div></div>
                    <div className="text-2xl font-semibold tabular-nums text-primary">{r.total}</div>
                  </motion.div>
                ) : (
                  <motion.div key="off" exit={{ opacity: 0 }} transition={{ duration: 0.12 }} className="flex items-center gap-3 rounded-xl border border-dashed border-line p-3.5 text-neutral-300"><div className="w-9 text-center text-2xl font-semibold">{i + 1}.</div><div className="h-9 w-9 rounded-full bg-neutral-50" /><div className="flex-1 text-sm">?</div></motion.div>
                )}
              </AnimatePresence>);
          })}
        </div>
        {!done && <div className="text-center"><button className="text-sm font-semibold text-muted underline" onClick={() => setShown(total)} data-testid="results-skip">Preskoči otkrivanje</button></div>}

        {done && (<>
          <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="card space-y-2">
            <SectionTitle icon="trophy">Priznanja</SectionTitle>
            {awards.map((a) => { const p = v.players[a.r!.playerId]; return <div key={a.t} className="flex items-center gap-3 rounded-xl bg-neutral-50 p-2.5"><FactionBadge faction={p.faction} size={28} /><div className="flex-1 text-sm"><div className="font-semibold">{a.t}</div><div className="text-muted">{p.name} · {a.s(a.r!)}</div></div></div>; })}
          </motion.section>
          <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="card space-y-2">
            <SectionTitle icon="target">Otkriveni tajni ciljevi</SectionTitle>
            {rk.map((r) => <div key={r.playerId} className="flex items-center gap-2 rounded-xl bg-neutral-50 p-2"><FactionBadge faction={v.players[r.playerId].faction} size={28} /><div className="flex-1 text-sm"><b>{v.players[r.playerId].name}</b>: {r.objectiveTitle}</div><span className={`chip ${r.objectiveCompleted ? 'chip-good' : ''}`}>{r.objectiveCompleted ? '+5' : 'neispunjen'}</span></div>)}
          </motion.section>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} className="grid grid-cols-2 gap-3 pb-4"><button className="btn btn-yellow col-span-2" disabled={sharing} onClick={share} data-testid="share-result"><Icon name="send" size={18} />{sharing ? 'Pripremam…' : 'Podijeli rezultat'}</button><Link href="/igra" className="btn btn-ghost">Nova kampanja</Link><Link href={`/k/${g.id}/izvjestaji`} className="btn btn-ghost">Izvještaji</Link></motion.div>
        </>)}
      </div>
    </div>
  );
}
