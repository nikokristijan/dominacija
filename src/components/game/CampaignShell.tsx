'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { FACTIONS } from '@/engine/config';
import { Icon, type IconName } from '@/components/art/Icons';
import { Penguin } from '@/components/art/Penguin';
import { ResourceIcon } from '@/components/art/Resources';
import { FactionBadge, FactionBanner } from '@/components/art/Factions';
import { Toasts } from '@/components/ui/kit';
import { Logo } from '@/components/Logo';
import { formatRemaining } from '@/lib/format';
import { api } from '@/lib/api';
import { GameProvider, useGame } from './GameProvider';
import { ResPill } from './common';
import { Lobby } from '@/components/screens/Lobby';

const NAV: Array<{ href: string; label: string; icon: IconName; key: string }> = [
  { href: '', label: 'Početna', icon: 'home', key: 'home' },
  { href: '/karta', label: 'Karta', icon: 'map', key: 'map' },
  { href: '/naredbe', label: 'Naredbe', icon: 'orders', key: 'orders' },
  { href: '/diplomacija', label: 'Diplomacija', icon: 'handshake', key: 'dip' },
  { href: '/vise', label: 'Više', icon: 'more', key: 'more' },
];

export function CampaignShell({ id, children }: { id: string; children: React.ReactNode }) {
  return <GameProvider id={id}><Inner id={id}>{children}</Inner></GameProvider>;
}

function Inner({ id, children }: { id: string; children: React.ReactNode }) {
  const g = useGame();
  const { meta, view, loading, error, toasts } = g;
  if (loading && !meta) return <Splash text="Učitavam kraljevstvo…" />;
  if (error && !meta) return <Splash text={error} error />;
  if (!meta) return null;
  if (meta.status === 'waiting') return <><Lobby /><Toasts toasts={toasts} /></>;
  if (meta.status === 'disabled') return <Splash text={`Kampanja je onemogućena. ${meta.disabledReason ?? ''}`} error />;
  if (!view) return <Splash text="Priprema…" />;
  return (
    <div className="h-dvh flex bg-bg overflow-hidden">
      <Sidebar id={id} />
      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar id={id} />
        <main className="flex-1 min-h-0 flex flex-col overflow-hidden">{children}</main>
        <BottomNav id={id} />
      </div>
      <Toasts toasts={toasts} />
    </div>
  );
}

function Splash({ text, error }: { text: string; error?: boolean }) {
  return (<div className="h-dvh bg-kingdom grid place-items-center text-white text-center px-6"><div><div className="bob inline-block"><Penguin mood={error ? 'defeated' : 'thinking'} size={140} /></div><p className="font-display text-xl mt-2">{text}</p>{error && <Link href="/igra" className="btn btn-yellow mt-4">Natrag na kampanje</Link>}</div></div>);
}

function isActive(path: string, base: string, href: string) {
  if (href === '') return path === base;
  if (href === '/vise') return ['/vise', '/tehnologija', '/izvjestaji', '/profil', '/ljestvica', '/obavijesti', '/kraljevstvo', '/rezultati', '/postavke'].some((p) => path.startsWith(base + p));
  if (href === '/naredbe') return path.startsWith(base + '/naredbe') || path.startsWith(base + '/operacija');
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
  return (
    <nav className="lg:hidden shrink-0 bg-white border-t-2 border-line pb-[var(--safe-b)] z-30" aria-label="Glavna navigacija">
      <ul className="grid grid-cols-5">
        {NAV.map((n) => {
          const active = isActive(path, base, n.href);
          const b = badgeFor(n.key, g);
          return (
            <li key={n.key}>
              <Link href={base + n.href} className={`relative flex flex-col items-center justify-center gap-0.5 min-h-16 pt-1 ${active ? 'text-primary' : 'text-muted'}`} aria-current={active ? 'page' : undefined} data-testid={`nav-${n.key}`}>
                <span className={`grid place-items-center h-9 w-12 rounded-2xl transition-colors ${active ? 'bg-primary-100' : ''}`}><Icon name={n.icon} size={24} stroke={active ? 2.6 : 2.2} /></span>
                <span className={`text-[11px] ${active ? 'font-black' : 'font-bold'}`}>{n.label}</span>
                {b && <span className="absolute top-1 right-[22%] min-w-5 h-5 px-1 rounded-full bg-bad text-white text-[10px] font-black grid place-items-center border-2 border-white">{b}</span>}
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
  return (
    <header className="shrink-0 panel-dark rounded-none lg:rounded-b-3xl pt-[calc(0.5rem+var(--safe-t))] pb-2 px-3 z-20">
      <div className="flex items-center gap-2">
        <Link href="/igra" className="lg:hidden grid place-items-center h-10 w-10 rounded-xl bg-white/15" aria-label="Moje kampanje"><Icon name="back" size={20} /></Link>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="text-[11px] font-extrabold text-white/70 truncate">{meta.name}</div>
          <div className="font-display text-lg flex items-center gap-2" data-testid="day-label">Dan {v.round} / {v.totalRounds}
            <span className={`chip ${locked ? 'chip-warn' : 'chip-yellow'}`}>{v.phase === 'completed' ? 'Završeno' : locked ? 'Razrješenje' : 'Planiranje'}</span></div>
        </div>
        {v.phase === 'planning' && rem !== null && (
          <div className="text-right leading-tight" data-testid="remaining">
            <div className="text-[10px] font-extrabold text-white/70 uppercase">Preostalo</div>
            <div className={`font-display text-lg ${rem < 3600_000 ? 'text-accent' : ''}`}>{formatRemaining(rem)}</div>
          </div>
        )}
        <Link href={`/k/${id}/obavijesti`} className="relative grid place-items-center h-10 w-10 rounded-xl bg-white/15" aria-label="Obavijesti"><Icon name="bell" size={20} />{g.unread > 0 && <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-bad text-[10px] font-black grid place-items-center border-2 border-[#3a24a0]">{g.unread}</span>}</Link>
      </div>
      <div className="scroll-x mt-2 pb-0.5">
        <ResPill name="gold" value={v.me.resources.gold} delta={net.gold} label="Zlato" />
        <ResPill name="food" value={v.me.resources.food} delta={net.food} label="Hrana" />
        <ResPill name="iron" value={v.me.resources.iron} delta={net.iron} label="Željezo" />
        <ResPill name="wood" value={v.me.resources.wood} delta={net.wood} label="Drvo" />
        <ResPill name="influence" value={v.me.resources.influence} delta={net.influence} label="Utjecaj" />
        <div className={`flex items-center gap-1.5 rounded-2xl pl-1 pr-2.5 py-1 min-w-[4.6rem] ${stab < v.config.stability.warnRed ? 'bg-red-500/50' : stab < v.config.stability.warnYellow ? 'bg-orange-400/40' : 'bg-white/15'}`} title="Stabilnost"><ResourceIcon name="stability" size={26} /><div className="leading-none"><div className="font-display font-extrabold text-[15px]">{stab}</div><div className="text-[10px] font-extrabold text-white/70">stab.</div></div></div>
        <div className="flex items-center gap-1.5 rounded-2xl bg-accent/90 text-ink pl-1 pr-2.5 py-1 min-w-[4.6rem]" title="Zapovjedni bodovi"><span className="grid place-items-center h-6 w-6 rounded-full bg-primary text-white text-[10px] font-black">ZB</span><div className="leading-none"><div className="font-display font-extrabold text-[15px]">{v.cp.available - v.cp.used}/{v.cp.available}</div><div className="text-[10px] font-extrabold">slobodno</div></div></div>
      </div>
    </header>
  );
}

function Sidebar({ id }: { id: string }) {
  const path = usePathname();
  const g = useGame();
  const router = useRouter();
  const v = g.view!;
  const base = `/k/${id}`;
  const rank = [...v.ranking];
  const [busy, setBusy] = useState(false);
  const f = FACTIONS[v.me.faction];
  return (
    <aside className="hidden lg:flex w-72 shrink-0 flex-col bg-white border-r-2 border-line overflow-y-auto" aria-label="Bočna navigacija">
      <div className="bg-kingdom text-white p-4 flex items-center gap-3">
        <div className="shrink-0"><Penguin mood={g.mood} size={84} /></div>
        <div className="min-w-0"><div className="font-display text-xl truncate">{v.me.name}</div><div className="text-xs font-bold text-white/80">{f.name}</div><div className="mt-1"><FactionBanner faction={v.me.faction} size={26} className="inline" /></div></div>
      </div>
      <nav className="p-3 space-y-1">
        {NAV.map((n) => { const active = isActive(path, base, n.href); const b = badgeFor(n.key, g); return (
          <Link key={n.key} href={base + n.href} className={`flex items-center gap-3 rounded-2xl px-3 min-h-12 font-extrabold ${active ? 'tab-active' : 'text-ink hover:bg-primary-100'}`}>
            <Icon name={n.icon} size={22} />{n.label}{b && <span className={`ml-auto chip ${active ? '' : 'chip-bad'}`}>{b}</span>}</Link>); })}
        <div className="h-px bg-line my-2" />
        {[['/tehnologija', 'Tehnologija', 'flask'], ['/izvjestaji', 'Izvještaji', 'report'], ['/kraljevstvo', 'Kraljevstvo', 'crown'], ['/ljestvica', 'Ljestvica', 'trophy'], ['/profil', 'Profil', 'user']].map(([h, l, i]) => (
          <Link key={h} href={base + h} className={`flex items-center gap-3 rounded-2xl px-3 min-h-11 text-sm font-extrabold ${path.startsWith(base + h) ? 'text-primary bg-primary-100' : 'text-muted hover:bg-primary-100'}`}><Icon name={i as IconName} size={20} />{l}</Link>))}
      </nav>
      <div className="p-3 mt-auto">
        <div className="label mb-1.5">Ljestvica kampanje</div>
        <ol className="space-y-1">{rank.map((r, i) => { const p = v.players[r.playerId]; return (
          <li key={r.playerId} className={`flex items-center gap-2 rounded-xl px-2 py-1.5 ${r.playerId === v.me.id ? 'bg-accent/30' : 'bg-primary-100/40'}`}><span className="w-5 text-center font-black text-sm text-muted">{i + 1}</span><FactionBadge faction={p.faction} size={22} /><span className="flex-1 truncate font-extrabold text-sm">{p.name}</span><span className="font-display font-extrabold text-primary">{r.score}</span></li>); })}</ol>
        <button className="btn btn-ghost btn-sm w-full mt-3" disabled={busy} onClick={async () => { setBusy(true); await api('/api/auth/logout', {}); router.push('/'); }}><Icon name="logout" size={16} />Odjava</button>
        <Link href="/igra" className="btn btn-ghost btn-sm w-full mt-2">Sve kampanje</Link>
        <div className="mt-3 flex justify-center"><Logo size={0.4} /></div>
      </div>
    </aside>
  );
}
