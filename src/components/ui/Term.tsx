'use client';
import { useEffect, useRef, useState } from 'react';
import { GLOSSARY } from '@/lib/glossary';

/** Pojam s točkastim podcrtavanjem; dodir/hover otvara kratko objašnjenje. */
export function Term({ id, children }: { id: keyof typeof GLOSSARY | string; children?: React.ReactNode }) {
  const g = GLOSSARY[id];
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', close); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', esc); };
  }, [open]);
  if (!g) return <>{children}</>;
  return (
    <span ref={ref} className="relative inline" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((o) => !o); }} className="underline decoration-dotted decoration-neutral-400 underline-offset-[3px] cursor-help text-inherit font-inherit" aria-expanded={open} data-testid={`term-${id}`}>{children ?? g.term}</button>
      {open && <span role="tooltip" className="absolute z-[60] left-0 top-full mt-1.5 w-60 rounded-xl bg-ink text-white text-xs leading-snug p-3 font-normal normal-case tracking-normal text-left shadow-lg whitespace-normal">{g.text}</span>}
    </span>
  );
}
