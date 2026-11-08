'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon, type IconName } from '@/components/art/Icons';
import { Expandable } from '@/components/ui/kit';
import { useGame } from '@/components/game/GameProvider';
import { api } from '@/lib/api';

export function MoreScreen() {
  const g = useGame();
  const router = useRouter();
  const v = g.view!;
  const [admin, setAdmin] = useState(false);
  useEffect(() => { api<{ user: { isAdmin: boolean } }>('/api/auth/me').then((r) => setAdmin(r.user.isAdmin)).catch(() => undefined); }, []);
  const base = `/k/${g.id}`;
  const items: Array<[string, string, IconName, string?]> = [
    ['Kraljevstvo', '/kraljevstvo', 'crown'], ['Istraživanje', '/tehnologija', 'flask'], ['Poredak', '/ljestvica', 'trophy'], ['Izvještaji', '/izvjestaji', 'report'],
    ['Obavijesti', '/obavijesti', 'bell', g.unread ? String(g.unread) : undefined], ['Profil', '/profil', 'user'],
    ...(v.phase === 'completed' ? [['Rezultati', '/rezultati', 'trophy', '!'] as [string, string, IconName, string]] : []),
  ];
  return (
    <div className="flex-1 overflow-y-auto" data-testid="more-screen">
      <div className="max-w-2xl mx-auto p-3 lg:p-5 space-y-4">
        <h1 className="text-2xl text-secondary">Više</h1>
        <div className="grid grid-cols-2 gap-3">{items.map(([l, h, i, b]) => (
          <Link key={h} href={base + h} className="card !p-4 flex items-center gap-3 active:translate-y-0.5 relative" data-testid={`more-${h.slice(1)}`}><span className="h-12 w-12 rounded-xl bg-primary-100 text-primary grid place-items-center"><Icon name={i} size={26} /></span><span className="font-display text-lg text-secondary">{l}</span>{b && <span className="absolute top-2 right-2 chip chip-bad">{b}</span>}</Link>))}</div>
        <div className="grid grid-cols-2 gap-3"><Link href="/igra" className="btn btn-ghost">Sve kampanje</Link>{admin && <Link href="/admin" className="btn btn-purple">Administracija</Link>}</div>
        <Expandable title={<span className="flex items-center gap-2"><Icon name="book" size={20} />Kako se igra</span>}>
          <div className="space-y-2 text-sm font-semibold text-ink/90">
            <p><b>Cilj:</b> za 7 dana skupi najviše bodova dominacije: teritorij 1, grad 4, tuđi glavni grad 10, kontrola regije 8, tajni cilj 5 i vojna postignuća. Vojska nije jedina mjera uspjeha.</p>
            <p><b>Dan:</b> svaki dan imaš 10 zapovjednih bodova (ZB). Planiraj naredbe, pregovaraj i špijuniraj. Kad rok istekne, sve naredbe svih igrača izvršavaju se <i>istovremeno</i> na serveru.</p>
            <p><b>Naredbe:</b> novačenje 1, trgovina 1, gradnja 2, obrana 2, špijunaža 2, diplomacija 2, napad 3, sabotaža 3, istraživanje 3 ZB. Nacrti se ne izvršavaju; predaj ih.</p>
            <p><b>Bitke</b> su determinističke (bez kocke): ovise o sastavu vojske, terenu, formaciji, utvrdama, opskrbi, moralu, tehnologiji i obavještajnim podacima. Izvještaj objašnjava ishod.</p>
            <p><b>Magla rata:</b> vlastito vidiš potpuno, susjedno djelomično, a daleko ograničeno. Špijunaža daje procjene s razinom pouzdanosti.</p>
            <p><b>Ekonomija:</b> zlato, hrana, željezo, drvo, utjecaj i stabilnost. Visoki porezi rađaju zlato, ali i nemire — pobuna uvijek dolazi s upozorenjem.</p>
            <p><b>Otpor:</b> ako ti padne glavni grad, ne ispadaš: dobivaš jeftino novačenje, ustanak i priliku za povratak.</p>
          </div>
        </Expandable>
        <button className="btn btn-ghost w-full" onClick={async () => { await api('/api/auth/logout', {}); router.push('/'); router.refresh(); }}><Icon name="logout" size={18} />Odjava</button>
      </div>
    </div>
  );
}
