'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FACTION_IDS, FACTIONS } from '@/engine/config';
import type { FactionId } from '@/engine/types';
import type { CampaignMeta } from '@/server/service';
import { api } from '@/lib/api';
import { Logo } from '@/components/Logo';
import { FactionBadge } from '@/components/art/Factions';
import { Icon } from '@/components/art/Icons';
import { Sheet, Seg, Field, Empty, Expandable } from '@/components/ui/kit';

type Row = CampaignMeta & { myFaction: FactionId | null };
const STATUS: Record<string, { t: string; c: string }> = { waiting: { t: 'Čeka igrače', c: 'chip-yellow' }, active: { t: 'U tijeku', c: 'chip-good' }, completed: { t: 'Završena', c: '' }, disabled: { t: 'Onemogućena', c: 'chip-bad' } };

export default function Hub() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [me, setMe] = useState<{ displayName: string; admin: boolean } | null>(null);
  const [sheet, setSheet] = useState<'create' | 'join' | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      const [c, m] = await Promise.all([api<{ campaigns: Row[] }>('/api/campaigns'), api<{ profile: { displayName: string }; user: { isAdmin: boolean } }>('/api/auth/me')]);
      setRows(c.campaigns); setMe({ displayName: m.profile.displayName, admin: m.user.isAdmin });
    } catch { router.push('/prijava'); }
  }, [router]);
  useEffect(() => { void load(); }, [load]);

  return (
    <main className="min-h-dvh bg-white pb-24">
      <header className="px-5 pt-[calc(1rem+var(--safe-t))] pb-4 border-b border-line">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Logo size={0.8} />
          <div className="flex-1" />
          <span className="text-sm text-muted hidden sm:inline">{me?.displayName ?? ''}</span>
          {me?.admin && <Link href="/admin" className="btn btn-ghost btn-sm">Admin</Link>}
          <button className="btn btn-ghost btn-sm" onClick={async () => { await api('/api/auth/logout', {}); router.push('/'); router.refresh(); }} aria-label="Odjava"><Icon name="logout" size={16} /></button>
        </div>
      </header>
      <div className="max-w-2xl mx-auto px-5 pt-5 space-y-3">
        <Link href="/k/tutorial/karta" className="flex items-center gap-4 rounded-xl border border-primary/30 bg-primary-100 px-5 py-4" data-testid="tutorial-card">
          <Icon name="play" size={26} className="text-primary shrink-0" /><div className="flex-1"><div className="font-semibold text-primary">Prvi put? Pokreni vodič</div><div className="text-sm text-neutral-600">Probna bitka kroz sve funkcije igre, oko 8 minuta. Ništa ne utječe na prave kampanje.</div></div><Icon name="chevron" className="text-primary" />
        </Link>
        <div className="grid grid-cols-2 gap-3">
          <button className="btn btn-yellow" onClick={() => setSheet('create')} data-testid="new-campaign"><Icon name="plus" /> Nova kampanja</button>
          <button className="btn btn-purple" onClick={() => setSheet('join')} data-testid="join-campaign"><Icon name="users" /> Pridruži se</button>
        </div>
        {err && <p role="alert" className="card-flat bg-red-50 text-red-800 font-medium">{err}</p>}
        <h2 className="text-[15px] pt-3">Tvoje kampanje</h2>
        {rows === null && <div className="card shimmer h-24" />}
        {rows?.length === 0 && <Empty title="Još nemaš kampanju" text="Stvori privatnu kampanju za prijatelje ili uđi pozivnim kodom. Za brzo isprobavanje otvori simulaciju s botovima." />}
        {rows?.map((c) => (
          <Link key={c.id} href={`/k/${c.id}${c.status === 'active' ? '/karta' : ''}`} className="card flex items-center gap-3 hover:bg-neutral-50" data-testid={`campaign-${c.id}`}>
            {c.myFaction ? <FactionBadge faction={c.myFaction} size={46} /> : <div className="h-11 w-11 rounded-full bg-neutral-100 grid place-items-center text-neutral-500"><Icon name="crown" /></div>}
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate">{c.name}</div>
              <div className="text-sm text-muted">{c.members.length}/{c.maxPlayers} igrača{c.status === 'active' && c.round ? ` · Dan ${c.round}/${c.totalRounds}` : ''}{c.devSimulation ? ' · simulacija' : ''}</div>
            </div>
            <span className={`chip ${STATUS[c.status].c}`}>{STATUS[c.status].t}</span>
          </Link>
        ))}
        <p className="text-center text-xs text-muted pt-4">Dominacija · razvojna verzija 0.2</p>
      </div>
      <CreateSheet open={sheet === 'create'} onClose={() => setSheet(null)} onCreated={(id) => router.push(`/k/${id}`)} setErr={setErr} />
      <JoinSheet open={sheet === 'join'} onClose={() => setSheet(null)} onJoined={(id) => router.push(`/k/${id}`)} />
    </main>
  );
}

function FactionPick({ value, onChange }: { value: FactionId | null; onChange: (f: FactionId | null) => void }) {
  return (<div className="flex flex-wrap items-center gap-2">
    <button type="button" onClick={() => onChange(null)} className={`h-11 rounded-xl border px-3 text-xs font-semibold ${value === null ? 'border-primary bg-primary-100' : 'border-line'}`}>Nasumično</button>
    {FACTION_IDS.map((f) => <button key={f} type="button" aria-label={FACTIONS[f].name} onClick={() => onChange(f)} className={`h-11 w-11 rounded-xl border grid place-items-center ${value === f ? 'border-primary bg-primary-100' : 'border-line'}`}><FactionBadge faction={f} size={30} /></button>)}
  </div>);
}

function CreateSheet({ open, onClose, onCreated, setErr }: { open: boolean; onClose: () => void; onCreated: (id: string) => void; setErr: (s: string | null) => void }) {
  const [mode, setMode] = useState<'private' | 'dev'>('private');
  const [pace, setPace] = useState<'fast' | 'daily'>('fast'); const [bots2, setBots2] = useState(true);
  const [midday, setMidday] = useState(true); const [midHour, setMidHour] = useState(13);
  const [name, setName] = useState('');
  const [min, setMin] = useState(4); const [max, setMax] = useState(6);
  const [faction, setFaction] = useState<FactionId | null>(null);
  const [lock, setLock] = useState(20); const [start, setStart] = useState(8);
  const [bots, setBots] = useState(5); const [secs, setSecs] = useState(90);
  const [busy, setBusy] = useState(false); const [localErr, setLocalErr] = useState<string | null>(null);
  const tz = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'Europe/Zagreb';
  const submit = async () => {
    setBusy(true); setLocalErr(null);
    try {
      const body: Record<string, unknown> = { name: name || (mode === 'dev' ? 'Testna simulacija' : 'Nova kampanja'), faction: faction ?? undefined, timezone: tz, planningStartHour: start, lockHour: lock };
      if (mode === 'private') { body.minPlayers = min; body.maxPlayers = Math.max(min, max); body.pace = pace; body.fillBots = bots2; body.midday = midday; body.middayHour = midHour; } else body.dev = { bots, planningSeconds: secs };
      const r = await api<{ campaign: CampaignMeta }>('/api/campaigns', body);
      setErr(null); onCreated(r.campaign.id);
    } catch (e) { setLocalErr(e instanceof Error ? e.message : 'Greška'); } finally { setBusy(false); }
  };
  return (
    <Sheet open={open} onClose={onClose} title="Nova kampanja">
      <div className="space-y-4" data-testid="create-sheet">
        <h2 className="text-2xl">Nova kampanja</h2>
        {DEV_UI && <Seg value={mode} onChange={setMode} options={[{ value: 'private', label: 'Privatna (prijatelji)' }, { value: 'dev', label: 'Simulacija (botovi)' }]} />}
        <Field label="Naziv"><input className="input" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder={mode === 'dev' ? 'Testna simulacija' : 'Npr. Subotnji rat'} data-testid="campaign-name" /></Field>
        {mode === 'private' ? (<>
          <Field label="Tempo igre"><Seg value={pace} onChange={setPace} options={[{ value: 'fast', label: 'Brza (dan ≈ 10 min)' }, { value: 'daily', label: 'Dnevna (dan = 24 h)' }]} /></Field>
          <p className="text-xs text-muted">{pace === 'fast' ? `Idealno za večer s prijateljima: 7 dana završi za oko sat vremena (${midday ? 'podne + večer' : 'jedno razrješenje'} po danu), a dan se razriješi čim su svi spremni.` : 'Klasično: svaki dan planiraš, naredbe se zaključavaju u zadani sat i razrješavaju istovremeno. Kampanja traje tjedan dana.'}</p>
          <label className="flex items-center justify-between gap-3 rounded-xl border border-line p-3"><span><span className="block text-sm font-semibold">Popuni prazna mjesta botovima</span><span className="block text-xs text-muted">Možeš igrati i sâm ili s jednim prijateljem. Botovi su jasno označeni.</span></span><input type="checkbox" className="h-5 w-5 accent-[#7138E8]" checked={bots2} onChange={(e) => setBots2(e.target.checked)} data-testid="fill-bots" /></label>
          <Expandable title="Napredne postavke">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Min. igrača"><select className="input" value={min} onChange={(e) => setMin(+e.target.value)}>{[4, 5, 6, 7, 8].map((n) => <option key={n}>{n}</option>)}</select></Field>
                <Field label="Maks. igrača"><select className="input" value={max} onChange={(e) => setMax(+e.target.value)}>{[4, 5, 6, 7, 8].map((n) => <option key={n}>{n}</option>)}</select></Field>
              </div>
              <label className="flex items-center justify-between gap-3 rounded-xl border border-line p-3"><span><span className="block text-sm font-semibold">Podnevno razrješenje</span><span className="block text-xs text-muted">Špijunaža i diplomacija stižu usred dana, ostalo navečer.</span></span><input type="checkbox" className="h-5 w-5 accent-[#7138E8]" checked={midday} onChange={(e) => setMidday(e.target.checked)} data-testid="midday-toggle" /></label>
              {pace === 'daily' && midday && <Field label="Sat podnevnog razrješenja"><select className="input" value={midHour} onChange={(e) => setMidHour(+e.target.value)}>{Array.from({ length: 22 }, (_, h) => h + 1).filter((h) => h > start && h < lock).map((h) => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}</select></Field>}
              {pace === 'daily' && <div className="grid grid-cols-2 gap-3">
                <Field label="Početak planiranja"><select className="input" value={start} onChange={(e) => setStart(+e.target.value)}>{Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}</select></Field>
                <Field label="Zaključavanje naredbi"><select className="input" value={lock} onChange={(e) => setLock(+e.target.value)}>{Array.from({ length: 23 }, (_, h) => <option key={h + 1} value={h + 1}>{String(h + 1).padStart(2, '0')}:00</option>)}</select></Field>
              </div>}
              <p className="text-xs text-muted">Vremenska zona: {tz}.</p>
            </div>
          </Expandable>
        </>) : (<>
          <div className="rounded-xl bg-neutral-50 border border-line p-3 text-sm font-medium text-neutral-700">Razvojna simulacija: protiv tebe igraju botovi (jasno označeni), a runde su ubrzane. Služi za testiranje — ne koristi se za pravu kampanju.</div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Broj botova"><select className="input" value={bots} onChange={(e) => setBots(+e.target.value)}>{[3, 4, 5, 6, 7].map((n) => <option key={n}>{n}</option>)}</select></Field>
            <Field label="Planiranje (sekundi)"><select className="input" value={secs} onChange={(e) => setSecs(+e.target.value)}>{[30, 60, 90, 180, 600].map((n) => <option key={n}>{n}</option>)}</select></Field>
          </div>
        </>)}
        <Field label="Tvoje kraljevstvo"><FactionPick value={faction} onChange={setFaction} /></Field>
        {localErr && <p role="alert" className="rounded-xl bg-red-50 border border-red-200 p-2.5 text-sm text-red-800 font-medium">{localErr}</p>}
        <button className="btn btn-yellow w-full" disabled={busy} onClick={submit} data-testid="create-submit">{busy ? 'Stvaram…' : mode === 'dev' ? 'Pokreni simulaciju' : 'Stvori kampanju'}</button>
      </div>
    </Sheet>
  );
}

const DEV_UI = process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_DEV_MODE === 'true';

function JoinSheet({ open, onClose, onJoined }: { open: boolean; onClose: () => void; onJoined: (id: string) => void }) {
  const [code, setCode] = useState(''); const [faction, setFaction] = useState<FactionId | null>(null); const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const go = async () => { setBusy(true); setErr(null); try { const r = await api<{ campaign: CampaignMeta }>('/api/campaigns/join', { code, faction: faction ?? undefined }); onJoined(r.campaign.id); } catch (e) { setErr(e instanceof Error ? e.message : 'Greška'); } finally { setBusy(false); } };
  return (
    <Sheet open={open} onClose={onClose} title="Pridruži se kampanji">
      <div className="space-y-4">
        <h2 className="text-2xl">Pridruži se kampanji</h2>
        <Field label="Pozivni kod"><input className="input text-center text-2xl tracking-[0.3em] uppercase font-display" maxLength={8} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ABC123" data-testid="join-code" /></Field>
        <Field label="Željeno kraljevstvo"><FactionPick value={faction} onChange={setFaction} /></Field>
        {err && <p role="alert" className="rounded-xl bg-red-50 border border-red-200 p-2.5 text-sm text-red-800 font-medium">{err}</p>}
        <button className="btn btn-purple w-full" disabled={busy || code.length < 4} onClick={go} data-testid="join-submit">Uđi u kampanju</button>
      </div>
    </Sheet>
  );
}
