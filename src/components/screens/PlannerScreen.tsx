'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FACTIONS, UNIT_TYPES } from '@/engine/config';
import type { AttackStrategy, Formation, OrderPreview, RiskPref, SupplyLevel, Units } from '@/engine/types';
import { Icon } from '@/components/art/Icons';
import { Stepper, Counter, Field } from '@/components/ui/kit';
import { useGame } from '@/components/game/GameProvider';
import { HexMap, type Highlight } from '@/components/game/HexMap';
import { PreviewCard, UnitPicker, freeUnits } from '@/components/game/common';
import { adjacentOwned } from '@/components/game/TerritoryDetails';
import { unitTotal } from '@/engine/util';
import { api } from '@/lib/api';
import { ResourceIcon } from '@/components/art/Resources';

const STEPS = ['Strategija', 'Vojska', 'Formacija', 'Logistika', 'Uvjeti', 'Pregled'];
const STRAT: Array<{ id: AttackStrategy; name: string; desc: string; tag: string }> = [
  { id: 'direct', name: 'Izravni napad', desc: 'Snažan trenutačni udar. Veći gubici s obje strane.', tag: '+15% napad, +20% gubitaka' },
  { id: 'ambush', name: 'Zasjeda', desc: 'Slabija izravna snaga, ali jaka uz svježu špijunažu cilja.', tag: 'Treba obavještajne podatke' },
  { id: 'encirclement', name: 'Opkoljavanje', desc: 'Slabi obranu kad imaš više susjednih prijateljskih teritorija.', tag: 'Min. 2 susjedna teritorija' },
  { id: 'diversion', name: 'Diverzija', desc: 'Odvlači protivnika; slabi obranu drugih njegovih teritorija koje napadaš.', tag: 'Min. 4 vojnika' },
  { id: 'siege', name: 'Opsada', desc: 'Najbolja protiv tvrđava i gradova. Treba opsadna oruđa i zalihe; opsada se nakuplja iz runde u rundu.', tag: 'Treba opsadno oruđe' },
];
const FORM: Array<{ id: Formation; name: string; desc: string }> = [
  { id: 'line', name: 'Linija', desc: 'Uravnoteženo. Bez bonusa i kazni.' },
  { id: 'wedge', name: 'Klin', desc: '+12% napad, −10% obrana.' },
  { id: 'phalanx', name: 'Falanga', desc: '−8% napad, +15% obrana.' },
  { id: 'skirmish', name: 'Raspršeno', desc: 'Strijelci i konjica +15%, vitezovi i opsada −10%.' },
];
const RISK: Array<{ id: RiskPref; name: string; desc: string }> = [
  { id: 'cautious', name: 'Oprezno', desc: 'Manji gubici, slabiji napad. Povlači se rano.' },
  { id: 'balanced', name: 'Uravnoteženo', desc: 'Zadano.' },
  { id: 'bold', name: 'Hrabro', desc: '+10% napad, +20% primljene štete. Bez povlačenja.' },
];
const SUPPLY: Array<{ id: SupplyLevel; name: string; desc: string }> = [
  { id: 'minimal', name: 'Minimalne', desc: '60% zaliha: jeftino, ali slabiji napad.' },
  { id: 'standard', name: 'Standardne', desc: 'Puna opskrba.' },
  { id: 'generous', name: 'Obilne', desc: '140% zaliha: mali bonus morala, skuplje.' },
];

export function PlannerScreen() {
  const g = useGame();
  const v = g.view!;
  const router = useRouter();
  const sp = useSearchParams();
  const [step, setStep] = useState(0);
  const [target, setTarget] = useState<string | null>(sp.get('target'));
  const [from, setFrom] = useState<string | null>(null);
  const [strategy, setStrategy] = useState<AttackStrategy>('direct');
  const [units, setUnits] = useState<Units>({});
  const [reserve, setReserve] = useState<Units>({});
  const [formation, setFormation] = useState<Formation>('line');
  const [risk, setRisk] = useState<RiskPref>('balanced');
  const [supply, setSupply] = useState<SupplyLevel>('standard');
  const [retreat, setRetreat] = useState(35);
  const [condFort, setCondFort] = useState(false); const [condDef, setCondDef] = useState(false);
  const [preview, setPreview] = useState<OrderPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const seq = useRef(0);

  const adjSources = useMemo(() => (target ? adjacentOwned(v, target) : []), [v, target]);
  useEffect(() => { if (target && !from && adjSources.length) { const best = [...adjSources].sort((a, b) => unitTotal(freeUnits(v, b)) - unitTotal(freeUnits(v, a)))[0]; setFrom(best); } }, [target, from, adjSources, v]);
  useEffect(() => { setUnits({}); setReserve({}); }, [from]);

  const tgt = target ? v.territories[target] : null;
  const src = from ? v.territories[from] : null;
  const free = from ? freeUnits(v, from) : {};
  const afterSend: Units = Object.fromEntries(UNIT_TYPES.map((u) => [u, Math.max(0, (free[u] ?? 0) - (units[u] ?? 0))])) as Units;
  const orderInput = useMemo(() => (target && from ? { type: 'attack' as const, params: { fromId: from, targetId: target, units, strategy, formation, supply, risk, retreatBelow: retreat / 100, reserve } } : null), [target, from, units, strategy, formation, supply, risk, retreat, reserve]);

  useEffect(() => {
    if (!orderInput || step < 3) return;
    const my = ++seq.current; setPreview(null);
    const t = setTimeout(async () => {
      try { const r = await api<{ preview: OrderPreview }>(`/api/campaigns/${g.id}/preview`, { order: orderInput }); if (my === seq.current) setPreview(r.preview); }
      catch (e) { if (my === seq.current) setPreview({ validation: { ok: false, errors: [e instanceof Error ? e.message : 'Greška'], warnings: [], cpCost: 0, resourceCost: {} }, title: 'Napad', known: [], estimated: [], unknown: [], risks: [], countermeasures: [] }); }
    }, 300);
    return () => clearTimeout(t);
  }, [orderInput, step, g.id]);

  const highlights = useMemo<Record<string, Highlight>>(() => {
    const h: Record<string, Highlight> = {};
    if (!target) { for (const id of v.map.order) { const t = v.territories[id]; if (t.owner !== v.me.id && t.terrain !== 'water' && adjacentOwned(v, id).length) h[id] = 'info'; } }
    else { h[target] = 'danger'; for (const s of adjSources) h[s] = 'source'; if (from) h[from] = 'target'; }
    return h;
  }, [v, target, adjSources, from]);

  const onSelect = (id: string | null) => {
    if (!id) return;
    const t = v.territories[id];
    if (t.owner === v.me.id && adjSources.includes(id)) setFrom(id);
    else if (t.owner !== v.me.id && t.terrain !== 'water' && adjacentOwned(v, id).length) { setTarget(id); setFrom(null); }
  };

  const supplyNeeded = preview?.validation.resourceCost.food;
  const canNext = step === 0 ? !!target && !!from : step === 1 ? unitTotal(units) > 0 : true;
  const strategyIssue = (s: AttackStrategy): string | null => {
    if (!tgt) return null;
    if (s === 'siege' && !(free.siege ?? 0)) return 'Nemaš opsadna oruđa u polaznom teritoriju.';
    if (s === 'encirclement') return adjSources.length < 2 ? 'Treba barem 2 susjedna prijateljska teritorija.' : null;
    return null;
  };

  const submit = async (status: 'draft' | 'submitted') => {
    if (!orderInput) return;
    setBusy(true);
    try {
      await api(`/api/campaigns/${g.id}/orders`, { action: 'create', order: orderInput, status });
      const base = { condition: { type: 'always' }, resourceReq: {}, priority: 1, expiresRound: v.round };
      if (condFort && target) await api(`/api/campaigns/${g.id}/conditional`, { action: 'create', trigger: { type: 'territory_conquered', territoryId: target }, action_: { type: 'build_fortress', territoryId: target }, ...base, resourceReq: { gold: 35, wood: 20, iron: 20 } }).catch((e) => g.toast(e.message, 'bad'));
      if (condDef && from) await api(`/api/campaigns/${g.id}/conditional`, { action: 'create', trigger: { type: 'territory_attacked', territoryId: from }, action_: { type: 'defensive_formation', territoryId: from }, ...base }).catch((e) => g.toast(e.message, 'bad'));
      await g.refresh();
      g.toast(status === 'draft' ? 'Nacrt napada spremljen.' : 'Napad predan. Ostaje tajan do razrješenja.', 'good');
      router.push(`/k/${g.id}/naredbe`);
    } catch (e) { g.toast(e instanceof Error ? e.message : 'Greška', 'bad'); } finally { setBusy(false); }
  };

  if (v.phase !== 'planning' || v.me.ready) return <div className="p-6 text-center"><p className="font-bold">Naredbe su zaključane ili je razrješenje u tijeku.</p><Link className="btn btn-purple mt-3" href={`/k/${g.id}/naredbe`}>Natrag na naredbe</Link></div>;

  return (
    <div className="flex-1 min-h-0 flex flex-col lg:flex-row" data-testid="planner">
      <div className="relative h-52 lg:h-auto lg:flex-1 shrink-0 border-b-2 lg:border-b-0 lg:border-r-2 border-line">
        <HexMap view={v} selectedId={target} onSelect={onSelect} highlights={highlights} focusId={target} className="absolute inset-0" />
        <div className="absolute top-2 left-2 chip chip-yellow">{target ? 'Dodirni susjedni teritorij za polazište/cilj' : 'Odaberi cilj napada (označeni teritoriji)'}</div>
      </div>
      <div className="flex-1 lg:flex-none lg:w-[28rem] min-h-0 flex flex-col bg-white">
        <div className="px-4 pt-3 pb-2 shrink-0"><Stepper steps={STEPS} current={step} /></div>
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
          {step === 0 && (<>
            <div className="rounded-2xl bg-primary-100 p-3"><div className="label">Cilj</div><div className="font-display text-xl text-secondary" data-testid="planner-target">{tgt ? tgt.name : 'Nije odabran'}</div>{tgt && <div className="text-sm text-muted font-bold">{v.config.terrain[tgt.terrain].name}{tgt.owner ? ` · ${v.players[tgt.owner]?.name}` : ' · neutralno'}</div>}</div>
            {target && (<Field label="Smjer napada (polazni teritorij)"><div className="grid gap-2">{adjSources.map((s) => { const st = v.territories[s]; return <button key={s} onClick={() => setFrom(s)} className={`rounded-2xl border-2 p-2.5 text-left flex justify-between items-center ${from === s ? 'border-primary bg-primary-100' : 'border-line'}`} data-testid={`source-${s}`}><span className="font-extrabold">{st.name}</span><span className="chip">{unitTotal(freeUnits(v, s))} slobodnih</span></button>; })}</div></Field>)}
            <div className="space-y-2"><div className="label">Strategija napada</div>
              {STRAT.map((s) => { const issue = strategyIssue(s.id); return (
                <button key={s.id} disabled={!!issue} onClick={() => setStrategy(s.id)} className={`w-full text-left rounded-2xl border-2 p-3 ${strategy === s.id ? 'border-primary bg-primary-100' : 'border-line bg-white'} ${issue ? 'opacity-50' : ''}`} data-testid={`strategy-${s.id}`}>
                  <div className="flex justify-between items-center"><b className="font-display text-lg text-secondary">{s.name}</b><span className="chip">{s.tag}</span></div><div className="text-sm text-muted font-semibold">{s.desc}</div>{issue && <div className="text-xs text-bad font-bold mt-1">{issue}</div>}</button>); })}</div>
          </>)}
          {step === 1 && src && (<>
            <h3 className="text-xl text-secondary">Odaberi vojnike iz {src.name}</h3>
            <UnitPicker view={v} available={free} value={units} onChange={setUnits} color={FACTIONS[v.me.faction].color} />
            <div className="rounded-2xl bg-primary-100/60 p-3 space-y-2"><div className="label">Rezerva (ostaje u {src.name})</div>
              <p className="text-xs text-muted font-bold">Napad neće povući vojnike označene kao rezerva.</p>
              <UnitPicker view={v} available={afterSend} value={reserve} onChange={setReserve} color={FACTIONS[v.me.faction].color} /></div>
            <div className="text-sm font-bold">Nakon odlaska u {src.name} ostaje {unitTotal(afterSend)} branitelja.</div>
          </>)}
          {step === 2 && (<>
            <div className="space-y-2"><div className="label">Formacija</div>{FORM.map((f) => <button key={f.id} onClick={() => setFormation(f.id)} className={`w-full text-left rounded-2xl border-2 p-3 ${formation === f.id ? 'border-primary bg-primary-100' : 'border-line'}`} data-testid={`formation-${f.id}`}><b className="font-display text-lg text-secondary">{f.name}</b><div className="text-sm text-muted font-semibold">{f.desc}</div></button>)}</div>
            <div className="space-y-2"><div className="label">Sklonost riziku</div><div className="grid grid-cols-3 gap-2">{RISK.map((r) => <button key={r.id} onClick={() => { setRisk(r.id); setRetreat(Math.round(v.config.combat.risk[r.id].defaultRetreat * 100)); }} className={`rounded-2xl border-2 p-2 text-center ${risk === r.id ? 'border-primary bg-primary-100' : 'border-line'}`}><b className="text-sm">{r.name}</b><div className="text-[11px] text-muted font-semibold leading-tight">{r.desc}</div></button>)}</div></div>
          </>)}
          {step === 3 && (<>
            <div className="space-y-2"><div className="label">Raspodjela zaliha</div>{SUPPLY.map((s) => <button key={s.id} onClick={() => setSupply(s.id)} className={`w-full text-left rounded-2xl border-2 p-3 ${supply === s.id ? 'border-primary bg-primary-100' : 'border-line'}`} data-testid={`supply-${s.id}`}><b className="font-display text-lg text-secondary">{s.name}</b><div className="text-sm text-muted font-semibold">{s.desc}</div></button>)}</div>
            <Field label={`Uvjet povlačenja: povuci se ako vojska padne ispod ${retreat}% početne snage`}><input type="range" min={0} max={80} step={5} value={retreat} onChange={(e) => setRetreat(+e.target.value)} className="w-full accent-[#5B3DF6]" /></Field>
            <div className="rounded-2xl bg-yellow-50 border-2 border-yellow-200 p-3 text-sm font-bold flex items-center gap-2"><ResourceIcon name="food" size={26} />Trošak opskrbe: {supplyNeeded ?? '…'} hrane. Daleki napadi iz izoliranih teritorija troše više i slabe vojsku.</div>
          </>)}
          {step === 4 && (<>
            <h3 className="text-xl text-secondary">Uvjetno ponašanje</h3>
            <p className="text-sm text-muted font-bold">Neobavezno. Server će automatski izvršiti ove naredbe ako se okidač dogodi (broje se u ograničenje uvjetnih naredbi).</p>
            <label className="flex items-start gap-3 rounded-2xl border-2 border-line p-3"><input type="checkbox" className="h-5 w-5 mt-0.5 accent-[#5B3DF6]" checked={condFort} onChange={(e) => setCondFort(e.target.checked)} data-testid="cond-fort" /><span className="font-extrabold">AKO osvojim {tgt?.name}, TADA izgradi tvrđavu<span className="block text-xs font-semibold text-muted">Ako ostanu resursi (35 zlata, 20 drva, 20 željeza).</span></span></label>
            <label className="flex items-start gap-3 rounded-2xl border-2 border-line p-3"><input type="checkbox" className="h-5 w-5 mt-0.5 accent-[#5B3DF6]" checked={condDef} onChange={(e) => setCondDef(e.target.checked)} data-testid="cond-def" /><span className="font-extrabold">AKO napadnu {src?.name}, TADA aktiviraj obrambenu formaciju<span className="block text-xs font-semibold text-muted">+25% obrane tog teritorija dok je vojska na pohodu.</span></span></label>
          </>)}
          {step === 5 && (<><PreviewCard p={preview} /></>)}
        </div>
        <div className="shrink-0 px-4 py-3 border-t-2 border-line flex gap-2 pb-[calc(0.75rem+var(--safe-b))]">
          {step > 0 ? <button className="btn btn-ghost" onClick={() => setStep(step - 1)} data-testid="planner-back"><Icon name="back" size={18} /></button> : <Link className="btn btn-ghost" href={`/k/${g.id}/naredbe`}><Icon name="close" size={18} /></Link>}
          {step < 5 ? <button className="btn btn-purple flex-1" disabled={!canNext} onClick={() => setStep(step + 1)} data-testid="planner-next">Dalje <Icon name="chevron" size={18} /></button>
            : <><button className="btn btn-ghost flex-1" disabled={busy || !orderInput} onClick={() => submit('draft')}>Nacrt</button><button className="btn btn-yellow flex-[1.5]" disabled={busy || !preview?.validation.ok} onClick={() => submit('submitted')} data-testid="planner-submit">Predaj napad</button></>}
        </div>
      </div>
    </div>
  );
}
void Counter;
