import { Sparkle } from '@/components/art/Effects';

export function Logo({ size = 1 }: { size?: number }) {
  const s = (n: number) => n * size;
  return (
    <div className="relative inline-flex flex-col items-center select-none" style={{ fontSize: s(16) }} aria-label="Dominacija: Rise of Empires">
      <svg viewBox="0 0 100 60" width={s(70)} height={s(42)} className="-mb-3 relative z-10 drop-shadow" aria-hidden="true">
        <path d="M14 52 L8 14 L32 34 L50 4 L68 34 L92 14 L86 52Z" fill="#FFD23F" stroke="#B87400" strokeWidth="5" strokeLinejoin="round" />
        <path d="M14 52 H86 V58 Q50 64 14 58Z" fill="#F5B800" stroke="#B87400" strokeWidth="4" strokeLinejoin="round" />
        <circle cx="50" cy="42" r="6" fill="#E63946" stroke="#9F1239" strokeWidth="2.5" /><circle cx="30" cy="46" r="4" fill="#38BDF8" stroke="#0369A1" strokeWidth="2" /><circle cx="70" cy="46" r="4" fill="#22C55E" stroke="#15803D" strokeWidth="2" />
        <circle cx="8" cy="14" r="4.5" fill="#fff" stroke="#B87400" strokeWidth="2.5" /><circle cx="50" cy="4" r="4.5" fill="#fff" stroke="#B87400" strokeWidth="2.5" /><circle cx="92" cy="14" r="4.5" fill="#fff" stroke="#B87400" strokeWidth="2.5" />
      </svg>
      <div className="font-display font-black leading-none text-white relative z-0" style={{ fontSize: s(54), WebkitTextStroke: `${s(9)}px #2E1A8F`, paintOrder: 'stroke fill', textShadow: `0 ${s(5)}px 0 #2E1A8F`, letterSpacing: '-0.02em' }}>Dominacija</div>
      <div className="relative -mt-1" style={{ filter: 'drop-shadow(0 3px 0 rgba(46,26,143,.6))' }}>
        <div className="px-5 py-1 font-display font-extrabold text-[#5A3200] tracking-wide" style={{ fontSize: s(19), background: 'linear-gradient(#FFE680,#FFC933)', clipPath: 'polygon(0 0,100% 0,96% 50%,100% 100%,0 100%,4% 50%)', paddingLeft: s(26), paddingRight: s(26) }}>Rise of Empires</div>
      </div>
      <span className="absolute -right-2 top-6"><Sparkle size={s(18)} /></span>
    </div>
  );
}
