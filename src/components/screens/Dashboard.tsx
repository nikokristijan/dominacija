'use client';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { FACTIONS } from '@/engine/config';
import { Icon, type IconName } from '@/components/art/Icons';
import { FactionBadge } from '@/components/art/Factions';
import { Progress, SectionTitle, Expandable } from '@/components/ui/kit';
import { useGame } from '@/components/game/GameProvider';
import { formatRemaining, signed } from '@/lib/format';
import { ResourceIcon } from '@/components/art/Resources';
import { api } from '@/lib/api';
import { useState } from 'react';
import { EventIcon } from '@/components/art/Effects';

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
  const setReady = async (ready: boolean) => { setBusy(true); try { await g.act(`/api/campaigns/${g.id}/orders`, { action: 'ready', ready }, { successMsg: ready ? 'Naredbe označene kao spremne.' : 'Naredbe otključane.' }); } catch { /* toast */ } finally { setBusy(false); } };
  const tiles: Array<{ label: string; icon: IconName; href: string; badge?: string; tone: string }> = [
    { label: 'Naredbe', icon: 'swords', href: '/naredbe', badge: `${v.cp.used}/${v.cp.available}`, tone: 'from-[#7B5CFF] to-[#4B33C9]' },
    { label: 'Diplomacija', icon: 'handshake', href: '/diplomacija', badge: pendingOffers.length ? String(pendingOffers.length) : undefined, tone: 'from-[#8A6CFF] to-[#5B3DF6]' },
    { label: 'Tehnologija', icon: 'flask', href: '/tehnologija', tone: 'from-[#6D8CFF] to-[#4B5FE0]' },
    { label: 'Izvještaji', icon: 'report', href: '/izvjestaji', badge: g.unread ? String(g.unread) : undefined, tone: 'from-[#9B7BFF] to-[#6A45E8]' },
  ];
  return (
    <div className="flex-1 overflow-y-auto" data-testid="dashboard">
      <div className="max-w-5xl mx-auto p-3 lg:p-5 grid gap-3 lg:grid-cols-[1.2fr_1fr]">
        {/* Dan i vrijeme */}
        <section className="card lg:col-span-2 space-y-3">
          <div className="flex items-center gap-3"><FactionBadge faction={v.me.faction} size={40} /><div className="leading-tight flex-1"><div className="font-semibold text-lg">{v.me.name}</div><div className="text-sm text-muted">{f.name}</div></div>
            <Link href={`${base}/karta`} className="btn btn-yellow btn-sm" data-testid="open-map"><Icon name="map" size={16} />Otvori kartu</Link></div>
          <div className="rounded-2xl bg-neutral-50 p-4">
            <div className="label">Dan {v.round} / {v.totalRounds}</div>
            {v.phase === 'completed' ? <div className="text-2xl font-semibold text-primary">Kampanja završena</div> : (<>
              <div className="text-2xl font-semibold">{v.phase === 'planning' ? 'Faza planiranja' : 'Razrješenje u tijeku'}</div>
              {v.phase === 'planning' && rem !== null && <div className="flex items-center gap-2 mt-1 text-neutral-600"><Icon name="clock" size={18} />Preostalo: <span className="font-semibold text-primary" data-testid="remaining-big">{formatRemaining(rem)}</span></div>}
              {rem !== null && rem <= 0 && v.phase === 'planning' && <div className="text-sm text-muted mt-1">Rok je istekao — razrješenje svaki čas…</div>}
              <Progress className="mt-3" value={v.round - 1 + (v.me.ready ? 0.75 : orders.length ? 0.4 : 0.1)} max={v.totalRounds} />
            </>)}
          </div>
          {v.phase === 'completed' && <Link href={`${base}/rezultati`} className="btn btn-yellow w-full">Pogledaj konačne rezultate</Link>}
        </section>

        {/* Pločice */}
        <section className="grid grid-cols-2 gap-3 lg:col-span-1 content-start">
          {tiles.map((t) => (
            <motion.div key={t.label} whileTap={{ scale: 0.96 }}>
              <Link href={base + t.href} className="relative flex items-center gap-3.5 rounded-2xl border border-line px-4 min-h-20 hover:bg-neutral-50" data-testid={`tile-${t.label}`}>
                <Icon name={t.icon} size={26} stroke={1.6} className="text-neutral-700 shrink-0" /><span className="font-semibold text-[17px]">{t.label}</span>
                {t.badge && <span className="ml-auto chip chip-yellow">{t.badge}</span>}
              </Link>
            </motion.div>
          ))}
        </section>

        {/* Zapovjedni bodovi + akcije */}
        <section className="card space-y-3 lg:col-span-1">
          <div className="flex items-center justify-between"><SectionTitle icon="orders">Naredbe za danas</SectionTitle><span className="chip chip-yellow" data-testid="cp-chip">{v.cp.used}/{v.cp.available} ZB</span></div>
          <Progress value={v.cp.used} max={v.cp.available} color="bg-accent-600" />
          <div className="flex gap-2 text-sm font-bold text-muted"><span>{orders.length} predano</span><span>·</span><span>{drafts.length} nacrta</span><span>·</span><span>{v.conditionalOrders.filter((c) => c.status === 'active').length} uvjetnih</span></div>
          {v.phase === 'planning' ? (
            <div className="grid grid-cols-2 gap-2">
              <Link href={`${base}/naredbe`} className="btn btn-purple btn-sm">Planiraj naredbe</Link>
              <button className={`btn btn-sm ${v.me.ready ? 'btn-ghost' : 'btn-yellow'}`} disabled={busy} onClick={() => setReady(!v.me.ready)} data-testid="ready-toggle"><Icon name={v.me.ready ? 'unlock' : 'lock'} size={16} />{v.me.ready ? 'Otključaj' : 'Spremno'}</button>
            </div>
          ) : null}
          {meta.devSimulation && v.phase === 'planning' && (
            <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50 p-3 space-y-2" data-testid="dev-tools">
              <div className="label !text-amber-700">Razvojni alati (simulacija)</div>
              <div className="grid grid-cols-2 gap-2">
                <button className="btn btn-ghost btn-sm" disabled={busy} onClick={async () => { setBusy(true); try { await api(`/api/campaigns/${g.id}/dev`, { action: 'resolve' }); await g.refresh(); g.toast('Runda razriješena.', 'good'); } catch (e) { g.toast(e instanceof Error ? e.message : 'Greška', 'bad'); } finally { setBusy(false); } }} data-testid="dev-resolve"><Icon name="play" size={16} />Razriješi sada</button>
                <button className="btn btn-ghost btn-sm" disabled={busy} onClick={async () => { setBusy(true); try { await api(`/api/campaigns/${g.id}/dev`, { action: 'resolve_all' }); await g.refresh(); g.toast('Cijela kampanja simulirana.', 'good'); } catch (e) { g.toast(e instanceof Error ? e.message : 'Greška', 'bad'); } finally { setBusy(false); } }} data-testid="dev-resolve-all"><Icon name="fast" size={16} />Odigraj sve dane</button>
              </div>
            </div>
          )}
        </section>

        {/* Upozorenja */}
        {warnings.length > 0 && (
          <section className="space-y-2 lg:col-span-2">
            {warnings.map((w, i) => { const body = <div className={`flex items-center gap-3 rounded-2xl border-2 p-3 font-bold ${w.sev === 'bad' ? 'border-red-200 bg-red-50 text-red-900' : 'border-orange-200 bg-orange-50 text-orange-900'}`}><Icon name="warn" size={22} className="shrink-0" /><span className="flex-1 text-sm">{w.t}</span>{w.href && <Icon name="chevron" size={18} />}</div>; return w.href ? <Link key={i} href={w.href}>{body}</Link> : <div key={i}>{body}</div>; })}
          </section>
        )}

        {/* Događaj dana */}
        {(ev || nextEv) && (
          <section className="card lg:col-span-1">
            <SectionTitle icon="sparkle">Svjetski događaj</SectionTitle>
            {ev && <div className="flex gap-3 items-start"><EventIcon type={ev.type} size={48} /><div><div className="text-lg ">Danas: {ev.title}</div><div className="text-sm text-muted">{ev.description}</div>{ev.effects.map((e, i) => <div key={i} className="chip mt-1 mr-1">{e}</div>)}</div></div>}
            {nextEv && nextEv.type !== 'none' && <div className="mt-3 rounded-2xl bg-primary-100/60 p-2.5 text-sm font-bold">Sutra: <b>{nextEv.title}</b> — {nextEv.effects[0]}</div>}
          </section>
        )}

        {/* Ponude */}
        {pendingOffers.length > 0 && (
          <Link href={`${base}/diplomacija`} className="card lg:col-span-1 flex items-center gap-3 border-accent-600">
            <Icon name="handshake" size={30} className="text-primary" /><div className="flex-1"><div className="text-lg ">{pendingOffers.length} diplomatska ponuda</div><div className="text-sm text-muted">{pendingOffers.map((o) => v.players[o.from]?.name).join(', ')} čeka tvoj odgovor.</div></div><Icon name="chevron" />
          </Link>
        )}

        {/* Tajni cilj (privatno) */}
        <section className="card lg:col-span-1">
          <SectionTitle icon="target" right={<span className="chip chip-yellow">Tajno</span>}>{v.me.objective.title}</SectionTitle>
          <p className="text-sm text-muted">{v.me.objective.description}</p>
          <div className="mt-2 flex items-center gap-2"><Progress className="flex-1" value={Math.min(v.me.objectiveProgress.current, v.me.objectiveProgress.target)} max={v.me.objectiveProgress.target} color={v.me.objectiveProgress.done ? 'bg-good' : 'bg-primary'} /><span className="text-xs font-extrabold whitespace-nowrap">{v.me.objectiveProgress.label}</span></div>
        </section>

        {/* Ekonomija */}
        <section className="card lg:col-span-1">
          <SectionTitle icon="coins" right={<Link href={`${base}/kraljevstvo`} className="chip">Detalji</Link>}>Prognoza dana</SectionTitle>
          <div className="grid grid-cols-5 gap-1.5 text-center">
            {(['gold', 'food', 'iron', 'wood', 'influence'] as const).map((r) => (<div key={r} className="rounded-2xl bg-primary-100/50 py-2"><ResourceIcon name={r} size={26} className="mx-auto" /><div className={`font-extrabold ${v.forecast.net[r] < 0 ? 'text-bad' : 'text-good'}`}>{signed(v.forecast.net[r], 1)}</div></div>))}
          </div>
          <div className="mt-2 text-xs text-muted font-bold flex flex-wrap gap-x-3">Porezi: {v.forecast.taxes.toFixed(1)} zlata · Vojska: {v.forecast.soldiers} · Stabilnost {signed(v.forecast.stabilityDelta, 0)}/dan → {Math.round(v.forecast.projectedStability)}</div>
        </section>

        {/* Nedavni događaji */}
        <section className="lg:col-span-2 space-y-2">
          <SectionTitle icon="report" right={<Link href={`${base}/izvjestaji`} className="chip">Svi izvještaji</Link>}>Nedavni događaji</SectionTitle>
          {!lastReport && <div className="card-flat text-muted text-sm">Još nema izvještaja. Prvi stiže nakon razrješenja prve runde.</div>}
          {lastReport?.entries.slice(0, 6).map((e) => <div key={e.id} className={`rounded-2xl border-2 p-2.5 text-sm font-bold ${SEV[e.severity]}`}>{e.text}</div>)}
        </section>

        {/* Ljestvica */}
        <section className="lg:col-span-2">
          <Expandable title={<span className="flex items-center gap-2"><Icon name="trophy" size={20} />Ljestvica</span>} badge={<span className="chip">{v.ranking.findIndex((r) => r.playerId === v.me.id) + 1}. mjesto</span>}>
            <ol className="space-y-1.5">{v.ranking.map((r, i) => { const p = v.players[r.playerId]; return (<li key={r.playerId} className={`flex items-center gap-2 rounded-xl px-2.5 py-2 ${r.playerId === v.me.id ? 'bg-accent/30' : 'bg-primary-100/40'}`}><span className="w-6 text-center font-black text-muted">{i + 1}</span><FactionBadge faction={p.faction} size={26} /><span className="flex-1 font-extrabold truncate">{p.name}{p.status === 'resistance' && <span className="chip chip-bad ml-2">Otpor</span>}</span><span className="text-xs text-muted font-bold">{r.territories} teritorija</span><span className="text-lg text-primary">{r.score}</span></li>); })}</ol>
          </Expandable>
        </section>
      </div>
    </div>
  );
}
void api;
