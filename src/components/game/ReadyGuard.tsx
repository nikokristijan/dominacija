'use client';
import { useState } from 'react';
import { Sheet } from '@/components/ui/kit';
import { radar } from '@/lib/radar';
import { useGame } from './GameProvider';
import type { PlayerView } from '@/engine/view';

/** Upozorenja prije zaključavanja: neiskorišteni ZB, nacrti koji se ne izvršavaju, ugroženi teritoriji bez obrane. */
export function readyWarnings(v: PlayerView): string[] {
  const w: string[] = [];
  const left = v.cp.available - v.cp.used;
  if (left >= 3) w.push(`Ostalo ti je ${left} od ${v.cp.available} zapovjednih bodova neiskorišteno.`);
  const drafts = v.orders.filter((o) => o.round === v.round && o.status === 'draft').length;
  if (drafts) w.push(`Imaš ${drafts} ${drafts === 1 ? 'nacrt koji se NE izvršava' : 'nacrta koji se NE izvršavaju'} dok ih ne predaš.`);
  const defended = new Set(v.orders.filter((o) => o.round === v.round && o.type === 'defend' && o.status !== 'draft' && o.status !== 'cancelled').map((o) => (o as { params: { territoryId: string } }).params.territoryId));
  const open = radar(v).filter((r) => r.kind === 'threat' && !defended.has(r.id));
  if (open.length) w.push(`${open.length === 1 ? 'Ugrožen je' : 'Ugroženo je'} ${open.slice(0, 2).map((r) => r.title.replace('Prijetnja: ', '')).join(', ')} — nisi naredio obranu.`);
  return w;
}

/** Hook: toggle() zaključava s upozorenjem kad ima razloga; „dialog” se ugradi bilo gdje u stablo. */
export function useReady() {
  const g = useGame();
  const [warn, setWarn] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const apply = async (ready: boolean) => {
    setBusy(true);
    try { await g.act(`/api/campaigns/${g.id}/orders`, { action: 'ready', ready }, { successMsg: ready ? 'Naredbe zaključane — čekaj razrješenje.' : 'Naredbe otključane.' }); } catch { /* toast */ } finally { setBusy(false); }
  };
  const toggle = () => {
    const v = g.view!;
    if (v.me.ready) return void apply(false);
    const w = readyWarnings(v);
    if (w.length) setWarn(w); else void apply(true);
  };
  const dialog = (
    <Sheet open={!!warn} onClose={() => setWarn(null)} title="Prije nego zaključaš">
      <div className="space-y-4" data-testid="ready-dialog">
        <h2 className="text-2xl">Sigurno si gotov?</h2>
        <ul className="space-y-2">{warn?.map((x) => <li key={x} className="flex gap-2.5 rounded-xl border border-orange-200 bg-orange-50 p-3 text-sm font-medium text-orange-900"><span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-warn shrink-0" />{x}</li>)}</ul>
        <div className="grid gap-2">
          <button className="btn btn-yellow" onClick={() => setWarn(null)} data-testid="ready-back">Vrati se planirati</button>
          <button className="btn btn-ghost" onClick={() => { setWarn(null); void apply(true); }} data-testid="ready-confirm">Ipak zaključaj</button>
        </div>
      </div>
    </Sheet>
  );
  return { toggle, dialog, busy };
}
