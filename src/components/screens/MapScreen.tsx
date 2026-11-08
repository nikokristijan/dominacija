'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { OrderType } from '@/engine/types';
import { Icon } from '@/components/art/Icons';
import { Seg, Sheet } from '@/components/ui/kit';
import { useGame } from '@/components/game/GameProvider';
import { HexMap, type MapArrow } from '@/components/game/HexMap';
import { TerritoryDetails } from '@/components/game/TerritoryDetails';
import { OrderComposer, ORDER_LABELS } from '@/components/game/OrderComposer';
import { ConditionalComposer } from '@/components/game/ConditionalComposer';
import { CommandQueue } from '@/components/game/CommandQueue';
import { FactionBadge } from '@/components/art/Factions';
import { timeAgo } from '@/lib/format';
import { useIsDesktop } from '@/lib/useMediaQuery';

export function MapScreen() {
  const g = useGame();
  const v = g.view!;
  const [overlay, setOverlay] = useState<'owners' | 'regions' | 'production'>('owners');
  const [composer, setComposer] = useState<{ type: OrderType | 'conditional'; territoryId: string } | null>(null);
  const [tab, setTab] = useState<'territory' | 'intel' | 'ranking'>('territory');
  const sel = g.selected ? v.territories[g.selected] : null;
  const desktop = useIsDesktop();

  const arrows = useMemo<MapArrow[]>(() => v.orders.filter((o) => o.round === v.round && (o.status === 'submitted' || o.status === 'locked' || o.status === 'draft')).flatMap((o): MapArrow[] => {
    if (o.type === 'attack') return [{ from: o.params.fromId, to: o.params.targetId, kind: o.status === 'draft' ? 'plan' : 'attack' }];
    if (o.type === 'defend' && o.params.stance === 'reinforce' && o.params.fromTerritoryId) return [{ from: o.params.fromTerritoryId, to: o.params.territoryId, kind: 'support' }];
    return [];
  }), [v.orders, v.round]);

  const onAction = (type: OrderType | 'conditional', territoryId: string) => setComposer({ type, territoryId });
  const closeSheet = () => g.select(null);

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="flex-1 min-h-0 flex">
        <div className="relative flex-1 min-w-0" data-testid="map-area">
          <HexMap view={v} selectedId={g.selected} onSelect={g.select} arrows={arrows} overlay={overlay} className="absolute inset-0" />
          <div className="absolute top-2 left-2 right-2 flex items-start justify-between gap-2 pointer-events-none">
            <div className="pointer-events-auto w-60 max-w-[70%]"><Seg value={overlay} onChange={setOverlay} options={[{ value: 'owners', label: 'Vlasnici' }, { value: 'regions', label: 'Regije' }, { value: 'production', label: 'Proizvodnja' }]} /></div>
            <Link href={`/k/${g.id}/naredbe`} className="pointer-events-auto btn btn-yellow btn-sm"><Icon name="orders" size={16} />{v.cp.used}/{v.cp.available}</Link>
          </div>
          <div className="absolute bottom-2 left-2 right-2 pointer-events-none flex flex-wrap gap-1.5 justify-center">
            {Object.values(v.players).map((p) => <span key={p.id} className="pointer-events-auto inline-flex items-center gap-1 rounded-full bg-white/90 border-2 border-line pl-0.5 pr-2 py-0.5 text-[11px] font-extrabold shadow"><FactionBadge faction={p.faction} size={18} />{p.name}<span className="text-primary">{p.score}</span></span>)}
          </div>
        </div>
        {/* Desktop: desni panel */}
        {desktop && <aside className="flex w-[22rem] shrink-0 flex-col bg-white border-l-2 border-line" aria-label="Detalji">
          <div className="p-3"><Seg value={tab} onChange={setTab} options={[{ value: 'territory', label: 'Teritorij' }, { value: 'intel', label: 'Obavještajno' }, { value: 'ranking', label: 'Ljestvica' }]} /></div>
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            {tab === 'territory' && (sel ? <TerritoryDetails t={sel} onAction={onAction} compact /> : <div className="text-center text-muted font-bold py-10">Odaberi teritorij na karti.<br /><span className="text-sm">Dodirni heksagon za pojedinosti i akcije.</span></div>)}
            {tab === 'intel' && <IntelList />}
            {tab === 'ranking' && <ol className="space-y-1.5">{v.ranking.map((r, i) => { const p = v.players[r.playerId]; return <li key={r.playerId} className="flex items-center gap-2 rounded-xl bg-primary-100/40 px-2.5 py-2"><span className="w-5 font-black text-muted">{i + 1}</span><FactionBadge faction={p.faction} size={24} /><span className="flex-1 font-extrabold truncate">{p.name}</span><span className="font-display text-primary">{r.score}</span></li>; })}</ol>}
          </div>
        </aside>}
      </div>
      {desktop && <div className="shrink-0"><CommandQueue /></div>}

      {/* Mobilno: ilustrirani bottom sheet */}
      {!desktop && (
        <Sheet open={!!sel && sel.terrain !== 'water' && !composer} onClose={closeSheet} title="Detalji teritorija">
          {sel && <TerritoryDetails t={sel} onAction={onAction} />}
        </Sheet>
      )}
      <Sheet open={!!composer} onClose={() => setComposer(null)} title="Naredba" tall>
        {composer && (composer.type === 'conditional'
          ? <><h2 className="text-2xl text-secondary mb-3">Uvjetna naredba</h2><ConditionalComposer territoryId={composer.territoryId} onDone={() => setComposer(null)} /></>
          : <><h2 className="text-2xl text-secondary mb-1 flex items-center gap-2"><Icon name={ORDER_LABELS[composer.type].icon} />{ORDER_LABELS[composer.type].name}</h2><p className="text-sm text-muted mb-3">{ORDER_LABELS[composer.type].desc}</p>
            <OrderComposer key={composer.type + composer.territoryId} type={composer.type} onDone={() => setComposer(null)} prefillTerritory={composer.territoryId}
              initial={composer.type === 'espionage' ? { type: 'espionage', params: { action: 'army', targetPlayerId: v.territories[composer.territoryId].owner ?? undefined, targetTerritoryId: composer.territoryId } }
                : composer.type === 'sabotage' ? { type: 'sabotage', params: { kind: 'production', targetPlayerId: v.territories[composer.territoryId].owner ?? '', targetTerritoryId: composer.territoryId } }
                : composer.type === 'diplomacy' ? { type: 'diplomacy', params: { kind: 'annex', targetTerritoryId: composer.territoryId } } : undefined} /></>)}
      </Sheet>
    </div>
  );
}

function IntelList() {
  const { view: v } = useGame();
  const list = [...v!.intel].sort((a, b) => b.round - a.round || b.createdAt.localeCompare(a.createdAt));
  if (!list.length) return <div className="text-center text-muted font-bold py-10">Još nemaš obavještajnih izvješća.<br /><span className="text-sm">Naredi špijunažu preko teritorija protivnika.</span></div>;
  return (<div className="space-y-2">{list.map((r) => (
    <div key={r.id} className="rounded-2xl border-2 border-line p-2.5">
      <div className="flex justify-between items-center"><span className="chip">{r.kind}</span><span className={`chip ${r.confidence === 'high' ? 'chip-good' : r.confidence === 'medium' ? 'chip-yellow' : r.confidence === 'low' ? 'chip-warn' : 'chip-bad'}`}>{r.confidence === 'failed' ? 'neuspjelo' : r.confidence === 'high' ? 'visoka' : r.confidence === 'medium' ? 'srednja' : 'niska'}</span></div>
      <p className="text-sm font-bold mt-1">{r.summary}</p><p className="text-xs text-muted">Zadnje ažurirano: {timeAgo(r.createdAt)} · dan {r.round}{v!.round - r.round > v!.config.espionage.staleAfterRounds ? ' · ZASTARJELO' : ''}</p>
    </div>))}</div>);
}
export { IntelList };
