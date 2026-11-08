import { FACTIONS } from '@/engine/config';
import type { FactionId } from '@/engine/types';

function Emblem({ id, fill = '#fff', stroke }: { id: string; fill?: string; stroke: string }) {
  const p = { fill, stroke, strokeWidth: 1.8, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
  switch (id) {
    case 'crown': return <g><path d="M-12 8 L-14 -8 L-6 -1 L0 -12 L6 -1 L14 -8 L12 8Z" {...p} /><rect x="-12" y="8" width="24" height="5" rx="1.5" {...p} /></g>;
    case 'lily': return <g><path d="M0 -14 Q-7 -6 -2 4 L-2 10 L2 10 L2 4 Q7 -6 0 -14Z" {...p} /><path d="M-3 2 Q-14 -6 -13 4 Q-12 10 -4 8Z" {...p} /><path d="M3 2 Q14 -6 13 4 Q12 10 4 8Z" {...p} /><rect x="-8" y="8" width="16" height="4" rx="1.5" {...p} /></g>;
    case 'eagle': return <g><path d="M0 -6 L-4 -12 L0 -9 L4 -12Z" {...p} /><path d="M0 -8 L-16 -10 Q-12 -2 -8 2 Q-5 10 0 13 Q5 10 8 2 Q12 -2 16 -10Z" {...p} /><path d="M0 -3 L0 10" stroke={stroke} strokeWidth="1.6" fill="none" /></g>;
    case 'swords': return <g><path d="M-12 -12 L10 10 M12 -12 L-10 10" stroke={stroke} strokeWidth="6" strokeLinecap="round" /><path d="M-12 -12 L10 10 M12 -12 L-10 10" stroke={fill} strokeWidth="3" strokeLinecap="round" /><path d="M-13 6 L-6 13 M13 6 L6 13" stroke={stroke} strokeWidth="5" strokeLinecap="round" /><path d="M-13 6 L-6 13 M13 6 L6 13" stroke={fill} strokeWidth="2.4" strokeLinecap="round" /></g>;
    case 'deer': return <g><path d="M-5 -2 L-9 -12 M-9 -12 L-14 -10 M-9 -12 L-10 -17 M5 -2 L9 -12 M9 -12 L14 -10 M9 -12 L10 -17" stroke={fill} strokeWidth="2.4" fill="none" strokeLinecap="round" /><path d="M-8 -4 Q-9 6 0 13 Q9 6 8 -4 Q0 -7 -8 -4Z" {...p} /><circle cx="-3" cy="2" r="1.4" fill={stroke} /><circle cx="3" cy="2" r="1.4" fill={stroke} /><ellipse cx="0" cy="9" rx="2.4" ry="1.8" fill={stroke} /></g>;
    case 'octopus': return <g><path d="M-10 0 Q-10 -13 0 -13 Q10 -13 10 0 Q10 3 8 4 L-8 4 Q-10 3 -10 0Z" {...p} /><path d="M-8 4 Q-12 10 -8 13 M-3 4 Q-5 11 -1 13 M3 4 Q5 11 1 13 M8 4 Q12 10 8 13" fill="none" stroke={fill} strokeWidth="3" strokeLinecap="round" /><circle cx="-4" cy="-3" r="1.6" fill={stroke} /><circle cx="4" cy="-3" r="1.6" fill={stroke} /></g>;
    case 'flower': return <g>{[0, 72, 144, 216, 288].map((a) => <ellipse key={a} cx="0" cy="-8" rx="5" ry="7" transform={`rotate(${a})`} {...p} />)}<circle r="4.4" fill="#FFD23F" stroke={stroke} strokeWidth="1.8" /></g>;
    case 'wolf': return <g><path d="M-12 -12 L-6 -6 L6 -6 L12 -12 L12 2 Q10 12 0 14 Q-10 12 -12 2Z" {...p} /><circle cx="-5" cy="0" r="1.6" fill={stroke} /><circle cx="5" cy="0" r="1.6" fill={stroke} /><path d="M-3 8 L0 11 L3 8Z" fill={stroke} /></g>;
    default: return null;
  }
}

export function FactionBanner({ faction, size = 56, className = '' }: { faction: FactionId; size?: number; className?: string }) {
  const f = FACTIONS[faction];
  const id = `fb-${faction}`;
  return (
    <svg viewBox="0 0 64 88" width={size} height={size * 1.375} className={className} role="img" aria-label={f.name} xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={f.light} /><stop offset="0.25" stopColor={f.color} /><stop offset="1" stopColor={f.dark} /></linearGradient></defs>
      <rect x="4" y="3" width="56" height="8" rx="4" fill="#FFD23F" stroke="#B87400" strokeWidth="2.4" />
      <circle cx="6" cy="7" r="4.5" fill="#FFD23F" stroke="#B87400" strokeWidth="2.2" /><circle cx="58" cy="7" r="4.5" fill="#FFD23F" stroke="#B87400" strokeWidth="2.2" />
      <path d="M9 11 H55 V62 L32 80 L9 62Z" fill={`url(#${id})`} stroke={f.dark} strokeWidth="3" strokeLinejoin="round" />
      <path d="M14 16 H50 V58 L32 72 L14 58Z" fill="none" stroke="#FFD23F" strokeWidth="1.8" opacity="0.85" strokeLinejoin="round" />
      <g transform="translate(32 40)"><Emblem id={f.emblem} stroke={f.dark} /></g>
      <path d="M12 14 L12 40" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" opacity="0.35" />
    </svg>
  );
}

/** Mali krug s bojom i amblemom — za oznake na karti i popise igrača. */
export function FactionBadge({ faction, size = 28 }: { faction: FactionId; size?: number }) {
  const f = FACTIONS[faction];
  return (
    <svg viewBox="-20 -20 40 40" width={size} height={size} role="img" aria-label={f.name} xmlns="http://www.w3.org/2000/svg">
      <circle r="18" fill={f.color} stroke={f.dark} strokeWidth="3" />
      <circle r="14" fill="none" stroke="#fff" strokeOpacity="0.4" strokeWidth="1.5" />
      <g transform="scale(0.78)"><Emblem id={f.emblem} stroke={f.dark} /></g>
    </svg>
  );
}
