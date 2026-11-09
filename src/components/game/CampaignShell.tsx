'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { FACTIONS } from '@/engine/config';
import { Icon, type IconName } from '@/components/art/Icons';
import { FactionBadge } from '@/components/art/Factions';
import { ResourceIcon } from '@/components/art/Resources';
import { Toasts } from '@/components/ui/kit';
import { Logo } from '@/components/Logo';
import { formatRemaining } from '@/lib/format';
import { api } from '@/lib/api';
import { GameProvider, useGame } from './GameProvider';
import { ResPill } from './common';
import { Lobby } from '@/components/screens/Lobby';
import { HelpSheet } from './HelpSheet';
import { MorningEdition } from './MorningEdition';
import { middayPending } from '@/lib/schedule';
import { AnimatePresence } from 'framer-motion';
import { TutorialOverlay } from '@/components/tutorial/TutorialOverlay';
import { installTutorialApi, uninstallTutorialApi } from '@/components/tutorial/localApi';

const NAV: Array<{ href: string; label: string; icon: IconName; key: string; mobile?: boolean }> = [
  { href: '', label: 'Početna', icon: 'home', key: 'home', mobile: true },
  { href: '/karta', label: 'Karta', icon: 'map', key: 'map', mobile: true },
  { href: '/naredbe', label: 'Naredbe', icon: 'swords', key: 'orders', mobile: true },
  { href: '/diplomacija', label: 'Diplomacija', icon: 'handshake', key: 'dip', mobile: true },
  { href: '/kraljevstvo', label: 'Kraljevstvo', icon: 'layers', key: 'dev' },
];
const KINGDOM_PATHS = ['/kraljevstvo', '/tehnologija', '/ljestvica'];

export function CampaignShell({ id, children }: { id: string; children: React.ReactNode }) {
  // Vodič: lokalni engine u pregledniku umjesto servera (instalira se prije prvog dohvata stanja)
  if (id === 'tutorial') installTutorialApi();
  useEffect(() => { if (id === 'tutorial') installTutorialApi(); return () => { if (id === 'tutorial') uninstallTutorialApi(); }; }, [id]);
  return <GameProvider id={id}><Inner id={id}>{children}</Inner></GameProvider>;
}

function Inner({ id, children }: { id: string; children: React.ReactNode }) {
  const g = useGame();
  const { meta, view, loading, error, toasts } = g;
  const [edition, setEdition] = useState<number | null>(null);
  const round = view?.round ?? null; const phase = view?.phase ?? null;
  const midDone = view?.middayDone ?? null;
  const prevMid = useRef<boolean | null>(null);
  useEffect(() => {
    // Podnevni rezultati stigli dok je igrač u aplikaciji: kratka obavijest (push ide odvojeno)
    if (midDone === null) return;
    if (prevMid.current === false && midDone === true && id !== 'tutorial') g.toast('Podnevno izvješće je stiglo — izvidnici i poruke.', 'good');
    prevMid.current = midDone;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [midDone, round]);
  useEffect(() => {
    // Jutarnje izdanje: pri prvom otvaranju nakon razrješenja runde (ne u vodiču; ne pri prvom ulasku u kampanju)
    if (id === 'tutorial' || round === null || phase !== 'planning') return;
    const k = `dom_seen_${id}`;
    try {
      const seen = localStorage.getItem(k);
      if (seen === null) { localStorage.setItem(k, String(round)); return; }
      if (round > Number(seen)) { localStorage.setItem(k, String(round)); if (!localStorage.getItem('dom_no_edition')) setEdition(round - 1); }
    } catch { /* bez localStorage nema izdanja */ }
  }, [id, round, phase]);
  if (loading && !meta) return <Splash text="Učitavam kraljevstvo…" />;
  if (error && !meta) return <Splash text={error} error />;
  if (!meta) return null;
  if (meta.status === 'waiting') return <><Lobby /><Toasts toasts={toasts} /></>;
  if (meta.status === 'disabled') return <Splash text={`Kampanja je onemogućena. ${meta.disabledReason ?? ''}`} error />;
  if (!view) return <Splash text="Priprema…" />;
  return (
    <div className="h-dvh flex bg-white overflow-hidden">
      <Sidebar id={id} />
      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar id={id} />
        <main className="flex-1 min-h-0 flex flex-col overflow-hidden relative">{children}</main>
        <BottomNav id={id} />
      </div>
      <Toasts toasts={toasts} />
      {id === 'tutorial' && <TutorialOverlay />}
      <AnimatePresence>{edition !== null && <MorningEdition key={edition} round={edition} onClose={() => setEdition(null)} />}</AnimatePresence>
    </div>
  );
}

function Splash({ text, error }: { text: string; error?: boolean }) {
  return (<div className="h-dvh grid place-items-center text-center px-6"><div><div className="mx-auto h-8 w-8 rounded-full border border-neutral-200 border-t-primary animate-spin" /><p className={`mt-4 font-semibold ${error ? 'text-bad' : 'text-neutral-500'}`}>{text}</p>{error && <Link href="/igra" className="btn btn-ghost mt-4">Natrag na kampanje</Link>}</div></div>);
}

function isActive(path: string, base: string, href: string) {
  if (href === '') return path === base;
  if (href === '/naredbe') return path.startsWith(base + '/naredbe') || path.startsWith(base + '/operacija');
  if (href === '/vise') return ['/vise', '/izvjestaji', '/profil', '/obavijesti', '/rezultati', ...KINGDOM_PATHS].some((p) => path.startsWith(base + p));
  if (href === '/kraljevstvo') return KINGDOM_PATHS.some((p) => path.startsWith(base + p));
  return path.startsWith(base + href);
}

function badgeFor(key: string, g: ReturnType<typeof useGame>): string | null {
  const v = g.view!;
  if (key === 'orders') return `${v.cp.used}/${v.cp.available}`;
  if (key === 'dip') { const n = v.offers.filter((o) => o.to === v.me.id && o.status === 'pending').length; return n ? String(n) : null; }
  if (key === 'more') return g.unread ? String(g.unread) : null;
  return null;
}

function BottomNav({ id }: { id: string }) {
  const path = usePathname();
  const g = useGame();
  const base = `/k/${id}`;
  const items = [...NAV.filter((n) => n.mobile), { href: '/vise', label: 'Više', icon: 'more' as IconName, key: 'more', mobile: true }];
  const order = ['home', 'map', 'orders', 'dip', 'more'];
  items.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
  return (
    <nav className="lg:hidden shrink-0 bg-white border-t border-line pb-[var(--safe-b)] z-30" aria-label="Glavna navigacija">
      <ul className="grid grid-cols-5">
        {items.map((n) => {
          const active = isActive(path, base, n.href);
          const b = badgeFor(n.key, g);
          return (
            <li key={n.key}>
              <Link href={base + n.href} className={`relative flex flex-col items-center justify-center gap-0.5 min-h-14 ${active ? 'text-primary' : 'text-neutral-400'}`} aria-current={active ? 'page' : undefined} data-testid={`nav-${n.key}`} data-tour={`nav-${n.key}`}>
                <Icon name={n.icon} size={22} stroke={active ? 2 : 1.7} />
                <span className="text-[10px] font-semibold">{n.label}</span>
                {b && <span className="absolute top-1.5 left-1/2 ml-2 min-w-4 h-4 px-1 rounded-full bg-primary text-white text-[9px] font-medium grid place-items-center">{b}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function TopBar({ id }: { id: string }) {
  const g = useGame();
  const v = g.view!, meta = g.meta!;
  const rem = g.remainingMs;
  const net = v.forecast.net;
  const stab = Math.round(v.me.stability);
  const locked = v.phase !== 'planning';
  const myScore = v.ranking.find((r) => r.playerId === v.me.id)?.score ?? 0;
  const pendingOffers = v.offers.filter((o) => o.to === v.me.id && o.status === 'pending').length;
  const [help, setHelp] = useState(false);
  const midAt = middayPending(v, meta) && meta.clock.middayAt ? Date.parse(meta.clock.middayAt) - g.now : null;
  const phaseText = v.phase === 'completed' ? 'Završeno' : locked ? 'Razrješenje' : midAt !== null && midAt > 0 ? `Podne za ${formatRemaining(midAt)}` : rem !== null ? `${formatRemaining(rem)} do zaključavanja` : 'Planiranje';
  return (
    <header className="shrink-0 bg-white border-b border-line pt-[var(--safe-t)] z-20" data-tour="topbar">
      <div className="flex items-center gap-3 lg:gap-5 xl:gap-6 px-3 lg:px-5 xl:px-6 min-h-14 lg:min-h-[68px]">
        <Link href="/igra" className="lg:hidden grid place-items-center h-9 w-9 -ml-1 rounded-full text-neutral-500" aria-label="Moje kampanje"><Icon name="back" size={20} /></Link>
        <div className="flex items-center gap-2.5 lg:rounded-full lg:border lg:border-line lg:pl-3.5 lg:pr-5 lg:py-1.5 min-w-0 shrink-0 whitespace-nowrap" data-testid="day-label" data-tour="day">
          <Icon name="clock" size={20} className="hidden lg:block text-neutral-500" />
          <div className="leading-tight"><div className="font-semibold text-[15px]">Dan {v.round} / {v.totalRounds}</div><div className={`text-xs ${rem !== null && rem < 3600_000 && !locked ? 'text-primary font-semibold' : 'text-muted'}`} data-testid="remaining">{id === 'tutorial' ? 'Vodič — vježba' : phaseText}</div></div>
        </div>
        <div className="hidden lg:flex items-center gap-4 xl:gap-6 min-w-0" data-tour="resources">
          <ResPill name="food" value={v.me.resources.food} delta={net.food} label="Hrana" />
          <ResPill name="gold" value={v.me.resources.gold} delta={net.gold} label="Zlato" />
          <ResPill name="iron" value={v.me.resources.iron} delta={net.iron} label="Željezo" />
          <ResPill name="wood" value={v.me.resources.wood} delta={net.wood} label="Drvo" />
          <ResPill name="influence" value={v.me.resources.influence} delta={net.influence} label="Utjecaj" />
          <div className="hidden 2xl:flex items-center gap-2 shrink-0" title="Bodovi"><Icon name="trophy" size={20} className="text-neutral-500" /><span className="text-lg font-semibold">{myScore}</span></div>
        </div>
        <div className="ml-auto flex items-center gap-1 shrink-0">
          <div className={`hidden 2xl:flex items-center gap-1.5 rounded-full px-3 h-9 text-sm font-semibold mr-1 ${stab < v.config.stability.warnRed ? 'bg-red-50 text-bad' : stab < v.config.stability.warnYellow ? 'bg-orange-50 text-warn' : 'bg-neutral-50 text-neutral-600'}`} title="Stabilnost"><ResourceIcon name="stability" size={16} />{stab}</div>
          <Link href={`/k/${id}/naredbe`} className="flex items-center gap-1.5 rounded-full bg-primary-100 text-primary px-3 h-9 text-sm font-semibold whitespace-nowrap" data-testid="cp-chip-top" data-tour="cp"><ResourceIcon name="command" size={16} />{v.cp.available - v.cp.used}<span className="hidden sm:inline">/ {v.cp.available}&nbsp;ZB</span></Link>
          <Link href={`/k/${id}/ljestvica`} className="hidden lg:grid place-items-center h-10 w-10 rounded-full text-neutral-500 hover:bg-neutral-50" aria-label="Poredak"><Icon name="list" size={20} /></Link>
          <Link href={`/k/${id}/diplomacija`} className="relative hidden lg:grid place-items-center h-10 w-10 rounded-full text-neutral-500 hover:bg-neutral-50" aria-label="Poruke"><Icon name="send" size={20} />{pendingOffers > 0 && <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-primary" />}</Link>
          <button onClick={() => setHelp(true)} className="grid place-items-center h-10 w-10 rounded-full text-neutral-500 hover:bg-neutral-50" aria-label="Pomoć" data-testid="help-btn" data-tour="help"><Icon name="info" size={20} /></button>
          <Link href={`/k/${id}/obavijesti`} className="relative grid place-items-center h-10 w-10 rounded-full text-neutral-500 hover:bg-neutral-50" aria-label="Obavijesti"><Icon name="bell" size={20} />{g.unread > 0 && <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-primary" />}</Link>
        </div>
      </div>
      <div className="lg:hidden scroll-x px-3 pb-2 gap-4">
        <ResPill name="food" value={v.me.resources.food} delta={net.food} compact />
        <ResPill name="gold" value={v.me.resources.gold} delta={net.gold} compact />
        <ResPill name="iron" value={v.me.resources.iron} delta={net.iron} compact />
        <ResPill name="wood" value={v.me.resources.wood} delta={net.wood} compact />
        <ResPill name="influence" value={v.me.resources.influence} delta={net.influence} compact />
        <span className="flex items-center gap-1 text-sm font-semibold text-neutral-600 shrink-0"><ResourceIcon name="stability" size={16} />{stab}</span>
      </div>
      <span className="hidden">{meta.name}</span>
      <HelpSheet open={help} onClose={() => setHelp(false)} id={id} />
    </header>
  );
}

function Sidebar({ id }: { id: string }) {
  const path = usePathname();
  const g = useGame();
  const router = useRouter();
  const v = g.view!;
  const base = `/k/${id}`;
  const [menu, setMenu] = useState(false);
  const f = FACTIONS[v.me.faction];
  return (
    <aside className="hidden lg:flex w-[15.5rem] shrink-0 flex-col bg-white border-r border-line" aria-label="Bočna navigacija">
      <Link href="/igra" className="px-6 min-h-[68px] flex items-center shrink-0 mb-2" aria-label="Moje kampanje"><Logo /></Link>
      <nav className="px-3 space-y-0.5">
        {NAV.map((n) => { const active = isActive(path, base, n.href); const b = badgeFor(n.key, g); return (
          <Link key={n.key} href={base + n.href} data-tour={`side-${n.key}`} className={`flex items-center gap-3 rounded-xl px-3.5 min-h-11 text-[15px] font-medium transition-colors ${active ? 'bg-primary-100 text-primary' : 'text-neutral-600 hover:bg-neutral-50'}`}>
            <Icon name={n.icon} size={20} stroke={active ? 2 : 1.7} />{n.label}{b && <span className="ml-auto text-xs font-semibold text-muted">{b}</span>}</Link>); })}
      </nav>
      <div className="mt-auto p-3 relative">
        {menu && (
          <div className="absolute bottom-[calc(100%-0.25rem)] left-3 right-3 bg-white rounded-xl float-shadow p-1.5 space-y-0.5 z-20">
            {[['/ljestvica', 'Poredak', 'trophy'], ['/izvjestaji', 'Izvještaji', 'report'], ['/obavijesti', 'Obavijesti', 'bell'], ['/profil', 'Profil i postavke', 'user']].map(([h, l, i]) => <Link key={h} href={base + h} onClick={() => setMenu(false)} className="flex items-center gap-3 rounded-lg px-3 min-h-10 text-sm font-medium text-neutral-700 hover:bg-neutral-50"><Icon name={i as IconName} size={18} />{l}</Link>)}
            <Link href="/igra" className="flex items-center gap-3 rounded-lg px-3 min-h-10 text-sm font-medium text-neutral-700 hover:bg-neutral-50"><Icon name="list" size={18} />Sve kampanje</Link>
            <button onClick={async () => { await api('/api/auth/logout', {}); router.push('/'); }} className="w-full flex items-center gap-3 rounded-lg px-3 min-h-10 text-sm font-medium text-neutral-700 hover:bg-neutral-50"><Icon name="logout" size={18} />Odjava</button>
          </div>)}
        <button onClick={() => setMenu(!menu)} className="w-full flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-neutral-50 text-left" data-testid="user-menu">
          <FactionBadge faction={v.me.faction} size={36} />
          <div className="flex-1 min-w-0 leading-tight"><div className="font-semibold truncate">{v.me.name}</div><div className="text-xs text-muted truncate">{f.name}</div></div>
          <Icon name="down" size={16} className="text-muted" />
        </button>
      </div>
    </aside>
  );
}
