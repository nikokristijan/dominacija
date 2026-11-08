'use client';
import { useState } from 'react';
import { FACTIONS, RESOURCE_TYPES, UNIT_TYPES } from '@/engine/config';
import type { ConditionalActionType, Resources, TriggerType, Units } from '@/engine/types';
import { Counter, Field } from '@/components/ui/kit';
import { ResourceIcon } from '@/components/art/Resources';
import { useGame } from './GameProvider';
import { UnitPicker, freeUnits } from './common';
import { RES_LOWER } from '@/lib/format';

export const TRIGGER_LABEL: Record<TriggerType, string> = {
  territory_attacked: 'Moj teritorij je napadnut', capital_attacked: 'Moj glavni grad je napadnut', attacked_by_player: 'Određeni igrač me napadne',
  territory_conquered: 'Moja vojska osvoji teritorij', ally_loses_territory: 'Saveznik izgubi teritorij', territory_lost: 'Izgubim teritorij',
};
export const ACTION_LABEL: Record<ConditionalActionType, string> = {
  defensive_formation: 'Aktiviraj obrambenu formaciju', move_reserves: 'Premjesti rezerve', build_fortress: 'Izgradi tvrđavu', send_support: 'Pošalji vojnu potporu saveznik', emergency_recruit: 'Hitno novačenje',
};
const PRE: TriggerType[] = ['territory_attacked', 'capital_attacked', 'attacked_by_player'];

export function ConditionalComposer({ territoryId, onDone }: { territoryId?: string; onDone: () => void }) {
  const g = useGame();
  const v = g.view!;
  const mine = v.map.order.map((i) => v.territories[i]).filter((t) => t.owner === v.me.id);
  const others = Object.values(v.players).filter((p) => p.id !== v.me.id);
  const allies = others.filter((p) => p.relation === 'ally');
  const [trig, setTrig] = useState<TriggerType>('territory_attacked');
  const [trigT, setTrigT] = useState(territoryId && v.territories[territoryId]?.owner === v.me.id ? territoryId : mine[0]?.id ?? '');
  const [trigP, setTrigP] = useState(others[0]?.id ?? '');
  const [cond, setCond] = useState<'always' | 'resources' | 'strength'>('always');
  const [condGold, setCondGold] = useState(30); const [condStr, setCondStr] = useState(10);
  const [act, setAct] = useState<ConditionalActionType>('defensive_formation');
  const [from, setFrom] = useState(mine.find((t) => t.id !== trigT)?.id ?? '');
  const [units, setUnits] = useState<Units>({});
  const [unit, setUnit] = useState<(typeof UNIT_TYPES)[number]>('infantry'); const [count, setCount] = useState(5);
  const [req, setReq] = useState<Partial<Resources>>({});
  const [prio, setPrio] = useState(1); const [exp, setExp] = useState(v.round);
  const [busy, setBusy] = useState(false);
  const preTrigger = PRE.includes(trig);
  const validActs: ConditionalActionType[] = preTrigger ? ['defensive_formation', 'move_reserves', 'emergency_recruit'] : trig === 'territory_conquered' ? ['build_fortress', 'emergency_recruit'] : trig === 'ally_loses_territory' ? ['send_support'] : ['emergency_recruit', 'move_reserves'];
  const actNow = validActs.includes(act) ? act : validActs[0];

  const submit = async () => {
    setBusy(true);
    const trigger = { type: trig, ...(trig === 'territory_attacked' ? { territoryId: trigT } : {}), ...(trig === 'attacked_by_player' ? { playerId: trigP } : {}), ...(trig === 'ally_loses_territory' && allies[0] ? { playerId: trigP && allies.some((a) => a.id === trigP) ? trigP : allies[0].id } : {}) };
    const condition = cond === 'always' ? { type: 'always' } : cond === 'resources' ? { type: 'resources', min: { gold: condGold } } : { type: 'attacker_strength_above', value: condStr };
    const action_ = { type: actNow, ...(actNow === 'defensive_formation' ? {} : {}), ...(actNow === 'move_reserves' ? { fromTerritoryId: from, units, territoryId: preTrigger && trig === 'territory_attacked' ? trigT : undefined } : {}), ...(actNow === 'send_support' ? { fromTerritoryId: from, units } : {}), ...(actNow === 'emergency_recruit' ? { territoryId: trigT || mine[0]?.id, unit, count } : {}), ...(actNow === 'build_fortress' ? {} : {}) };
    try { await g.act(`/api/campaigns/${g.id}/conditional`, { action: 'create', trigger, condition, action_, resourceReq: Object.fromEntries(Object.entries(req).filter(([, n]) => (n ?? 0) > 0)), priority: prio, expiresRound: exp }, { successMsg: 'Uvjetna naredba spremljena.' }); onDone(); }
    catch { /* toast */ } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4" data-testid="conditional-composer">
      <div className="rounded-2xl bg-primary-100 p-3 text-sm font-bold text-secondary">Uvjetne naredbe izvršava server automatski u trenutku razrješenja, ako se okidač dogodi. Najviše {v.config.campaign.maxConditionalOrdersPerRound} po rundi.</div>
      <Field label="AKO (okidač)"><select className="input" value={trig} onChange={(e) => setTrig(e.target.value as TriggerType)} data-testid="cond-trigger">{(Object.keys(TRIGGER_LABEL) as TriggerType[]).filter((t) => t !== 'ally_loses_territory' || allies.length > 0).map((t) => <option key={t} value={t}>{TRIGGER_LABEL[t]}</option>)}</select></Field>
      {trig === 'territory_attacked' && <Field label="Koji teritorij"><select className="input" value={trigT} onChange={(e) => setTrigT(e.target.value)}>{mine.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>}
      {trig === 'attacked_by_player' && <Field label="Koji igrač"><select className="input" value={trigP} onChange={(e) => setTrigP(e.target.value)}>{others.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>}
      {trig === 'ally_loses_territory' && <Field label="Koji saveznik"><select className="input" value={trigP} onChange={(e) => setTrigP(e.target.value)}>{allies.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>}
      <Field label="UVJET"><select className="input" value={cond} onChange={(e) => setCond(e.target.value as typeof cond)}><option value="always">Uvijek</option><option value="resources">Samo ako imam zlata</option>{preTrigger && <option value="strength">Samo ako napadač ima više vojnika od…</option>}</select></Field>
      {cond === 'resources' && <Counter value={condGold} onChange={setCondGold} max={999} step={10} />}
      {cond === 'strength' && <Counter value={condStr} onChange={setCondStr} max={999} step={5} />}
      <Field label="TADA (radnja)"><select className="input" value={actNow} onChange={(e) => setAct(e.target.value as ConditionalActionType)} data-testid="cond-action">{validActs.map((a) => <option key={a} value={a}>{ACTION_LABEL[a]}</option>)}</select></Field>
      {(actNow === 'move_reserves' || actNow === 'send_support') && (<>
        <Field label="Iz teritorija"><select className="input" value={from} onChange={(e) => { setFrom(e.target.value); setUnits({}); }}>{mine.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
        {from && <UnitPicker view={v} available={freeUnits(v, from)} value={units} onChange={setUnits} color={FACTIONS[v.me.faction].color} />}
      </>)}
      {actNow === 'emergency_recruit' && (<div className="grid grid-cols-2 gap-3"><Field label="Postrojba"><select className="input" value={unit} onChange={(e) => setUnit(e.target.value as typeof unit)}>{UNIT_TYPES.map((u) => <option key={u} value={u}>{v.config.units[u].name}</option>)}</select></Field><Field label="Broj"><Counter value={count} min={1} max={30} onChange={setCount} /></Field></div>)}
      <div><div className="label mb-1">Potrebni resursi (zadržavaju se samo pri izvršenju)</div>
        <div className="grid grid-cols-2 gap-1.5">{RESOURCE_TYPES.slice(0, 4).map((r) => <div key={r} className="flex items-center justify-between rounded-xl bg-primary-100/50 px-2 py-1"><span className="flex items-center gap-1 text-sm font-extrabold"><ResourceIcon name={r} size={20} />{RES_LOWER[r]}</span><Counter value={req[r] ?? 0} max={500} step={5} onChange={(n) => setReq({ ...req, [r]: n })} /></div>)}</div></div>
      <div className="grid grid-cols-2 gap-3"><Field label="Prioritet (1 = prvi)"><Counter value={prio} min={1} max={5} onChange={setPrio} /></Field><Field label="Vrijedi do runde"><Counter value={exp} min={v.round} max={v.totalRounds} onChange={setExp} /></Field></div>
      <button className="btn btn-yellow w-full" disabled={busy} onClick={submit} data-testid="cond-submit">Spremi uvjetnu naredbu</button>
    </div>
  );
}
