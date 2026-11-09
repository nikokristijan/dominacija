'use client';
import { Icon } from '@/components/art/Icons';
import { fmtClock, isMiddayKind, middayPending } from '@/lib/schedule';
import { useGame } from './GameProvider';

/** Kad stiže rezultat ove vrste naredbe: „u podne (13:00)” ili „navečer”. Prikazuje se samo ako je podnevno razrješenje uključeno. */
export function MiddayHint({ type, kind }: { type: string; kind?: string }) {
  const g = useGame();
  const v = g.view, meta = g.meta;
  if (!v || !meta?.clock.middayAt || v.phase !== 'planning') return null;
  const mid = isMiddayKind(type, kind);
  const pending = middayPending(v, meta);
  const text = mid ? (pending ? `Rezultat stiže u podne (${fmtClock(meta.clock.middayAt)}) — iskoristit ćeš ga za večernje odluke.` : 'Podne je već prošlo — rezultat stiže navečer.') : `Razrješava se navečer (${fmtClock(meta.clock.roundDeadline)}).`;
  return <div className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium ${mid && pending ? 'bg-primary-100 text-primary' : 'bg-neutral-50 text-neutral-600'}`} data-testid="midday-hint"><Icon name="clock" size={14} className="shrink-0" />{text}</div>;
}
