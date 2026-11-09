'use client';
import Link from 'next/link';
import { FACTIONS } from '@/engine/config';
import { Icon } from '@/components/art/Icons';
import { FactionBadge } from '@/components/art/Factions';
import { Progress, SectionTitle, Expandable } from '@/components/ui/kit';
import { useGame } from '@/components/game/GameProvider';
import { formatRemaining, signed } from '@/lib/format';
import { ResourceIcon } from '@/components/art/Resources';
import { api } from '@/lib/api';
import { useState } from 'react';
import { EventIcon } from '@/components/art/Effects';
import { suggestions } from '@/lib/suggestions';
import { useReady } from '@/components/game/ReadyGuard';
import { Term } from '@/components/ui/Term';
import { PushPrompt } from '@/components/game/PushPrompt';

const SEV: Record<string, string> = { good: 'border-green-200 bg-green-50', bad: 'border-red-200 bg-red-50', warn: 'border-orange-200 bg-orange-50', info: 'border-line bg-white' };

export function Dashboard() {
  const g = useGame();
  const v = g.view!, meta = g.meta!;
  const base = `/k/${g.id}`;
  const rem = g.remainingMs;
  const [busy, setBusy] = useState(false);
  const f = FACTIONS[v.me.faction];
  const ev = v.events.find((e) => e.round === v.round);
  const nextEv = v.events.find((e) => e.round === v.round + 1 && e.announced);
  const pendingOffers = v.offers.filter((o) => o.to === v.me.id && o.status === 'pending');
  const lastReport = v.reports.find((r) => r.round === v.round - 1);
  const orders = v.orders.filter((o) => o.round === v.round && (o.status === 'submitted' || o.status === 'locked'));
  const drafts = v.orders.filter((o) => o.round === v.round && o.status === 'draft');
  const warnings: Array<{ t: string; sev: 'bad' | 'warn'; href?: string }> = [];
  if (v.phase === 'planning') {
    if (v.forecast.rebellionWarning === 'red') warnings.push({ t: `Stabilnost ${Math.round(v.me.stability)}: prijeti pobuna! Snizi poreze.`, sev: 'bad', href: `${base}/kraljevstvo` });
    else if (v.forecast.rebellionWarning === 'yellow') warnings.push({ t: `Stabilnost pada (${Math.round(v.me.stability)}). Pripazi na poreze i hranu.`, sev: 'warn', href: `${base}/kraljevstvo` });
    if (v.forecast.foodShortageRisk) warnings.push({ t: 'Prijeti glad: hrana neće pokriti potrošnju.', sev: 'bad', href: `${base}/kraljevstvo` });
    if (v.forecast.goldShortageRisk) warnings.push({ t: 'Prijeti prazna riznica: plaće vojske neće biti isplaćene.', sev: 'bad' });
    const unsup = Object.values(v.territories).filter((t) => t.owner === v.me.id && t.supplied === false);
    if (unsup.length && v.me.status !== 'resistance') warnings.push({ t: `${unsup.length} teritorij(a) odsječeno od opskrbe: ${unsup.map((t) => t.name).join(', ')}.`, sev: 'warn', href: `${base}/karta` });
    if (v.me.status === 'resistance') warnings.push({ t: 'Tvoj glavni grad je pao! Kraljevstvo je u stanju Otpora — pokreni ustanak.', sev: 'bad', href: `${base}/naredbe` });
    if (!v.me.submittedOnce && v.round > 1) warnings.push({ t: 'Još nisi predao naredbe — ako ne djeluješ, kraljevstvo prelazi u automatsku obranu.', sev: 'warn', href: `${base}/naredbe` });
  }
  const ready = useReady();
  const [choosing, setChoosing] = useState(false);
  const choose = async (choice: 'a' | 'b') => { setChoosing(true); try { await g.act(`/api/campaigns/${g.id}/orders`, { action: 'dilemma', choice }, { successMsg: 'Odluka donesena.' }); } catch { /* toast */ } finally { setChoosing(false); } };
  const sugg = suggestions(v, base);
  const planning = v.phase === 'planning';
  return (
    <div className="flex-1 overflow-y-auto" data-testid="dashboard">
      <div className="max-w-2xl mx-auto p-3 lg:p-6 space-y-3">
        {/* Dan, vrijeme i glavna akcija */}
        <section className="card space-y-4">
          <div className="flex items-center gap-3"><FactionBadge faction={v.me.faction} size={36} /><div className="leading-tight flex-1 min-w-0"><div className="font-semibold truncate">{v.me.name}</div><div className="text-sm text-muted">{f.name}</div></div>
            <Link href={`${base}/karta`} className="btn btn-yellow btn-sm" data-testid="open-map"><Icon name="map" size={16} />Karta</Link></div>
          <div>
            <div className="label">Dan {v.round} od {v.totalRounds}</div>
            {v.phase === 'completed' ? <div className="text-2xl font-semibold text-primary mt-0.5">Kampanja završena</div> : (<>
              <div className="text-2xl font-semibold mt-0.5">{planning ? (v.me.ready ? 'Spremno — čekamo ostale' : 'Vrijeme je za planiranje') : 'Razrješenje u tijeku'}</div>
              {planning && rem !== null && <div className="flex items-center gap-2 mt-1 text-neutral-600 text-sm"><Icon name="clock" size={16} />Zaključavanje za <span className="font-semibold text-primary" data-testid="remaining-big">{formatRemaining(rem)}</span></div>}
              {rem !== null && rem <= 0 && planning && <div className="text-sm text-muted mt-1">Rok je istekao — razrješenje svaki čas…</div>}
            </>)}
          </div>
          {planning && v.playerOrder.some((id) => id !== v.me.id && !v.players[id].isBot) && (
            <div className="flex items-center gap-2 flex-wrap" data-testid="ready-strip">
              {v.playerOrder.filter((id) => id !== v.me.id && !v.players[id].isBot).map((id) => { const pl = v.players[id]; const ok = pl.ready; return <span key={id} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${ok ? 'border-green-200 bg-green-50 text-green-800' : 'border-line text-neutral-600'}`}><span className={`h-1.5 w-1.5 rounded-full ${ok ? 'bg-good' : 'bg-neutral-300'}`} />{pl.name}{!ok && ' razmišlja…'}</span>; })}
            </div>)}
          {planning && (<div className="space-y-2.5">
            <div className="flex items-center justify-between text-sm"><span className="text-muted"><Term id="zb">Zapovjedni bodovi</Term> danas</span><span className="font-semibold" data-testid="cp-chip">{v.cp.used}/{v.cp.available} ZB</span></div>
            <Progress value={v.cp.used} max={v.cp.available} />
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Link href={`${base}/naredbe`} className="btn btn-purple" data-testid="plan-orders">Naredbe ({orders.length + drafts.length})</Link>
              <button className={`btn ${v.me.ready ? 'btn-ghost' : 'btn-yellow'}`} disabled={ready.busy} onClick={ready.toggle} data-testid="ready-toggle"><Icon name={v.me.ready ? 'unlock' : 'lock'} size={16} />{v.me.ready ? 'Otključaj' : 'Spremno'}</button>
            </div>
          </div>)}
          {v.phase === 'completed' && <Link href={`${base}/rezultati`} className="btn btn-yellow w-full">Pogledaj konačne rezultate</Link>}
        </section>

        {/* Natjecanje: gdje si i koga loviš */}
        {v.phase !== 'completed' && (() => {
          const sorted = [...v.ranking].sort((a, b) => b.score - a.score);
          const i = sorted.findIndex((r) => r.playerId === v.me.id);
          const you = sorted[i];
          const above = sorted[i - 1], below = sorted[i + 1];
          const line = above ? `${v.players[above.playerId].name} je ispred za ${Math.max(1, above.score - you.score)} bod.` : below ? `${v.players[below.playerId].name} te lovi — razlika ${Math.max(0, you.score - below.score)} bod.` : 'Sam si na vrhu.';
          return (
            <Link href={`${base}/ljestvica`} className="card flex items-center gap-4" data-testid="rank-strip">
              <div className="text-3xl font-semibold tabular-nums w-12 text-center">{i + 1}.</div>
              <div className="flex-1 min-w-0"><div className="font-semibold">{you.score} bodova · {i === 0 ? 'vodiš' : `${i + 1}. od ${sorted.length}`}</div><div className="text-sm text-muted truncate">{line}</div></div>
              <Icon name="chevron" size={16} className="text-muted" />
            </Link>);
        })()}

        {/* Upozorenja */}
        {warnings.map((w, i) => { const body2 = <div className={`flex items-center gap-3 rounded-xl border p-3 text-sm font-medium ${w.sev === 'bad' ? 'border-red-200 bg-red-50 text-red-900' : 'border-orange-200 bg-orange-50 text-orange-900'}`}><Icon name="warn" size={20} className="shrink-0" /><span className="flex-1">{w.t}</span>{w.href && <Icon name="chevron" size={16} />}</div>; return w.href ? <Link key={i} href={w.href} className="block">{body2}</Link> : <div key={i}>{body2}</div>; })}

        <PushPrompt />

        {/* Što dalje? */}
        {sugg.length > 0 && (
          <section className="card space-y-2" data-testid="suggestions" data-tour="suggestions">
            <SectionTitle icon="sparkle">Što dalje?</SectionTitle>
            {sugg.map((x) => (
              <Link key={x.id} href={x.href} className={`flex items-center gap-3 rounded-xl border p-3 hover:bg-neutral-50 ${x.tone === 'bad' ? 'border-red-200' : x.tone === 'warn' ? 'border-orange-200' : x.tone === 'good' ? 'border-green-200' : 'border-line'}`}>
                <span className={`h-2 w-2 rounded-full shrink-0 ${x.tone === 'bad' ? 'bg-bad' : x.tone === 'warn' ? 'bg-warn' : x.tone === 'good' ? 'bg-good' : 'bg-primary'}`} />
                <span className="flex-1 min-w-0"><span className="block text-sm font-semibold">{x.title}</span><span className="block text-xs text-muted">{x.text}</span></span>
                <span className="text-xs font-semibold text-primary shrink-0">{x.cta}</span>
              </Link>
            ))}
          </section>
        )}

        {/* Dnevna dilema */}
        {v.dilemma && (
          <section className="card space-y-3" data-testid="dilemma">
            <SectionTitle icon="scroll" right={v.dilemma.chosen ? <span className="chip chip-good">Odlučeno</span> : <span className="chip chip-yellow">Danas</span>}>{v.dilemma.title}</SectionTitle>
            <p className="text-sm text-neutral-600">{v.dilemma.text}</p>
            {v.dilemma.chosen ? <div className="rounded-xl bg-neutral-50 p-3 text-sm"><b>{v.dilemma.chosen === 'a' ? v.dilemma.a.label : v.dilemma.b.label}.</b> {v.dilemma.result}</div> : (
              <div className="grid gap-2 sm:grid-cols-2">
                {(['a', 'b'] as const).map((k) => { const o = v.dilemma![k]; return (
                  <button key={k} className="text-left rounded-xl border border-line p-3 hover:bg-neutral-50 active:bg-neutral-100 disabled:opacity-50" disabled={choosing || v.phase !== 'planning'} onClick={() => choose(k)} data-testid={`dilemma-${k}`}>
                    <span className="block font-semibold">{o.label}</span><span className="block text-xs text-muted mt-0.5">{o.hint}</span>
                  </button>); })}
              </div>)}
          </section>
        )}

        {/* Događaj i tajni cilj u jednom retku */}
        {(ev && ev.type !== 'none') && (
          <section className="card flex items-start gap-3"><EventIcon type={ev.type} size={36} /><div className="min-w-0"><div className="font-semibold">Danas: {ev.title}</div><div className="text-sm text-muted">{ev.description}</div>{ev.effects.map((e, i) => <span key={i} className="chip mt-1.5 mr-1">{e}</span>)}{nextEv && nextEv.type !== 'none' && <div className="text-xs text-muted mt-1.5">Sutra: <b className="text-ink">{nextEv.title}</b></div>}</div></section>
        )}
        <section className="card">
          <SectionTitle icon="target" right={<span className="chip chip-yellow">Tajno</span>}>{v.me.objective.title}</SectionTitle>
          <p className="text-sm text-muted">{v.me.objective.description}</p>
          <div className="mt-2 flex items-center gap-2"><Progress className="flex-1" value={Math.min(v.me.objectiveProgress.current, v.me.objectiveProgress.target)} max={v.me.objectiveProgress.target} color={v.me.objectiveProgress.done ? 'bg-good' : 'bg-primary'} /><span className="text-xs font-semibold whitespace-nowrap">{v.me.objectiveProgress.label}</span></div>
        </section>

        {/* Nedavni događaji */}
        {lastReport && lastReport.entries.length > 0 && (
          <section className="space-y-2">
            <SectionTitle icon="report" right={<Link href={`${base}/izvjestaji`} className="chip">Svi izvještaji</Link>}>Što se dogodilo</SectionTitle>
            {lastReport.entries.slice(0, 3).map((e) => <div key={e.id} className={`rounded-xl border p-3 text-sm font-medium ${SEV[e.severity]}`}>{e.text}</div>)}
          </section>
        )}

        {meta.devSimulation && planning && (
          <section className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-3 space-y-2" data-testid="dev-tools">
            <div className="label">Razvojni alati (simulacija)</div>
            <div className="grid grid-cols-2 gap-2">
              <button className="btn btn-ghost btn-sm" disabled={busy} onClick={async () => { setBusy(true); try { await api(`/api/campaigns/${g.id}/dev`, { action: 'resolve' }); await g.refresh(); g.toast('Runda razriješena.', 'good'); } catch (e) { g.toast(e instanceof Error ? e.message : 'Greška', 'bad'); } finally { setBusy(false); } }} data-testid="dev-resolve"><Icon name="play" size={16} />Razriješi sada</button>
              <button className="btn btn-ghost btn-sm" disabled={busy} onClick={async () => { setBusy(true); try { await api(`/api/campaigns/${g.id}/dev`, { action: 'resolve_all' }); await g.refresh(); g.toast('Cijela kampanja simulirana.', 'good'); } catch (e) { g.toast(e instanceof Error ? e.message : 'Greška', 'bad'); } finally { setBusy(false); } }} data-testid="dev-resolve-all"><Icon name="fast" size={16} />Odigraj sve dane</button>
            </div>
          </section>
        )}
      </div>
      {ready.dialog}
    </div>
  );
}
void api; void signed; void ResourceIcon; void Expandable;
