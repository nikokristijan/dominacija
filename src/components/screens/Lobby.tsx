'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FactionBadge } from '@/components/art/Factions';
import { Icon } from '@/components/art/Icons';
import { Penguin } from '@/components/art/Penguin';
import { useGame } from '@/components/game/GameProvider';
import { api } from '@/lib/api';

export function Lobby() {
  const { meta, refresh, toast, id } = useGame();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  if (!meta) return null;
  const can = meta.members.length >= meta.minPlayers;
  const link = typeof window !== 'undefined' ? `${window.location.origin}/igra?kod=${meta.inviteCode}` : '';
  const act = async (fn: () => Promise<unknown>) => { setBusy(true); try { await fn(); await refresh(); } catch (e) { toast(e instanceof Error ? e.message : 'Greška', 'bad'); } finally { setBusy(false); } };
  return (
    <main className="min-h-dvh bg-kingdom text-white px-4 py-6 pt-[calc(1.5rem+var(--safe-t))]">
      <div className="max-w-md mx-auto space-y-4">
        <Link href="/igra" className="inline-flex items-center gap-1 font-bold text-white/90"><Icon name="back" size={18} />Moje kampanje</Link>
        <div className="flex items-center gap-3"><div className="bob"><Penguin mood="thinking" size={92} /></div><div><h1 className="text-3xl">{meta.name}</h1><p className="font-bold text-white/80">Čekamo igrače ({meta.members.length}/{meta.maxPlayers}, minimum {meta.minPlayers})</p></div></div>
        <div className="card text-ink" data-testid="lobby">
          <div className="label">Pozivni kod</div>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 text-center font-display text-4xl tracking-[0.25em] text-secondary" data-testid="invite-code">{meta.inviteCode}</div>
            <button className="btn btn-ghost btn-sm" onClick={async () => { await navigator.clipboard?.writeText(meta.inviteCode).catch(() => undefined); toast('Kod kopiran.', 'good'); }} aria-label="Kopiraj kod"><Icon name="copy" size={18} /></button>
          </div>
          <p className="text-xs text-muted mt-1 break-all">Podijeli kod s prijateljima. Oni se pridružuju na „Pridruži se”.{link ? ` Poveznica: ${link}` : ''}</p>
        </div>
        <div className="card text-ink space-y-2">
          <div className="label">Igrači</div>
          {meta.members.map((m) => (
            <div key={m.playerId} className="flex items-center gap-3 rounded-2xl bg-primary-100/50 p-2">
              {m.faction ? <FactionBadge faction={m.faction} size={36} /> : <div className="h-9 w-9 rounded-full bg-white grid place-items-center text-muted font-black">?</div>}
              <div className="flex-1 font-extrabold">{m.name}{m.isMe && <span className="chip ml-2">Ti</span>}{m.isOwner && <span className="chip chip-yellow ml-1">Vlasnik</span>}</div>
            </div>
          ))}
          {Array.from({ length: Math.max(0, meta.minPlayers - meta.members.length) }).map((_, i) => <div key={i} className="rounded-2xl border-2 border-dashed border-line p-3 text-center text-muted font-bold">Slobodno mjesto</div>)}
        </div>
        {meta.isOwner ? (
          <button className="btn btn-yellow w-full text-xl min-h-14" disabled={!can || busy} onClick={() => act(async () => { await api(`/api/campaigns/${id}/start`, {}); })} data-testid="start-campaign">{can ? 'Pokreni kampanju!' : `Treba još ${meta.minPlayers - meta.members.length} igrača`}</button>
        ) : <p className="text-center font-bold">Vlasnik će pokrenuti kampanju kad se skupi dovoljno igrača.</p>}
        <button className="btn btn-ghost w-full" disabled={busy} onClick={() => act(async () => { await api(`/api/campaigns/${id}/leave`, {}); router.push('/igra'); })}>{meta.isOwner ? 'Obriši kampanju' : 'Napusti kampanju'}</button>
      </div>
    </main>
  );
}
