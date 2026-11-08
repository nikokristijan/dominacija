'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Icon } from '@/components/art/Icons';
import { Seg, SectionTitle } from '@/components/ui/kit';
import { Penguin } from '@/components/art/Penguin';

interface Overview { users: Array<{ id: string; username: string; isAdmin: boolean; disabled: boolean; createdAt: string }>; campaigns: Array<{ id: string; name: string; status: string; members: number; round: number | null; dev: boolean; deadline: string | null; version: number; schedule: any; disabledReason?: string }>; errors: Array<{ id: string; at: string; where: string; message: string; stack?: string }>; audit: Array<{ id: string; at: string; kind: string; detail: string; userId: string | null }>; balanceOverrides: unknown; baseConfig: any }
const EVENTS = ['none', 'drought', 'gold_rush', 'plague', 'rebellion', 'trade_boom', 'winter', 'storm', 'harvest'];

export function AdminPanel() {
  const [tab, setTab] = useState<'campaigns' | 'balance' | 'logs' | 'users'>('campaigns');
  const [o, setO] = useState<Overview | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [bal, setBal] = useState('');
  const load = useCallback(async () => { try { const r = await api<Overview>('/api/admin'); setO(r); setBal(JSON.stringify(r.balanceOverrides ?? {}, null, 2)); } catch (e) { setMsg(e instanceof Error ? e.message : 'Greška'); } }, []);
  useEffect(() => { void load(); }, [load]);
  const act = async (body: Record<string, unknown>, ok = 'Učinjeno.') => { try { await api('/api/admin', body); setMsg(ok); await load(); if (detail && body.campaignId) await open(String(body.campaignId)); } catch (e) { setMsg(e instanceof Error ? e.message : 'Greška'); } };
  const open = async (id: string) => { try { setDetail(await api(`/api/admin/campaign/${id}`)); } catch (e) { setMsg(e instanceof Error ? e.message : 'Greška'); } };
  return (
    <main className="min-h-dvh bg-bg pb-16" data-testid="admin">
      <header className="bg-kingdom text-white px-4 pt-[calc(1rem+var(--safe-t))] pb-5"><div className="max-w-5xl mx-auto flex items-center gap-3"><Penguin mood="confident" size={64} /><div className="flex-1"><h1 className="text-2xl">Administracija</h1><p className="text-sm font-bold text-white/80">Zaštićeno sučelje — samo za administratore</p></div><Link href="/igra" className="btn btn-ghost btn-sm">Natrag</Link></div></header>
      <div className="max-w-5xl mx-auto p-3 space-y-3">
        {msg && <div role="status" className="card-flat bg-yellow-50 font-bold flex justify-between">{msg}<button onClick={() => setMsg(null)} aria-label="Zatvori"><Icon name="close" size={16} /></button></div>}
        <Seg value={tab} onChange={setTab} options={[{ value: 'campaigns', label: 'Kampanje' }, { value: 'balance', label: 'Balans' }, { value: 'logs', label: 'Zapisnici' }, { value: 'users', label: 'Korisnici' }]} />
        {!o && <div className="card shimmer h-24" />}
        {o && tab === 'campaigns' && (<div className="grid lg:grid-cols-2 gap-3">
          <div className="space-y-2">{o.campaigns.length === 0 && <div className="card-flat text-muted font-bold">Nema kampanja.</div>}{o.campaigns.map((c) => (
            <div key={c.id} className="card-flat space-y-2" data-testid="admin-campaign">
              <div className="flex items-center justify-between gap-2"><b className="font-display text-lg text-secondary">{c.name}</b><span className={`chip ${c.status === 'active' ? 'chip-good' : c.status === 'disabled' ? 'chip-bad' : ''}`}>{c.status}</span></div>
              <div className="text-xs text-muted font-bold">{c.members} igrača · {c.round ? `dan ${c.round}` : 'nije pokrenuta'} · {c.dev ? 'simulacija' : 'stvarna'} · verzija {c.version}{c.deadline ? ` · rok ${new Date(c.deadline).toLocaleString('hr-HR')}` : ''}</div>
              <div className="flex flex-wrap gap-2"><button className="btn btn-ghost btn-sm" onClick={() => open(c.id)}>Pregledaj</button>{c.status === 'active' && <button className="btn btn-ghost btn-sm" onClick={() => act({ action: 'resolve', campaignId: c.id }, 'Runda razriješena.')}>Razriješi sada</button>}{c.status === 'disabled' ? <button className="btn btn-green btn-sm" onClick={() => act({ action: 'enable', campaignId: c.id })}>Omogući</button> : <button className="btn btn-red btn-sm" onClick={() => act({ action: 'disable', campaignId: c.id, reason: 'Onemogućeno (kvar)' }, 'Kampanja onemogućena.')}>Onemogući</button>}</div>
            </div>))}</div>
          <div>{detail ? (<div className="card space-y-3" data-testid="admin-detail"><SectionTitle>{detail.meta.name}</SectionTitle>
            {detail.suspicious.length > 0 ? <div className="rounded-2xl bg-red-50 border-2 border-red-200 p-2.5 text-sm font-bold text-red-900">{detail.suspicious.map((s: string, i: number) => <div key={i}>Upozorenje: {s}</div>)}</div> : <div className="chip chip-good">Nema sumnjivih aktivnosti</div>}
            <div className="label">Igrači</div>{detail.players.map((p: any) => <div key={p.id} className="rounded-2xl bg-primary-100/50 p-2 text-xs font-bold"><b className="text-sm">{p.name}</b> · {p.status}{p.autopilot ? ' · autopilot' : ''} · stab {Math.round(p.stability)} · zlato {Math.floor(p.resources.gold)} · tehn. {p.techs.length} · napadi {p.stats.attacksLaunched} · propušteno {p.missedRounds}<div className="text-muted">Cilj: {p.objective}</div></div>)}
            <div className="label">Svjetski događaji (budući se mogu mijenjati)</div>{detail.events.map((e: any) => <div key={e.id} className="flex items-center gap-2 text-sm font-bold"><span className="w-14">Dan {e.round}</span><select className="input !min-h-9 !py-0" disabled={e.announced} value={e.type} onChange={(ev) => act({ action: 'event', campaignId: detail.meta.id, round: e.round, type: ev.target.value }, 'Događaj promijenjen.')}>{EVENTS.map((t) => <option key={t}>{t}</option>)}</select>{e.announced && <span className="chip">objavljen</span>}</div>)}
            <div className="label">Raspored</div><div className="flex gap-2 items-center text-sm font-bold">Zaključavanje u <input className="input !min-h-9 w-20" type="number" min={1} max={23} defaultValue={detail.meta.schedule.lockHour} onBlur={(e) => act({ action: 'schedule', campaignId: detail.meta.id, schedule: { lockHour: +e.target.value } }, 'Raspored promijenjen.')} /> h ({detail.meta.schedule.timezone})</div>
          </div>) : <div className="card-flat text-muted font-bold text-center">Odaberi kampanju za inspekciju.</div>}</div>
        </div>)}
        {o && tab === 'balance' && (<div className="card space-y-2"><SectionTitle icon="settings">Konfiguracija balansa</SectionTitle><p className="text-sm text-muted font-bold">JSON „DeepPartial” nadjačavanje centralne konfiguracije (src/engine/config.ts). Vrijedi za NOVE kampanje; pokrenute kampanje zadržavaju svoju kopiju. Npr. {`{"orderCosts":{"attack":2}}`}</p>
          <textarea className="input font-mono !min-h-64 text-xs" value={bal} onChange={(e) => setBal(e.target.value)} spellCheck={false} data-testid="balance-json" />
          <div className="flex gap-2"><button className="btn btn-yellow" onClick={() => { try { act({ action: 'balance', overrides: JSON.parse(bal) }, 'Balans spremljen.'); } catch { setMsg('Neispravan JSON.'); } }}>Spremi</button><button className="btn btn-ghost" onClick={() => setBal('{}')}>Vrati zadano</button></div>
          <details className="text-xs"><summary className="font-extrabold cursor-pointer">Trenutne zadane vrijednosti</summary><pre className="overflow-auto max-h-80 bg-primary-100/40 p-2 rounded-xl">{JSON.stringify({ orderCosts: o.baseConfig.orderCosts, campaign: o.baseConfig.campaign, tax: o.baseConfig.tax, combat: { phases: o.baseConfig.combat.phases, damageRate: o.baseConfig.combat.damageRate }, scoring: o.baseConfig.scoring }, null, 1)}</pre></details></div>)}
        {o && tab === 'logs' && (<div className="grid lg:grid-cols-2 gap-3"><div className="card space-y-2"><SectionTitle icon="warn">Greške ({o.errors.length})</SectionTitle>{o.errors.length === 0 && <div className="chip chip-good">Nema grešaka</div>}{o.errors.map((e) => <details key={e.id} className="rounded-xl bg-red-50 p-2 text-xs font-bold"><summary className="cursor-pointer">{new Date(e.at).toLocaleString('hr-HR')} · {e.where}: {e.message}</summary><pre className="whitespace-pre-wrap">{e.stack}</pre></details>)}</div>
          <div className="card space-y-1"><SectionTitle icon="list">Revizijski trag</SectionTitle>{o.audit.map((a) => <div key={a.id} className="text-xs font-bold border-b border-line/60 py-1"><span className="text-muted">{new Date(a.at).toLocaleTimeString('hr-HR')}</span> <b>{a.kind}</b> {a.detail}</div>)}</div></div>)}
        {o && tab === 'users' && (<div className="card space-y-2">{o.users.map((u) => <div key={u.id} className="flex items-center gap-3 rounded-2xl bg-primary-100/40 p-2"><div className="flex-1 font-extrabold">{u.username} {u.isAdmin && <span className="chip chip-yellow">admin</span>}{u.disabled && <span className="chip chip-bad ml-1">onemogućen</span>}<div className="text-xs text-muted">{new Date(u.createdAt).toLocaleDateString('hr-HR')}</div></div>{!u.isAdmin && <button className="btn btn-ghost btn-sm" onClick={() => act({ action: 'disable_user', targetUserId: u.id })}>{u.disabled ? 'Omogući' : 'Onemogući'}</button>}</div>)}</div>)}
      </div>
    </main>
  );
}
