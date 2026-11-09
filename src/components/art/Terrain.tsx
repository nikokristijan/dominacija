import type { ReactNode } from 'react';
import { createRng } from '@/engine/rng';
import { hexCorners } from '@/engine/hex';
import type { TerrainType } from '@/engine/types';

/** Paleta tla: svijetla → tamna (gornja ploha) i boja bočne strane (zemlja). Bez crnih obruba — plošni, plastični izgled. */
export const TERRAIN_COLORS: Record<TerrainType, { light: string; dark: string; edge: string }> = {
  plains: { light: '#A9CF5C', dark: '#86B445', edge: '#6F5337' },
  forest: { light: '#80B15A', dark: '#5F9544', edge: '#6A4E35' },
  mountains: { light: '#A7B58E', dark: '#8A9A78', edge: '#665A4A' },
  desert: { light: '#E8D49A', dark: '#D7BB72', edge: '#9C8052' },
  water: { light: '#9DD3F0', dark: '#66B0DE', edge: '#4F93C2' },
  special: { light: '#C2AAEE', dark: '#9C80DB', edge: '#6A4E9C' },
};

export function TerrainDefs() {
  return (
    <defs>
      {(Object.keys(TERRAIN_COLORS) as TerrainType[]).map((t) => (
        <linearGradient key={t} id={`tg-${t}`} x1="0" y1="0" x2="0.35" y2="1">
          <stop offset="0" stopColor={TERRAIN_COLORS[t].light} /><stop offset="1" stopColor={TERRAIN_COLORS[t].dark} />
        </linearGradient>
      ))}
      <linearGradient id="tg-side" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#7B5C3E" /><stop offset="1" stopColor="#5A412B" /></linearGradient>
      <radialGradient id="tg-glow"><stop offset="0" stopColor="#fff" stopOpacity="0.85" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></radialGradient>
      <filter id="map-shadow" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="26" stdDeviation="22" floodColor="#171717" floodOpacity="0.20" /></filter>
    </defs>
  );
}

export const Pine = ({ x, y, s = 1, tone = 0 }: { x: number; y: number; s?: number; tone?: number }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <ellipse cx="0" cy="9" rx="6" ry="1.8" fill="#000" opacity="0.14" />
    <rect x="-1.1" y="5" width="2.2" height="4.5" fill="#6B4A2B" />
    <path d="M0 -13 L5.6 -4 H2.8 L7 3 H-7 L-2.8 -4 H-5.6Z" fill={['#2D6A37', '#34753D', '#285F32'][tone % 3]} />
    <path d="M0 -13 L-5.6 -4 H-2.8 L-7 3 H0Z" fill="#fff" opacity="0.10" />
    <path d="M0 -13 L5.6 -4 H2.8 L7 3 H0Z" fill="#000" opacity="0.10" />
  </g>
);
export const Tree = ({ x, y, s = 1, tone = 0 }: { x: number; y: number; s?: number; tone?: number }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <ellipse cx="0" cy="8" rx="6.5" ry="2" fill="#000" opacity="0.14" />
    <rect x="-1.1" y="2" width="2.2" height="6" fill="#6B4A2B" />
    <circle cx="0" cy="-2" r="6.4" fill={['#3F8A3F', '#4B9645', '#367A38'][tone % 3]} />
    <circle cx="-2" cy="-4" r="3.4" fill="#fff" opacity="0.14" />
  </g>
);
export const Peak = ({ x, y, s = 1, snow = true }: { x: number; y: number; s?: number; snow?: boolean }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <ellipse cx="2" cy="9" rx="17" ry="3" fill="#000" opacity="0.12" />
    <path d="M-15 8 L-3 -13 L3 -5 L8 -10 L16 8Z" fill="#838EA8" />
    <path d="M-3 -13 L3 -5 L-2 8 L-15 8Z" fill="#A5AFC6" />
    <path d="M8 -10 L16 8 L5 8 L3 -5Z" fill="#6F7A94" />
    {snow && <path d="M-3 -13 L-7.6 -5.4 L-4 -6.8 L-1.4 -4 L0.8 -7 L3 -5Z" fill="#F4F7FB" />}
  </g>
);
export const Dune = ({ x, y, s = 1 }: { x: number; y: number; s?: number }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <path d="M-15 5 Q-7 -9 2 -1 Q8 -6 15 5Z" fill="#D3B567" />
    <path d="M-15 5 Q-7 -9 2 -1 Q-4 1 -6 5Z" fill="#F1E0AE" opacity="0.75" />
  </g>
);
export const Cactus = ({ x, y, s = 1 }: { x: number; y: number; s?: number }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`} fill="#5E9A55">
    <rect x="-2.2" y="-9" width="4.4" height="16" rx="2.2" /><path d="M-2.2 -1H-5.6V-6a1.7 1.7 0 0 1 3.4 0z" /><path d="M2.2 1H5.6V-4a1.7 1.7 0 0 0-3.4 0z" />
  </g>
);
export const Crystal = ({ x, y, s = 1, color = '#C9A8FF' }: { x: number; y: number; s?: number; color?: string }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <ellipse cx="0" cy="8" rx="11" ry="2.4" fill="#000" opacity="0.14" />
    <path d="M-7 8 L-9 -2 L-5 -10 L-1 -2 L-2 8Z" fill={color} />
    <path d="M0 8 L-2 -8 L2 -16 L6 -8 L5 8Z" fill="#EBDDFF" />
    <path d="M0 8 L-2 -8 L2 -16 L2 8Z" fill={color} opacity="0.9" />
    <path d="M5 8 L5 0 L9 -6 L11 2 L10 8Z" fill={color} />
  </g>
);
export const Hut = ({ x, y, s = 1 }: { x: number; y: number; s?: number }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <ellipse cx="0" cy="6" rx="7" ry="1.8" fill="#000" opacity="0.14" />
    <rect x="-4.5" y="-1.5" width="9" height="7" fill="#F1E6D2" /><path d="M-6 -1.5 L0 -7.5 L6 -1.5Z" fill="#B9503B" /><rect x="-1" y="1.5" width="2" height="4" fill="#8A6A4C" />
  </g>
);
export const Tuft = ({ x, y }: { x: number; y: number }) => <path d={`M${x - 3} ${y} q1 -5 2 0 q1 -6 2 0 q1 -5 2 0`} fill="none" stroke="#5E9A33" strokeWidth="1.2" strokeLinecap="round" />;
export const Flower = ({ x, y, c }: { x: number; y: number; c: string }) => (<g><circle cx={x} cy={y} r="1.7" fill={c} /><circle cx={x} cy={y} r="0.6" fill="#FFF3B0" /></g>);
export const Wave = ({ x, y, s = 1 }: { x: number; y: number; s?: number }) => <path transform={`translate(${x} ${y}) scale(${s})`} d="M-8 0 q2 -3 4 0 t4 0 t4 0 t4 0" fill="none" stroke="#fff" strokeOpacity="0.8" strokeWidth="1.5" strokeLinecap="round" />;

/** Dekoracije teritorija — pozicije determinirane sjemenom (id). `r` = polumjer heksa. */
export function terrainDecor(terrain: TerrainType, seed: string, r: number): ReactNode {
  const rng = createRng(seed);
  const k = r / 40;
  const j = (a: number) => (rng.next() * 2 - 1) * a * k;
  switch (terrain) {
    case 'plains': return (<g>
      <Tuft x={-16 * k + j(4)} y={4 * k + j(4)} />
      {rng.next() < 0.45 && <><Hut x={-12 * k + j(3)} y={-8 * k} s={k * 1.1} /><Hut x={-2 * k + j(3)} y={-2 * k} s={k * 0.85} /></>}
    </g>);
    case 'forest': return (<g>
      <Pine x={-17 * k + j(2)} y={-4 * k + j(2)} s={k * 1.05} tone={0} /><Pine x={-6 * k + j(2)} y={-12 * k + j(2)} s={k * 1.15} tone={1} /><Pine x={9 * k + j(2)} y={-9 * k + j(2)} s={k * 1.05} tone={2} />
      <Pine x={19 * k + j(2)} y={-2 * k + j(2)} s={k * 0.95} tone={0} /><Tree x={-12 * k + j(2)} y={10 * k + j(2)} s={k} tone={1} /><Pine x={2 * k + j(2)} y={7 * k + j(2)} s={k * 1.2} tone={1} /><Pine x={14 * k + j(2)} y={12 * k + j(2)} s={k} tone={2} />
    </g>);
    case 'mountains': return (<g>
      <Pine x={-20 * k} y={10 * k} s={k * 0.8} tone={2} /><Peak x={-6 * k + j(3)} y={2 * k} s={k * 1.55} /><Peak x={15 * k + j(2)} y={8 * k} s={k * 1.0} /><Pine x={21 * k} y={-6 * k} s={k * 0.75} />
    </g>);
    case 'desert': return (<g>
      <Dune x={-9 * k + j(3)} y={-6 * k} s={k * 1.4} /><Dune x={12 * k + j(3)} y={10 * k} s={k * 1.2} /><Cactus x={16 * k + j(2)} y={-8 * k + j(2)} s={k} /><Cactus x={-18 * k} y={12 * k} s={k * 0.75} />
    </g>);
    case 'water': return (<g>
      <Wave x={-8 * k + j(3)} y={-10 * k} s={k * 1.2} /><Wave x={10 * k + j(3)} y={2 * k} s={k * 1.2} /><Wave x={-12 * k} y={14 * k} s={k * 1.1} />
    </g>);
    case 'special': return (<g>
      <circle cx="0" cy="0" r={26 * k} fill="url(#tg-glow)" opacity="0.5" />
      <Crystal x={-6 * k} y={4 * k} s={k * 1.3} /><Crystal x={12 * k} y={8 * k} s={k * 0.8} color="#9BC4FF" />
    </g>);
  }
}

export function TerrainTile({ terrain, size = 120, seed = 'x' }: { terrain: TerrainType; size?: number; seed?: string }) {
  const r = 50;
  const c = TERRAIN_COLORS[terrain];
  const pts = (cy: number) => hexCorners(60, cy, r).map((p) => p.join(',')).join(' ');
  return (
    <svg viewBox="0 0 120 124" width={size} height={size * 1.033} role="img" aria-label={terrain} xmlns="http://www.w3.org/2000/svg">
      <TerrainDefs />
      <polygon points={pts(68)} fill={c.edge} />
      <polygon points={pts(60)} fill={`url(#tg-${terrain})`} />
      <g transform="translate(60 60)">{terrainDecor(terrain, seed, r)}</g>
    </svg>
  );
}
