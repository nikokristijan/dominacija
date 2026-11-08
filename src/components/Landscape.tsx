import { Building } from '@/components/art/Buildings';
import { Tree, Pine } from '@/components/art/Terrain';

/** Ilustrirana pozadina kraljevstva za dobrodošlicu: brežuljci, dvorci, šuma. */
export function Landscape({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMax slice" className={className} aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="ls-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#7C5CFF" /><stop offset="1" stopColor="#C9B8FF" /></linearGradient>
        <linearGradient id="ls-h1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#9BE15D" /><stop offset="1" stopColor="#5FBF45" /></linearGradient>
        <linearGradient id="ls-h2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#7ACB55" /><stop offset="1" stopColor="#3FA24A" /></linearGradient>
      </defs>
      <rect width="400" height="300" fill="url(#ls-sky)" />
      {[[40, 50, 1], [250, 30, 1.3], [340, 80, 0.8]].map(([x, y, s], i) => <g key={i} transform={`translate(${x} ${y}) scale(${s})`} opacity="0.9"><ellipse cx="0" cy="0" rx="26" ry="9" fill="#fff" /><ellipse cx="-14" cy="-6" rx="14" ry="9" fill="#fff" /><ellipse cx="10" cy="-9" rx="16" ry="11" fill="#fff" /></g>)}
      <path d="M-10 170 Q60 110 140 160 Q220 110 300 150 Q360 120 420 160 V300 H-10Z" fill="#B9A6F2" />
      <path d="M-10 200 Q80 150 170 195 Q260 150 340 190 Q390 170 420 195 V300 H-10Z" fill="url(#ls-h1)" />
      <path d="M-10 240 Q100 200 200 235 Q300 205 420 240 V300 H-10Z" fill="url(#ls-h2)" />
      <g transform="translate(8 128)"><Building type="capital" faction="red" size={74} /></g>
      <g transform="translate(300 142)"><Building type="capital" faction="blue" size={60} /></g>
      <g transform="translate(180 170)"><Building type="city" size={44} /></g>
      <g transform="translate(90 205) scale(1.5)"><Tree x={0} y={0} /><Pine x={14} y={4} /><Tree x={28} y={0} tone={1} /></g>
      <g transform="translate(300 215) scale(1.6)"><Pine x={0} y={0} /><Tree x={14} y={4} tone={2} /></g>
      <path d="M150 300 Q190 250 200 215" stroke="#E8C98A" strokeWidth="9" fill="none" strokeLinecap="round" opacity="0.8" />
    </svg>
  );
}
