'use client';
import { useEffect, useState } from 'react';
import { Icon, type IconName } from '@/components/art/Icons';
import { Empty } from '@/components/ui/kit';
import { useGame } from '@/components/game/GameProvider';
import { api } from '@/lib/api';
import { timeAgo } from '@/lib/format';
import type { NotificationRecord } from '@/server/records';

const ICON: Record<string, IconName> = { invitation: 'users', alliance_offer: 'handshake', trade_offer: 'trade', attack: 'sword', resolution: 'report', diplomatic: 'handshake', campaign_complete: 'trophy', phase: 'clock', achievement: 'trophy', warning: 'warn' };

export function NotificationsScreen() {
  const g = useGame();
  const [list, setList] = useState<NotificationRecord[] | null>(null);
  const load = async () => { const r = await api<{ notifications: NotificationRecord[] }>(`/api/notifications?campaign=${g.id}`); setList(r.notifications); };
  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [g.view?.round]);
  const readAll = async () => { await api('/api/notifications', { ids: list?.filter((n) => !n.readAt).map((n) => n.id) }); await load(); await g.refresh(); };
  return (
    <div className="flex-1 overflow-y-auto" data-testid="notifications-screen">
      <div className="max-w-2xl mx-auto p-3 lg:p-5 space-y-3">
        <div className="flex items-center justify-between"><h1 className="text-2xl text-secondary">Obavijesti</h1>{list?.some((n) => !n.readAt) && <button className="chip" onClick={readAll}>Označi sve pročitanim</button>}</div>
        {list === null && <div className="card shimmer h-20" />}
        {list?.length === 0 && <Empty title="Nema obavijesti" text="Ovdje stižu ponude, napadi i izvještaji." mood="happy" />}
        {list?.map((n) => <div key={n.id} className={`card-flat flex items-start gap-3 ${n.readAt ? 'opacity-70' : 'border-primary/50 bg-primary-100/40'}`}><span className="h-10 w-10 shrink-0 rounded-xl bg-white border border-line grid place-items-center text-primary"><Icon name={ICON[n.kind] ?? 'bell'} size={22} /></span><div className="flex-1 min-w-0"><div className="font-semibold">{n.title}</div><div className="text-sm text-muted font-semibold">{n.body}</div><div className="text-xs text-muted">{timeAgo(n.createdAt)}</div></div>{!n.readAt && <span className="h-2.5 w-2.5 rounded-full bg-bad mt-2" />}</div>)}
      </div>
    </div>
  );
}
