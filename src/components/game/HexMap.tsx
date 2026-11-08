'use client';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FACTIONS } from '@/engine/config';
import { hexCenter, hexCorners } from '@/engine/hex';
import type { PlayerView, TerritoryView } from '@/engine/view';
import { TerrainDefs, terrainDecor } from '@/components/art/Terrain';
import { Icon, type IconName } from '@/components/art/Icons';
import { unitTotal } from '@/engine/util';
import type { BuildingType } from '@/engine/types';

export type Highlight = 'target' | 'source' | 'danger' | 'ally' | 'info';
export interface MapArrow { from: string; to: string; kind: 'attack' | 'support' | 'plan' }

const SIZE = 40;
/** Vertikalna kompresija = povišeni (blago izometrijski) pogled. */
const YS = 0.8;
const DEPTH = 11;
const EVEN = [[1, 0], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1]];
const ODD = [[1, 0], [1, 1], [0, 1], [-1, 0], [0, -1], [1, -1]];

/** Boje odnosa: ja = ljubičasta, saveznik = plava, protivnik = prigušena crvena, neutralno = prigušeno zlato. */
export const REL = { me: '#7138E8', ally: '#3F78E0', enemy: '#C9504A', neutral: '#C9A24A' };
const B_GLYPH: Record<BuildingType, IconName> = { capital: 'crown', farm: 'wheat', mine: 'pickaxe', city: 'city', fortress: 'castle', barracks: 'swords', market: 'stall', research_center: 'flask' };
const HL: Record<Highlight, string> = { target: '#2F9E62', source: '#7138E8', danger: '#D1453B', ally: '#3F78E0', info: '#C9A24A' };

const pathFor = (cx: number, cy: number, s: number, lift = 0) => 'M' + hexCorners(cx, cy, s).map(([x, y]) => `${x.toFixed(1)} ${(cy + (y - cy) * YS - lift).toFixed(1)}`).join(' L') + 'Z';
const edgeLine = (cx: number, cy: number, i: number, f = 0.92) => {
  const c = hexCorners(cx, cy, SIZE - 0.5); const a = c[i], b = c[(i + 1) % 6];
  const p = (q: number[]) => [cx + (q[0] - cx) * f, cy + (q[1] - cy) * YS * f];
  const [x1, y1] = p(a), [x2, y2] = p(b);
  return `M${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)}`;
};

interface Cell { t: TerritoryView; cx: number; cy: number; rel: 'me' | 'ally' | 'enemy' | 'neutral' | null; borders: boolean[]; faction?: string }

const TopLayer = memo(function TopLayer({ c, selected, overlay, regionColor }: { c: Cell; selected: boolean; overlay: string; regionColor?: string }) {
  const { t, cx, cy, rel } = c;
  const water = t.terrain === 'water';
  const lift = selected && !water ? 5 : 0;
  const col = rel ? REL[rel] : REL.neutral;
  return (
    <g pointerEvents="none">
      <path className="hex-top" d={pathFor(cx, cy + (water ? 4 : 0), SIZE - 0.4, lift)} fill={`url(#tg-${t.terrain})`} />
      {!water && <path d={pathFor(cx, cy, SIZE - 0.4, lift)} fill="none" stroke="#fff" strokeOpacity="0.28" strokeWidth="1" />}
      {!water && (rel ? <path d={pathFor(cx, cy, SIZE - 0.4, lift)} fill={col} opacity={rel === 'me' ? 0.34 : 0.3} /> : <path d={pathFor(cx, cy, SIZE - 0.4, lift)} fill={REL.neutral} opacity="0.1" />)}
      {overlay === 'regions' && regionColor && !water && <path d={pathFor(cx, cy, SIZE - 0.4, lift)} fill={regionColor} opacity="0.4" />}
    </g>
  );
});

const DecorLayer = memo(function DecorLayer({ c, selected, fog }: { c: Cell; selected: boolean; fog: boolean }) {
  const { t, cx, cy } = c;
  if (t.terrain === 'water') return <g transform={`translate(${cx} ${cy + 4})`} pointerEvents="none">{terrainDecor('water', t.id, SIZE)}</g>;
  const lift = selected ? 5 : 0;
  return <g transform={`translate(${cx} ${cy - lift})`} opacity={fog ? 0.88 : 1} pointerEvents="none">{terrainDecor(t.terrain, t.id, SIZE)}</g>;
});

interface MarkProps { c: Cell; selected: boolean; showName: boolean; armyLabel?: string; fog: boolean; mine: boolean; unsupplied: boolean; production: boolean; hl?: Highlight }
const MarkLayer = memo(function MarkLayer({ c, selected, showName, armyLabel, fog, mine, unsupplied, production, hl }: MarkProps) {
  const { t, cx, cy, rel, borders } = c;
  if (t.terrain === 'water') return null;
  const lift = selected ? 5 : 0;
  const col = rel ? REL[rel] : REL.neutral;
  const fac = t.owner && c.faction ? FACTIONS[c.faction as keyof typeof FACTIONS] : null;
  const gy = cy - lift;
  const building = t.building ?? (t.isCapital ? 'capital' : null);
  return (
    <g pointerEvents="none">
      {rel && borders.map((b, i) => b && <g key={i}><path d={edgeLine(cx, gy, i)} stroke={col} strokeWidth="5.5" strokeLinecap="round" opacity="0.95" /><path d={edgeLine(cx, gy, i, 0.86)} stroke="#fff" strokeWidth="1.4" strokeLinecap="round" opacity="0.85" /></g>)}
      {fog && <path d={pathFor(cx, cy, SIZE - 0.4, lift)} fill="#fff" opacity="0.30" />}
      {production && mine && t.production && <g transform={`translate(${cx} ${gy - 18})`}><rect x="-15" y="-8" width="30" height="15" rx="7.5" fill="#fff" /><text textAnchor="middle" y="3.5" fontSize="9.5" fontWeight="700" fill="#171717">+{Math.round(t.production.total.gold + t.production.total.food + t.production.total.iron + t.production.total.wood + t.production.total.influence)}</text></g>}
      {t.isCapital && (
        <g transform={`translate(${cx} ${gy - 3})`}>
          <circle r="15" fill={col} opacity="0.28" />
          <circle r="11.5" fill={col} stroke="#fff" strokeWidth="2" />
          {fac && <circle r="14.4" fill="none" stroke={fac.color} strokeWidth="1.8" />}
          <g color="#fff" transform="translate(-7 -7)"><Icon name="crown" size={14} stroke={2} /></g>
        </g>
      )}
      {building && !t.isCapital && (
        <g transform={`translate(${cx} ${gy - 4})`}>
          <circle r="10.5" fill="#fff" /><circle r="10.5" fill="none" stroke={col} strokeWidth="1.6" />
          <g color="#171717" transform="translate(-6.5 -6.5)"><Icon name={B_GLYPH[building]} size={13} stroke={2} /></g>
        </g>
      )}
      {t.construction && <g transform={`translate(${cx + 12} ${gy - 16})`}><circle r="6.5" fill="#fff" /><g color="#C77A1A" transform="translate(-4.5 -4.5)"><Icon name="hammer" size={9} stroke={2.4} /></g></g>}
      {t.siegeProgress ? <g transform={`translate(${cx - 14} ${gy - 16})`}><circle r="6.5" fill="#D1453B" /><text textAnchor="middle" y="3" fontSize="9" fontWeight="800" fill="#fff">{t.siegeProgress}</text></g> : null}
      {unsupplied && <g transform={`translate(${cx - 18} ${gy + 6})`}><circle r="6" fill="#D1453B" stroke="#fff" strokeWidth="1.4" /><path d="M-2.6 -2.6 L2.6 2.6 M2.6 -2.6 L-2.6 2.6" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" /></g>}
      {armyLabel && (
        <g transform={`translate(${cx} ${gy + 15})`}>
          <rect x={-(armyLabel.length * 3.3 + 8)} y="-7.5" width={armyLabel.length * 6.6 + 16} height="15" rx="7.5" fill="#fff" stroke="#E6E6E6" strokeWidth="0.8" />
          <circle cx={-(armyLabel.length * 3.3) - 0.5} cy="0" r="2.4" fill={col} />
          <text x="3" textAnchor="middle" y="3.4" fontSize="9.5" fontWeight="700" fill="#171717">{armyLabel}</text>
        </g>
      )}
      {showName && <text transform={`translate(${cx} ${gy + 30})`} textAnchor="middle" fontSize="9.5" fontWeight="650" fill="#171717" stroke="#fff" strokeWidth="3.2" paintOrder="stroke" strokeLinejoin="round">{t.name}</text>}
      {hl && <g><path d={pathFor(cx, cy, SIZE - 2.5, lift)} fill={HL[hl]} opacity="0.2" /><path d={pathFor(cx, cy, SIZE - 2.5, lift)} fill="none" stroke={HL[hl]} strokeWidth="3" strokeDasharray={hl === 'target' || hl === 'danger' ? '6 4' : undefined} className={hl === 'target' || hl === 'danger' ? 'march' : undefined} /></g>}
      {selected && <g><path d={pathFor(cx, cy, SIZE + 0.5, lift)} fill="none" stroke="#fff" strokeWidth="6" strokeLinejoin="round" /><path d={pathFor(cx, cy, SIZE + 0.5, lift)} fill="none" stroke="#171717" strokeWidth="2.2" strokeLinejoin="round" /></g>}
    </g>
  );
});

export interface HexMapProps {
  view: PlayerView; selectedId: string | null; onSelect: (id: string | null) => void; highlights?: Record<string, Highlight>; arrows?: MapArrow[];
  focusId?: string | null; overlay?: 'owners' | 'regions' | 'production'; className?: string; interactive?: boolean; fitSignal?: number; zoomSignal?: number; focusBias?: number;
}

export function HexMap({ view, selectedId, onSelect, highlights, arrows = [], focusId, overlay = 'owners', className = '', interactive = true, fitSignal = 0, zoomSignal = 0, focusBias = 0.5 }: HexMapProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 360, h: 420 });
  const [measured, setMeasured] = useState(false);
  const [tf, setTf] = useState({ x: 0, y: 0, k: 1 });
  const fitRef = useRef(1);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef({ moved: 0, startDist: 0, startK: 1, captured: false });

  const meId = view.me.id;
  const geo = useMemo(() => {
    const cells: Record<string, { x: number; y: number }> = {};
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const id of view.map.order) {
      const t = view.territories[id];
      const c = hexCenter(t.col, t.row, SIZE);
      const x = c.x, y = c.y * YS;
      cells[id] = { x, y };
      minX = Math.min(minX, x - SIZE); maxX = Math.max(maxX, x + SIZE); minY = Math.min(minY, y - SIZE * YS - 8); maxY = Math.max(maxY, y + SIZE * YS + DEPTH + 30);
    }
    const pad = 36;
    for (const id of Object.keys(cells)) { cells[id].x -= minX - pad; cells[id].y -= minY - pad; }
    return { cells, W: maxX - minX + pad * 2, H: maxY - minY + pad * 2 };
  }, [view.map.order, view.territories]);
  const { W, H } = geo;

  const fit = useCallback((w: number, h: number) => {
    const k = Math.min(w / W, h / H) * 0.98;
    fitRef.current = k;
    setTf({ k, x: (w - W * k) / 2, y: (h - H * k) / 2 });
  }, [W, H]);

  useEffect(() => {
    const el = wrap.current; if (!el) return;
    const ro = new ResizeObserver(() => { const r = el.getBoundingClientRect(); setBox({ w: r.width, h: r.height }); if (r.width > 10 && r.height > 10) setMeasured(true); });
    ro.observe(el);
    const r = el.getBoundingClientRect(); setBox({ w: r.width, h: r.height }); if (r.width > 10 && r.height > 10) setMeasured(true);
    return () => ro.disconnect();
  }, []);

  const clampTf = useCallback((n: { x: number; y: number; k: number }) => {
    const k = Math.max(fitRef.current * 0.7, Math.min(fitRef.current * 7, n.k));
    const mw = W * k, mh = H * k;
    const x = mw < box.w ? (box.w - mw) / 2 : Math.max(box.w - mw - 120, Math.min(120, n.x));
    const y = mh < box.h ? (box.h - mh) / 2 : Math.max(box.h - mh - 120, Math.min(120, n.y));
    return { x, y, k };
  }, [W, H, box]);

  const first = useRef(true);
  useEffect(() => {
    if (!(measured && box.w > 10 && box.h > 10 && first.current)) return;
    first.current = false;
    fit(box.w, box.h);
    const cap = geo.cells[view.me.capitalId];
    if (box.w < 700 && cap) {
      const k = fitRef.current * 1.9;
      const mw = W * k, mh = H * k;
      let x = box.w / 2 - cap.x * k, y = box.h / 2 - cap.y * k;
      x = Math.max(box.w - mw - 120, Math.min(120, x)); y = Math.max(box.h - mh - 120, Math.min(120, y));
      setTf({ k, x, y });
    }
  }, [measured, box, fit, W, H, geo, view.me.capitalId]);
  useEffect(() => { if (fitSignal && box.w > 10) fit(box.w, box.h); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [fitSignal]);

  const zoomAt = useCallback((px: number, py: number, factor: number) => {
    setTf((t) => { const k = Math.max(fitRef.current * 0.7, Math.min(fitRef.current * 7, t.k * factor)); const f = k / t.k; return clampTf({ k, x: px - (px - t.x) * f, y: py - (py - t.y) * f }); });
  }, [clampTf]);
  const lastZoom = useRef(0);
  useEffect(() => { if (zoomSignal !== lastZoom.current) { zoomAt(box.w / 2, box.h / 2, zoomSignal > lastZoom.current ? 1.35 : 1 / 1.35); lastZoom.current = zoomSignal; } /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [zoomSignal]);

  useEffect(() => {
    if (!focusId) return;
    const c = geo.cells[focusId]; if (!c) return;
    const k = Math.max(tf.k, fitRef.current * 2.2);
    setTf(clampTf({ k, x: box.w / 2 - c.x * k, y: box.h * focusBias - c.y * k }));
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
      if (gesture.current.startDist > 0) zoomAt((a.x + b.x) / 2 - rect.left, (a.y + b.y) / 2 - rect.top, (d / gesture.current.startDist) * gesture.current.startK / tf.k);
    }
  };
  const onPointerUp = (e: React.PointerEvent) => { pointers.current.delete(e.pointerId); };
  const onWheel = (e: React.WheelEvent) => { if (!interactive) return; const r = wrap.current!.getBoundingClientRect(); zoomAt(e.clientX - r.left, e.clientY - r.top, e.deltaY < 0 ? 1.14 : 1 / 1.14); };
  const onClick = (e: React.MouseEvent) => {
    if (gesture.current.moved > 7) return;
    const el = (e.target as Element).closest('[data-tid]') as HTMLElement | null;
    if (!el) { onSelect(null); return; }
    const id = el.getAttribute('data-tid')!;
    if (view.territories[id]?.terrain === 'water') { onSelect(null); return; }
    onSelect(id);
  };

  const sup = view.territories, players = view.players;
  const regionColor = useMemo(() => Object.fromEntries(view.map.regions.map((r) => [r.id, r.color])), [view.map.regions]);
  const order = useMemo(() => view.map.order.slice().sort((a, b) => sup[a].row - sup[b].row || sup[a].col - sup[b].col), [view.map.order, sup]);

  const cells = useMemo<Cell[]>(() => order.map((id) => {
    const t = sup[id];
    const g = geo.cells[id];
    const owner = t.owner ? players[t.owner] : undefined;
    const rel = !owner ? null : owner.id === meId ? 'me' : owner.relation === 'ally' || owner.relation === 'pact' ? 'ally' : 'enemy';
    const nbOwner = (i: number) => { const d = (t.row % 2 === 0 ? EVEN : ODD)[i]; return sup[`h${t.col + d[0]}_${t.row + d[1]}`]?.owner; };
    return { t, cx: g.x, cy: g.y, rel, borders: [0, 1, 2, 3, 4, 5].map((i) => !!t.owner && nbOwner(i) !== t.owner), faction: owner?.faction };
  }), [order, sup, players, geo, meId]);

  // Rijeke: od planine do najbližeg jezera kroz susjedne heksove (dekorativno, determinirano)
  const rivers = useMemo(() => {
    const out: Array<Array<{ x: number; y: number }>> = [];
    const adj = (id: string) => { const t = sup[id]; const d = t.row % 2 === 0 ? EVEN : ODD; return d.map(([dc, dr]) => `h${t.col + dc}_${t.row + dr}`).filter((n) => sup[n]); };
    const lakes = order.filter((id) => sup[id].terrain === 'water');
    const used = new Set<string>();
    for (const lake of lakes) {
      const prev = new Map<string, string>(); const q = [lake]; const seen = new Set([lake]); let src: string | null = null; const depth = new Map<string, number>([[lake, 0]]);
      while (q.length && !src) {
        const cur = q.shift()!;
        for (const n of adj(cur)) {
          if (seen.has(n) || sup[n].terrain === 'water') continue;
          seen.add(n); prev.set(n, cur); depth.set(n, (depth.get(cur) ?? 0) + 1); q.push(n);
          const d = depth.get(n) ?? 0;
          if (sup[n].terrain === 'mountains' && !used.has(n) && d >= 3 && d <= 6) { src = n; break; }
        }
      }
      if (!src) continue;
      used.add(src);
      const pts: Array<{ x: number; y: number }> = []; let cur: string | undefined = src;
      while (cur) { const g = geo.cells[cur]; pts.push({ x: g.x, y: g.y }); cur = prev.get(cur); }
      const lg = geo.cells[lake]; pts.push({ x: lg.x, y: lg.y + 4 });
      out.push(pts);
    }
    return out;
  }, [order, sup, geo]);
  const riverPath = (raw: Array<{ x: number; y: number }>) => {
    // okomiti pomak po točki (determinirano) pa glatka krivulja kroz sredine segmenata
    const pts = raw.map((p, i) => { if (i === 0 || i === raw.length - 1) return p; const a = raw[i - 1], b = raw[i + 1]; const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1; const o = (i % 2 ? 1 : -1) * 10; return { x: p.x - (dy / l) * o, y: p.y + (dx / l) * o }; });
    let d = `M${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    for (let i = 1; i < pts.length - 1; i++) { const m = { x: (pts[i].x + pts[i + 1].x) / 2, y: (pts[i].y + pts[i + 1].y) / 2 }; d += ` Q${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)} ${m.x.toFixed(1)} ${m.y.toFixed(1)}`; }
    const last = pts[pts.length - 1]; d += ` L${last.x.toFixed(1)} ${last.y.toFixed(1)}`;
    return d;
  };

  const showAllNames = tf.k / fitRef.current >= 2.4;

  const roads = useMemo(() => {
    const lines: Array<{ a: string; b: string; mine: boolean }> = [];
    const byOwner = new Map<string, string[]>();
    for (const id of order) { const t = sup[id]; if (t.owner && t.terrain !== 'water') byOwner.set(t.owner, [...(byOwner.get(t.owner) ?? []), id]); }
    const nb = (id: string) => { const t = sup[id]; const d = t.row % 2 === 0 ? EVEN : ODD; return d.map(([dc, dr]) => `h${t.col + dc}_${t.row + dr}`).filter((n) => sup[n]); };
    for (const [owner, ids] of byOwner) {
      const set = new Set(ids);
      const root = players[owner]?.capitalId && set.has(players[owner].capitalId) ? players[owner].capitalId : ids[0];
      const seen = new Set([root]); const q = [root];
      while (q.length) { const cur = q.shift()!; for (const n of nb(cur)) if (set.has(n) && !seen.has(n)) { seen.add(n); q.push(n); lines.push({ a: cur, b: n, mine: owner === meId }); } }
    }
    return lines;
  }, [order, sup, meId, players]);

  return (
    <div ref={wrap} className={`overflow-hidden touch-none select-none ${className}`} onWheel={onWheel} data-testid="hexmap">
      <svg width={box.w} height={box.h} className="block" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onClick={onClick} role="application" aria-label="Svjetska karta">
        <TerrainDefs />
        <defs>
          {(['attack', 'support', 'plan'] as const).map((k) => <marker key={k} id={`arr-${k}`} viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10Z" fill={k === 'attack' ? '#D1453B' : k === 'support' ? '#2F9E62' : '#7138E8'} /></marker>)}
        </defs>
        <g transform={`translate(${tf.x} ${tf.y}) scale(${tf.k})`}>
          {/* 1. sjena + bočne strane: otok lebdi direktno na bijeloj pozadini */}
          <g filter="url(#map-shadow)">
            {cells.map(({ t, cx, cy }) => t.terrain === 'water'
              ? <path key={t.id} d={pathFor(cx, cy + 4, SIZE - 0.4)} fill="#5A9FCB" />
              : <path key={t.id} d={pathFor(cx, cy + DEPTH, SIZE - 0.2)} fill="url(#tg-side)" />)}
            {cells.map(({ t, cx, cy }) => t.terrain === 'water' ? null : <path key={`m${t.id}`} d={pathFor(cx, cy + DEPTH / 2, SIZE - 0.2)} fill="url(#tg-side)" />)}
          </g>
          {cells.map((c) => <TopLayer key={c.t.id} c={c} selected={selectedId === c.t.id} overlay={overlay} regionColor={regionColor[c.t.regionId]} />)}
          <g pointerEvents="none" fill="none" strokeLinecap="round" strokeLinejoin="round">
            {rivers.map((pts, i) => <g key={i}><path d={riverPath(pts)} stroke="#4F97C9" strokeOpacity="0.55" strokeWidth="6.5" /><path d={riverPath(pts)} stroke="#7FBDE6" strokeWidth="4.2" /><path d={riverPath(pts)} stroke="#BFE3F7" strokeWidth="1.2" /></g>)}
            {roads.map((r, i) => { const a = geo.cells[r.a], b = geo.cells[r.b]; return r.mine ? <g key={i}><path d={`M${a.x} ${a.y + 12} L${b.x} ${b.y + 12}`} stroke="#fff" strokeOpacity="0.85" strokeWidth="4.5" /><path d={`M${a.x} ${a.y + 12} L${b.x} ${b.y + 12}`} stroke="#8A6A4B" strokeWidth="1.6" strokeDasharray="1 3.4" /></g> : null; })}
          </g>
          {cells.map((c) => <DecorLayer key={c.t.id} c={c} selected={selectedId === c.t.id} fog={c.t.visibility === 'far'} />)}
          {cells.map((c) => {
            const t = c.t;
            let armyLabel: string | undefined;
            if (t.terrain !== 'water') {
              if (t.visibility === 'own' && t.garrison) { const n = unitTotal(t.garrison); if (n > 0) armyLabel = `${n}`; }
              else if (t.armyEstimate?.range && t.armyEstimate.range.max > 0) armyLabel = `~${Math.round((t.armyEstimate.range.min + t.armyEstimate.range.max) / 2)}`;
              else if (t.armyEstimate?.exact) armyLabel = `${unitTotal(t.armyEstimate.exact)}`;
              else if (t.owner && t.visibility === 'far') armyLabel = '?';
            }
            return <MarkLayer key={t.id} c={c} selected={selectedId === t.id} showName={showAllNames || (t.isCapital && tf.k / fitRef.current > 1.2) || selectedId === t.id} armyLabel={armyLabel} fog={t.visibility === 'far'}
              mine={t.owner === meId} unsupplied={t.owner === meId && t.supplied === false} production={overlay === 'production'} hl={highlights?.[t.id]} />;
          })}
          <g pointerEvents="none">
            {arrows.map((a, i) => {
              const from = geo.cells[a.from], to = geo.cells[a.to]; if (!from || !to) return null;
              const dx = to.x - from.x, dy = to.y - from.y, len = Math.hypot(dx, dy) || 1;
              const sx = from.x + (dx / len) * 16, sy = from.y + (dy / len) * 16, ex = to.x - (dx / len) * 22, ey = to.y - (dy / len) * 22;
              const col = a.kind === 'attack' ? '#D1453B' : a.kind === 'support' ? '#2F9E62' : '#7138E8';
              return <g key={i}><line x1={sx} y1={sy} x2={ex} y2={ey} stroke="#fff" strokeWidth="9" strokeLinecap="round" opacity="0.9" /><line x1={sx} y1={sy} x2={ex} y2={ey} stroke={col} strokeWidth="4" strokeLinecap="round" markerEnd={`url(#arr-${a.kind})`} className="march" /></g>;
            })}
          </g>
          {cells.map(({ t, cx, cy }) => <path key={t.id} data-tid={t.id} data-testid={`hex-${t.id}`} className={t.terrain === 'water' ? undefined : 'map-hex'} d={pathFor(cx, cy, SIZE)} fill="transparent" />)}
        </g>
      </svg>
    </div>
  );
}

export const MAP_REL_LABELS: Array<{ key: keyof typeof REL; label: string }> = [{ key: 'me', label: 'Ti' }, { key: 'ally', label: 'Saveznik' }, { key: 'enemy', label: 'Protivnik' }, { key: 'neutral', label: 'Neutralno' }];
