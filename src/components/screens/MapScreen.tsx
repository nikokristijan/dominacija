'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { OrderType } from '@/engine/types';
import { Icon, type IconName } from '@/components/art/Icons';
import { Seg, Sheet } from '@/components/ui/kit';
import { useGame } from '@/components/game/GameProvider';
import { HexMap, MAP_REL_LABELS, REL, type Highlight, type MapArrow } from '@/components/game/HexMap';
import { TerritoryDetails, adjacentOwned } from '@/components/game/TerritoryDetails';
import { OrderComposer, ORDER_LABELS } from '@/components/game/OrderComposer';
import { ConditionalComposer } from '@/components/game/ConditionalComposer';
import { OperationPopup } from '@/components/game/OperationPopup';
import { useIsDesktop } from '@/lib/useMediaQuery';
import { radar } from '@/lib/radar';
import { useReady } from '@/components/game/ReadyGuard';
import { sfx } from '@/lib/sfx';
import { buildReplay, type ReplayStep } from '@/lib/replay';

type Overlay = 'owners' | 'regions' | 'production';

export function MapScreen() {
  const g = useGame();
  const v = g.view!;
  const sp = useSearchParams();
  const [overlay, setOverlay] = useState<Overlay>('owners');
  const [composer, setComposer] = useState<{ type: OrderType | 'conditional'; territoryId: string } | null>(null);
  const [op, setOp] = useState<{ target: string | null; from: string | null } | null>(null);
  const [fitSignal, setFitSignal] = useState(0);
  const [zoomSignal, setZoomSignal] = useState(0);
  const sel = g.selected ? v.territories[g.selected] : null;
  const desktop = useIsDesktop();
  const ready = useReady();

  // Ponavljanje bitki prošle runde: kamera ide od jedne do druge, strelice marširaju, pa ishod
  const [replay, setReplay] = useState<{ list: ReplayStep[]; i: number; stage: 'march' | 'result' } | null>(null);
  useEffect(() => {
    if (sp.get('replay') !== '1') return;
    const list = buildReplay(v, v.round - 1);
    if (list.length) { g.select(null); setReplay({ list, i: 0, stage: 'march' }); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!replay) return;
    const st = replay.list[replay.i];
    const t = setTimeout(() => {
      if (replay.stage === 'march') {
        if (st.tone === 'good') sfx.win(); else if (st.tone === 'bad') sfx.loss(); else sfx.tick();
        setReplay({ ...replay, stage: 'result' });
      } else if (replay.i + 1 < replay.list.length) setReplay({ ...replay, i: replay.i + 1, stage: 'march' });
      else setReplay(null);
    }, replay.stage === 'march' ? 1900 : 2100);
    return () => clearTimeout(t);
  }, [replay]);
  const replayBattle = replay ? replay.list[replay.i] : null; // ReplayStep

  useEffect(() => { const f = sp.get('focus'); if (f && v.territories[f]) g.select(f); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const t = sp.get('op'); if (t && v.territories[t]) { setOp({ target: t, from: null }); g.select(null); } /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const arrows = useMemo<MapArrow[]>(() => {
    const list: MapArrow[] = v.orders.filter((o) => o.round === v.round && ['submitted', 'locked', 'draft'].includes(o.status)).flatMap((o): MapArrow[] => {
      if (o.type === 'attack') return [{ from: o.params.fromId, to: o.params.targetId, kind: o.status === 'draft' ? 'plan' : 'attack' }];
      if (o.type === 'defend' && o.params.stance === 'reinforce' && o.params.fromTerritoryId) return [{ from: o.params.fromTerritoryId, to: o.params.territoryId, kind: 'support' }];
      return [];
    });
    if (op?.target && op.from) list.push({ from: op.from, to: op.target, kind: 'plan' });
    return list;
  }, [v.orders, v.round, op]);
  const replayArrows = useMemo<MapArrow[]>(() => replayBattle ? replayBattle.arrows : [], [replayBattle]);
  const replayHl = useMemo<Record<string, Highlight>>(() => replayBattle ? { [replayBattle.territoryId]: replayBattle.tone === 'good' ? 'target' : replayBattle.tone === 'bad' ? 'danger' : 'info' } : {}, [replayBattle]);

  const highlights = useMemo<Record<string, Highlight>>(() => {
    const h: Record<string, Highlight> = {};
    if (!op) { for (const id of g.tourTargets) h[id] = 'source'; return h; }
    if (!op.target) { for (const id of v.map.order) { const t = v.territories[id]; if (t.owner !== v.me.id && t.terrain !== 'water' && adjacentOwned(v, id).length) h[id] = 'info'; } return h; }
    h[op.target] = 'danger';
    for (const s of adjacentOwned(v, op.target)) h[s] = 'source';
    if (op.from) h[op.from] = 'target';
    return h;
  }, [op, v, g.tourTargets]);

  const badges = useMemo(() => { const b: Record<string, 'threat' | 'chance'> = {}; for (const r of radar(v)) if (!b[r.id]) b[r.id] = r.kind; return b; }, [v]);

  const onSelect = (id: string | null) => {
    if (op) {
      if (!id) return;
      const t = v.territories[id];
      if (t.owner === v.me.id && op.target && adjacentOwned(v, op.target).includes(id)) setOp({ ...op, from: id });
      else if (t.owner !== v.me.id && t.terrain !== 'water' && adjacentOwned(v, id).length) setOp({ target: id, from: null });
      return;
    }
    g.select(id);
  };
  // stabilna referenca: karta se ne crta ponovno svake sekunde zbog otkucaja sata
  const selRef = useRef(onSelect); selRef.current = onSelect;
  const stableSelect = useCallback((id: string | null) => selRef.current(id), []);
  const startOp = (target: string | null) => { g.select(null); setOp({ target, from: null }); };
  const popupOpen = !!op || (!!sel && !composer);
  const cycle = () => setOverlay((o) => (o === 'owners' ? 'regions' : o === 'regions' ? 'production' : 'owners'));

  const tools: Array<{ icon: IconName; label: string; onClick?: () => void; href?: string; active?: boolean; tour?: string }> = [
    { icon: 'cursor', label: 'Odabir', active: !op, onClick: () => setOp(null) },
    { icon: 'expand', label: 'Prilagodi prikaz', onClick: () => setFitSignal((n) => n + 1) },
    { icon: 'layers', label: `Sloj: ${overlay === 'owners' ? 'vlasnici' : overlay === 'regions' ? 'regije' : 'proizvodnja'}`, onClick: cycle, tour: 'layers' },
    { icon: 'swords', label: 'Vojna operacija', active: !!op, onClick: () => (op ? setOp(null) : startOp(sel && sel.owner !== v.me.id ? sel.id : null)), tour: 'tool-op' },
    { icon: 'flask', label: 'Istraživanje', href: `/k/${g.id}/tehnologija` },
    ...(v.phase === 'planning' ? [{ icon: (v.me.ready ? 'unlock' : 'lock') as IconName, label: v.me.ready ? 'Otključaj naredbe' : 'Zaključaj naredbe (spremno)', active: v.me.ready, onClick: ready.toggle, tour: 'tool-ready' }] : []),
  ];

  return (
    <div className="flex-1 min-h-0 relative bg-white" data-testid="map-area">
      <HexMap view={v} selectedId={g.selected} onSelect={stableSelect} arrows={replay ? replayArrows : arrows} highlights={replay ? replayHl : highlights} badges={op || replay ? undefined : badges} overlay={overlay} className="absolute inset-0" fitSignal={fitSignal} zoomSignal={zoomSignal} focusId={replayBattle ? replayBattle.territoryId : !desktop ? (op?.target ?? g.selected) : null} focusBias={0.24} />

      {/* sloj + legenda (plutajuće, bez okvira) */}
      <div className="absolute top-3 left-3 right-3 lg:right-auto flex items-center gap-2 pointer-events-none">
        <div className="pointer-events-auto w-full max-w-[17rem] bg-white rounded-xl"><Seg small value={overlay} onChange={setOverlay} options={[{ value: 'owners', label: 'Vlasnici' }, { value: 'regions', label: 'Regije' }, { value: 'production', label: 'Proizvodnja' }]} /></div>
      </div>
      <div className="absolute left-3 bottom-4 hidden lg:flex flex-col gap-1.5 pointer-events-none" data-tour="legend">
        {MAP_REL_LABELS.map((r) => <div key={r.key} className="flex items-center gap-2 text-xs font-semibold text-neutral-600"><span className="h-2.5 w-2.5 rounded-full" style={{ background: REL[r.key] }} />{r.label}</div>)}
      </div>

      {/* zoom */}
      <div className="absolute right-3 top-3 lg:top-auto lg:bottom-4 flex flex-col rounded-full bg-white float-shadow overflow-hidden" style={{ right: popupOpen ? undefined : undefined }}>
        <button className="h-11 w-11 grid place-items-center text-neutral-700 active:bg-neutral-50" aria-label="Povećaj" onClick={() => setZoomSignal((n) => n + 1)}><Icon name="plus" size={20} /></button>
        <div className="h-px bg-line mx-2" />
        <button className="h-11 w-11 grid place-items-center text-neutral-700 active:bg-neutral-50" aria-label="Smanji" onClick={() => setZoomSignal((n) => n - 1)}><Icon name="minus" size={20} /></button>
      </div>

      {/* plutajuća alatna traka */}
      <div className={`absolute left-1/2 -translate-x-1/2 bottom-4 ${popupOpen ? 'max-lg:hidden' : ''}`}>
        <div className="flex items-center gap-1 rounded-full bg-white float-shadow p-1.5" data-tour="toolbar">
          {tools.map((t) => {
            const cls = `h-11 w-11 grid place-items-center rounded-full transition-colors ${t.active ? 'bg-ink text-white' : 'text-neutral-600 hover:bg-neutral-100'}`;
            return t.href ? <Link key={t.label} href={t.href} className={cls} aria-label={t.label} title={t.label}><Icon name={t.icon} size={21} stroke={1.7} /></Link>
              : <button key={t.label} onClick={t.onClick} className={cls} aria-label={t.label} title={t.label} data-tour={t.tour}><Icon name={t.icon} size={21} stroke={1.7} /></button>;
          })}
          <Link href={`/k/${g.id}/naredbe`} className="ml-1 h-11 px-4 rounded-full bg-primary-100 text-primary font-semibold text-sm inline-flex items-center gap-1.5" data-tour="orders-link"><Icon name="orders" size={18} />{v.cp.used}/{v.cp.available}</Link>
        </div>
      </div>

      {replay && replayBattle && (() => {
        const b = replayBattle; const m = replay.stage === 'march' ? b.march : b.result;
        const tone = replay.stage === 'march' ? 'bg-ink text-white' : b.tone === 'good' ? 'bg-good text-white' : b.tone === 'bad' ? 'bg-bad text-white' : 'bg-ink text-white';
        return (
          <div className="absolute left-3 right-3 bottom-[5.5rem] lg:bottom-auto lg:left-auto lg:right-4 lg:top-4 z-20 flex justify-center pointer-events-none" data-testid="replay-banner">
            <div className={`pointer-events-auto rounded-2xl px-5 py-3 float-shadow max-w-md w-full lg:w-[22rem] transition-colors ${tone}`}>
              <div className="text-[11px] uppercase tracking-wider opacity-70">Prošli dan · {replay.i + 1} / {replay.list.length}</div>
              <div className="text-lg font-semibold leading-tight">{m.title}</div>
              <div className="text-sm opacity-80">{m.sub}</div>
              <button className="mt-1.5 text-xs font-semibold underline opacity-80" onClick={() => setReplay(null)} data-testid="replay-skip">Preskoči</button>
            </div>
          </div>);
      })()}

      {ready.dialog}
      {/* kontekstualni popupi */}
      <Sheet open={!!sel && !op && !composer} onClose={() => g.select(null)} title="Teritorij" side modeless>
        {sel && <TerritoryDetails key={sel.id} t={sel} onAction={(type, id) => setComposer({ type, territoryId: id })} onOperation={(id) => startOp(id)} />}
      </Sheet>
      <Sheet open={!!op} onClose={() => setOp(null)} title="Vojna operacija" side modeless>
        {op && <OperationPopup target={op.target} from={op.from} setTarget={(t) => setOp((o) => (o ? { ...o, target: t } : o))} setFrom={(f) => setOp((o) => (o ? { ...o, from: f } : o))} onClose={() => setOp(null)} />}
      </Sheet>
      <Sheet open={!!composer} onClose={() => setComposer(null)} title="Naredba" tall side>
        {composer && (composer.type === 'conditional'
          ? <><h2 className="text-xl mb-3">Uvjetna naredba</h2><ConditionalComposer territoryId={composer.territoryId} onDone={() => setComposer(null)} /></>
          : <><h2 className="text-xl mb-0.5 flex items-center gap-2"><Icon name={ORDER_LABELS[composer.type].icon} size={22} />{ORDER_LABELS[composer.type].name}</h2><p className="text-sm text-muted mb-4">{ORDER_LABELS[composer.type].desc}</p>
            <OrderComposer key={composer.type + composer.territoryId} type={composer.type} onDone={() => setComposer(null)} prefillTerritory={composer.territoryId}
              initial={composer.type === 'espionage' ? { type: 'espionage', params: { action: 'army', targetPlayerId: v.territories[composer.territoryId].owner ?? undefined, targetTerritoryId: composer.territoryId } }
                : composer.type === 'sabotage' ? { type: 'sabotage', params: { kind: 'production', targetPlayerId: v.territories[composer.territoryId].owner ?? '', targetTerritoryId: composer.territoryId } }
                : composer.type === 'diplomacy' ? (v.territories[composer.territoryId].owner ? { type: 'diplomacy', params: { kind: 'alliance', targetPlayerId: v.territories[composer.territoryId].owner! } } : { type: 'diplomacy', params: { kind: 'annex', targetTerritoryId: composer.territoryId } }) : undefined} /></>)}
      </Sheet>
    </div>
  );
}
