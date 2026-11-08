'use client';
import { useEffect, useState } from 'react';
import { ACHIEVEMENTS } from '@/engine/resolve';
import { FACTION_IDS, FACTIONS } from '@/engine/config';
import type { FactionId } from '@/engine/types';
import { FactionBadge } from '@/components/art/Factions';
import { Icon } from '@/components/art/Icons';
import { Field, SectionTitle } from '@/components/ui/kit';
import { useGame } from '@/components/game/GameProvider';
import { api } from '@/lib/api';
import type { ProfileRecord } from '@/server/records';

const PREF_LABELS: Record<string, string> = { invitation: 'Pozivi u kampanje', alliance_offer: 'Ponude saveza', trade_offer: 'Trgovinske ponude', attack: 'Napadi na tvoje teritorije', resolution: 'Završetak dnevnog razrješenja', diplomatic: 'Diplomatski događaji', campaign_complete: 'Završetak kampanje', phase: 'Početak nove faze planiranja', achievement: 'Postignuća', warning: 'Upozorenja (glad, pobuna)' };

export function ProfileScreen() {
  const g = useGame();
  const v = g.view!;
  const [prof, setProf] = useState<ProfileRecord | null>(null);
  const [name, setName] = useState('');
  useEffect(() => { api<{ profile: ProfileRecord }>('/api/profile').then((r) => { setProf(r.profile); setName(r.profile.displayName); }).catch(() => undefined); }, []);
  const save = async (body: Record<string, unknown>) => { try { const r = await api<{ profile: ProfileRecord }>('/api/profile', body); setProf(r.profile); g.toast('Spremljeno.', 'good'); } catch (e) { g.toast(e instanceof Error ? e.message : 'Greška', 'bad'); } };
  const enablePush = async () => {
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return g.toast('Preglednik ne podržava push obavijesti.', 'bad');
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key) return g.toast('Push poslužitelj još nije podešen (VAPID ključevi). Obavijesti rade unutar aplikacije.', 'info');
      const perm = await Notification.requestPermission(); if (perm !== 'granted') return g.toast('Dozvola odbijena.', 'bad');
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
      await api('/api/push/subscribe', sub.toJSON()); g.toast('Push obavijesti uključene.', 'good');
    } catch (e) { g.toast(e instanceof Error ? e.message : 'Greška', 'bad'); }
  };
  const s = v.me.stats;
  const stats: Array<[string, number]> = [['Bitke dobivene', s.battlesWon], ['Bitke izgubljene', s.battlesLost], ['Obrane', s.defensesWon], ['Osvojeno teritorija', s.territoriesCaptured], ['Izgubljeno teritorija', s.territoriesLost], ['Glavni gradovi osvojeni', s.capitalsCaptured], ['Istraženo', s.researchDone], ['Trgovina', s.tradesDone], ['Uhvaćeni špijuni', s.spiesCaught]];
  return (
    <div className="flex-1 overflow-y-auto" data-testid="profile-screen">
      <div className="max-w-3xl mx-auto p-3 lg:p-5 space-y-4">
        <section className="card flex items-center gap-4"><FactionBadge faction={v.me.faction} size={56} /><div className="flex-1 min-w-0"><h1 className="text-2xl truncate">{prof?.displayName ?? v.me.name}</h1><div className="text-muted">{FACTIONS[v.me.faction].name}</div></div></section>
        
        <section className="card space-y-3"><SectionTitle icon="user">Prilagodba</SectionTitle>
          <Field label="Ime kralja"><div className="flex gap-2"><input className="input" value={name} maxLength={24} onChange={(e) => setName(e.target.value)} /><button className="btn btn-purple" onClick={() => save({ displayName: name })} disabled={name.trim().length < 2}>Spremi</button></div></Field>
          <Field label="Omiljeno kraljevstvo (za nove kampanje)"><div className="flex flex-wrap gap-2">{FACTION_IDS.map((f: FactionId) => <button key={f} aria-label={FACTIONS[f].name} onClick={() => save({ preferredFaction: f })} className={`h-12 w-12 rounded-xl border grid place-items-center ${prof?.preferredFaction === f ? 'border-primary bg-primary-100' : 'border-line'}`}><FactionBadge faction={f} size={36} /></button>)}</div></Field>
          <p className="text-xs text-muted font-medium">Frakcije su u ovoj verziji isključivo kozmetičke — nemaju nikakve prednosti.</p></section>
        <section className="card space-y-2"><SectionTitle icon="trophy">Postignuća ({v.me.achievements.filter((a) => !a.startsWith('__')).length}/{ACHIEVEMENTS.length})</SectionTitle>
          <div className="grid grid-cols-2 gap-2">{ACHIEVEMENTS.map((a) => { const got = v.me.achievements.includes(a.id) || prof?.achievements.includes(a.id); return <div key={a.id} className={`rounded-xl border p-2.5 ${got ? 'border-primary bg-primary-100/60' : 'border-line opacity-60'}`}><div className="flex items-center gap-2"><Icon name={got ? 'trophy' : 'lock'} size={18} className={got ? 'text-accent-600' : 'text-muted'} /><b className="text-sm">{a.title}</b></div><div className="text-xs text-muted font-semibold">{a.description}</div></div>; })}</div></section>
        <section className="card space-y-2"><SectionTitle icon="target">Statistika kampanje</SectionTitle><div className="grid grid-cols-3 gap-2">{stats.map(([l, n]) => <div key={l} className="rounded-xl bg-primary-100/50 p-2 text-center"><div className="text-2xl ">{Math.round(n)}</div><div className="text-[10px] font-semibold text-muted leading-tight">{l}</div></div>)}</div></section>
        <section className="card space-y-2"><SectionTitle icon="book">Povijest kampanja</SectionTitle>
          {!prof || prof.history.length === 0 ? <p className="text-sm text-muted font-medium">Još nema završenih kampanja. Pobjede: {prof?.totals.wins ?? 0}.</p> : prof.history.map((h) => <div key={h.campaignId} className="flex items-center gap-3 rounded-xl bg-primary-100/50 p-2"><FactionBadge faction={h.faction} size={32} /><div className="flex-1"><b>{h.name}</b><div className="text-xs text-muted font-medium">{new Date(h.finishedAt).toLocaleDateString('hr-HR')}</div></div><span className="chip chip-yellow">{h.rank}/{h.players}</span><span className="text-primary">{h.score}</span></div>)}</section>
        <section className="card space-y-2"><SectionTitle icon="bell">Obavijesti</SectionTitle>
          {prof && Object.entries(PREF_LABELS).map(([k, label]) => <label key={k} className="flex items-center justify-between gap-3 min-h-11 font-medium"><span>{label}</span><input type="checkbox" className="h-6 w-6 accent-[#5B3DF6]" checked={(prof.prefs as unknown as Record<string, boolean>)[k]} onChange={(e) => save({ prefs: { [k]: e.target.checked } })} /></label>)}
          <button className="btn btn-ghost w-full" onClick={enablePush}><Icon name="bell" size={18} />Uključi push obavijesti u pregledniku</button>
          <p className="text-xs text-muted font-medium">Obavijesti koje isključiš neće se ni stvarati. Nema spamanja: „nova faza” je zadano isključena.</p></section>
      </div>
    </div>
  );
}
