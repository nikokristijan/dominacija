'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { PlayerView } from '@/engine/view';
import type { CampaignMeta } from '@/server/service';
import { ApiFail, api } from '@/lib/api';
import type { Mood } from '@/engine/types';

interface Toast { id: number; text: string; kind: 'good' | 'bad' | 'info' }
interface Ctx {
  id: string; meta: CampaignMeta | null; view: PlayerView | null; unread: number; loading: boolean; error: string | null;
  refresh: () => Promise<void>; act: <T = any>(path: string, body: unknown, opts?: { quiet?: boolean; successMsg?: string }) => Promise<T>;
  selected: string | null; select: (id: string | null) => void; toast: (text: string, kind?: Toast['kind']) => void; toasts: Toast[];
  now: number; mood: Mood; remainingMs: number | null;
}
const C = createContext<Ctx | null>(null);
export const useGame = () => { const c = useContext(C); if (!c) throw new Error('GameProvider nedostaje'); return c; };

export function GameProvider({ id, children }: { id: string; children: React.ReactNode }) {
  const [meta, setMeta] = useState<CampaignMeta | null>(null);
  const [view, setView] = useState<PlayerView | null>(null);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const skew = useRef(0);
  const busy = useRef(false);

  const refresh = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const r = await api<{ meta: CampaignMeta; view: PlayerView | null; unread: number }>(`/api/campaigns/${id}`);
      skew.current = new Date(r.meta.serverNow).getTime() - Date.now();
      setMeta(r.meta); setView(r.view); setUnread(r.unread); setError(null);
    } catch (e) {
      if (e instanceof ApiFail && e.status === 401) { window.location.href = '/prijava'; return; }
      setError(e instanceof Error ? e.message : 'Greška');
    } finally { busy.current = false; setLoading(false); }
  }, [id]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now() + skew.current), 1000);
    const p = setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 12000);
    const onVis = () => { if (document.visibilityState === 'visible') void refresh(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(t); clearInterval(p); document.removeEventListener('visibilitychange', onVis); };
  }, [refresh]);

  const toast = useCallback((text: string, kind: Toast['kind'] = 'info') => {
    const tid = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id: tid, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== tid)), 3800);
  }, []);

  const act = useCallback(async <T,>(path: string, body: unknown, opts?: { quiet?: boolean; successMsg?: string }) => {
    try {
      const r = await api<T>(path, body);
      if (opts?.successMsg) toast(opts.successMsg, 'good');
      await refresh();
      return r;
    } catch (e) {
      if (!opts?.quiet) toast(e instanceof Error ? e.message : 'Greška', 'bad');
      throw e;
    }
  }, [refresh, toast]);

  const remainingMs = meta?.clock.roundDeadline ? new Date(meta.clock.roundDeadline).getTime() - now : null;
  const mood: Mood = useMemo(() => {
    if (!view) return 'neutral';
    if (view.phase === 'completed') return view.final?.winnerId === view.me.id ? 'celebrating' : 'confident';
    if (view.me.status === 'resistance') return 'angry';
    const last = view.reports[view.reports.length - 1];
    if (view.round > 1 && last && last.round === view.round - 1 && last.mood !== 'neutral') return last.mood;
    if (view.forecast.rebellionWarning === 'red') return 'surprised';
    return view.me.ready ? 'confident' : 'thinking';
  }, [view]);

  const value: Ctx = { id, meta, view, unread, loading, error, refresh, act, selected, select: setSelected, toast, toasts, now, mood, remainingMs };
  return <C.Provider value={value}>{children}</C.Provider>;
}
