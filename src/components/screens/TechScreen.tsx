'use client';
import { useState } from 'react';
import { TECHS, TECH_CATEGORIES, techCost, type TechCategory, type TechDef } from '@/engine/tech';
import { Icon, type IconName } from '@/components/art/Icons';
import { Sheet } from '@/components/ui/kit';
import { useGame } from '@/components/game/GameProvider';
import { OrderComposer } from '@/components/game/OrderComposer';
import { CostLine } from '@/components/game/common';
import type { GameState, Resources } from '@/engine/types';

export function TechScreen() {
  const g = useGame();
  const v = g.view!;
  const [cat, setCat] = useState<TechCategory | 'all'>('all');
  const [sel, setSel] = useState<TechDef | null>(null);
  const [composer, setComposer] = useState<TechDef | null>(null);
  const planned = new Set(v.orders.filter((o) => o.round === v.round && o.type === 'research' && ['submitted', 'locked', 'draft'].includes(o.status)).map((o) => (o as any).params.techId as string));
  const cats = (Object.keys(TECH_CATEGORIES) as TechCategory[]).filter((c) => cat === 'all' || cat === c);
  const state = (t: TechDef) => v.me.techs.includes(t.id) ? 'done' : planned.has(t.id) ? 'planned' : t.requires.every((r) => v.me.techs.includes(r)) ? 'available' : 'locked';
  // Cijena s popustom istraživačkih centara (isti izračun kao server)
  const costOf = (t: TechDef): Partial<Resources> => {
    let levels = 0; for (const x of Object.values(v.territories)) if (x.owner === v.me.id && x.building === 'research_center') levels += x.buildingLevel ?? 0;
    const d = Math.min(0.4, levels * v.config.research.researchCenterDiscount);
    return Object.fromEntries(Object.entries(t.cost).map(([k, n]) => [k, Math.ceil((n as number) * (1 - d))]));
  };
  void techCost; void ({} as GameState);
  return (
    <div className="flex-1 overflow-y-auto" data-testid="tech-screen">
      <div className="max-w-5xl mx-auto p-3 lg:p-5 space-y-3">
        <header className="flex items-center gap-3"><Icon name="flask" size={32} stroke={1.5} className="text-neutral-400" /><div><h1 className="text-2xl text-secondary">Tehnologija</h1><p className="text-sm text-muted font-medium">Istraženo: {v.me.techs.length}/{TECHS.length}. Svako istraživanje košta 3 ZB i resurse — izaberi pametno, u 7 dana ne možeš sve.</p></div></header>
        <div className="scroll-x">{(['all', ...Object.keys(TECH_CATEGORIES)] as Array<TechCategory | 'all'>).map((c) => <button key={c} onClick={() => setCat(c)} className={`pill ${cat === c ? 'pill-on' : ''}`}>{c === 'all' ? 'Sve' : TECH_CATEGORIES[c].name}</button>)}</div>
        <div className={`grid gap-4 ${cat === 'all' ? 'lg:grid-cols-5 sm:grid-cols-2' : 'grid-cols-1 max-w-md mx-auto'}`}>
          {cats.map((c) => (
            <section key={c} className="rounded-2xl p-3 border border-line bg-neutral-50/60">
              <h2 className="text-sm font-semibold flex items-center gap-2 mb-3 text-ink"><Icon name={(({ sword: 'sword', coin: 'coins', crown: 'crown', eye: 'eye', handshake: 'handshake' } as Record<string, IconName>)[TECH_CATEGORIES[c].icon])} size={18} className="text-neutral-500" />{TECH_CATEGORIES[c].name}<span className="ml-auto text-xs font-medium text-muted">{TECHS.filter((t) => t.category === c && v.me.techs.includes(t.id)).length}/{TECHS.filter((t) => t.category === c).length}</span></h2>
              <div className="relative flex flex-col gap-2.5">
                <div className="absolute left-1/2 top-3 bottom-3 w-px -translate-x-1/2 bg-neutral-200" />
                {TECHS.filter((t) => t.category === c).map((t) => { const st = state(t); return (
                  <button key={t.id} onClick={() => setSel(t)} className={`relative text-left rounded-xl border p-3 bg-white transition active:scale-[0.99] ${st === 'done' ? 'border-good/50' : st === 'available' ? 'border-primary' : st === 'planned' ? 'border-primary/50 bg-primary-100/40' : 'border-line opacity-60'}`} data-testid={`tech-${t.id}`}>
                    <div className="flex items-center justify-between gap-2"><span className="text-[15px] font-semibold text-ink leading-tight">{t.name}</span>
                      {st === 'done' ? <span className="h-5 w-5 rounded-full bg-good text-white grid place-items-center shrink-0"><Icon name="check" size={12} stroke={3} /></span> : st === 'locked' ? <Icon name="lock" size={15} className="text-muted shrink-0" /> : st === 'planned' ? <span className="chip chip-yellow">u planu</span> : <span className="chip">razina {t.tier}</span>}</div>
                    <div className="text-xs text-muted mt-1 line-clamp-2">{t.description}</div>
                  </button>); })}
              </div>
            </section>))}
        </div>
      </div>
      <Sheet open={!!sel} onClose={() => setSel(null)} title="Tehnologija" side>
        {sel && (() => { const st = state(sel); return (
          <div className="space-y-3">
            <div className="flex items-start gap-3"><Icon name="flask" size={36} stroke={1.5} className="text-neutral-400 shrink-0" /><div><div className="chip">{TECH_CATEGORIES[sel.category].name} · razina {sel.tier}</div><h2 className="text-2xl text-secondary mt-1">{sel.name}</h2></div></div>
            <p className="font-medium">{sel.description}</p>
            <div className="rounded-xl bg-primary-100/60 p-3 space-y-1"><div className="label">Cijena</div><div className="flex items-center gap-3"><span className="chip chip-yellow">3 ZB</span><CostLine cost={costOf(sel)} /></div>{costOf(sel).gold !== sel.cost.gold && <div className="text-xs text-good font-medium">Popust istraživačkih centara uračunat.</div>}</div>
            {sel.requires.length > 0 && <div className="text-sm font-medium">Preduvjet: {sel.requires.map((r) => TECHS.find((x) => x.id === r)?.name).join(', ')} {sel.requires.every((r) => v.me.techs.includes(r)) ? '✓' : ''}</div>}
            {st === 'done' && <div className="chip chip-good">Istraženo</div>}
            {st === 'planned' && <div className="chip chip-yellow">Istraživanje je u planu naredbi.</div>}
            {st === 'available' && <button className="btn btn-yellow w-full" disabled={v.phase !== 'planning' || v.me.ready} onClick={() => { setComposer(sel); setSel(null); }} data-testid="research-btn"><Icon name="flask" size={18} />Istraži</button>}
            {st === 'locked' && <div className="chip">Zaključano — istraži preduvjet.</div>}
          </div>); })()}
      </Sheet>
      <Sheet open={!!composer} onClose={() => setComposer(null)} title="Istraživanje" tall side>
        {composer && <><h2 className="text-2xl text-secondary mb-3">Istraživanje: {composer.name}</h2><OrderComposer type="research" initial={{ type: 'research', params: { techId: composer.id } }} onDone={() => setComposer(null)} /></>}
      </Sheet>
    </div>
  );
}
