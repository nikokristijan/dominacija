'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { UNIT_TYPES } from '@/engine/config';
import type { AttackStrategy, Formation, OrderPreview, RiskPref, SupplyLevel, Units } from '@/engine/types';
import { unitTotal } from '@/engine/util';
import { Icon } from '@/components/art/Icons';
import { ResourceIcon } from '@/components/art/Resources';
import { Stepper, Field } from '@/components/ui/kit';
import { api } from '@/lib/api';
import { useGame } from './GameProvider';
import { PreviewCard, UnitPicker, freeUnits } from './common';
import { adjacentOwned } from './TerritoryDetails';

const STEPS = ['Cilj', 'Vojska', 'Formacija', 'Logistika', 'Uvjeti', 'Pregled'];
const STRAT: Array<{ id: AttackStrategy; name: string; desc: string; tag: string }> = [
  { id: 'direct', name: 'Izravni napad', desc: 'Snažan trenutačni udar. Veći gubici s obje strane.', tag: '+15% napad · +20% gubitaka' },
  { id: 'ambush', name: 'Zasjeda', desc: 'Slabija izravna snaga, ali jaka uz svježu špijunažu cilja.', tag: 'treba obavještajne podatke' },
  { id: 'encirclement', name: 'Opkoljavanje', desc: 'Slabi obranu kad imaš više susjednih prijateljskih teritorija.', tag: 'min. 2 susjedna teritorija' },
  { id: 'diversion', name: 'Diverzija', desc: 'Odvlači protivnika; slabi obranu drugih njegovih teritorija koje napadaš.', tag: 'min. 4 vojnika' },
  { id: 'siege', name: 'Opsada', desc: 'Najbolja protiv tvrđava i gradova. Treba opsadna oruđa i zalihe; opsada se nakuplja iz runde u rundu.', tag: 'treba opsadno oruđe' },
];
const FORM: Array<{ id: Formation; name: string; desc: string }> = [
  { id: 'line', name: 'Linija', desc: 'Uravnoteženo. Bez bonusa i kazni.' }, { id: 'wedge', name: 'Klin', desc: '+12% napad, −10% obrana.' },
  { id: 'phalanx', name: 'Falanga', desc: '−8% napad, +15% obrana.' }, { id: 'skirmish', name: 'Raspršeno', desc: 'Strijelci i konjica +15%, vitezovi i opsada −10%.' },
];
const RISK: Array<{ id: RiskPref; name: string; desc: string }> = [
  { id: 'cautious', name: 'Oprezno', desc: 'Manji gubici, slabiji napad.' }, { id: 'balanced', name: 'Uravnoteženo', desc: 'Zadano.' }, { id: 'bold', name: 'Hrabro', desc: '+10% napad, +20% primljene štete.' },
];
const SUPPLY: Array<{ id: SupplyLevel; name: string; desc: string }> = [
  { id: 'minimal', name: 'Minimalne', desc: '60% zaliha — jeftino, slabiji napad.' }, { id: 'standard', name: 'Standardne', desc: 'Puna opskrba.' }, { id: 'generous', name: 'Obilne', desc: '140% zaliha — mali bonus morala.' },
];

function Choice({ active, onClick, title, desc, tag, disabled, testId }: { active: boolean; onClick: () => void; title: string; desc?: string; tag?: string; disabled?: boolean; testId?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} data-testid={testId} className={`w-full text-left rounded-2xl border px-4 py-3 transition-colors ${active ? 'border-ink bg-neutral-50' : 'border-line hover:bg-neutral-50'} ${disabled ? 'opacity-40' : ''}`}>
      <div className="flex items-center justify-between gap-2"><b>{title}</b>{tag && <span className="text-[11px] text-muted">{tag}</span>}</div>
      {desc && <div className="text-[13px] text-muted leading-snug mt-0.5">{desc}</div>}
    </button>
  );
}

/** Popup vojne operacije: 6 koraka; karta ostaje vidljiva i dodirljiva (odabir cilja i smjera napada). */
export function OperationPopup({ target, from, setTarget, setFrom, onClose }: { target: string | null; from: string | null; setTarget: (id: string | null) => void; setFrom: (id: string | null) => void; onClose: () => void }) {
  const g = useGame();
  const v = g.view!;
  const [step, setStep] = useState(0);
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
  useEffect(() => { if (target && !from && adjSources.length) setFrom([...adjSources].sort((a, b) => unitTotal(freeUnits(v, b)) - unitTotal(freeUnits(v, a)))[0]); }, [target, from, adjSources, v, setFrom]);
  useEffect(() => { setUnits({}); setReserve({}); }, [from]);

  const tgt = target ? v.territories[target] : null;
  const src = from ? v.territories[from] : null;
  const free = from ? freeUnits(v, from) : {};
  const afterSend = Object.fromEntries(UNIT_TYPES.map((u) => [u, Math.max(0, (free[u] ?? 0) - (units[u] ?? 0))])) as Units;
  const orderInput = useMemo(() => (target && from ? { type: 'attack' as const, params: { fromId: from, targetId: target, units, strategy, formation, supply, risk, retreatBelow: retreat / 100, reserve } } : null), [target, from, units, strategy, formation, supply, risk, retreat, reserve]);

  useEffect(() => {
    if (!orderInput || step < 3) return;
    const my = ++seq.current; setPreview(null);
    const t = setTimeout(async () => {
      try { const r = await api<{ preview: OrderPreview }>(`/api/campaigns/${g.id}/preview`, { order: orderInput }); if (my === seq.current) setPreview(r.preview); }
      catch (e) { if (my === seq.current) setPreview({ validation: { ok: false, errors: [e instanceof Error ? e.message : 'Greška'], warnings: [], cpCost: 0, resourceCost: {} }, title: 'Napad', known: [], estimated: [], unknown: [], risks: [], countermeasures: [] }); }
    }, 280);
    return () => clearTimeout(t);
  }, [orderInput, step, g.id]);

  const canNext = step === 0 ? !!target && !!from : step === 1 ? unitTotal(units) > 0 : true;
  const issue = (s: AttackStrategy): string | null => {
    if (s === 'siege' && !(free.siege ?? 0)) return 'Nemaš opsadna oruđa u polaznom teritoriju.';
    if (s === 'encirclement' && adjSources.length < 2) return 'Treba barem 2 susjedna prijateljska teritorija.';
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
      g.toast(status === 'draft' ? 'Nacrt napada spremljen.' : 'Napad predan — ostaje tajan do razrješenja.', 'good');
      onClose();
    } catch (e) { g.toast(e instanceof Error ? e.message : 'Greška', 'bad'); } finally { setBusy(false); }
  };

  if (v.phase !== 'planning' || v.me.ready) return <p className="text-sm text-muted py-6">Naredbe su zaključane ili je razrješenje u tijeku. Otključaj naredbe da planiraš operaciju.</p>;

  return (
    <div className="space-y-4" data-testid="planner">
      <h3 className="text-xl">{tgt ? `Napad na ${tgt.name}` : 'Odaberi cilj na karti'}</h3>
      <Stepper steps={STEPS} current={step} onGo={(i) => { if (i <= step || canNext) setStep(i); }} />

      {step === 0 && (<div className="space-y-4">
        <div className="rounded-2xl bg-neutral-50 px-4 py-3"><div className="label">Cilj</div><div className="font-semibold" data-testid="planner-target">{tgt ? tgt.name : 'Dodirni protivnički ili neutralni teritorij uz svoje kraljevstvo'}</div>{tgt && <div className="text-sm text-muted">{v.config.terrain[tgt.terrain].name}{tgt.owner ? ` · ${v.players[tgt.owner]?.name}` : ' · neutralno'}</div>}</div>
        {target && <Field label="Smjer napada (polazni teritorij)"><div className="space-y-2">{adjSources.map((s) => <Choice key={s} active={from === s} onClick={() => setFrom(s)} title={v.territories[s].name} tag={`${unitTotal(freeUnits(v, s))} slobodnih`} testId={`source-${s}`} />)}</div></Field>}
        <div className="space-y-2"><div className="label">Strategija</div>{STRAT.map((s) => { const i = issue(s.id); return <Choice key={s.id} active={strategy === s.id} disabled={!!i} onClick={() => setStrategy(s.id)} title={s.name} desc={i ?? s.desc} tag={s.tag} testId={`strategy-${s.id}`} />; })}</div>
      </div>)}

      {step === 1 && src && (<div className="space-y-4">
        <div><div className="label mb-2">Vojnici iz {src.name}</div><UnitPicker view={v} available={free} value={units} onChange={setUnits} /></div>
        <div className="rounded-2xl border border-line p-3 space-y-2"><div className="label">Rezerva — ostaje u {src.name}</div><UnitPicker view={v} available={afterSend} value={reserve} onChange={setReserve} /></div>
        <p className="text-sm text-muted">Nakon odlaska u {src.name} ostaje {unitTotal(afterSend)} branitelja.</p>
      </div>)}

      {step === 2 && (<div className="space-y-4">
        <div className="space-y-2"><div className="label">Formacija</div>{FORM.map((f) => <Choice key={f.id} active={formation === f.id} onClick={() => setFormation(f.id)} title={f.name} desc={f.desc} testId={`formation-${f.id}`} />)}</div>
        <div className="space-y-2"><div className="label">Sklonost riziku</div><div className="grid grid-cols-3 gap-2">{RISK.map((r) => <button key={r.id} type="button" onClick={() => { setRisk(r.id); setRetreat(Math.round(v.config.combat.risk[r.id].defaultRetreat * 100)); }} className={`rounded-2xl border p-2.5 text-left ${risk === r.id ? 'border-ink bg-neutral-50' : 'border-line'}`}><b className="text-sm">{r.name}</b><div className="text-[11px] text-muted leading-tight mt-0.5">{r.desc}</div></button>)}</div></div>
      </div>)}

      {step === 3 && (<div className="space-y-4">
        <div className="space-y-2"><div className="label">Raspodjela zaliha</div>{SUPPLY.map((s) => <Choice key={s.id} active={supply === s.id} onClick={() => setSupply(s.id)} title={s.name} desc={s.desc} testId={`supply-${s.id}`} />)}</div>
        <Field label={`Uvjet povlačenja: povuci se kad vojska padne ispod ${retreat}% početne snage`}><input type="range" min={0} max={80} step={5} value={retreat} onChange={(e) => setRetreat(+e.target.value)} className="w-full accent-[#7138E8]" /></Field>
        <div className="rounded-2xl bg-neutral-50 px-4 py-3 text-sm flex items-center gap-2.5"><ResourceIcon name="food" size={20} className="text-neutral-500" />Trošak opskrbe: <b>{preview?.validation.resourceCost.food ?? '…'} hrane</b>. Daleki napadi iz odsječenih teritorija troše više i slabe vojsku.</div>
      </div>)}

      {step === 4 && (<div className="space-y-3">
        <p className="text-sm text-muted">Neobavezno: server izvršava ove naredbe automatski ako se okidač dogodi (broje se u ograničenje uvjetnih naredbi).</p>
        <label className="flex items-start gap-3 rounded-2xl border border-line p-3.5"><input type="checkbox" className="h-5 w-5 mt-0.5 accent-[#7138E8]" checked={condFort} onChange={(e) => setCondFort(e.target.checked)} data-testid="cond-fort" /><span className="font-semibold">AKO osvojim {tgt?.name}, TADA izgradi tvrđavu<span className="block text-xs font-normal text-muted">Samo ako ostanu resursi (35 zlata, 20 drva, 20 željeza).</span></span></label>
        <label className="flex items-start gap-3 rounded-2xl border border-line p-3.5"><input type="checkbox" className="h-5 w-5 mt-0.5 accent-[#7138E8]" checked={condDef} onChange={(e) => setCondDef(e.target.checked)} data-testid="cond-def" /><span className="font-semibold">AKO napadnu {src?.name}, TADA aktiviraj obrambenu formaciju<span className="block text-xs font-normal text-muted">+25% obrane tog teritorija dok je vojska na pohodu.</span></span></label>
      </div>)}

      {step === 5 && <PreviewCard p={preview} />}

      <div className="flex gap-2 pt-1">
        {step > 0 ? <button className="btn btn-ghost" onClick={() => setStep(step - 1)} data-testid="planner-back" aria-label="Natrag"><Icon name="back" size={18} /></button> : <button className="btn btn-ghost" onClick={onClose} aria-label="Zatvori"><Icon name="close" size={18} /></button>}
        {step < 5 ? <button className="btn btn-yellow flex-1" disabled={!canNext} onClick={() => setStep(step + 1)} data-testid="planner-next">Dalje<Icon name="chevron" size={18} /></button>
          : <><button className="btn btn-ghost flex-1" disabled={busy || !orderInput} onClick={() => submit('draft')}>Nacrt</button><button className="btn btn-yellow flex-[1.5]" disabled={busy || !preview?.validation.ok} onClick={() => submit('submitted')} data-testid="planner-submit">Predaj napad</button></>}
      </div>
    </div>
  );
}
