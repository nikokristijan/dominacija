'use client';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FACTIONS } from '@/engine/config';
import { hexCenter, hexCorners, mapPixelSize } from '@/engine/hex';
import type { PlayerView, TerritoryView } from '@/engine/view';
import { Building } from '@/components/art/Buildings';
import { ResourceIcon } from '@/components/art/Resources';
import { TERRAIN_COLORS, TerrainDefs, terrainDecor } from '@/components/art/Terrain';
import { Icon } from '@/components/art/Icons';
import { BuildEffect } from '@/components/art/Effects';
import { unitTotal } from '@/engine/util';

export type Highlight = 'target' | 'source' | 'danger' | 'ally' | 'info';
export interface MapArrow { from: string; to: string; kind: 'attack' | 'support' | 'plan' }
const SIZE = 40;
const EDGE_DIRS_EVEN = [[1, 0], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1]];
const EDGE_DIRS_ODD = [[1, 0], [1, 1], [0, 1], [-1, 0], [0, -1], [1, -1]];

const HEX_PATH = (cx: number, cy: number, s: number) => 'M' + hexCorners(cx, cy, s).map((p) => p.map((n) => n.toFixed(1)).join(' ')).join(' L') + 'Z';

interface HexProps {
  t: TerritoryView; cx: number; cy: number; ownerColor?: string; ownerDark?: string; borders: boolean[]; selected: boolean; hl?: Highlight; showName: boolean; capitalFaction?: string; armyLabel?: string; armyColor?: string;
  fog: boolean; mine: boolean; unsupplied: boolean; production: boolean; ownerFaction?: PlayerView['players'][string]['faction']; regionColor?: string; overlay: string;
}
const HL_COLORS: Record<Highlight, string> = { target: '#22C55E', source: '#5B3DF6', danger: '#EF4444', ally: '#38BDF8', info: '#FFD23F' };

const Hex = memo(function Hex({ t, cx, cy, ownerColor, ownerDark, borders, selected, hl, showName, armyLabel, armyColor, fog, mine, unsupplied, production, ownerFaction, regionColor, overlay }: HexProps) {
  const c = TERRAIN_COLORS[t.terrain];
  const water = t.terrain === 'water';
  const corners = hexCorners(cx, cy, SIZE - 0.6);
  const depth = water ? 2 : 5;
  const edgePath = (i: number) => { const a = corners[i], b = corners[(i + 1) % 6]; const m = (p: number[], q: number[], f: number) => [cx + (p[0] - cx) * f, cy + (p[1] - cy) * f]; const a2 = m(a, a, 0.9), b2 = m(b, b, 0.9); return `M${a2[0].toFixed(1)} ${a2[1].toFixed(1)} L${b2[0].toFixed(1)} ${b2[1].toFixed(1)}`; };
  const seed = t.id;
  return (
    <g className={water ? undefined : 'map-hex'} data-tid={t.id} data-testid={`hex-${t.id}`} role={water ? undefined : 'button'} aria-label={water ? undefined : `${t.name}`}>
      <path d={HEX_PATH(cx, cy + depth, SIZE - 0.6)} fill={c.edge} />
      <path d={HEX_PATH(cx, cy, SIZE - 0.6)} fill={`url(#tg-${t.terrain})`} stroke="rgba(255,255,255,0.55)" strokeWidth="1.2" strokeLinejoin="round" />
      {overlay === 'regions' && regionColor && <path d={HEX_PATH(cx, cy, SIZE - 0.6)} fill={regionColor} opacity="0.42" />}
      <g transform={`translate(${cx} ${cy})`} opacity={fog && !mine ? 0.82 : 1}>{terrainDecor(t.terrain, seed, SIZE)}</g>
      {ownerColor && !water && <path d={HEX_PATH(cx, cy, SIZE - 0.6)} fill={ownerColor} opacity={fog && !mine ? 0.28 : 0.4} />}
      {ownerColor && !water && borders.map((b, i) => b && <path key={i} d={edgePath(i)} stroke={ownerDark} strokeWidth="7" strokeLinecap="round" opacity="0.9" />)}
      {ownerColor && !water && borders.map((b, i) => b && <path key={`b${i}`} d={edgePath(i)} stroke={ownerColor} strokeWidth="4" strokeLinecap="round" />)}
      {fog && !water && <path d={HEX_PATH(cx, cy, SIZE - 0.6)} fill="#EDE8FF" opacity="0.34" pointerEvents="none" />}
      {production && mine && t.production && !water && (
        <g transform={`translate(${cx} ${cy - 22})`} pointerEvents="none">
          <rect x="-17" y="-8" width="34" height="14" rx="7" fill="#fff" stroke="#5B3DF6" strokeWidth="1.4" />
          <text textAnchor="middle" y="3" fontSize="9" fontWeight="900" fill="#38218C">{Math.round(t.production.total.gold + t.production.total.food + t.production.total.iron + t.production.total.wood + t.production.total.influence)}</text>
        </g>
      )}
      {/* nalazište */}
      {t.resource && !t.building && !water && t.terrain !== 'special' && !production && (
        <g transform={`translate(${cx - 24} ${cy - 20})`} opacity={fog && !mine ? 0.75 : 1} pointerEvents="none"><ResourceIcon name={t.resource} size={17} /></g>
      )}
      {/* zgrada */}
      {t.building && !water && (
        <g transform={`translate(${cx - 19} ${cy - 24})`} pointerEvents="none"><Building type={t.building} faction={ownerFaction ?? 'red'} level={t.buildingLevel ?? 1} size={t.isCapital ? 40 : 36} /></g>
      )}
      {!t.building && t.isCapital && !water && (
        <g transform={`translate(${cx - 20} ${cy - 25})`} pointerEvents="none"><Building type="capital" faction={ownerFaction ?? 'red'} size={40} /></g>
      )}
      {t.construction && !water && <g transform={`translate(${cx - 12} ${cy - 18})`} pointerEvents="none"><BuildEffect size={24} /></g>}
      {t.siegeProgress ? <g transform={`translate(${cx + 14} ${cy - 24})`} pointerEvents="none"><circle r="8" fill="#F97316" stroke="#fff" strokeWidth="1.5" /><path d="M-3.5 -3.5 L3.5 3.5 M3.5 -3.5 L-3.5 3.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" /></g> : null}
      {unsupplied && !water && <g transform={`translate(${cx - 24} ${cy + 6})`} pointerEvents="none"><circle r="7" fill="#EF4444" stroke="#fff" strokeWidth="1.4" /><path d="M-3 -3 L3 3 M3 -3 L-3 3" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" /></g>}
      {armyLabel && !water && (
        <g transform={`translate(${cx + 15} ${cy + 15})`} pointerEvents="none">
          <path d="M-12 -9 H12 V4 Q12 11 0 14 Q-12 11 -12 4Z" fill={armyColor ?? '#6B628F'} stroke="#fff" strokeWidth="2" strokeLinejoin="round" />
          <text textAnchor="middle" y="5" fontSize={armyLabel.length > 3 ? 8 : 11} fontWeight="900" fill="#fff" style={{ paintOrder: 'stroke' }} stroke="rgba(0,0,0,0.35)" strokeWidth="0.6">{armyLabel}</text>
        </g>
      )}
      {showName && !water && (
        <g transform={`translate(${cx} ${cy + 30})`} pointerEvents="none"><text textAnchor="middle" fontSize="9.5" fontWeight="900" fill="#211B43" stroke="#fff" strokeWidth="3" paintOrder="stroke" strokeLinejoin="round">{t.name}</text></g>
      )}
      {hl && !water && (
        <g pointerEvents="none">
          <path d={HEX_PATH(cx, cy, SIZE - 2)} fill={HL_COLORS[hl]} opacity="0.22" />
          <path d={HEX_PATH(cx, cy, SIZE - 2)} fill="none" stroke={HL_COLORS[hl]} strokeWidth="3.4" strokeDasharray={hl === 'target' || hl === 'danger' ? '6 4' : undefined} className={hl === 'target' || hl === 'danger' ? 'march' : undefined} />
        </g>
      )}
      {selected && !water && (
        <g pointerEvents="none">
          <path d={HEX_PATH(cx, cy, SIZE + 1)} fill="none" stroke="#fff" strokeWidth="6" strokeLinejoin="round" />
          <path d={HEX_PATH(cx, cy, SIZE + 1)} fill="none" stroke="#FFD23F" strokeWidth="3.4" strokeLinejoin="round" />
          <path d={HEX_PATH(cx, cy, SIZE + 1)} fill="none" stroke="#FFD23F" strokeWidth="2" className="pulse-ring" />
        </g>
      )}
    </g>
  );
});

export interface HexMapProps {
  view: PlayerView; selectedId: string | null; onSelect: (id: string | null) => void; highlights?: Record<string, Highlight>; arrows?: MapArrow[];
  focusId?: string | null; overlay?: 'owners' | 'regions' | 'production'; className?: string; interactive?: boolean;
}

export function HexMap({ view, selectedId, onSelect, highlights, arrows = [], focusId, overlay = 'owners', className = '', interactive = true }: HexMapProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 360, h: 420 });
  const [tf, setTf] = useState({ x: 0, y: 0, k: 1 });
  const fitRef = useRef(1);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef({ moved: 0, startDist: 0, startK: 1, captured: false });
  const [zoomLbl, setZoomLbl] = useState(1);

  const { W, H } = useMemo(() => { const m = mapPixelSize(view.map.width, view.map.height, SIZE); return { W: m.width + 40, H: m.height + 50 }; }, [view.map.width, view.map.height]);

  const fit = useCallback((w: number, h: number) => {
    const k = Math.min(w / W, h / H) * 1.0;
    fitRef.current = k;
    setTf({ k, x: (w - W * k) / 2, y: (h - H * k) / 2 });
  }, [W, H]);

  useEffect(() => {
    const el = wrap.current; if (!el) return;
    const ro = new ResizeObserver(() => { const r = el.getBoundingClientRect(); setBox({ w: r.width, h: r.height }); });
    ro.observe(el);
    const r = el.getBoundingClientRect(); setBox({ w: r.width, h: r.height });
    return () => ro.disconnect();
  }, []);
  const first = useRef(true);
  useEffect(() => {
    if (!(box.w > 10 && box.h > 10 && first.current)) return;
    first.current = false;
    fit(box.w, box.h);
    const narrow = box.w < 700;
    const cap = view.territories[view.me.capitalId];
    if (narrow && cap) {
      const k = fitRef.current * 2.1;
      const c = hexCenter(cap.col, cap.row, SIZE);
      const mw = W * k, mh = H * k;
      let x = box.w / 2 - (c.x + 20) * k, y = box.h / 2 - (c.y + 20) * k;
      x = Math.max(box.w - mw - 80, Math.min(80, x)); y = Math.max(box.h - mh - 80, Math.min(80, y));
      setTf({ k, x, y });
    }
  }, [box, fit, W, H, view.territories, view.me.capitalId]);
  useEffect(() => { setZoomLbl(tf.k / fitRef.current); }, [tf.k]);

  const clampTf = useCallback((n: { x: number; y: number; k: number }) => {
    const k = Math.max(fitRef.current * 0.7, Math.min(fitRef.current * 6, n.k));
    const mw = W * k, mh = H * k;
    const x = mw < box.w ? (box.w - mw) / 2 : Math.max(box.w - mw - 80, Math.min(80, n.x));
    const y = mh < box.h ? (box.h - mh) / 2 : Math.max(box.h - mh - 80, Math.min(80, n.y));
    return { x, y, k };
  }, [W, H, box]);

  const zoomAt = useCallback((px: number, py: number, factor: number) => {
    setTf((t) => { const k = Math.max(fitRef.current * 0.7, Math.min(fitRef.current * 6, t.k * factor)); const f = k / t.k; return clampTf({ k, x: px - (px - t.x) * f, y: py - (py - t.y) * f }); });
  }, [clampTf]);

  // Fokus na teritorij
  useEffect(() => {
    if (!focusId) return;
    const t = view.territories[focusId]; if (!t) return;
    const c = hexCenter(t.col, t.row, SIZE);
    const k = Math.max(tf.k, fitRef.current * 2.2);
    setTf(clampTf({ k, x: box.w / 2 - (c.x + 20) * k, y: box.h / 2 - (c.y + 20) * k }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!interactive) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    gesture.current.moved = 0; gesture.current.captured = false;
    if (pointers.current.size === 2) { const [a, b] = [...pointers.current.values()]; gesture.current.startDist = Math.hypot(a.x - b.x, a.y - b.y); gesture.current.startK = tf.k; }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!interactive || !pointers.current.has(e.pointerId)) return;
    const prev = pointers.current.get(e.pointerId)!;
    const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    gesture.current.moved += Math.abs(dx) + Math.abs(dy);
    if (gesture.current.moved > 7 && !gesture.current.captured) { gesture.current.captured = true; (e.currentTarget as Element).setPointerCapture?.(e.pointerId); }
    if (pointers.current.size === 1 && gesture.current.moved > 7) setTf((t) => clampTf({ ...t, x: t.x + dx, y: t.y + dy }));
    else if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const rect = wrap.current!.getBoundingClientRect();
      const mx = (a.x + b.x) / 2 - rect.left, my = (a.y + b.y) / 2 - rect.top;
      if (gesture.current.startDist > 0) zoomAt(mx, my, (d / gesture.current.startDist) * gesture.current.startK / tf.k);
    }
  };
  const onPointerUp = (e: React.PointerEvent) => { pointers.current.delete(e.pointerId); };
  const onWheel = (e: React.WheelEvent) => {
    if (!interactive) return;
    const rect = wrap.current!.getBoundingClientRect();
    zoomAt(e.clientX - rect.left, e.clientY - rect.top, e.deltaY < 0 ? 1.15 : 1 / 1.15);
  };
  const onClick = (e: React.MouseEvent) => {
    if (gesture.current.moved > 7) return;
    const el = (e.target as Element).closest('[data-tid]') as HTMLElement | null;
    if (!el) { onSelect(null); return; }
    const id = el.getAttribute('data-tid')!;
    if (view.territories[id]?.terrain === 'water') { onSelect(null); return; }
    onSelect(id);
  };

  const sup = view.territories;
  const order = view.map.order;
  const players = view.players;
  const meId = view.me.id;
  const cache = useMemo(() => {
    const centers: Record<string, { x: number; y: number }> = {};
    for (const id of order) { const t = sup[id]; const c = hexCenter(t.col, t.row, SIZE); centers[id] = { x: c.x + 20, y: c.y + 20 }; }
    return centers;
  }, [order, sup]);
  const regionColor = useMemo(() => Object.fromEntries(view.map.regions.map((r) => [r.id, r.color])), [view.map.regions]);
  const nbOwner = (t: TerritoryView, i: number): string | null | undefined => {
    const d = (t.row % 2 === 0 ? EDGE_DIRS_EVEN : EDGE_DIRS_ODD)[i];
    const c = t.col + d[0], r = t.row + d[1];
    if (c < 0 || r < 0 || c >= view.map.width || r >= view.map.height) return undefined;
    return sup[`h${c}_${r}`]?.owner;
  };
  const showAllNames = tf.k / fitRef.current >= 2.6;

  // Ceste: razapinjuće stablo teritorija svakog vlasnika (BFS od glavnog grada) — jasniji prikaz opskrbnih putova
  const roads = useMemo(() => {
    const lines: Array<{ a: string; b: string; mine: boolean; owner: string }> = [];
    const byOwner = new Map<string, string[]>();
    for (const id of order) { const t = sup[id]; if (t.owner && t.terrain !== 'water') byOwner.set(t.owner, [...(byOwner.get(t.owner) ?? []), id]); }
    const nb = (id: string) => { const t = sup[id]; const d = t.row % 2 === 0 ? EDGE_DIRS_EVEN : EDGE_DIRS_ODD; return d.map(([dc, dr]) => `h${t.col + dc}_${t.row + dr}`).filter((n) => sup[n]); };
    for (const [owner, ids] of byOwner) {
      const set = new Set(ids);
      const root = (players[owner]?.capitalId && set.has(players[owner].capitalId)) ? players[owner].capitalId : ids[0];
      const seen = new Set([root]); const q = [root];
      while (q.length) { const cur = q.shift()!; for (const n of nb(cur)) if (set.has(n) && !seen.has(n)) { seen.add(n); q.push(n); lines.push({ a: cur, b: n, mine: owner === meId, owner }); } }
    }
    return lines;
  }, [order, sup, meId, players]);

  return (
    <div ref={wrap} className={`overflow-hidden touch-none select-none ${className}`} onWheel={onWheel} data-testid="hexmap">
      <svg width={box.w} height={box.h} className="block" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onClick={onClick} role="application" aria-label="Svjetska karta">
        <TerrainDefs />
        <defs>
          <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#A9E1FF" /><stop offset="1" stopColor="#6FC3F5" /></linearGradient>
          <pattern id="sea-dots" width="26" height="26" patternUnits="userSpaceOnUse"><circle cx="6" cy="6" r="1.6" fill="#fff" opacity="0.5" /><circle cx="19" cy="19" r="1.2" fill="#fff" opacity="0.4" /></pattern>
          <marker id="arr-attack" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10Z" fill="#EF4444" stroke="#fff" strokeWidth="1.2" /></marker>
          <marker id="arr-support" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10Z" fill="#22C55E" stroke="#fff" strokeWidth="1.2" /></marker>
          <marker id="arr-plan" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10Z" fill="#FFD23F" stroke="#5B3DF6" strokeWidth="1.2" /></marker>
        </defs>
        <g transform={`translate(${tf.x} ${tf.y}) scale(${tf.k})`}>
          <rect x="-200" y="-200" width={W + 400} height={H + 400} fill="url(#sea)" />
          <rect x="-200" y="-200" width={W + 400} height={H + 400} fill="url(#sea-dots)" />
          <rect x="4" y="4" width={W - 8} height={H - 8} rx="34" fill="none" stroke="#fff" strokeOpacity="0.5" strokeWidth="3" strokeDasharray="2 10" strokeLinecap="round" />
          <g transform="translate(20 20)">
            {order.map((id) => {
              const t = sup[id];
              const c = hexCenter(t.col, t.row, SIZE);
              const owner = t.owner ? players[t.owner] : undefined;
              const f = owner ? FACTIONS[owner.faction] : undefined;
              const borders = [0, 1, 2, 3, 4, 5].map((i) => { const o = nbOwner(t, i); return !!t.owner && o !== t.owner; });
              let armyLabel: string | undefined, armyColor: string | undefined;
              if (t.terrain !== 'water') {
                if (t.visibility === 'own' && t.garrison) { const n = unitTotal(t.garrison); if (n > 0) { armyLabel = `${n}`; armyColor = f?.dark; } }
                else if (t.armyEstimate?.range) { const r = t.armyEstimate.range; if (r.max > 0) { armyLabel = `~${Math.round((r.min + r.max) / 2)}`; armyColor = f?.dark ?? '#6B628F'; } }
                else if (t.armyEstimate?.exact) { armyLabel = `${unitTotal(t.armyEstimate.exact)}`; armyColor = f?.dark; }
                else if (t.owner && t.visibility === 'far') { armyLabel = '?'; armyColor = '#7C73A6'; }
              }
              return (
                <Hex key={id} t={t} cx={c.x} cy={c.y} ownerColor={f?.color} ownerDark={f?.dark} ownerFaction={owner?.faction} borders={borders} selected={selectedId === id}
                  hl={highlights?.[id]} showName={showAllNames || t.isCapital || selectedId === id} armyLabel={armyLabel} armyColor={armyColor}
                  fog={t.visibility === 'far'} mine={t.owner === meId} unsupplied={t.owner === meId && t.supplied === false} production={overlay === 'production'}
                  regionColor={regionColor[t.regionId]} overlay={overlay} capitalFaction={undefined} />
              );
            })}
            {/* ceste */}
            <g pointerEvents="none">
              {roads.map((r, i) => { const a = cache[r.a], b = cache[r.b]; const ax = a.x - 20, ay = a.y - 20, bx = b.x - 20, by = b.y - 20; return <g key={i}><line x1={ax} y1={ay + 14} x2={bx} y2={by + 14} stroke="#fff" strokeOpacity="0.8" strokeWidth={r.mine ? 5 : 3} strokeLinecap="round" /><line x1={ax} y1={ay + 14} x2={bx} y2={by + 14} stroke={r.mine ? '#B5733A' : '#C9B79A'} strokeWidth={r.mine ? 2.4 : 1.6} strokeLinecap="round" strokeDasharray={r.mine ? undefined : '3 4'} /></g>; })}
            </g>
            {/* strelice naredbi */}
            <g pointerEvents="none">
              {arrows.map((a, i) => {
                const from = cache[a.from], to = cache[a.to]; if (!from || !to) return null;
                const fx = from.x - 20, fy = from.y - 20, tx = to.x - 20, ty = to.y - 20;
                const dx = tx - fx, dy = ty - fy, len = Math.hypot(dx, dy) || 1;
                const sx = fx + (dx / len) * 14, sy = fy + (dy / len) * 14, ex = tx - (dx / len) * 22, ey = ty - (dy / len) * 22;
                const col = a.kind === 'attack' ? '#EF4444' : a.kind === 'support' ? '#22C55E' : '#FFD23F';
                return <g key={i}><line x1={sx} y1={sy} x2={ex} y2={ey} stroke="#fff" strokeWidth="9" strokeLinecap="round" opacity="0.85" /><line x1={sx} y1={sy} x2={ex} y2={ey} stroke={col} strokeWidth="5" strokeLinecap="round" markerEnd={`url(#arr-${a.kind})`} className="march" /></g>;
              })}
            </g>
          </g>
        </g>
      </svg>
      {interactive && (
        <div className="absolute left-2 top-1/2 -translate-y-1/2 flex flex-col gap-2">
          <button className="h-11 w-11 rounded-2xl bg-white border-2 border-line text-primary grid place-items-center shadow-lg active:translate-y-0.5" aria-label="Povećaj" onClick={() => zoomAt(box.w / 2, box.h / 2, 1.4)}><Icon name="plus" /></button>
          <button className="h-11 w-11 rounded-2xl bg-white border-2 border-line text-primary grid place-items-center shadow-lg active:translate-y-0.5" aria-label="Smanji" onClick={() => zoomAt(box.w / 2, box.h / 2, 1 / 1.4)}><Icon name="minus" /></button>
          <button className="h-11 w-11 rounded-2xl bg-white border-2 border-line text-primary grid place-items-center shadow-lg active:translate-y-0.5" aria-label="Prilagodi prikaz" onClick={() => fit(box.w, box.h)}><Icon name="target" /></button>
        </div>
      )}
      <span className="sr-only">Zoom {zoomLbl.toFixed(1)}×</span>
    </div>
  );
}
