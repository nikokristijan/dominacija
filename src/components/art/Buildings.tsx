import { FACTIONS } from '@/engine/config';
import type { BuildingType, FactionId } from '@/engine/types';

const O = '#3B2A6B';
const sw = { stroke: O, strokeWidth: 2.4, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
const Shadow = () => <ellipse cx="50" cy="90" rx="38" ry="7" fill="#000" opacity="0.16" />;
const Flag = ({ x, y, c = '#EF4444' }: { x: number; y: number; c?: string }) => (<g><path d={`M${x} ${y} V${y - 16}`} stroke={O} strokeWidth="2.2" strokeLinecap="round" /><path d={`M${x} ${y - 16} h11 l-3 4.5 3 4.5 h-11Z`} fill={c} stroke={O} strokeWidth="1.8" strokeLinejoin="round" /></g>);
const Win = ({ x, y }: { x: number; y: number }) => <rect x={x} y={y} width="5" height="7" rx="2.4" fill="#FFE680" stroke={O} strokeWidth="1.6" />;

export function Building({ type, faction = 'red', level = 1, size = 64, className = '' }: { type: BuildingType; faction?: FactionId; level?: number; size?: number; className?: string }) {
  const f = FACTIONS[faction];
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} role="img" aria-label={type} xmlns="http://www.w3.org/2000/svg">
      <Shadow />
      {type === 'capital' && (<g {...sw}>
        <rect x="14" y="52" width="72" height="34" rx="3" fill="#D9D2EC" />
        <rect x="14" y="52" width="72" height="6" fill="#EFEAFB" />
        <path d="M14 52 h6 v-4 h6 v4 h6 v-4 h6 v4 h6 v-4 h6 v4 h6 v-4 h6 v4 h6 v-4 h6 v4" fill="none" />
        <rect x="6" y="38" width="20" height="48" rx="2" fill="#E6E0F5" />
        <path d="M3 40 L16 18 L29 40Z" fill={f.color} /><Win x={13.5} y={50} />
        <rect x="74" y="38" width="20" height="48" rx="2" fill="#E6E0F5" />
        <path d="M71 40 L84 18 L97 40Z" fill={f.color} /><Win x={82.5} y={50} />
        <rect x="34" y="26" width="32" height="60" rx="2" fill="#F2EEFB" />
        <path d="M30 28 L50 4 L70 28Z" fill={f.color} />
        <path d="M50 4 L50 -2" /><Win x={42} y={38} /><Win x={53} y={38} />
        <path d="M42 86 V72 a8 8 0 0 1 16 0 V86Z" fill="#7A4B22" />
        <path d="M50 72 V86" stroke="#4A2C10" strokeWidth="1.6" />
        <circle cx="50" cy="19" r="4" fill="#FFD23F" />
      </g>)}
      {type === 'capital' && <Flag x={50} y={4} c={f.color} />}
      {type === 'city' && (<g {...sw}>
        <rect x="8" y="58" width="26" height="28" rx="2" fill="#FFE6C2" /><path d="M5 60 L21 40 L37 60Z" fill="#F0605D" /><Win x={18.5} y={66} />
        <rect x="64" y="56" width="28" height="30" rx="2" fill="#FFE6C2" /><path d="M61 58 L78 36 L95 58Z" fill="#EF4444" /><Win x={75.5} y={66} />
        <rect x="34" y="40" width="30" height="46" rx="2" fill="#F5E9D4" /><path d="M31 42 L49 16 L67 42Z" fill="#F97316" /><Win x={40} y={52} /><Win x={53} y={52} />
        <path d="M43 86 V74 a6 6 0 0 1 12 0 V86Z" fill="#7A4B22" /><Flag x={49} y={16} c="#5B3DF6" />
      </g>)}
      {type === 'farm' && (<g {...sw}>
        <path d="M50 46 L92 66 L50 88 L8 66Z" fill="#8BD04F" />
        <path d="M50 52 L82 67 L50 83 L18 67Z" fill="#F4D14D" stroke="none" />
        {[0, 1, 2, 3].map((i) => <path key={i} d={`M${22 + i * 5} ${69 - i * 2.4} L${50 + i * 4} ${54 + i * 4}`} stroke="#C99B1D" strokeWidth="1.8" fill="none" />)}
        <rect x="56" y="30" width="26" height="22" rx="2" fill="#E5484D" /><path d="M53 32 L69 18 L85 32Z" fill="#A61E2B" /><rect x="64" y="40" width="10" height="12" fill="#FDE7C3" />
        <g transform="translate(26 34)"><rect x="-3" y="-2" width="6" height="22" fill="#F7EFD9" /><path d="M-3 -2 L0 -10 L3 -2Z" fill="#B5733A" />
          <g transform="translate(0 4)"><path d="M0 0 L-14 -5 L-10 -10Z M0 0 L14 5 L10 10Z M0 0 L-5 14 L-10 10Z M0 0 L5 -14 L10 -10Z" fill="#fff" /></g></g>
      </g>)}
      {type === 'mine' && (<g {...sw}>
        <path d="M6 86 Q8 46 34 34 Q50 24 66 34 Q92 46 94 86Z" fill="#9D8FBF" />
        <path d="M22 50 Q34 36 48 34" fill="none" stroke="#C9BEE6" strokeWidth="3" />
        <path d="M34 86 V62 a16 16 0 0 1 32 0 V86Z" fill="#2B1B4A" />
        <path d="M30 86 V60 M70 86 V60 M30 60 H70" stroke="#A46B2F" strokeWidth="5" />
        <rect x="68" y="70" width="22" height="14" rx="2" fill="#6B7280" /><circle cx="73" cy="86" r="4" fill="#374151" /><circle cx="86" cy="86" r="4" fill="#374151" />
        <path d="M70 70 l4 -6 l5 4 l5 -5 l4 7Z" fill="#E5E7EB" />
        <path d="M18 74 L32 62 M18 74 l-4 -6 M26 66 l8 4" stroke="#7C4A1D" strokeWidth="3" fill="none" />
      </g>)}
      {type === 'fortress' && (<g {...sw}>
        <rect x="8" y="48" width="84" height="38" rx="2" fill="#C9C3DD" />
        <path d="M8 48 h8 v-5 h8 v5 h8 v-5 h8 v5 h8 v-5 h8 v5 h8 v-5 h8 v5 h8 v-5 h8 v5" fill="#DAD5EA" />
        <rect x="2" y="30" width="24" height="56" rx="2" fill="#B8B1D2" /><path d="M0 30 h6 v-6 h6 v6 h4 v-6 h6 v6 h4" fill="#CFC9E5" />
        <rect x="74" y="30" width="24" height="56" rx="2" fill="#B8B1D2" /><path d="M72 30 h6 v-6 h6 v6 h4 v-6 h6 v6 h4" fill="#CFC9E5" />
        <path d="M38 86 V66 a12 12 0 0 1 24 0 V86Z" fill="#4A2C10" /><path d="M38 70 H62 M44 86 V62 M56 86 V62" stroke="#2A1608" strokeWidth="1.6" fill="none" />
        <Win x={11} y={44} /><Win x={83} y={44} /><Flag x={50} y={48} c="#EF4444" />
        {level > 1 && <g>{Array.from({ length: Math.min(3, level) }).map((_, i) => <circle key={i} cx={34 + i * 16} cy="40" r="3.4" fill="#FFD23F" />)}</g>}
      </g>)}
      {type === 'barracks' && (<g {...sw}>
        <rect x="10" y="46" width="80" height="40" rx="3" fill="#F5E4C8" />
        <path d="M4 48 L50 18 L96 48Z" fill="#E5484D" /><path d="M20 40 L50 22 L80 40" fill="none" stroke="#fff" strokeWidth="4" strokeOpacity="0.8" />
        <path d="M40 86 V64 a10 10 0 0 1 20 0 V86Z" fill="#4A2C10" />
        <g transform="translate(50 36)"><path d="M-8 -6 L8 6 M8 -6 L-8 6" stroke={O} strokeWidth="5" /><path d="M-8 -6 L8 6 M8 -6 L-8 6" stroke="#fff" strokeWidth="2.4" /></g>
        <rect x="14" y="60" width="14" height="18" rx="2" fill="#6D4DF7" /><path d="M16 66 h10 M16 72 h10" stroke="#FFD23F" strokeWidth="2" />
        <Flag x={86} y={50} c="#EF4444" />
      </g>)}
      {type === 'market' && (<g {...sw}>
        <rect x="14" y="52" width="72" height="34" rx="2" fill="#F5E4C8" />
        <path d="M8 50 H92 L86 30 H14Z" fill="#fff" />
        {[0, 1, 2, 3, 4, 5].map((i) => <path key={i} d={`M${14 + i * 12} 30 h12 l1 20 h-14Z`} fill={i % 2 ? '#fff' : '#EF4444'} stroke="none" />)}
        <path d="M8 50 H92 L86 30 H14Z" fill="none" />
        <path d="M8 50 q5 8 10 0 q5 8 10 0 q5 8 10 0 q5 8 10 0 q5 8 10 0 q5 8 10 0 q5 8 10 0 q4 6 5 0" fill="#EF4444" />
        <circle cx="30" cy="70" r="6" fill="#F97316" /><circle cx="42" cy="72" r="6" fill="#84CC16" /><circle cx="54" cy="70" r="6" fill="#EF4444" />
        <rect x="64" y="64" width="16" height="16" rx="2" fill="#B5733A" /><circle cx="72" cy="72" r="4" fill="#FFD23F" />
      </g>)}
      {type === 'research_center' && (<g {...sw}>
        <rect x="26" y="46" width="48" height="40" rx="3" fill="#E6E0F5" />
        <path d="M22 48 Q50 6 78 48Z" fill="#6D4DF7" /><path d="M32 40 Q50 18 68 40" fill="none" stroke="#C4B5FD" strokeWidth="3" />
        <circle cx="50" cy="56" r="8" fill="#FFE680" /><path d="M46 56 h8 M50 52 v8" stroke={O} strokeWidth="1.8" />
        <path d="M70 26 L90 14 L94 20 L74 32Z" fill="#FFD23F" /><circle cx="92" cy="17" r="3" fill="#7DD3FC" />
        <path d="M38 86 V72 a6 6 0 0 1 12 0 V86Z" fill="#4A2C10" /><rect x="56" y="68" width="12" height="12" rx="2" fill="#F97316" /><path d="M58 72 h8 M58 76 h8" stroke="#fff" strokeWidth="1.6" />
      </g>)}
    </svg>
  );
}
export const BUILDING_TYPES: BuildingType[] = ['farm', 'mine', 'city', 'fortress', 'barracks', 'market', 'research_center', 'capital'];
