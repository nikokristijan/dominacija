/** Efekti: bitka, istraživanje, osvajanje, gradnja — koriste se i na karti i u izvješćima. */
export function ClashEffect({ size = 96 }: { size?: number }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label="Bitka" xmlns="http://www.w3.org/2000/svg">
      <defs><radialGradient id="fx-clash"><stop offset="0" stopColor="#FFF7B0" /><stop offset="0.5" stopColor="#FFB800" stopOpacity="0.85" /><stop offset="1" stopColor="#FF6A00" stopOpacity="0" /></radialGradient></defs>
      <circle cx="50" cy="50" r="42" fill="url(#fx-clash)" />
      <g stroke="#3B2A6B" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round">
        <path d="M22 78 L70 30 L78 22 L80 30 L72 38 L30 80Z" fill="#E8EEF7" transform="rotate(8 50 50)" />
        <path d="M78 78 L30 30 L22 22 L20 30 L28 38 L70 80Z" fill="#E8EEF7" transform="rotate(-8 50 50)" />
        <path d="M18 70 L30 82 M82 70 L70 82" stroke="#FFD23F" strokeWidth="6" />
      </g>
      <path d="M50 10 l4 10 10 -2 -6 8 8 8 -11 0 -1 11 -6 -9 -9 6 2 -11 -11 -3 10 -6z" fill="#fff" opacity="0.85" />
    </svg>
  );
}
export function ResearchEffect({ size = 96 }: { size?: number }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label="Istraživanje" xmlns="http://www.w3.org/2000/svg">
      <defs><radialGradient id="fx-res"><stop offset="0" stopColor="#E9D5FF" /><stop offset="1" stopColor="#7C3AED" stopOpacity="0" /></radialGradient></defs>
      <circle cx="50" cy="50" r="46" fill="url(#fx-res)" />
      <g stroke="#3B2A6B" strokeWidth="2.4" strokeLinejoin="round"><path d="M14 62 L50 72 L86 62 V38 L50 48 L14 38Z" fill="#FDF3D7" /><path d="M50 48 V72" /><path d="M24 46 L40 50 M24 52 L40 56" stroke="#B87400" strokeWidth="1.8" /><path d="M60 50 L76 46 M60 56 L76 52" stroke="#B87400" strokeWidth="1.8" /></g>
      {[[30, 24], [72, 20], [50, 12], [84, 40]].map(([x, y], i) => <path key={i} transform={`translate(${x} ${y})`} d="M0 -6 l2 4 4 2 -4 2 -2 4 -2 -4 -4 -2 4 -2z" fill="#FFE680" />)}
    </svg>
  );
}
export function ExpandEffect({ size = 96 }: { size?: number }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label="Osvajanje teritorija" xmlns="http://www.w3.org/2000/svg">
      <g stroke="#3B2A6B" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round">
        <path d="M30 14 V86" /><path d="M30 14 h30 l-6 9 6 9 H30Z" fill="#EF4444" />
        <path d="M10 86 Q50 72 90 86" fill="#8BD04F" />
        <path d="M40 66 h30 m-8 -8 l8 8 -8 8" stroke="#FFD23F" strokeWidth="5" fill="none" />
      </g>
    </svg>
  );
}
export function BuildEffect({ size = 96 }: { size?: number }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label="Izgradnja" xmlns="http://www.w3.org/2000/svg">
      <g stroke="#3B2A6B" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round">
        <path d="M14 86 H86 M24 86 V30 M76 86 V30 M24 30 H76 M24 58 H76 M24 86 L76 30 M76 86 L24 30" fill="none" stroke="#A46B2F" strokeWidth="5" />
        <path d="M52 40 L74 18 L82 26 L60 48Z" fill="#E8EEF7" /><path d="M46 46 L56 56" stroke="#8A5A2B" strokeWidth="6" />
      </g>
    </svg>
  );
}
export function Sparkle({ size = 20, color = '#FFD23F' }: { size?: number; color?: string }) {
  return <svg viewBox="-10 -10 20 20" width={size} height={size} aria-hidden="true"><path d="M0 -9 L2.4 -2.4 L9 0 L2.4 2.4 L0 9 L-2.4 2.4 L-9 0 L-2.4 -2.4Z" fill={color} stroke="#B87400" strokeWidth="1" strokeLinejoin="round" /></svg>;
}

/** Ikone svjetskih događaja (SVG, bez emojija). */
export function EventIcon({ type, size = 44 }: { type: string; size?: number }) {
  const s = '#3B2A6B';
  const common = { stroke: s, strokeWidth: 2.4, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} role="img" aria-label={type} xmlns="http://www.w3.org/2000/svg">
      {type === 'none' && <g {...common}><circle cx="24" cy="24" r="9" fill="#FFD23F" />{[0, 45, 90, 135, 180, 225, 270, 315].map((a) => <path key={a} d="M24 8 V12" transform={`rotate(${a} 24 24)`} />)}</g>}
      {type === 'drought' && <g {...common}><path d="M4 38 H44" /><path d="M8 38 Q14 28 20 38 Q26 24 34 38" fill="#F2C65C" /><circle cx="36" cy="14" r="6" fill="#FFB020" /><path d="M16 22 l4 4 -4 4 M12 26 h12" stroke="#B45309" /></g>}
      {type === 'gold_rush' && <g {...common}><path d="M6 40 L24 8 L42 40Z" fill="#9D8FBF" /><circle cx="24" cy="28" r="8" fill="#FFD23F" /><path d="M20 28 l3 3 6 -6" /></g>}
      {type === 'plague' && <g {...common}><circle cx="24" cy="22" r="14" fill="#E8F5D0" /><circle cx="18" cy="21" r="3.4" fill={s} /><circle cx="30" cy="21" r="3.4" fill={s} /><path d="M18 31 h12 M21 31 v5 M27 31 v5" /></g>}
      {type === 'rebellion' && <g {...common}><path d="M24 6 C28 14 38 18 38 30 a14 14 0 0 1 -28 0 C10 24 15 22 17 16 C19 20 21 21 23 20 C22 14 22 10 24 6Z" fill="#F97316" /><path d="M24 22 C27 27 31 28 31 33 a7 7 0 0 1 -14 0 C17 29 22 27 24 22Z" fill="#FFD23F" /></g>}
      {type === 'trade_boom' && <g {...common}><path d="M6 14 H12 L16 32 H36 L40 18 H14" fill="#fff" /><circle cx="19" cy="38" r="3.4" fill="#FFD23F" /><circle cx="33" cy="38" r="3.4" fill="#FFD23F" /><path d="M20 24 h14" /></g>}
      {type === 'winter' && <g {...common}><path d="M24 6 V42 M8 15 L40 33 M8 33 L40 15" stroke="#38BDF8" /><circle cx="24" cy="24" r="4" fill="#E0F2FE" /></g>}
      {type === 'storm' && <g {...common}><path d="M12 28 a8 8 0 0 1 2 -15 a10 10 0 0 1 19 3 a7 7 0 0 1 -1 12Z" fill="#CBD5E1" /><path d="M24 24 l-5 9 h6 l-3 9 9 -13 h-6 l3 -5Z" fill="#FFD23F" /></g>}
      {type === 'harvest' && <g {...common}><path d="M24 42 V14" /><path d="M24 20 Q14 18 14 10 Q22 12 24 20Z M24 20 Q34 18 34 10 Q26 12 24 20Z M24 30 Q14 28 14 20 Q22 22 24 30Z M24 30 Q34 28 34 20 Q26 22 24 30Z" fill="#FFC933" /></g>}
    </svg>
  );
}
