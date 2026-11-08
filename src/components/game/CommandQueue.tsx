'use client';
import Link from 'next/link';
import { Icon } from '@/components/art/Icons';
import { ResourceIcon } from '@/components/art/Resources';
import { useGame } from './GameProvider';
import { describeOrder } from './orderText';
import { ORDER_LABELS } from './OrderComposer';

/** Donji pojas na desktopu: red naredbi i brze radnje. */
export function CommandQueue() {
  const g = useGame();
  const v = g.view!;
  const list = v.orders.filter((o) => o.round === v.round && ['submitted', 'locked', 'draft'].includes(o.status)).sort((a, b) => a.priority - b.priority);
  return (
    <div className="bg-white border-t-2 border-line px-4 py-2 flex items-center gap-3" data-testid="command-queue">
      <div className="flex items-center gap-2 shrink-0"><ResourceIcon name="command" size={30} /><div className="leading-tight"><div className="label">Red naredbi</div><div className="font-display font-extrabold text-secondary">{v.cp.used}/{v.cp.available} ZB</div></div></div>
      <div className="scroll-x flex-1">
        {list.length === 0 && <span className="text-muted font-bold text-sm self-center">Nema planiranih naredbi.</span>}
        {list.map((o) => { const d = describeOrder(v, o); return <Link href={`/k/${g.id}/naredbe`} key={o.id} className={`shrink-0 inline-flex items-center gap-2 rounded-2xl border-2 px-3 py-1.5 ${o.status === 'draft' ? 'border-dashed border-line bg-white' : 'border-primary bg-primary-100'}`}><Icon name={ORDER_LABELS[o.type].icon} size={18} className="text-primary" /><span className="text-sm font-extrabold whitespace-nowrap">{d.title}</span><span className="chip">{o.cpCost}</span></Link>; })}
      </div>
      <Link href={`/k/${g.id}/naredbe`} className="btn btn-yellow btn-sm shrink-0">Strateške radnje</Link>
    </div>
  );
}
