'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { RESOURCE_TYPES, UNIT_TYPES } from '@/engine/config';
import { TECHS, TECH_BY_ID, TECH_CATEGORIES } from '@/engine/tech';
import type { OrderInput, OrderPreview, OrderType, ResourceType, Resources } from '@/engine/types';
import { Counter, Field, Seg } from '@/components/ui/kit';
import { Icon } from '@/components/art/Icons';
import { Building } from '@/components/art/Buildings';
import { ResourceIcon } from '@/components/art/Resources';
import { UnitIcon } from '@/components/art/Characters';
import { FACTIONS } from '@/engine/config';
import { useGame } from './GameProvider';
import { PreviewCard, UnitPicker, freeUnits, CostLine } from './common';
import { api } from '@/lib/api';
import { RES_LOWER } from '@/lib/format';
import type { PlayerView } from '@/engine/view';

export const ORDER_LABELS: Record<OrderType, { name: string; icon: Parameters<typeof Icon>[0]['name']; desc: string }> = {
  recruit: { name: 'Novačenje', icon: 'users', desc: 'Novi vojnici stižu početkom iduće runde.' },
  trade: { name: 'Trgovačka ekspedicija', icon: 'trade', desc: 'Zamijeni jedan resurs drugim.' },
  build: { name: 'Gradnja', icon: 'hammer', desc: 'Podigni ili nadogradi zgradu.' },
  defend: { name: 'Obrambena operacija', icon: 'shield', desc: 'Utvrdi teritorij ili pošalji pojačanje.' },
  espionage: { name: 'Špijunaža', icon: 'eye', desc: 'Prikupi procjene o protivniku.' },
  diplomacy: { name: 'Diplomatska misija', icon: 'handshake', desc: 'Ponude, savezi, pripajanje neutralnih teritorija.' },
  attack: { name: 'Vojni napad', icon: 'sword', desc: 'Višekoračno planiranje operacije.' },
  sabotage: { name: 'Sabotaža', icon: 'fire', desc: 'Oštećeni proizvodnju, stabilnost ili utvrde.' },
  research: { name: 'Istraživanje', icon: 'flask', desc: 'Otključaj tehnologiju.' },
  resistance: { name: 'Otpor', icon: 'flag', desc: 'Posebne misije za kraljevstva u Otporu.' },
};

export function defaultOrder(view: PlayerView, type: OrderType, hint: { territoryId?: string } = {}): OrderInput {
  const mine = view.map.order.map((i) => view.territories[i]).filter((t) => t.owner === view.me.id);
  const tid = hint.territoryId && view.territories[hint.territoryId]?.owner === view.me.id ? hint.territoryId : (mine.find((t) => t.isCapital) ?? mine[0])?.id ?? '';
  const others = Object.values(view.players).filter((p) => p.id !== view.me.id);
  switch (type) {
    case 'recruit': return { type, params: { territoryId: tid, unit: 'infantry', count: 5 } };
    case 'trade': return { type, params: { give: 'gold', receive: 'iron', amount: 20 } };
    case 'build': return { type, params: { territoryId: tid, building: 'farm' } };
    case 'defend': return { type, params: { territoryId: tid, stance: 'entrench' } };
    case 'espionage': return { type, params: { action: 'army', targetPlayerId: others[0]?.id } };
    case 'diplomacy': return { type, params: { kind: 'alliance', targetPlayerId: others[0]?.id } };
    case 'sabotage': { const p = others[0]; const t = Object.values(view.territories).find((x) => x.owner === p?.id); return { type, params: { kind: 'production', targetPlayerId: p?.id ?? '', targetTerritoryId: t?.id ?? '' } }; }
    case 'research': { const t = TECHS.find((x) => !view.me.techs.includes(x.id) && x.requires.every((r) => view.me.techs.includes(r))); return { type, params: { techId: t?.id ?? 'mil_infantry' } }; }
    case 'resistance': return { type, params: { kind: 'emergency_recruit', territoryId: tid } };
    default: return { type: 'recruit', params: { territoryId: tid, unit: 'infantry', count: 1 } };
  }
}

type Draft = OrderInput;

export function OrderComposer({ type, initial, editingId, onDone, prefillTerritory }: { type: OrderType; initial?: Draft; editingId?: string; onDone: () => void; prefillTerritory?: string }) {
  const { view, id, act, toast } = useGame();
  const v = view!;
  const [o, setO] = useState<Draft>(() => initial ?? defaultOrder(v, type, { territoryId: prefillTerritory }));
  const [preview, setPreview] = useState<OrderPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const mine = useMemo(() => v.map.order.map((i) => v.territories[i]).filter((t) => t.owner === v.me.id), [v]);
  const others = Object.values(v.players).filter((p) => p.id !== v.me.id);
  const seq = useRef(0);

  useEffect(() => {
    const my = ++seq.current;
    setPreview(null);
    const t = setTimeout(async () => {
      try { const r = await api<{ preview: OrderPreview }>(`/api/campaigns/${id}/preview`, { order: o, excludeId: editingId }); if (my === seq.current) setPreview(r.preview); }
      catch (e) { if (my === seq.current) setPreview({ validation: { ok: false, errors: [e instanceof Error ? e.message : 'Neispravno'], warnings: [], cpCost: 0, resourceCost: {} }, title: 'Naredba', known: [], estimated: [], unknown: [], risks: [], countermeasures: [] }); }
    }, 300);
    return () => clearTimeout(t);
  }, [o, id, editingId]);

  const set = (params: Record<string, unknown>) => setO((cur) => ({ ...cur, params: { ...(cur.params as object), ...params } } as Draft));
  const p = o.params as any;
  const terrOpts = (list: typeof mine) => list.map((t) => <option key={t.id} value={t.id}>{t.name}{t.isCapital ? ' (glavni grad)' : ''}</option>);

  const save = async (status: 'draft' | 'submitted') => {
    setBusy(true);
    try {
      if (editingId) {
        await act(`/api/campaigns/${id}/orders`, { action: 'update', orderId: editingId, order: o }, { quiet: true });
        toast('Naredba ažurirana.', 'good');
      } else await act(`/api/campaigns/${id}/orders`, { action: 'create', order: o, status }, { quiet: true });
      if (!editingId) toast(status === 'draft' ? 'Nacrt spremljen.' : 'Naredba predana.', 'good');
      onDone();
    } catch (e) { toast(e instanceof Error ? e.message : 'Greška', 'bad'); } finally { setBusy(false); }
  };

  const isDraftEdit = editingId ? v.orders.find((x) => x.id === editingId)?.status === 'draft' : false;

  return (
    <div className="space-y-4" data-testid={`composer-${type}`}>
      {type === 'recruit' && (<>
        <Field label="Teritorij"><select className="input" value={p.territoryId} onChange={(e) => set({ territoryId: e.target.value })}>{terrOpts(mine)}</select></Field>
        <Field label="Vrsta postrojbe">
          <div className="grid grid-cols-3 gap-2">{UNIT_TYPES.map((u) => (
            <button key={u} type="button" onClick={() => set({ unit: u })} className={`rounded-2xl border-2 p-2 flex flex-col items-center ${p.unit === u ? 'border-primary bg-primary-100' : 'border-line bg-white'}`}>
              <UnitIcon unit={u} size={46} /><span className="text-xs font-extrabold">{v.config.units[u].name}</span><span className="text-[10px] text-muted">{v.config.units[u].cost.gold}z {v.config.units[u].cost.iron ? `${v.config.units[u].cost.iron}ž` : ''}</span>
            </button>))}</div>
        </Field>
        <Field label="Broj postrojbi"><Counter value={p.count} min={1} max={60} onChange={(n) => set({ count: n })} /></Field>
      </>)}

      {type === 'trade' && (<>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Daješ"><select className="input" value={p.give} onChange={(e) => set({ give: e.target.value })}>{RESOURCE_TYPES.map((r) => <option key={r} value={r}>{RES_LOWER[r]} (imaš {Math.floor(v.availableResources[r])})</option>)}</select></Field>
          <Field label="Primaš"><select className="input" value={p.receive} onChange={(e) => set({ receive: e.target.value })}>{RESOURCE_TYPES.map((r) => <option key={r} value={r}>{RES_LOWER[r]}</option>)}</select></Field>
        </div>
        <Field label={`Količina (najviše ${v.tradeCap})`}><Counter value={p.amount} min={1} max={v.tradeCap} step={5} onChange={(n) => set({ amount: n })} /></Field>
      </>)}

      {type === 'build' && (<>
        <Field label="Teritorij"><select className="input" value={p.territoryId} onChange={(e) => set({ territoryId: e.target.value })}>{terrOpts(mine)}</select></Field>
        {(() => {
          const t = v.territories[p.territoryId];
          return (<Field label="Zgrada"><div className="grid grid-cols-3 gap-2">{(['farm', 'mine', 'city', 'fortress', 'barracks', 'market', 'research_center'] as const).map((b) => {
            const bd = v.config.buildings[b];
            const ok = !!t && bd.allowedTerrain.includes(t.terrain) && (!t.building || t.building === b);
            return (<button key={b} type="button" disabled={!ok} onClick={() => set({ building: b })} className={`rounded-2xl border-2 p-1.5 flex flex-col items-center ${p.building === b ? 'border-primary bg-primary-100' : 'border-line bg-white'} ${ok ? '' : 'opacity-40'}`}>
              <Building type={b} size={52} faction={v.me.faction} /><span className="text-[11px] font-extrabold text-center leading-tight">{bd.name}</span>
              {t?.building === b && <span className="chip chip-good mt-0.5">Nadogradi</span>}
            </button>);
          })}</div></Field>);
        })()}
      </>)}

      {type === 'defend' && (<>
        <Field label="Teritorij"><select className="input" value={p.territoryId} onChange={(e) => set({ territoryId: e.target.value })}>{terrOpts(mine)}</select></Field>
        <Seg value={p.stance} onChange={(s) => set({ stance: s })} options={[{ value: 'entrench', label: 'Utvrdi' }, { value: 'fortify', label: 'Ojačaj' }, { value: 'reinforce', label: 'Pojačanje' }]} />
        <p className="text-sm text-muted">{p.stance === 'entrench' ? `+${Math.round(v.config.defense.entrenchBonus * 100)}% obrane samo ove runde (bez troška resursa).` : p.stance === 'fortify' ? 'Trajno povećava razinu obrane teritorija (košta resurse).' : 'Postrojbe iz susjednog teritorija prelaze prije bitaka.'}</p>
        {p.stance === 'reinforce' && (<>
          <Field label="Iz susjednog teritorija"><select className="input" value={p.fromTerritoryId ?? ''} onChange={(e) => set({ fromTerritoryId: e.target.value, units: {} })}><option value="">— odaberi —</option>{terrOpts(mine.filter((t) => t.id !== p.territoryId))}</select></Field>
          {p.fromTerritoryId && <UnitPicker view={v} available={freeUnits(v, p.fromTerritoryId, editingId)} value={p.units ?? {}} onChange={(u) => set({ units: u })} color={FACTIONS[v.me.faction].color} />}
        </>)}
      </>)}

      {type === 'espionage' && (<>
        <Field label="Radnja"><select className="input" value={p.action} onChange={(e) => set({ action: e.target.value, targetTerritoryId: undefined })}>
          <option value="army">Procijeni vojsku</option><option value="resources">Procijeni resurse</option><option value="buildings">Otkrij građevine</option><option value="preparations">Otkrij vojne pripreme</option><option value="routes">Otkrij pravce napada</option><option value="false_info">Širi lažne informacije (o sebi)</option><option value="counter">Protuobavještajna zaštita</option></select></Field>
        {!['counter', 'false_info'].includes(p.action) && (<>
          <Field label="Ciljani igrač"><select className="input" value={p.targetPlayerId ?? ''} onChange={(e) => set({ targetPlayerId: e.target.value, targetTerritoryId: undefined })}><option value="">— odaberi —</option>{others.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
          {p.action === 'army' && <Field label="Ciljani teritorij (neobavezno)" hint="Bez teritorija dobiješ procjenu ukupne vojske."><select className="input" value={p.targetTerritoryId ?? ''} onChange={(e) => set({ targetTerritoryId: e.target.value || undefined })}><option value="">Cijelo kraljevstvo</option>{Object.values(v.territories).filter((t) => t.owner === p.targetPlayerId).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>}
        </>)}
        <p className="text-sm text-muted">Izvješće stiže nakon razrješenja runde i prikazuje stanje na početku nove runde — s razinom pouzdanosti.</p>
      </>)}

      {type === 'sabotage' && (<>
        <Field label="Vrsta sabotaže"><select className="input" value={p.kind} onChange={(e) => set({ kind: e.target.value })}><option value="production">Proizvodnja (−50% jednu rundu)</option><option value="stability">Stabilnost (nemiri)</option><option value="fortification">Utvrde (−1 razina)</option></select></Field>
        <Field label="Ciljani igrač"><select className="input" value={p.targetPlayerId} onChange={(e) => set({ targetPlayerId: e.target.value, targetTerritoryId: Object.values(v.territories).find((t) => t.owner === e.target.value)?.id ?? '' })}>{others.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
        <Field label="Teritorij"><select className="input" value={p.targetTerritoryId} onChange={(e) => set({ targetTerritoryId: e.target.value })}>{Object.values(v.territories).filter((t) => t.owner === p.targetPlayerId).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
      </>)}

      {type === 'research' && (
        <div className="space-y-2">{(Object.keys(TECH_CATEGORIES) as Array<keyof typeof TECH_CATEGORIES>).map((cat) => (
          <div key={cat}><div className="label mb-1" style={{ color: TECH_CATEGORIES[cat].color }}>{TECH_CATEGORIES[cat].name}</div>
            <div className="grid gap-1.5">{TECHS.filter((t) => t.category === cat).map((t) => {
              const have = v.me.techs.includes(t.id), avail = t.requires.every((r) => v.me.techs.includes(r));
              return <button key={t.id} type="button" disabled={have || !avail} onClick={() => set({ techId: t.id })} className={`text-left rounded-2xl border-2 p-2.5 ${p.techId === t.id ? 'border-primary bg-primary-100' : 'border-line bg-white'} ${have || !avail ? 'opacity-45' : ''}`}>
                <div className="flex justify-between items-center"><b>{t.name}</b>{have && <span className="chip chip-good">Istraženo</span>}</div><div className="text-xs text-muted">{t.description}</div></button>;
            })}</div></div>))}
        </div>
      )}

      {type === 'diplomacy' && <DiplomacyForm v={v} p={p} set={set} mine={mine} others={others} editingId={editingId} />}

      {type === 'resistance' && (<>
        <Seg value={p.kind} onChange={(k) => set({ kind: k, territoryId: k === 'uprising' ? (v.me.resistance?.formerTerritories.find((id) => v.territories[id].owner !== v.me.id) ?? '') : mine[0]?.id ?? '' })} options={[{ value: 'emergency_recruit', label: 'Hitno novačenje' }, { value: 'uprising', label: 'Ustanak' }]} />
        {p.kind === 'emergency_recruit'
          ? <Field label="Teritorij"><select className="input" value={p.territoryId} onChange={(e) => set({ territoryId: e.target.value })}>{terrOpts(mine)}</select></Field>
          : <Field label="Okupirani teritorij"><select className="input" value={p.territoryId} onChange={(e) => set({ territoryId: e.target.value })}>{(v.me.resistance?.formerTerritories ?? []).filter((id) => v.territories[id].owner !== v.me.id).map((id) => <option key={id} value={id}>{v.territories[id].name}</option>)}</select></Field>}
      </>)}

      <PreviewCard p={preview} />

      <div className="sticky bottom-0 -mx-4 px-4 pt-3 pb-1 bg-gradient-to-t from-white via-white to-white/80 flex gap-2">
        {(!editingId || isDraftEdit) && <button className="btn btn-ghost flex-1" disabled={busy} onClick={() => save('draft')} data-testid="save-draft">Spremi nacrt</button>}
        <button className="btn btn-yellow flex-[1.4]" disabled={busy || !preview?.validation.ok} onClick={() => save('submitted')} data-testid="submit-order">{editingId && !isDraftEdit ? 'Spremi izmjene' : 'Predaj naredbu'}</button>
      </div>
    </div>
  );
}

function ResInputs({ value, onChange, label }: { value: Partial<Resources>; onChange: (r: Partial<Resources>) => void; label: string }) {
  return (<div><div className="label mb-1">{label}</div><div className="grid grid-cols-1 gap-1.5">{RESOURCE_TYPES.map((r) => (
    <div key={r} className="flex items-center justify-between rounded-xl bg-primary-100/50 px-2 py-1"><span className="flex items-center gap-1.5 font-extrabold text-sm"><ResourceIcon name={r} size={22} />{RES_LOWER[r]}</span><Counter value={value[r] ?? 0} max={999} step={5} onChange={(n) => onChange({ ...value, [r]: n })} /></div>))}</div></div>);
}

function DiplomacyForm({ v, p, set, mine, others, editingId }: { v: PlayerView; p: any; set: (x: Record<string, unknown>) => void; mine: any[]; others: any[]; editingId?: string }) {
  const terms = p.terms ?? {};
  const setTerms = (t: Record<string, unknown>) => set({ terms: { ...terms, ...t } });
  const target = p.targetPlayerId ? v.players[p.targetPlayerId] : undefined;
  const neutral = Object.values(v.territories).filter((t) => !t.owner && t.terrain !== 'water' && Object.values(v.territories).some((n) => n.owner === v.me.id && Math.abs(n.col - t.col) <= 1 && Math.abs(n.row - t.row) <= 1));
  return (<>
    <Field label="Vrsta misije"><select className="input" value={p.kind} onChange={(e) => set({ kind: e.target.value, terms: {}, targetTerritoryId: undefined })}>
      <option value="alliance">Prijedlog saveza</option><option value="nap">Sporazum o nenapadanju</option><option value="trade">Trgovinska razmjena</option><option value="support">Vojna potpora (saveznik)</option><option value="swap">Razmjena teritorija</option><option value="joint_attack">Zajednički napad (saveznik)</option><option value="improve">Dar (poboljšaj odnose)</option><option value="annex">Pripoji neutralni teritorij</option></select></Field>
    {p.kind === 'annex' ? (
      <Field label="Neutralni teritorij" hint="Plaća se utjecajem; neutralni stanovnici predaju se uz dio postrojbi."><select className="input" value={p.targetTerritoryId ?? ''} onChange={(e) => set({ targetTerritoryId: e.target.value })}><option value="">— odaberi —</option>{neutral.map((t) => <option key={t.id} value={t.id}>{t.name} ({v.config.terrain[t.terrain].name}, važnost {t.importance})</option>)}</select></Field>
    ) : (<>
      <Field label="Igrač"><select className="input" value={p.targetPlayerId ?? ''} onChange={(e) => set({ targetPlayerId: e.target.value })}><option value="">— odaberi —</option>{others.map((x) => <option key={x.id} value={x.id}>{x.name} {x.relation === 'ally' ? '(saveznik)' : ''}</option>)}</select></Field>
      {target && <p className="text-xs text-muted">Ugled igrača {target.name}: <b>{Math.round(target.reputation.score)}</b>/100 · izdaja: {target.reputation.betrayals} · prekršeni sporazumi: {target.reputation.brokenTreaties}</p>}
      {(p.kind === 'alliance' || p.kind === 'nap') && <Field label="Trajanje (runde)"><Counter value={terms.durationRounds ?? (p.kind === 'alliance' ? v.config.diplomacy.allianceDefaultDuration : v.config.diplomacy.napDefaultDuration)} min={1} max={7} onChange={(n) => setTerms({ durationRounds: n })} /></Field>}
      {p.kind === 'trade' && (<div className="grid gap-3"><ResInputs label="Ti daješ" value={terms.give ?? {}} onChange={(r) => setTerms({ give: r })} /><ResInputs label="Ti primaš" value={terms.receive ?? {}} onChange={(r) => setTerms({ receive: r })} /></div>)}
      {p.kind === 'improve' && <ResInputs label="Dar" value={terms.give ?? {}} onChange={(r) => setTerms({ give: r })} />}
      {p.kind === 'support' && (<>
        <Field label="Iz teritorija"><select className="input" value={terms.fromTerritoryId ?? ''} onChange={(e) => setTerms({ fromTerritoryId: e.target.value, units: {} })}><option value="">— odaberi —</option>{mine.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
        {terms.fromTerritoryId && <UnitPicker view={v} available={freeUnits(v, terms.fromTerritoryId, editingId)} value={terms.units ?? {}} onChange={(u) => setTerms({ units: u })} color={FACTIONS[v.me.faction].color} />}
      </>)}
      {p.kind === 'swap' && (<>
        <Field label="Tvoj teritorij"><select className="input" value={terms.swapMine ?? ''} onChange={(e) => setTerms({ swapMine: e.target.value })}><option value="">— odaberi —</option>{mine.filter((t) => !t.isCapital).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
        <Field label="Njihov teritorij"><select className="input" value={terms.swapTheirs ?? ''} onChange={(e) => setTerms({ swapTheirs: e.target.value })}><option value="">— odaberi —</option>{Object.values(v.territories).filter((t) => t.owner === p.targetPlayerId && !t.isCapital).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
      </>)}
      {p.kind === 'joint_attack' && <Field label="Cilj zajedničkog napada"><select className="input" value={terms.attackTarget ?? ''} onChange={(e) => setTerms({ attackTarget: e.target.value })}><option value="">— odaberi —</option>{Object.values(v.territories).filter((t) => t.owner !== v.me.id && t.owner !== p.targetPlayerId && t.terrain !== 'water').map((t) => <option key={t.id} value={t.id}>{t.name}{t.owner ? ` (${v.players[t.owner]?.name})` : ''}</option>)}</select></Field>}
      {['alliance', 'nap', 'trade', 'support', 'swap', 'joint_attack'].includes(p.kind) && (
        <label className="flex items-center gap-3 rounded-2xl bg-primary-100/60 p-3 font-extrabold"><input type="checkbox" className="h-5 w-5 accent-[#5B3DF6]" checked={!!p.secret} onChange={(e) => set({ secret: e.target.checked })} /><span>Tajni dogovor <span className="block text-xs font-semibold text-muted">Vidljiv samo vama dvoma.</span></span></label>
      )}
    </>)}
  </>);
}

export { CostLine, TECH_BY_ID };
export type { ResourceType };
