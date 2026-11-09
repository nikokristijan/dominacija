'use client';
import { Icon } from '@/components/art/Icons';
import { UnitIcon } from '@/components/art/Characters';
import { timeAgo } from '@/lib/format';
import { fmtRange } from '@/engine/intel';
import type { IntelReport } from '@/engine/types';
import { useGame } from './GameProvider';

const CONF: Record<string, string> = { high: 'visoka', medium: 'srednja', low: 'niska', failed: 'neuspjelo' };
const RES: Record<string, string> = { gold: 'zlato', food: 'hrana', iron: 'željezo', wood: 'drvo', influence: 'utjecaj' };
type Rng = { min: number; max: number };
const mid = (r: Rng) => Math.round((r.min + r.max) / 2);

/** Izvješće izvidnika čitljivo „na prvu”: ključni broj, sastav, utvrde i konkretna preporuka. */
export function IntelCard({ r, onAttack }: { r: IntelReport; onAttack?: () => void }) {
  const g = useGame();
  const v = g.view!;
  const d = r.data as Record<string, any>;
  const age = v.round - r.round;
  const stale = age > v.config.espionage.staleAfterRounds;
  const when = r.createdAt ? timeAgo(r.createdAt) : `dan ${r.round}`;
  const head = (
    <div className="flex items-center justify-between gap-2 text-xs text-muted">
      <span className="flex items-center gap-1.5"><Icon name="eye" size={14} />Izvidnici · {when}</span>
      <span className="flex gap-1.5"><span className="chip">pouzdanost {CONF[r.confidence]}</span>{stale && <span className="chip chip-warn">zastarjelo</span>}</span>
    </div>
  );
  if (r.kind === 'army' && typeof d.min === 'number') {
    const range: Rng = { min: d.min, max: d.max };
    const comp: Array<{ unit: string; min: number; max: number }> = d.comp ?? [];
    const exact = !!d.exact;
    return (
      <div className="rounded-xl border border-line p-3.5 space-y-3" data-testid="intel-card">
        {head}
        <div className="flex items-end gap-3">
          <div className="text-3xl font-semibold leading-none tabular-nums">{exact ? range.min : `≈${mid(range)}`}</div>
          <div className="text-sm text-muted pb-0.5">vojnika{!exact && <> · raspon {fmtRange(range)}</>}</div>
        </div>
        {comp.length > 0 && (
          <div className="space-y-1.5">
            {comp.map((u) => { const share = Math.min(100, (mid(u) / Math.max(1, mid(range))) * 100); return (
              <div key={u.unit} className="flex items-center gap-2.5 text-sm">
                <UnitIcon unit={u.unit as never} size={22} /><span className="w-24 truncate">{v.config.units[u.unit as keyof typeof v.config.units]?.name ?? u.unit}</span>
                <div className="flex-1 h-1.5 rounded-full bg-neutral-100 overflow-hidden"><div className="h-full rounded-full bg-neutral-700" style={{ width: `${share}%` }} /></div>
                <span className="w-14 text-right font-semibold tabular-nums">{exact ? u.min : `~${mid(u)}`}</span>
              </div>); })}
          </div>)}
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="rounded-lg bg-neutral-50 p-2"><div className="text-muted">Teren</div><div className="font-semibold">{d.terrain ? v.config.terrain[d.terrain as keyof typeof v.config.terrain].name : '—'}</div></div>
          <div className="rounded-lg bg-neutral-50 p-2"><div className="text-muted">Utvrde</div><div className="font-semibold">razina {d.defenseLevel ?? 0}</div></div>
          <div className="rounded-lg bg-neutral-50 p-2"><div className="text-muted">Zgrada</div><div className="font-semibold">{d.building ? v.config.buildings[d.building as keyof typeof v.config.buildings].name : 'nema'}</div></div>
        </div>
        {typeof d.needed === 'number' && (
          <div className="rounded-xl bg-primary-100 text-primary p-3 text-sm flex items-center gap-3">
            <div className="flex-1"><b>Preporuka:</b> za siguran napad šalji ≈{d.needed}+ vojnika{stale ? ' (podaci su stari — izvidi ponovno)' : ''}.</div>
            {onAttack && !stale && <button className="btn btn-yellow btn-sm shrink-0" onClick={onAttack} data-testid="intel-attack">Napadni</button>}
          </div>)}
      </div>
    );
  }
  const items: string[] = [];
  if (r.kind === 'resources' && d.ranges) for (const [k, rr] of Object.entries(d.ranges as Record<string, Rng>)) items.push(`${RES[k] ?? k}: ≈${mid(rr)} (${fmtRange(rr)})`);
  if (r.kind === 'buildings' && Array.isArray(d.list)) for (const b of d.list) items.push(`${b.name}: ${v.config.buildings[b.building as keyof typeof v.config.buildings]?.name ?? b.building}${b.level ? ` (razina ${b.level})` : ''}`);
  if (r.kind === 'routes' && Array.isArray(d.routes)) for (const x of d.routes.slice(0, 4)) items.push(`${x.fromName} → ${x.toName}: ≈${mid(x.est)} vojnika`);
  if (r.kind === 'preparations') { if (d.inTraining) items.push(`U novačenju: ≈${mid(d.inTraining)}`); items.push(`Napadi ove runde: ${d.attacksLaunched ?? 0}`); for (const c of d.concentrations ?? []) items.push(`Koncentracija: ${c.name} ≈${mid(c.est)}`); }
  return (
    <div className="rounded-xl border border-line p-3.5 space-y-2" data-testid="intel-card">
      {head}
      <div className="font-medium text-sm">{r.summary}</div>
      {items.length > 0 && <ul className="text-sm text-neutral-700 space-y-0.5">{items.map((x) => <li key={x} className="flex gap-2"><span className="mt-2 h-1 w-1 rounded-full bg-neutral-400 shrink-0" />{x}</li>)}</ul>}
    </div>
  );
}
