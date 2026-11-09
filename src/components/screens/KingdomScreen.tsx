'use client';
import { useState } from 'react';
import { TECHS } from '@/engine/tech';
import type { TaxLevel } from '@/engine/types';
import { Building } from '@/components/art/Buildings';
import { ResourceIcon } from '@/components/art/Resources';
import { Progress, SectionTitle, Expandable } from '@/components/ui/kit';
import { Term } from '@/components/ui/Term';
import { useGame } from '@/components/game/GameProvider';
import { KingdomTabs } from '@/components/game/KingdomTabs';
import { signed } from '@/lib/format';
import { unitTotal } from '@/engine/util';
import Link from 'next/link';

const TAX: Array<{ id: TaxLevel; name: string }> = [{ id: 'low', name: 'Niski' }, { id: 'normal', name: 'Normalni' }, { id: 'high', name: 'Visoki' }];

export function KingdomScreen() {
  const g = useGame();
  const v = g.view!;
  const [busy, setBusy] = useState(false);
  const fc = v.forecast;
  const mine = v.map.order.map((i) => v.territories[i]).filter((t) => t.owner === v.me.id);
  const pop = mine.reduce((n, t) => n + (t.population ?? 0), 0);
  const warn = fc.rebellionWarning;
  const setTax = async (tax: TaxLevel) => { setBusy(true); try { await g.act(`/api/campaigns/${g.id}/orders`, { action: 'tax', tax }, { successMsg: 'Porezna razina promijenjena.' }); } catch { /* toast */ } finally { setBusy(false); } };
  return (
    <div className="flex-1 overflow-y-auto" data-testid="kingdom-screen">
      <div className="max-w-3xl mx-auto p-3 lg:p-5 space-y-4">
        <KingdomTabs />
        <h1 className="text-2xl text-secondary">Gospodarstvo</h1>
        <section className="card space-y-3">
          <SectionTitle icon="coins">Porezi</SectionTitle>
          <div className="grid grid-cols-3 gap-2">{TAX.map((t) => { const c = v.config.tax[t.id]; return (
            <button key={t.id} disabled={busy || v.phase !== 'planning'} onClick={() => setTax(t.id)} className={`rounded-xl border p-2.5 text-center ${v.me.tax === t.id ? 'border-primary bg-primary-100' : 'border-line bg-white'}`} data-testid={`tax-${t.id}`}>
              <div className="font-display text-lg text-secondary">{t.name}</div><div className="text-xs font-medium text-muted">zlato ×{(c.goldPerPop / v.config.tax.normal.goldPerPop).toFixed(1)}</div><div className={`text-xs font-semibold ${c.stability < 0 ? 'text-bad' : 'text-good'}`}>stab. {signed(c.stability)}/dan</div></button>); })}</div>
          <p className="text-xs text-muted font-medium">Viši porezi donose više zlata, ali smanjuju stabilnost. Niska stabilnost slabi proizvodnju i moral, a ispod {v.config.stability.rebellionBelow} prijeti pobuna.</p>
        </section>

        <section className="card space-y-2">
          <SectionTitle icon="heart"><Term id="stabilnost">Stabilnost</Term> i narod</SectionTitle>
          <div className="flex items-center gap-3"><ResourceIcon name="stability" size={44} /><div className="flex-1"><div className="flex justify-between font-semibold text-sm"><span>Stabilnost {Math.round(v.me.stability)}/100</span><span className={fc.stabilityDelta < 0 ? 'text-bad' : 'text-good'}>{signed(fc.stabilityDelta)}/dan → {Math.round(fc.projectedStability)}</span></div><Progress value={v.me.stability} color={v.me.stability < v.config.stability.warnRed ? 'bg-bad' : v.me.stability < v.config.stability.warnYellow ? 'bg-warn' : 'bg-good'} /></div></div>
          {warn !== 'none' && <div className={`rounded-xl border p-3 text-sm font-medium ${warn === 'red' ? 'border-red-200 bg-red-50 text-red-900' : 'border-orange-200 bg-orange-50 text-orange-900'}`}>{warn === 'red' ? `OPASNOST: stabilost ispod ${v.config.stability.warnRed}. Ako nakon ove runde padne ispod ${v.config.stability.rebellionBelow}, najslabiji teritorij se buni i otcjepljuje. Snizi poreze, osiguraj hranu.` : 'Upozorenje: stabilnost je niska i pada.'}</div>}
          <div className="grid grid-cols-3 gap-2 text-center"><div className="rounded-xl bg-primary-100/50 py-2"><div className="label !text-[10px]">Stanovništvo</div><div className="font-display text-lg">{pop}</div></div><div className="rounded-xl bg-primary-100/50 py-2"><div className="label !text-[10px]">Vojska</div><div className="font-display text-lg">{fc.soldiers}</div></div><div className="rounded-xl bg-primary-100/50 py-2"><div className="label !text-[10px]">Teritorija</div><div className="font-display text-lg">{mine.length}</div></div></div>
          {fc.foodShortageRisk && <div className="rounded-xl border border-red-200 bg-red-50 p-2.5 text-sm text-red-900 font-medium">Prijeti glad: hrana ({Math.floor(v.me.resources.food)}) + prognoza ({signed(fc.net.food, 1)}) &lt; 0.</div>}
        </section>

        <section className="card space-y-2">
          <SectionTitle icon="layers">Dnevna prognoza</SectionTitle>
          <table className="w-full text-sm"><thead><tr className="text-muted text-xs"><th className="text-left">Resurs</th><th className="text-right">Proizvodnja</th><th className="text-right">Neto</th></tr></thead><tbody>
            {(['gold', 'food', 'iron', 'wood', 'influence'] as const).map((k) => <tr key={k} className="border-t border-line/60"><td className="py-1.5"><span className="inline-flex items-center gap-1.5 font-semibold"><ResourceIcon name={k} size={22} />{({ gold: 'Zlato', food: 'Hrana', iron: 'Željezo', wood: 'Drvo', influence: 'Utjecaj' })[k]}</span></td><td className="text-right font-medium">{fc.production[k].toFixed(1)}{k === 'gold' ? ` + ${fc.taxes.toFixed(1)} porez` : ''}</td><td className={`text-right font-display font-semibold ${fc.net[k] < 0 ? 'text-bad' : 'text-good'}`}>{signed(fc.net[k], 1)}</td></tr>)}
          </tbody></table>
          <p className="text-xs text-muted font-medium">Održavanje vojske: {fc.upkeepGold.toFixed(1)} zlata i {fc.upkeepFood.toFixed(1)} hrane (uključuje prehranu stanovništva).</p>
        </section>

        <section className="space-y-2">
          <SectionTitle icon="map">Teritoriji ({mine.length})</SectionTitle>
          {mine.map((t) => (
            <Expandable key={t.id} title={<span className="flex items-center gap-2">{t.building ? <Building type={t.building} faction={v.me.faction} size={34} /> : <span className="h-8 w-8 rounded-xl bg-primary-100" />}<span className="font-display text-lg">{t.name}</span>{t.isCapital && <span className="chip chip-bad">glavni grad</span>}{t.supplied === false && <span className="chip chip-bad">odsječen</span>}</span>} badge={<span className="chip">{unitTotal(t.garrison ?? {})} vojnika</span>}>
              <div className="grid grid-cols-3 gap-2 text-center mb-2"><div className="rounded-xl bg-primary-100/50 py-1.5"><div className="label !text-[10px]">Pop.</div><b>{t.population}</b></div><div className="rounded-xl bg-primary-100/50 py-1.5"><div className="label !text-[10px]">Stab.</div><b>{t.stability}</b></div><div className="rounded-xl bg-primary-100/50 py-1.5"><div className="label !text-[10px]">Obrana</div><b>{t.defenseLevel}</b></div></div>
              <div className="flex flex-wrap gap-3 text-sm font-semibold">{t.production && (Object.entries(t.production.total) as Array<[any, number]>).filter(([, n]) => n > 0).map(([k, n]) => <span key={k} className="inline-flex items-center gap-1"><ResourceIcon name={k} size={20} />+{n}</span>)}</div>
              <Link href={`/k/${g.id}/karta`} onClick={() => g.select(t.id)} className="btn btn-ghost btn-sm mt-2">Prikaži na karti</Link>
            </Expandable>))}
        </section>

        <section className="card space-y-1.5"><SectionTitle icon="flask">Istražene tehnologije</SectionTitle>{v.me.techs.length === 0 ? <p className="text-sm text-muted font-medium">Još ništa.</p> : v.me.techs.map((id) => <div key={id} className="text-sm font-medium">✓ {TECHS.find((t) => t.id === id)?.name} <span className="text-muted">— {TECHS.find((t) => t.id === id)?.description}</span></div>)}</section>
      </div>
    </div>
  );
}
