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
