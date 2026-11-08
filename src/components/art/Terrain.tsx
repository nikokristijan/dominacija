import type { ReactNode } from 'react';
import { createRng } from '@/engine/rng';
import { hexCorners } from '@/engine/hex';
import type { TerrainType } from '@/engine/types';

export const TERRAIN_COLORS: Record<TerrainType, { light: string; dark: string; edge: string }> = {
  plains: { light: '#B6EB7A', dark: '#7FCB4B', edge: '#4E9A2E' },
  forest: { light: '#6FC66A', dark: '#3C9650', edge: '#216B37' },
  mountains: { light: '#CFC3E6', dark: '#9D8FBF', edge: '#6B5A94' },
  desert: { light: '#FBE39A', dark: '#EDBB4F', edge: '#B98A25' },
  water: { light: '#7DDBFF', dark: '#2FA4E8', edge: '#1673B4' },
  special: { light: '#E0B4FF', dark: '#A56BF0', edge: '#6D3CC0' },
};

/** Gradijenti za sve terene (jednom po SVG-u). */
export function TerrainDefs() {
  return (
    <defs>
      {(Object.keys(TERRAIN_COLORS) as TerrainType[]).map((t) => (
        <linearGradient key={t} id={`tg-${t}`} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor={TERRAIN_COLORS[t].light} /><stop offset="1" stopColor={TERRAIN_COLORS[t].dark} />
        </linearGradient>
      ))}
      <radialGradient id="tg-glow"><stop offset="0" stopColor="#fff" stopOpacity="0.9" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></radialGradient>
    </defs>
  );
}

const OUT = 'rgba(40,24,80,0.55)';
export const Tree = ({ x, y, s = 1, tone = 0 }: { x: number; y: number; s?: number; tone?: number }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <rect x="-1.6" y="2" width="3.2" height="6" rx="1" fill="#8A5A2B" stroke={OUT} strokeWidth="0.9" />
    <circle cx="0" cy="-2" r="7" fill={['#2E9A4B', '#3AAE55', '#278A44'][tone % 3]} stroke={OUT} strokeWidth="1" />
    <circle cx="-2" cy="-4" r="3.4" fill="#5CCB6E" opacity="0.8" />
  </g>
);
export const Pine = ({ x, y, s = 1 }: { x: number; y: number; s?: number }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <rect x="-1.4" y="4" width="2.8" height="5" fill="#7A4E24" stroke={OUT} strokeWidth="0.8" />
    <path d="M0 -12 L6 -3 H3 L8 4 H-8 L-3 -3 H-6Z" fill="#2A8F4F" stroke={OUT} strokeWidth="1" strokeLinejoin="round" />
    <path d="M0 -12 L-4 -5 L0 -7Z" fill="#5CCB6E" opacity="0.7" />
  </g>
);
export const Peak = ({ x, y, s = 1, snow = true }: { x: number; y: number; s?: number; snow?: boolean }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <path d="M-14 8 L-2 -12 L4 -4 L8 -9 L16 8Z" fill="#8F7FB6" stroke={OUT} strokeWidth="1.2" strokeLinejoin="round" />
    <path d="M-2 -12 L4 -4 L-2 8 L-14 8Z" fill="#A99CCB" />
    {snow && <path d="M-2 -12 L-6.4 -4.6 L-3 -5.8 L-1 -3.4 L1 -6 L4 -4Z" fill="#fff" stroke={OUT} strokeWidth="0.8" strokeLinejoin="round" />}
  </g>
);
export const Dune = ({ x, y, s = 1 }: { x: number; y: number; s?: number }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <path d="M-14 4 Q-6 -8 2 0 Q8 -5 14 4Z" fill="#F2C65C" stroke={OUT} strokeWidth="1" strokeLinejoin="round" />
    <path d="M-8 2 Q-3 -3 1 1" fill="none" stroke="#FFF0B8" strokeWidth="1.6" strokeLinecap="round" />
  </g>
);
export const Cactus = ({ x, y, s = 1 }: { x: number; y: number; s?: number }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`} stroke={OUT} strokeWidth="1" strokeLinejoin="round">
    <rect x="-2.5" y="-9" width="5" height="17" rx="2.5" fill="#4FB36A" />
    <path d="M-2.5 -1 H-6 V-6 a1.8 1.8 0 0 1 3.6 0" fill="#4FB36A" /><path d="M2.5 1 H6 V-4 a1.8 1.8 0 0 0 -3.6 0" fill="#4FB36A" />
  </g>
);
export const Crystal = ({ x, y, s = 1, color = '#F0ABFC' }: { x: number; y: number; s?: number; color?: string }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`} stroke="#5B21B6" strokeWidth="1" strokeLinejoin="round">
    <path d="M-7 8 L-9 -2 L-5 -10 L-1 -2 L-2 8Z" fill={color} />
    <path d="M0 8 L-2 -8 L2 -16 L6 -8 L5 8Z" fill="#fff" fillOpacity="0.85" />
    <path d="M0 8 L-2 -8 L2 -16 L2 8Z" fill={color} />
    <path d="M5 8 L5 0 L9 -6 L11 2 L10 8Z" fill={color} />
  </g>
);
export const Tuft = ({ x, y }: { x: number; y: number }) => <path d={`M${x - 3} ${y} q1 -5 2 0 q1 -6 2 0 q1 -5 2 0`} fill="none" stroke="#3E8E2A" strokeWidth="1.3" strokeLinecap="round" />;
export const Flower = ({ x, y, c }: { x: number; y: number; c: string }) => (<g><circle cx={x} cy={y} r="2.1" fill={c} stroke={OUT} strokeWidth="0.7" /><circle cx={x} cy={y} r="0.8" fill="#FFF3B0" /></g>);
export const Wave = ({ x, y, s = 1 }: { x: number; y: number; s?: number }) => <path transform={`translate(${x} ${y}) scale(${s})`} d="M-8 0 q2 -3 4 0 t4 0 t4 0 t4 0" fill="none" stroke="#fff" strokeOpacity="0.85" strokeWidth="1.6" strokeLinecap="round" />;

/** Dekoracije jednog teritorija — pozicije su deterministične prema sjemenu (id). `r` = polumjer heksa. */
export function terrainDecor(terrain: TerrainType, seed: string, r: number): ReactNode {
  const rng = createRng(seed);
  const k = r / 40;
  const j = (a: number) => (rng.next() * 2 - 1) * a * k;
  switch (terrain) {
    case 'plains': return (<g>
      <ellipse cx={j(8)} cy={10 * k + j(3)} rx={18 * k} ry={8 * k} fill="#A6E36A" opacity="0.6" />
      <Tuft x={-18 * k + j(4)} y={-8 * k + j(4)} /><Tuft x={16 * k + j(4)} y={-14 * k + j(3)} /><Tuft x={-8 * k + j(4)} y={14 * k + j(3)} /><Tuft x={20 * k + j(3)} y={12 * k + j(3)} />
      <Flower x={-14 * k + j(3)} y={6 * k + j(3)} c="#FF6FA5" /><Flower x={10 * k + j(3)} y={-4 * k + j(3)} c="#FFE04D" /><Flower x={4 * k + j(3)} y={16 * k} c="#fff" />
    </g>);
    case 'forest': return (<g>
      <Tree x={-14 * k + j(3)} y={-6 * k + j(3)} s={k * 1.1} tone={0} /><Pine x={10 * k + j(3)} y={-10 * k + j(3)} s={k * 1.05} />
      <Tree x={-2 * k + j(3)} y={8 * k + j(2)} s={k * 1.25} tone={1} /><Pine x={-20 * k + j(2)} y={12 * k + j(2)} s={k * 0.85} /><Tree x={18 * k + j(2)} y={10 * k + j(2)} s={k * 0.95} tone={2} />
    </g>);
    case 'mountains': return (<g>
      <Peak x={-8 * k + j(3)} y={2 * k} s={k * 1.5} /><Peak x={14 * k + j(2)} y={8 * k} s={k * 1.0} /><Peak x={-18 * k} y={12 * k} s={k * 0.7} snow={false} />
    </g>);
    case 'desert': return (<g>
      <Dune x={-8 * k + j(3)} y={-6 * k} s={k * 1.4} /><Dune x={12 * k + j(3)} y={10 * k} s={k * 1.2} /><Cactus x={16 * k + j(2)} y={-8 * k + j(2)} s={k} /><Cactus x={-18 * k} y={12 * k} s={k * 0.75} />
    </g>);
    case 'water': return (<g>
      <Wave x={-8 * k + j(3)} y={-10 * k} s={k * 1.2} /><Wave x={10 * k + j(3)} y={2 * k} s={k * 1.2} /><Wave x={-12 * k} y={14 * k} s={k * 1.1} />
      {rng.next() < 0.28 && <g transform={`translate(${12 * k} ${-14 * k}) scale(${k})`}><path d="M-8 2 H8 L5 7 H-5Z" fill="#B5733A" stroke={OUT} strokeWidth="1" strokeLinejoin="round" /><path d="M0 -10 V2 M0 -10 L7 -1 H0Z" fill="#fff" stroke={OUT} strokeWidth="1" strokeLinejoin="round" /></g>}
    </g>);
    case 'special': return (<g>
      <circle cx="0" cy="0" r={26 * k} fill="url(#tg-glow)" opacity="0.55" />
      <Crystal x={-6 * k} y={4 * k} s={k * 1.3} /><Crystal x={12 * k} y={8 * k} s={k * 0.8} color="#93C5FD" />
      <path transform={`translate(${14 * k} ${-12 * k}) scale(${k})`} d="M0 -5 l1.6 3.4 3.4 1.6 -3.4 1.6 -1.6 3.4 -1.6 -3.4 -3.4 -1.6 3.4 -1.6z" fill="#fff" />
      <path transform={`translate(${-16 * k} ${-10 * k}) scale(${k * 0.7})`} d="M0 -5 l1.6 3.4 3.4 1.6 -3.4 1.6 -1.6 3.4 -1.6 -3.4 -3.4 -1.6 3.4 -1.6z" fill="#fff" />
    </g>);
  }
}

export function TerrainTile({ terrain, size = 120, seed = 'x' }: { terrain: TerrainType; size?: number; seed?: string }) {
  const r = 50;
  const pts = hexCorners(60, 60, r).map((p) => p.join(',')).join(' ');
  const c = TERRAIN_COLORS[terrain];
  return (
    <svg viewBox="0 0 120 124" width={size} height={size * 1.033} role="img" aria-label={terrain} xmlns="http://www.w3.org/2000/svg">
      <TerrainDefs />
      <polygon points={hexCorners(60, 68, r).map((p) => p.join(',')).join(' ')} fill={c.edge} />
      <polygon points={pts} fill={`url(#tg-${terrain})`} stroke={c.edge} strokeWidth="3" strokeLinejoin="round" />
      <g transform="translate(60 60)">{terrainDecor(terrain, seed, r)}</g>
    </svg>
  );
}
