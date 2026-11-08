import type { UnitType } from '@/engine/types';

const O = '#3B2A6B';
const sw = { stroke: O, strokeWidth: 2.4, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
const SKIN = '#FFD2A8';

export type CharacterKind = 'soldier' | 'archer' | 'knight' | 'spearman' | 'cavalry' | 'spy' | 'diplomat' | 'siege' | 'queen' | 'wizard';

function Face({ y = 34, brow = false }: { y?: number; brow?: boolean }) {
  return (<g>
    <circle cx="42" cy={y} r="2.5" fill="#1B1340" /><circle cx="58" cy={y} r="2.5" fill="#1B1340" />
    <circle cx="41.2" cy={y - 0.9} r="0.9" fill="#fff" /><circle cx="57.2" cy={y - 0.9} r="0.9" fill="#fff" />
    <path d={`M45 ${y + 8} Q50 ${y + 12} 55 ${y + 8}`} fill="none" stroke="#7B1E3A" strokeWidth="2" strokeLinecap="round" />
    <ellipse cx="37" cy={y + 6} rx="3.4" ry="2.2" fill="#FF8FAB" opacity="0.6" /><ellipse cx="63" cy={y + 6} rx="3.4" ry="2.2" fill="#FF8FAB" opacity="0.6" />
    {brow && <g stroke="#1B1340" strokeWidth="2" strokeLinecap="round"><path d={`M38 ${y - 7} L46 ${y - 5}`} /><path d={`M62 ${y - 7} L54 ${y - 5}`} /></g>}
  </g>);
}

function Body({ color, y = 52, legs = true }: { color: string; y?: number; legs?: boolean }) {
  return (<g {...sw}>
    {legs && <g><rect x="38" y={y + 26} width="10" height="14" rx="3" fill="#5A4A8A" /><rect x="52" y={y + 26} width="10" height="14" rx="3" fill="#5A4A8A" /><ellipse cx="42" cy={y + 41} rx="7" ry="3.4" fill="#7A4B22" /><ellipse cx="58" cy={y + 41} rx="7" ry="3.4" fill="#7A4B22" /></g>}
    <path d={`M33 ${y + 28} Q32 ${y} 50 ${y - 2} Q68 ${y} 67 ${y + 28}Z`} fill={color} />
    <path d={`M33 ${y + 20} H67`} stroke="#FFD23F" strokeWidth="3" />
  </g>);
}

function Person({ kind, color }: { kind: Exclude<CharacterKind, 'cavalry' | 'siege'>; color: string }) {
  const head = (
    <g {...sw}><circle cx="50" cy="35" r="17" fill={SKIN} /></g>
  );
  return (
    <g>
      {kind === 'archer' && <path d="M30 40 Q22 62 30 84" stroke="#8A5A2B" strokeWidth="3.6" fill="none" strokeLinecap="round" transform="translate(-6 -2)" />}
      <Body color={color} legs={kind !== 'wizard'} />
      {kind === 'wizard' && <path d="M28 82 Q50 96 72 82 L66 54 H34Z" fill="#7C4DFF" {...sw} />}
      {head}
      <Face brow={kind === 'knight'} />
      {kind === 'soldier' && (<g {...sw}><path d="M31 33 Q32 14 50 14 Q68 14 69 33 L60 28 H40Z" fill="#B7C0D6" /><rect x="47" y="20" width="6" height="12" rx="2" fill="#9AA5BF" /><circle cx="50" cy="14" r="3" fill="#EF4444" />
        <path d="M70 52 L70 84" stroke="#C0C8DA" strokeWidth="5" /><path d="M66 56 H74" stroke="#FFD23F" strokeWidth="3.4" /></g>)}
      {kind === 'soldier' && <g {...sw}><path d="M24 50 L38 52 L36 78 Q28 84 22 76Z" fill="#6D4DF7" /><circle cx="30" cy="64" r="3" fill="#FFD23F" stroke="none" /></g>}
      {kind === 'archer' && (<g {...sw}><path d="M31 33 Q30 16 50 12 Q70 16 69 33 Q60 24 50 26 Q40 24 31 33Z" fill="#4CAF50" /><path d="M64 14 L76 6 L72 18Z" fill="#EF4444" /><path d="M70 40 L74 82" stroke="#8A5A2B" strokeWidth="3" /><path d="M72 46 q10 14 2 30" fill="none" stroke="#C0A070" /></g>)}
      {kind === 'knight' && (<g {...sw}><path d="M30 38 Q28 12 50 10 Q72 12 70 38 L62 38 V30 H38 V38Z" fill="#CBD5E1" /><rect x="38" y="30" width="24" height="6" fill="#1B1340" stroke="none" /><path d="M50 10 Q48 -2 60 -2 Q56 4 56 12Z" fill="#EF4444" />
        <path d="M22 50 L40 52 L38 80 Q30 90 22 80Z" fill="#7C6CF0" /><path d="M26 58 L32 56 L36 62 L30 74 L24 66Z" fill="#FFD23F" stroke="none" opacity="0.9" /></g>)}
      {kind === 'spearman' && (<g {...sw}><path d="M31 34 Q31 16 50 14 Q69 16 69 34 Q60 26 50 28 Q40 26 31 34Z" fill="#A16207" /><path d="M72 8 V86" stroke="#8A5A2B" strokeWidth="3.4" /><path d="M72 0 L77 12 H67Z" fill="#E5E7EB" /></g>)}
      {kind === 'spy' && (<g {...sw}><path d="M28 56 Q22 14 50 12 Q78 14 72 56 L62 44 H38Z" fill="#3F3D56" /><path d="M36 30 H64 V42 H36Z" fill="#1B1340" stroke="none" /><ellipse cx="43" cy="36" rx="3" ry="2.2" fill="#fff" stroke="none" /><ellipse cx="57" cy="36" rx="3" ry="2.2" fill="#fff" stroke="none" /><circle cx="43.5" cy="36" r="1.2" fill="#1B1340" stroke="none" /><circle cx="57.5" cy="36" r="1.2" fill="#1B1340" stroke="none" /><path d="M70 60 L80 70 L76 74Z" fill="#CBD5E1" /></g>)}
      {kind === 'diplomat' && (<g {...sw}><path d="M30 28 H70 L66 20 H34Z" fill="#6D4DF7" /><path d="M34 20 Q50 2 66 20Z" fill="#8C73FF" /><circle cx="50" cy="10" r="3" fill="#FFD23F" /><rect x="64" y="58" width="16" height="22" rx="3" fill="#FDF3D7" /><path d="M67 64 h10 M67 70 h10 M67 76 h6" stroke="#8A5A2B" strokeWidth="1.6" fill="none" /></g>)}
      {kind === 'queen' && (<g {...sw}><path d="M30 30 Q28 6 50 8 Q72 6 70 30 Q66 20 50 22 Q34 20 30 30Z" fill="#E5484D" /><path d="M36 14 L40 4 L46 12 L50 2 L54 12 L60 4 L64 14Z" fill="#FFD23F" /></g>)}
      {kind === 'wizard' && (<g {...sw}><path d="M30 30 H70 L56 -2 H46Z" fill="#7C4DFF" /><path d="M30 30 H70" stroke="#FFD23F" strokeWidth="4" /><path d="M72 20 V86" stroke="#8A5A2B" strokeWidth="3.4" /><circle cx="72" cy="16" r="6" fill="#7DD3FC" /></g>)}
    </g>
  );
}

function Cavalry({ color }: { color: string }) {
  return (<g {...sw}>
    <path d="M20 66 Q22 52 40 52 H70 Q84 52 86 66 L84 84 H74 L72 74 H40 L38 84 H26Z" fill="#B5733A" />
    <path d="M70 52 Q82 40 88 28 L96 34 Q92 50 86 58Z" fill="#B5733A" /><circle cx="90" cy="32" r="1.8" fill="#1B1340" stroke="none" />
    <path d="M70 52 Q76 38 82 30" fill="none" stroke="#6B3E1A" strokeWidth="4" />
    <path d="M20 66 Q10 70 12 82" fill="none" stroke="#6B3E1A" strokeWidth="4" />
    <rect x="38" y="48" width="26" height="8" rx="3" fill={color} />
    <g transform="translate(-6 -18) scale(0.9)"><circle cx="54" cy="36" r="13" fill={SKIN} /><path d="M41 34 Q42 20 54 20 Q66 20 67 34 L60 30 H48Z" fill="#B7C0D6" /><circle cx="49" cy="38" r="2" fill="#1B1340" stroke="none" /><circle cx="59" cy="38" r="2" fill="#1B1340" stroke="none" /><path d="M50 44 Q54 47 58 44" fill="none" stroke="#7B1E3A" strokeWidth="1.6" /><path d="M44 50 Q54 44 64 50 L62 66 H46Z" fill={color} /></g>
    <path d="M78 24 V70" stroke="#8A5A2B" strokeWidth="3" transform="translate(-4 -4) rotate(18 78 40)" /><path d="M86 8 L90 20 L82 20Z" fill="#E5E7EB" transform="translate(-6 0) rotate(18 78 40)" />
  </g>);
}
function Siege({ color }: { color: string }) {
  return (<g {...sw}>
    <path d="M14 70 H86 L80 56 H20Z" fill="#B5733A" />
    <path d="M30 56 L56 22 M46 56 L60 22" stroke="#8A5A2B" strokeWidth="5" fill="none" />
    <path d="M26 44 L74 24" stroke="#A46B2F" strokeWidth="6" /><circle cx="22" cy="46" r="7" fill="#6B7280" /><path d="M74 24 q8 -4 10 4 q-4 8 -12 4Z" fill="#E5E7EB" />
    <circle cx="28" cy="78" r="10" fill="#8A5A2B" /><circle cx="28" cy="78" r="3.4" fill="#FFD23F" /><circle cx="72" cy="78" r="10" fill="#8A5A2B" /><circle cx="72" cy="78" r="3.4" fill="#FFD23F" />
    <path d="M40 56 V70 M60 56 V70" stroke={color} strokeWidth="5" />
  </g>);
}

export function Character({ kind, color = '#5B3DF6', size = 64, className = '' }: { kind: CharacterKind; color?: string; size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} role="img" aria-label={kind} xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="50" cy="92" rx="26" ry="5" fill="#000" opacity="0.16" />
      {kind === 'cavalry' ? <Cavalry color={color} /> : kind === 'siege' ? <Siege color={color} /> : <Person kind={kind} color={color} />}
    </svg>
  );
}

const UNIT_TO_KIND: Record<UnitType, CharacterKind> = { infantry: 'soldier', archers: 'archer', spearmen: 'spearman', knights: 'knight', cavalry: 'cavalry', siege: 'siege' };
export function UnitIcon({ unit, color, size = 40 }: { unit: UnitType; color?: string; size?: number }) {
  return <Character kind={UNIT_TO_KIND[unit]} color={color} size={size} />;
}
export const CHARACTER_KINDS: CharacterKind[] = ['soldier', 'archer', 'knight', 'spearman', 'cavalry', 'spy', 'diplomat', 'siege', 'queen', 'wizard'];
