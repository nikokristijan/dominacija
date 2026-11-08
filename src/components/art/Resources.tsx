import type { ResourceType } from '@/engine/types';

export type ResourceIconName = ResourceType | 'population' | 'stability' | 'command';
const S = '#4B2E83';

export function ResourceIcon({ name, size = 28, className = '' }: { name: ResourceIconName; size?: number; className?: string }) {
  const id = `ri-${name}`;
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} className={className} role="img" aria-label={name} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={`${id}-g`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFE680" /><stop offset="1" stopColor="#F5A300" /></linearGradient>
        <linearGradient id={`${id}-i`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#E3E8F2" /><stop offset="1" stopColor="#8D97AD" /></linearGradient>
        <linearGradient id={`${id}-w`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#C98A4B" /><stop offset="1" stopColor="#8A5426" /></linearGradient>
        <linearGradient id={`${id}-p`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#9B7BFF" /><stop offset="1" stopColor="#5B3DF6" /></linearGradient>
      </defs>
      {name === 'gold' && (<g>
        <ellipse cx="24" cy="42" rx="14" ry="3" fill="#000" opacity="0.15" />
        <circle cx="24" cy="23" r="17" fill={`url(#${id}-g)`} stroke="#B87400" strokeWidth="2.6" />
        <circle cx="24" cy="23" r="12" fill="none" stroke="#C98200" strokeWidth="2" />
        <path d="M16 28 L17.5 19 L21 23 L24 16 L27 23 L30.5 19 L32 28Z" fill="#FFF3B0" stroke="#B87400" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M13 14 Q18 8 26 7" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" fill="none" opacity="0.7" />
      </g>)}
      {name === 'food' && (<g stroke="#B87400" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
        <path d="M24 44 L24 14" stroke="#9A7A12" strokeWidth="3" fill="none" />
        {[10, 17, 24, 31].map((y, i) => (<g key={y}>
          <path d={`M24 ${y + 4} Q${12 - i} ${y} ${14 - i} ${y - 8} Q${23} ${y - 5} 24 ${y + 4}Z`} fill="#FFC933" />
          <path d={`M24 ${y + 4} Q${36 + i} ${y} ${34 + i} ${y - 8} Q${25} ${y - 5} 24 ${y + 4}Z`} fill="#FFD95A" />
        </g>))}
        <path d="M24 12 Q20 6 24 2 Q28 6 24 12Z" fill="#FFC933" />
      </g>)}
      {name === 'iron' && (<g strokeLinejoin="round" stroke={S} strokeWidth="2.4">
        <ellipse cx="24" cy="42" rx="16" ry="3" fill="#000" opacity="0.15" stroke="none" />
        <path d="M6 30 L14 22 H34 L42 30 V36 H6Z" fill={`url(#${id}-i)`} />
        <path d="M6 30 H42" stroke="#fff" opacity="0.6" strokeWidth="2" />
        <path d="M12 20 L18 13 H32 L37 20Z" fill={`url(#${id}-i)`} />
        <path d="M14 18 H30" stroke="#fff" opacity="0.7" strokeWidth="2" strokeLinecap="round" />
      </g>)}
      {name === 'wood' && (<g strokeLinejoin="round">
        <ellipse cx="24" cy="42" rx="17" ry="3" fill="#000" opacity="0.15" />
        <rect x="6" y="14" width="30" height="24" rx="3" fill={`url(#${id}-w)`} stroke="#5B3A1A" strokeWidth="2.4" />
        <ellipse cx="36" cy="26" rx="8" ry="12" fill="#E8B27A" stroke="#5B3A1A" strokeWidth="2.4" />
        <ellipse cx="36" cy="26" rx="4.4" ry="7.2" fill="none" stroke="#B87A3C" strokeWidth="2" />
        <circle cx="36" cy="26" r="1.2" fill="#B87A3C" />
        <path d="M10 20 H26 M10 30 H24" stroke="#6B4423" strokeWidth="1.6" strokeLinecap="round" opacity="0.7" />
      </g>)}
      {name === 'influence' && (<g strokeLinejoin="round">
        <ellipse cx="24" cy="43" rx="14" ry="2.6" fill="#000" opacity="0.15" />
        <path d="M24 3 L41 12 V28 Q41 38 24 45 Q7 38 7 28 V12Z" fill={`url(#${id}-p)`} stroke="#2E1A8F" strokeWidth="2.6" />
        <path d="M14 30 L15.5 19 L20 24 L24 15 L28 24 L32.5 19 L34 30Z" fill="url(#ri-influence-g)" stroke="#B87400" strokeWidth="1.8" />
        <defs><linearGradient id="ri-influence-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFE680" /><stop offset="1" stopColor="#F5A300" /></linearGradient></defs>
        <path d="M12 12 L24 6" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" opacity="0.5" />
      </g>)}
      {name === 'population' && (<g strokeLinejoin="round" stroke={S} strokeWidth="2.2">
        <circle cx="32" cy="16" r="6" fill="#FFD2A8" /><path d="M21 40 Q21 25 32 25 Q43 25 43 40Z" fill="#38BDF8" />
        <circle cx="16" cy="19" r="7" fill="#FFD2A8" /><path d="M3 42 Q3 27 16 27 Q29 27 29 42Z" fill="#F97316" />
      </g>)}
      {name === 'stability' && (<g strokeLinejoin="round" strokeLinecap="round">
        <circle cx="24" cy="24" r="19" fill="#4ADE80" stroke="#15803D" strokeWidth="2.6" />
        <ellipse cx="17" cy="20" rx="2.8" ry="3.6" fill="#14532D" /><ellipse cx="31" cy="20" rx="2.8" ry="3.6" fill="#14532D" />
        <path d="M14 29 Q24 40 34 29" fill="none" stroke="#14532D" strokeWidth="3" />
        <path d="M12 12 Q18 6 26 6" stroke="#fff" strokeWidth="2.6" fill="none" opacity="0.6" />
      </g>)}
      {name === 'command' && (<g strokeLinejoin="round">
        <path d="M24 3 L41 10 V25 Q41 36 24 45 Q7 36 7 25 V10Z" fill="#FFD23F" stroke="#B87400" strokeWidth="2.6" />
        <path d="M24 13 l3.2 6.6 7.2 1 -5.2 5 1.3 7.2 -6.5 -3.4 -6.5 3.4 1.3 -7.2 -5.2 -5 7.2 -1z" fill="#5B3DF6" stroke="#2E1A8F" strokeWidth="1.6" />
      </g>)}
    </svg>
  );
}
