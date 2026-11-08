'use client';
import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { UNIT_TYPES } from '@/engine/config';
import type { OrderPreview, PlayerId, Resources, UnitType, Units } from '@/engine/types';
import type { PlayerView } from '@/engine/view';
import { ResourceIcon, type ResourceIconName } from '@/components/art/Resources';
import { FactionBadge } from '@/components/art/Factions';
import { UnitIcon } from '@/components/art/Characters';
import { Counter } from '@/components/ui/kit';
import { Icon } from '@/components/art/Icons';
import { RES_NAMES, num } from '@/lib/format';

export function ResPill({ name, value, delta, label, compact }: { name: ResourceIconName; value: number | string; delta?: number; label?: string; compact?: boolean }) {
  return (
    <div className="flex items-center gap-2 shrink-0" title={label ?? String(name)}>
      <ResourceIcon name={name} size={compact ? 17 : 22} className="text-neutral-500" />
      <div className="leading-tight">
        <div className={`font-semibold tabular-nums ${compact ? 'text-sm' : 'text-[17px]'}`}>{typeof value === 'number' ? num(value) : value}</div>
        {delta !== undefined && !compact && <div className={`text-[11px] font-semibold ${delta >= 0 ? 'text-good' : 'text-bad'}`}>{delta >= 0 ? '+' : '−'}{Math.abs(Math.round(delta * 10) / 10)}/d</div>}
      </div>
      {delta !== undefined && compact && <span className={`text-[11px] font-semibold ${delta >= 0 ? 'text-good' : 'text-bad'}`}>{delta >= 0 ? '+' : '−'}{Math.abs(Math.round(delta))}</span>}
    </div>
  );
}

export function CostLine({ cost }: { cost: Partial<Resources> }) {
  const items = (Object.keys(cost) as Array<keyof Resources>).filter((k) => (cost[k] ?? 0) > 0);
  if (!items.length) return <span className="text-muted text-sm">Besplatno</span>;
  return <span className="inline-flex flex-wrap gap-2">{items.map((k) => <span key={k} className="inline-flex items-center gap-1 text-sm font-semibold"><ResourceIcon name={k} size={18} />{cost[k]}</span>)}</span>;
}

export function PlayerChip({ view, id, size = 26 }: { view: PlayerView; id: PlayerId; size?: number }) {
  const p = view.players[id];
  if (!p) return null;
  return <span className="inline-flex items-center gap-1.5 font-semibold"><FactionBadge faction={p.faction} size={size} />{p.name}</span>;
}

const CONF: Record<string, { label: string; cls: string }> = { high: { label: 'Visoka pouzdanost', cls: 'chip-good' }, medium: { label: 'Srednja pouzdanost', cls: 'chip-yellow' }, low: { label: 'Niska pouzdanost', cls: 'chip-warn' }, none: { label: 'Nepoznato', cls: 'chip-bad' } };

export function PreviewCard({ p }: { p: OrderPreview | null }) {
  if (!p) return <div className="card-flat text-muted text-sm shimmer">Računam strateški pregled…</div>;
  const v = p.validation;
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-2.5" data-testid="order-preview">
      <div className="rounded-xl bg-primary-100 p-3">
        <div className="flex items-center justify-between gap-2"><h4 className="font-display text-secondary text-lg">{p.title}</h4>
          {p.outlook && <span className={`chip ${p.outlook === 'favorable' ? 'chip-good' : p.outlook === 'unfavorable' ? 'chip-bad' : 'chip-yellow'}`}>{p.outlook === 'favorable' ? 'Povoljno' : p.outlook === 'unfavorable' ? 'Nepovoljno' : 'Neizvjesno'}</span>}</div>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm"><span className="inline-flex items-center gap-1 font-semibold"><ResourceIcon name="command" size={18} />{v.cpCost} ZB</span><CostLine cost={v.resourceCost} /></div>
      </div>
      {v.errors.length > 0 && <ul className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-800 font-medium space-y-1">{v.errors.map((e, i) => <li key={i} className="flex gap-2"><Icon name="warn" size={16} className="shrink-0 mt-0.5" />{e}</li>)}</ul>}
      {p.known.length > 0 && <Block title="Poznato" tone="good">{p.known.map((k, i) => <Row key={i} l={k.label} r={k.value} />)}</Block>}
      {p.estimated.length > 0 && <Block title="Procjena" tone="warn">{p.estimated.map((k, i) => <div key={i} className="flex justify-between gap-3 text-sm"><span className="text-muted">{k.label}</span><span className="text-right font-semibold">{k.value}<br /><span className={`chip ${CONF[k.confidence]?.cls ?? ''} mt-0.5`}>{CONF[k.confidence]?.label}</span></span></div>)}</Block>}
      {p.unknown.length > 0 && <Block title="Nepoznato" tone="muted">{p.unknown.map((u, i) => <div key={i} className="text-sm text-muted flex gap-2"><span>?</span>{u}</div>)}</Block>}
      {p.risks.length > 0 && <Block title="Rizici" tone="bad">{p.risks.map((r, i) => <div key={i} className="text-sm flex gap-2 items-start"><span className={`mt-1 h-2.5 w-2.5 rounded-full shrink-0 ${r.level === 'high' ? 'bg-bad' : r.level === 'medium' ? 'bg-warn' : 'bg-accent-600'}`} />{r.text}</div>)}</Block>}
      {p.countermeasures.length > 0 && <Block title="Moguće protumjere" tone="muted">{p.countermeasures.map((u, i) => <div key={i} className="text-sm flex gap-2"><Icon name="shield" size={15} className="shrink-0 mt-0.5 text-primary" />{u}</div>)}</Block>}
    </motion.div>
  );
}
const Row = ({ l, r }: { l: string; r: string }) => <div className="flex justify-between gap-3 text-sm"><span className="text-muted">{l}</span><span className="font-semibold text-right">{r}</span></div>;
function Block({ title, tone, children }: { title: string; tone: 'good' | 'warn' | 'bad' | 'muted'; children: React.ReactNode }) {
  const c = { good: 'border-green-200 bg-green-50/60', warn: 'border-orange-200 bg-orange-50/60', bad: 'border-red-200 bg-red-50/50', muted: 'border-line bg-white' }[tone];
  return <div className={`rounded-xl border p-3 space-y-1.5 ${c}`}><div className="label">{title}</div>{children}</div>;
}

/** Slobodne postrojbe u teritoriju = garnizon − već obećano drugim predanim naredbama. */
export function freeUnits(view: PlayerView, territoryId: string, excludeOrderId?: string): Units {
  const t = view.territories[territoryId];
  const have: Units = { ...(t?.garrison ?? {}) };
  for (const o of view.orders) {
    if (o.id === excludeOrderId || (o.status !== 'submitted' && o.status !== 'locked')) continue;
    let u: Units | undefined;
    if (o.type === 'attack' && o.params.fromId === territoryId) u = o.params.units;
    if (o.type === 'defend' && o.params.stance === 'reinforce' && o.params.fromTerritoryId === territoryId) u = o.params.units;
    if (o.type === 'diplomacy' && o.params.kind === 'support' && o.params.terms?.fromTerritoryId === territoryId) u = o.params.terms.units;
    if (u) for (const k of UNIT_TYPES) if (u[k]) have[k] = Math.max(0, (have[k] ?? 0) - (u[k] as number));
  }
  return have;
}

export function UnitPicker({ available, value, onChange, color, view }: { available: Units; value: Units; onChange: (u: Units) => void; color?: string; view: PlayerView }) {
  const types = UNIT_TYPES.filter((u) => (available[u] ?? 0) > 0);
  const total = types.reduce((a, u) => a + (value[u] ?? 0), 0);
  if (!types.length) return <div className="text-sm text-muted">Nema slobodnih postrojbi u ovom teritoriju.</div>;
  return (
    <div className="space-y-2">
      {types.map((u) => (
        <div key={u} className="flex items-center justify-between gap-2 rounded-xl bg-primary-100/60 pl-2 pr-1.5 py-1.5">
          <div className="flex items-center gap-2 min-w-0"><UnitIcon unit={u} color={color} size={38} /><div className="leading-tight"><div className="font-semibold">{view.config.units[u].name}</div><div className="text-xs text-muted">dostupno {available[u]} · nap. {view.config.units[u].attack} · obr. {view.config.units[u].defense}</div></div></div>
          <Counter value={value[u] ?? 0} max={available[u] ?? 0} onChange={(n) => onChange({ ...value, [u]: n })} />
        </div>
      ))}
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold">Ukupno: {total}</span>
        <div className="flex gap-1.5"><button type="button" className="chip" onClick={() => onChange(Object.fromEntries(types.map((u) => [u, Math.floor((available[u] ?? 0) / 2)])))}>½</button><button type="button" className="chip" onClick={() => onChange(Object.fromEntries(types.map((u) => [u, available[u] ?? 0])))}>Sve</button><button type="button" className="chip" onClick={() => onChange({})}>Ništa</button></div>
      </div>
    </div>
  );
}

export const unitNames = (view: PlayerView) => Object.fromEntries(UNIT_TYPES.map((u) => [u, view.config.units[u].name])) as Record<UnitType, string>;

export function useMyTerritories(view: PlayerView) {
  return useMemo(() => view.map.order.map((i) => view.territories[i]).filter((t) => t.owner === view.me.id), [view]);
}
export { RES_NAMES };
