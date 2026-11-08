'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useGame } from './GameProvider';

const TABS = [['/kraljevstvo', 'Gospodarstvo'], ['/tehnologija', 'Istraživanje'], ['/ljestvica', 'Poredak']] as const;

/** Tri srodna pregleda (gospodarstvo, istraživanje, poredak) pod jednom stavkom navigacije. */
export function KingdomTabs() {
  const g = useGame();
  const path = usePathname();
  return (
    <div className="scroll-x" role="tablist" aria-label="Kraljevstvo">
      {TABS.map(([h, l]) => { const on = path.startsWith(`/k/${g.id}${h}`); return <Link key={h} href={`/k/${g.id}${h}`} role="tab" aria-selected={on} className={`pill ${on ? 'pill-on' : ''}`} data-testid={`ktab-${h.slice(1)}`}>{l}</Link>; })}
    </div>
  );
}
