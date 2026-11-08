import type { Mood } from '@/engine/types';

/**
 * Maskota: Pingvin Kralj. Jedan parametrički SVG s 8 raspoloženja (iste proporcije u svima).
 * Klase .peng-body / .peng-eyes pokreću CSS animacije disanja i treptanja (globals.css).
 */
const NAVY = '#33337D', NAVY_D = '#242462', NAVY_L = '#4A4AA0';
const BEAK = '#FFA62B', BEAK_D = '#E5821A';
const GOLD = '#FFD23F', GOLD_D = '#C98A0B';
const RED = '#E63946', RED_D = '#A61E2B';
const ARMOR = '#5B5BE0', ARMOR_L = '#8C8CFF', ARMOR_D = '#3C3CB0';

export const MOOD_LABELS: Record<Mood, string> = {
  neutral: 'Neutralan', happy: 'Sretan', celebrating: 'Pobjeda', angry: 'Ljutit', thinking: 'Razmišlja', surprised: 'Iznenađen', defeated: 'Poraz', confident: 'Samouvjeren',
};

function Eyes({ mood }: { mood: Mood }) {
  const L = 82, Rr = 118, y = 76;
  const eye = (cx: number, dx = 0, dy = 0, r = 9.5, pr = 5.2) => (
    <g>
      <ellipse cx={cx} cy={y} rx={r} ry={r + 1.5} fill="#fff" stroke={NAVY_D} strokeWidth="2" />
      <circle cx={cx + dx} cy={y + dy + 1} r={pr} fill="#1B1340" />
      <circle cx={cx + dx - 1.8} cy={y + dy - 1.2} r={1.9} fill="#fff" />
      <circle cx={cx + dx + 1.6} cy={y + dy + 2.4} r={0.9} fill="#fff" opacity="0.8" />
    </g>
  );
  const arc = (cx: number, up = true) => (
    <path d={up ? `M${cx - 9} ${y + 3} Q${cx} ${y - 10} ${cx + 9} ${y + 3}` : `M${cx - 9} ${y - 3} Q${cx} ${y + 9} ${cx + 9} ${y - 3}`} fill="none" stroke="#1B1340" strokeWidth="4.2" strokeLinecap="round" />
  );
  switch (mood) {
    case 'happy': case 'celebrating':
      return <g className="peng-eyes">{arc(L)}{arc(Rr)}</g>;
    case 'angry':
      return (
        <g>
          <g className="peng-eyes">{eye(L, 1.5, 1.5, 9, 5.4)}{eye(Rr, -1.5, 1.5, 9, 5.4)}</g>
          <path d={`M${L - 12} ${y - 12} L${L + 10} ${y - 4}`} stroke="#1B1340" strokeWidth="5" strokeLinecap="round" />
          <path d={`M${Rr + 12} ${y - 12} L${Rr - 10} ${y - 4}`} stroke="#1B1340" strokeWidth="5" strokeLinecap="round" />
          <path d={`M${L - 7} ${y - 7} L${L + 9} ${y - 1} L${L + 9} ${y - 4}Z`} fill="#fff" opacity="0" />
        </g>
      );
    case 'thinking':
      return (
        <g>
          <g className="peng-eyes">{eye(L, 3, -3, 9.5, 5)}{eye(Rr, 3, -3, 9.5, 5)}</g>
          <path d={`M${Rr - 10} ${y - 15} Q${Rr} ${y - 20} ${Rr + 10} ${y - 13}`} fill="none" stroke="#1B1340" strokeWidth="3.6" strokeLinecap="round" />
          <path d={`M${L - 9} ${y - 11} L${L + 9} ${y - 11}`} stroke="#1B1340" strokeWidth="3.6" strokeLinecap="round" />
        </g>
      );
    case 'surprised':
      return (
        <g>
          <g className="peng-eyes">{eye(L, 0, 0, 11, 3.6)}{eye(Rr, 0, 0, 11, 3.6)}</g>
          <path d={`M${L - 10} ${y - 16} Q${L} ${y - 22} ${L + 10} ${y - 16}`} fill="none" stroke="#1B1340" strokeWidth="3.6" strokeLinecap="round" />
          <path d={`M${Rr - 10} ${y - 16} Q${Rr} ${y - 22} ${Rr + 10} ${y - 16}`} fill="none" stroke="#1B1340" strokeWidth="3.6" strokeLinecap="round" />
        </g>
      );
    case 'defeated':
      return (
        <g>
          <g className="peng-eyes">
            <path d={`M${L - 9} ${y} Q${L} ${y + 7} ${L + 9} ${y}`} fill="none" stroke="#1B1340" strokeWidth="4.2" strokeLinecap="round" />
            <path d={`M${Rr - 9} ${y} Q${Rr} ${y + 7} ${Rr + 9} ${y}`} fill="none" stroke="#1B1340" strokeWidth="4.2" strokeLinecap="round" />
          </g>
          <path d={`M${L - 11} ${y - 8} L${L + 8} ${y - 13}`} stroke="#1B1340" strokeWidth="3.6" strokeLinecap="round" />
          <path d={`M${Rr + 11} ${y - 8} L${Rr - 8} ${y - 13}`} stroke="#1B1340" strokeWidth="3.6" strokeLinecap="round" />
          <path d={`M${L + 4} ${y + 8} q-3 8 0 12 q3 -4 0 -12z`} fill="#7DD3FC" stroke="#38BDF8" strokeWidth="1" />
        </g>
      );
    case 'confident':
      return (
        <g>
          <g className="peng-eyes">
            <path d={`M${L - 9} ${y - 1} Q${L} ${y - 3} ${L + 9} ${y - 1} L${L + 9} ${y + 4} Q${L} ${y + 10} ${L - 9} ${y + 4}Z`} fill="#fff" stroke={NAVY_D} strokeWidth="2" />
            <circle cx={L + 2} cy={y + 3} r="4.4" fill="#1B1340" /><circle cx={L + 0.6} cy={y + 1.8} r="1.5" fill="#fff" />
            <path d={`M${Rr - 9} ${y - 1} Q${Rr} ${y - 3} ${Rr + 9} ${y - 1} L${Rr + 9} ${y + 4} Q${Rr} ${y + 10} ${Rr - 9} ${y + 4}Z`} fill="#fff" stroke={NAVY_D} strokeWidth="2" />
            <circle cx={Rr + 2} cy={y + 3} r="4.4" fill="#1B1340" /><circle cx={Rr + 0.6} cy={y + 1.8} r="1.5" fill="#fff" />
          </g>
          <path d={`M${L - 10} ${y - 5} L${L + 9} ${y - 7}`} stroke="#1B1340" strokeWidth="3.6" strokeLinecap="round" />
          <path d={`M${Rr - 9} ${y - 12} Q${Rr} ${y - 15} ${Rr + 10} ${y - 8}`} fill="none" stroke="#1B1340" strokeWidth="3.6" strokeLinecap="round" />
        </g>
      );
    default:
      return <g className="peng-eyes">{eye(L)}{eye(Rr)}</g>;
  }
}

function Mouth({ mood }: { mood: Mood }) {
  const y = 105;
  switch (mood) {
    case 'happy': return <path d={`M92 ${y} Q100 ${y + 12} 108 ${y}`} fill="#7B1E3A" stroke="#4A0E22" strokeWidth="1.5" />;
    case 'celebrating': return <g><path d={`M88 ${y - 1} Q100 ${y + 20} 112 ${y - 1} Z`} fill="#7B1E3A" stroke="#4A0E22" strokeWidth="1.5" /><path d={`M93 ${y + 8} Q100 ${y + 4} 107 ${y + 8} Q100 ${y + 14} 93 ${y + 8}`} fill="#FF7A90" /></g>;
    case 'angry': return <path d={`M91 ${y + 6} Q100 ${y - 2} 109 ${y + 6}`} fill="none" stroke="#4A0E22" strokeWidth="3" strokeLinecap="round" />;
    case 'surprised': return <ellipse cx="100" cy={y + 5} rx="5" ry="7" fill="#7B1E3A" stroke="#4A0E22" strokeWidth="1.5" />;
    case 'defeated': return <path d={`M92 ${y + 8} Q100 ${y} 108 ${y + 8}`} fill="none" stroke="#4A0E22" strokeWidth="3" strokeLinecap="round" />;
    case 'confident': return <path d={`M94 ${y + 2} Q104 ${y + 9} 112 ${y - 2}`} fill="none" stroke="#4A0E22" strokeWidth="3" strokeLinecap="round" />;
    case 'thinking': return <path d={`M93 ${y + 4} L106 ${y + 3}`} stroke="#4A0E22" strokeWidth="3" strokeLinecap="round" />;
    default: return <path d={`M93 ${y + 2} Q100 ${y + 8} 107 ${y + 2}`} fill="none" stroke="#4A0E22" strokeWidth="2.6" strokeLinecap="round" />;
  }
}

function Props({ mood }: { mood: Mood }) {
  switch (mood) {
    case 'thinking':
      return (
        <g>
          <circle cx="164" cy="30" r="4" fill="#fff" stroke="#C4B5FD" strokeWidth="2" />
          <circle cx="152" cy="46" r="2.6" fill="#fff" stroke="#C4B5FD" strokeWidth="2" />
          <ellipse cx="176" cy="14" rx="20" ry="14" fill="#fff" stroke="#C4B5FD" strokeWidth="2.5" />
          <text x="176" y="21" textAnchor="middle" fontSize="20" fontWeight="800" fill="#5B3DF6" fontFamily="Nunito, system-ui">?</text>
        </g>
      );
    case 'surprised':
      return <g><text x="150" y="30" fontSize="26" fontWeight="900" fill="#F97316" fontFamily="Nunito, system-ui">!</text><path d="M148 64 l10 -4 M146 50 l10 -9" stroke="#F97316" strokeWidth="3" strokeLinecap="round" /></g>;
    case 'angry':
      return <g><path d="M60 28 l8 8 m0 -8 l-8 8" stroke="#EF4444" strokeWidth="3.4" strokeLinecap="round" /><path d="M146 30 q8 -8 14 0 q-8 2 -14 0" fill="#fff" opacity="0.8" /><path d="M156 18 q10 -4 14 6" stroke="#EF4444" strokeWidth="3" fill="none" strokeLinecap="round" /></g>;
    case 'celebrating':
      return (
        <g>
          {[[30, 24, '#FFD23F'], [172, 20, '#EC4899'], [20, 80, '#22C55E'], [182, 74, '#38BDF8'], [48, 6, '#F97316'], [150, 4, '#A78BFA']].map(([x, y, c], i) => (
            <g key={i} transform={`translate(${x} ${y}) rotate(${i * 30})`}><rect x="-4" y="-2" width="8" height="4" rx="1" fill={c as string} /></g>
          ))}
          <path d="M168 40 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3z" fill="#FFD23F" />
          <path d="M28 46 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z" fill="#fff" stroke="#FFD23F" strokeWidth="1" />
        </g>
      );
    case 'confident':
      return <path d="M150 52 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3z" fill="#FFD23F" />;
    case 'happy':
      return <g><path d="M160 40 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z" fill="#FFD23F" /></g>;
    default: return null;
  }
}

export function Penguin({ mood = 'neutral', size = 160, animated = true, className = '', title }: { mood?: Mood; size?: number; animated?: boolean; className?: string; title?: string }) {
  const up = mood === 'celebrating';
  const slump = mood === 'defeated';
  const blush = mood === 'happy' || mood === 'celebrating';
  const crownTilt = slump ? 'rotate(-10 100 40)' : mood === 'surprised' ? 'translate(0 -4)' : '';
  return (
    <svg viewBox="-10 -10 220 244" width={size} height={size * 1.11} className={`${animated ? 'peng-anim' : ''} ${className}`} role="img" aria-label={title ?? `Pingvin kralj: ${MOOD_LABELS[mood]}`} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="pg-body" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={NAVY_L} /><stop offset="1" stopColor={NAVY_D} /></linearGradient>
        <linearGradient id="pg-armor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={ARMOR_L} /><stop offset="1" stopColor={ARMOR_D} /></linearGradient>
        <linearGradient id="pg-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFE680" /><stop offset="1" stopColor={GOLD} /></linearGradient>
        <linearGradient id="pg-cape" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#F25563" /><stop offset="1" stopColor={RED_D} /></linearGradient>
        <radialGradient id="pg-shadow"><stop offset="0" stopColor="#000" stopOpacity="0.28" /><stop offset="1" stopColor="#000" stopOpacity="0" /></radialGradient>
      </defs>
      <ellipse cx="100" cy="218" rx="62" ry="9" fill="url(#pg-shadow)" />
      <g className="peng-body" transform={slump ? 'translate(0 6)' : ''}>
        {/* Plašt */}
        <path d="M56 112 Q30 160 28 206 Q100 224 172 206 Q170 160 144 112 Z" fill="url(#pg-cape)" stroke={RED_D} strokeWidth="3" strokeLinejoin="round" />
        <path d="M36 196 Q100 214 164 196 L172 206 Q100 224 28 206Z" fill={RED_D} opacity="0.55" />
        {/* Noge */}
        <path d="M66 204 q-6 12 6 14 q22 2 24 -8 q0 -8 -10 -8z" fill={BEAK} stroke={BEAK_D} strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M134 204 q6 12 -6 14 q-22 2 -24 -8 q0 -8 10 -8z" fill={BEAK} stroke={BEAK_D} strokeWidth="2.5" strokeLinejoin="round" />
        {/* Tijelo */}
        <ellipse cx="100" cy="150" rx="54" ry="64" fill="url(#pg-body)" stroke={NAVY_D} strokeWidth="3" />
        <path d="M100 98 Q146 108 148 160 Q146 196 100 208 Q56 196 52 160 Q54 108 100 98Z" fill="#F4F1FF" opacity="0" />
        {/* Oklop */}
        <path d="M68 116 Q100 102 132 116 L128 168 Q100 184 72 168 Z" fill="url(#pg-armor)" stroke={ARMOR_D} strokeWidth="3" strokeLinejoin="round" />
        <path d="M74 122 Q100 111 126 122" fill="none" stroke="#C9C9FF" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
        <path d="M70 160 Q100 176 130 160" fill="none" stroke="url(#pg-gold)" strokeWidth="4" strokeLinecap="round" />
        <path d="M100 126 l6 11 12 2 -9 8 3 12 -12 -6 -12 6 3 -12 -9 -8 12 -2z" fill="url(#pg-gold)" stroke={GOLD_D} strokeWidth="1.6" strokeLinejoin="round" transform="translate(0 -2) scale(1)" />
        {/* Ramenjaci */}
        <ellipse cx="62" cy="122" rx="13" ry="10" fill="url(#pg-armor)" stroke={ARMOR_D} strokeWidth="2.6" transform="rotate(-20 62 122)" />
        <ellipse cx="138" cy="122" rx="13" ry="10" fill="url(#pg-armor)" stroke={ARMOR_D} strokeWidth="2.6" transform="rotate(20 138 122)" />
        <circle cx="62" cy="121" r="3" fill={GOLD} /><circle cx="138" cy="121" r="3" fill={GOLD} />
        {/* Lijevo krilo + štit */}
        <g transform={up ? 'rotate(-22 52 128)' : slump ? 'rotate(14 52 128)' : ''}>
          <path d="M50 124 Q24 138 26 170 Q40 172 52 156 Q58 138 56 126Z" fill={NAVY} stroke={NAVY_D} strokeWidth="3" strokeLinejoin="round" />
          <path d="M18 138 L46 134 L48 168 Q32 186 16 168Z" fill="#6D4DF7" stroke="#2B1B8E" strokeWidth="3" strokeLinejoin="round" />
          <path d="M22 144 L42 141 L43 164 Q32 176 21 164Z" fill="#8C73FF" />
          <path d="M24 158 l2 -9 5 5 5 -6 5 5 2 -5 0 10z" fill="url(#pg-gold)" stroke={GOLD_D} strokeWidth="1.3" strokeLinejoin="round" transform="translate(-2 -3)" />
        </g>
        {/* Desno krilo + mač */}
        <g transform={up ? 'rotate(-62 148 128)' : slump ? 'rotate(-6 148 128) translate(0 6)' : mood === 'confident' ? 'rotate(-12 148 128)' : ''}>
          <path d="M150 124 Q176 136 174 170 Q160 172 148 158 Q142 138 144 126Z" fill={NAVY} stroke={NAVY_D} strokeWidth="3" strokeLinejoin="round" />
          <g transform="rotate(12 172 150) translate(-4 10)">
            <rect x="168" y="76" width="9" height="76" rx="2.5" fill="#E8EEF7" stroke="#8091AE" strokeWidth="2.4" />
            <path d="M170 80 L172.5 66 L175 80Z" fill="#E8EEF7" stroke="#8091AE" strokeWidth="2" strokeLinejoin="round" />
            <line x1="172.5" y1="84" x2="172.5" y2="146" stroke="#fff" strokeWidth="2" opacity="0.8" />
            <rect x="158" y="150" width="29" height="7" rx="3.5" fill="url(#pg-gold)" stroke={GOLD_D} strokeWidth="2" />
            <rect x="169.5" y="156" width="6" height="16" rx="2" fill="#8B2E1F" stroke="#5A1A10" strokeWidth="2" />
            <circle cx="172.5" cy="176" r="5" fill="url(#pg-gold)" stroke={GOLD_D} strokeWidth="2" />
          </g>
        </g>
        {/* Glava */}
        <circle cx="100" cy="76" r="48" fill="url(#pg-body)" stroke={NAVY_D} strokeWidth="3" />
        <path d="M58 82 Q60 60 78 58 Q100 70 122 58 Q140 60 142 82 Q146 112 100 118 Q54 112 58 82Z" fill="#FFFFFF" stroke="#DCD6F5" strokeWidth="1.5" />
        {blush && <g><ellipse cx="66" cy="96" rx="8" ry="5" fill="#FF8FAB" opacity="0.7" /><ellipse cx="134" cy="96" rx="8" ry="5" fill="#FF8FAB" opacity="0.7" /></g>}
        {mood === 'angry' && <g opacity="0.35"><path d="M58 82 Q60 60 78 58 Q100 70 122 58 Q140 60 142 82 Q146 112 100 118 Q54 112 58 82Z" fill="#EF4444" /></g>}
        <Eyes mood={mood} />
        {/* Kljun */}
        <path d="M86 90 Q100 82 114 90 Q111 106 100 109 Q89 106 86 90Z" fill={BEAK} stroke={BEAK_D} strokeWidth="2.4" strokeLinejoin="round" />
        <path d="M92 90 Q100 86 108 90" fill="none" stroke="#FFD08A" strokeWidth="2.4" strokeLinecap="round" />
        <Mouth mood={mood} />
        {/* Kruna */}
        <g transform={crownTilt}>
          <path d="M66 42 L70 14 L86 30 L100 6 L114 30 L130 14 L134 42 Q100 50 66 42Z" fill="url(#pg-gold)" stroke={GOLD_D} strokeWidth="3" strokeLinejoin="round" />
          <path d="M66 42 Q100 52 134 42 L133 50 Q100 60 67 50Z" fill={GOLD} stroke={GOLD_D} strokeWidth="2.6" strokeLinejoin="round" />
          <circle cx="100" cy="43" r="4.8" fill="#E63946" stroke="#9F1239" strokeWidth="1.6" />
          <circle cx="84" cy="44" r="3.2" fill="#38BDF8" stroke="#0369A1" strokeWidth="1.3" />
          <circle cx="116" cy="44" r="3.2" fill="#22C55E" stroke="#15803D" strokeWidth="1.3" />
          <circle cx="70" cy="14" r="3" fill="#fff" stroke={GOLD_D} strokeWidth="1.4" /><circle cx="100" cy="6" r="3.4" fill="#fff" stroke={GOLD_D} strokeWidth="1.4" /><circle cx="130" cy="14" r="3" fill="#fff" stroke={GOLD_D} strokeWidth="1.4" />
        </g>
      </g>
      <Props mood={mood} />
      {title && <title>{title}</title>}
    </svg>
  );
}

export default Penguin;
