'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Icon } from '@/components/art/Icons';
import { useGame } from '@/components/game/GameProvider';
import { api } from '@/lib/api';
import type { PlayerView } from '@/engine/view';
import { tutorialOutpostId, resetTutorial } from './localApi';
import { useIsDesktop } from '@/lib/useMediaQuery';

interface Ctx { v: PlayerView; path: string; outpost: string; capital: string; selected: string | null; dom: (sel: string) => boolean }
interface Step {
  id: string; title: string; body: string; tip?: string; kind: 'info' | 'task'; goto?: { href: string; label: string };
  targets?: (c: Ctx) => string[]; tour?: string[]; done?: (c: Ctx) => boolean; action?: 'resolve';
}
const sub = (o: { round: number; type: string; status: string }, type: string, round: number) => o.round === round && o.type === type && ['submitted', 'locked'].includes(o.status);

export const STEPS: Step[] = [
  { id: 'intro', kind: 'info', title: 'Dobrodošao, kralju', body: 'Ovo je vježbena kampanja: ništa se ne sprema i ništa ne utječe na prave igre. Proći ćeš sve funkcije i odigrati probnu bitku — oko 8 minuta. Cilj prave igre: nakon 7 dana imati najviše bodova (teritorij 1, grad 4, tuđi glavni grad 10, regija 8, tajni cilj 5).', tip: 'Ne pobjeđuje onaj s najviše vojnika, nego onaj koji bolje planira.' },
  { id: 'map', kind: 'info', title: 'Karta svijeta', body: 'Svaki heksagon je teritorij. Ljubičasto je tvoje, crveno protivničko, plavo saveznici, zlatno neutralno. Povuci za pomicanje, štipni ili koristi + i − za zoom. Kruna je glavni grad, a bijela pločica pokazuje vojsku (~ znači procjena).', tour: ['legend'] },
  { id: 'select-capital', kind: 'task', title: 'Odaberi svoj glavni grad', body: 'Dodirni ljubičasti heksagon s krunom (pulsira).', targets: (c) => [c.capital], done: (c) => c.selected === c.capital },
  { id: 'popup', kind: 'info', title: 'Kartica teritorija', body: 'Svaki teritorij ima karticu s karticama: Pregled (proizvodnja i brze akcije), Razvoj (zgrade, stanovništvo), Vojska (postrojbe), Obrana (utvrde) i Više (opskrba). Sve što radiš kreće odavde.', tip: 'Na mobitelu je kartica donji list koji možeš povući dolje da je zatvoriš.' },
  { id: 'resources', kind: 'info', title: 'Resursi', body: 'Zlato (porezi, gradnja, novačenje), hrana (stanovništvo i vojska), željezo (oprema), drvo (gradnja) i utjecaj (diplomacija, špijunaža, pripajanje). Zeleni broj je dnevna dobit. Stabilnost pada zbog visokih poreza, gladi i poraza — ispod 30 prijeti pobuna, uvijek s upozorenjem.', tour: ['resources', 'topbar'] },
  { id: 'cp', kind: 'info', title: 'Zapovjedni bodovi (ZB)', body: 'U pravoj igri imaš 10 ZB dnevno (u vježbi 16, da stigneš isprobati sve). Napad košta 3, istraživanje 3, gradnja, obrana, špijunaža i diplomacija po 2, novačenje i trgovina po 1. U pravoj igri ne možeš sve — zato je svaka odluka važna.', tour: ['cp'] },
  { id: 'recruit', kind: 'task', title: 'Novači vojsku', body: 'U kartici glavnog grada odaberi Novači, pregledaj strateški pregled (poznato / procijenjeno / nepoznato / rizici) i pritisni Predaj naredbu. Postrojbe stižu početkom iduće runde.', tip: 'Nacrt ne troši ništa. Predana naredba rezervira resurse da ih ne potrošiš dvaput.', targets: (c) => [c.capital], tour: ['act-recruit'], done: (c) => c.v.orders.some((o) => sub(o, 'recruit', c.v.round)) },
  { id: 'build', kind: 'task', title: 'Izgradi zgradu', body: 'Odaberi jedan od svoja druga dva teritorija (pulsiraju) i u kartici pritisni Razvoj. Izaberi npr. Tržnicu ili Grad i predaj naredbu.', tip: 'Farma daje hranu, rudnik željezo, grad zlato, tvrđava obranu, barake otključavaju vitezove.', targets: (c) => Object.values(c.v.territories).filter((t) => t.owner === c.v.me.id && !t.isCapital).map((t) => t.id), tour: ['act-build'], done: (c) => c.v.orders.some((o) => sub(o, 'build', c.v.round)) },
  { id: 'tax', kind: 'task', title: 'Porezi i stabilnost', body: 'Otvori Razvoj i postavi Visoke poreze. Dobit zlata raste, ali stabilnost pada svaki dan. U pravoj igri pazi na upozorenja na dashboardu.', goto: { href: '/kraljevstvo', label: 'Otvori Razvoj' }, done: (c) => c.v.me.tax !== 'normal' },
  { id: 'research', kind: 'task', title: 'Istraživanje', body: 'Otvori Istraživanje, odaberi tehnologiju (npr. Poboljšana poljoprivreda) i predaj naredbu. Učinak vrijedi od iduće runde. U 7 dana ne možeš istražiti sve — biraj prema strategiji.', goto: { href: '/tehnologija', label: 'Otvori Istraživanje' }, done: (c) => c.v.orders.some((o) => sub(o, 'research', c.v.round)) },
  { id: 'spy', kind: 'task', title: 'Špijunaža i magla rata', body: 'Dodirni crveni teritorij Predstraža i odaberi Istraži. Dobiješ procjenu vojske s razinom pouzdanosti — nikad savršene podatke. Izvješće stiže nakon razrješenja.', tip: 'Susjedne teritorije vidiš djelomično, a daleke samo ograničeno.', goto: { href: '/karta', label: 'Natrag na kartu' }, targets: (c) => [c.outpost], tour: ['act-spy'], done: (c) => c.v.orders.some((o) => sub(o, 'espionage', c.v.round)) },
  { id: 'dip', kind: 'task', title: 'Diplomacija', body: 'Otvori Diplomaciju, pritisni Ponuda kod Marka i pošalji prijedlog saveza (2 ZB). Ponude stižu nakon razrješenja; saveznik dijeli vid, ali izdaja je uvijek moguća — i pamti se.', goto: { href: '/diplomacija', label: 'Otvori Diplomaciju' }, done: (c) => c.v.orders.some((o) => sub(o, 'diplomacy', c.v.round)) },
  { id: 'cond', kind: 'task', title: 'Uvjetna naredba', body: 'Na karti odaberi glavni grad → Uvjetna naredba i spremi zadano (AKO je teritorij napadnut, TADA obrambena formacija). Server je izvršava automatski u trenutku napada.', goto: { href: '/karta', label: 'Natrag na kartu' }, targets: (c) => [c.capital], tour: ['act-cond'], done: (c) => c.v.conditionalOrders.some((o) => o.status === 'active') },
  { id: 'attack-open', kind: 'task', title: 'Vojna operacija', body: 'Dodirni označenu crvenu Predstražu (pulsira — slab, ali stvaran cilj) i pritisni Napadni. Otvara se popup operacije s 6 koraka, a karta ostaje vidljiva.', targets: (c) => [c.outpost], tour: ['act-attack'], done: (c) => c.dom('[data-testid=planner]') && !!document.querySelector('[data-testid=planner-target]')?.textContent?.includes('Predstraža') },
  { id: 'attack-plan', kind: 'task', title: 'Isplaniraj napad', body: 'Prođi korake: Cilj (smjer i strategija), Vojska (+ rezerva), Formacija (+ rizik), Logistika (zalihe i uvjet povlačenja), Uvjeti, Pregled. Pošalji najmanje 12 vojnika — pregled bi trebao pokazati „Povoljno”. Zatim Predaj napad.', tip: 'Bitke su deterministične: nema kocke. Odlučuju sastav, teren, formacija, utvrde, opskrba, moral i tvoje informacije.', done: (c) => c.v.orders.some((o) => sub(o, 'attack', c.v.round)) },
  { id: 'lock', kind: 'task', title: 'Pregledaj i zaključaj', body: 'Ovdje su sve tvoje naredbe, potrošnja ZB i prioriteti (strelice). Nacrti se NE izvršavaju. Kad si gotov, pritisni „Zaključaj konačni popis”.', goto: { href: '/naredbe', label: 'Otvori Operacije' }, done: (c) => c.v.me.ready },
  { id: 'resolve', kind: 'info', title: 'Razrješenje runde', body: 'U pravoj igri server u zadani sat razrješava naredbe svih igrača ISTOVREMENO. Sada ćemo to pokrenuti ručno.', action: 'resolve', done: (c) => c.v.round >= 2 },
  { id: 'report', kind: 'info', title: 'Dnevni izvještaj', body: 'Otvori izvještaj: bojno izvješće objašnjava ishod — snage, faze bitke, čimbenike (teren, utvrde, moral, opskrba) i gubitke. Vidjet ćeš i rezultat špijunaže te promjenu resursa.', goto: { href: '/izvjestaji', label: 'Otvori Izvještaje' } },
  { id: 'end', kind: 'info', title: 'Spreman si!', body: 'Naučio si sve osnove. Još: ako ti padne glavni grad, ne ispadaš — ulaziš u Otpor s jeftinim novačenjem i ustankom. Svaki igrač ima tajni cilj koji otkriva tek završetak. Kampanja traje 7 dana.', tip: 'Savjet: prvo osiguraj hranu, zatim proširi i pregovaraj prije nego napadneš.' },
];

export function TutorialOverlay() {
  const g = useGame();
  const router = useRouter();
  const path = usePathname();
  const [idx, setIdx] = useState(0);
  const [min, setMin] = useState(false);
  const [busy, setBusy] = useState(false);
  const desktop = useIsDesktop();
  const advancing = useRef(false);
  const v = g.view;
  const step = STEPS[idx];
  const outpost = tutorialOutpostId();

  const ctx = useMemo<Ctx | null>(() => v ? ({ v, path, outpost, capital: v.me.capitalId, selected: g.selected, dom: (sel) => !!document.querySelector(sel) }) : null, [v, path, outpost, g.selected]);
  const ctxRef = useRef(ctx); ctxRef.current = ctx;

  // oznake na karti
  useEffect(() => { g.setTourTargets(ctx && step.targets ? step.targets(ctx) : []); return () => g.setTourTargets([]); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [idx, v?.round, v?.orders.length]);

  // isticanje UI elemenata + automatski prelazak kad je zadatak ispunjen
  useEffect(() => {
    const apply = () => {
      document.querySelectorAll('[data-tour-active]').forEach((e) => e.removeAttribute('data-tour-active'));
      for (const key of step.tour ?? []) {
        const els = [...document.querySelectorAll(`[data-tour="${key}"]`)].filter((e) => (e as HTMLElement).offsetParent !== null || e.tagName === 'A');
        els.forEach((e) => e.setAttribute('data-tour-active', ''));
        if (els.length) break;
      }
      const c = ctxRef.current;
      if (c && step.kind === 'task' && step.done?.(c) && !advancing.current) {
        advancing.current = true;
        setTimeout(() => { setIdx((i) => Math.min(STEPS.length - 1, i + 1)); advancing.current = false; }, 900);
      }
    };
    apply();
    const t = setInterval(apply, 350);
    return () => { clearInterval(t); document.querySelectorAll('[data-tour-active]').forEach((e) => e.removeAttribute('data-tour-active')); };
  }, [idx, step]);

  useEffect(() => { setMin(false); }, [idx]);

  if (!v) return null;
  const onMap = path.endsWith('/karta');
  const atTarget = !step.goto || path.endsWith(step.goto.href);
  const minimized = min || (!desktop && step.kind === 'task' && atTarget && (onMap ? !!g.selected : true));
  const next = () => setIdx((i) => Math.min(STEPS.length - 1, i + 1));
  const finish = () => { try { localStorage.setItem('dom_tutorial_done', '1'); } catch { /* */ } router.push('/igra'); };
  const resolve = async () => { setBusy(true); try { await api(`/api/campaigns/tutorial/dev`, { action: 'resolve' }); await g.refresh(); g.toast('Runda razriješena — pogledaj što se dogodilo.', 'good'); next(); } catch (e) { g.toast(e instanceof Error ? e.message : 'Greška', 'bad'); } finally { setBusy(false); } };
  const isTask = step.kind === 'task';
  const here = step.goto ? path.endsWith(step.goto.href) || (step.goto.href === '/karta' && path.endsWith('/karta')) : true;
  const last = idx === STEPS.length - 1;

  return (
    <div className={`fixed z-[55] left-3 right-3 ${onMap || minimized ? 'top-[7.4rem]' : 'bottom-[4.5rem]'} lg:left-[17rem] lg:right-auto lg:top-auto lg:bottom-5 lg:w-[24rem] pointer-events-none`} data-testid="tutorial-card">
      <AnimatePresence mode="wait">
        <motion.div key={idx + (minimized ? 'm' : '')} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="pointer-events-auto bg-white rounded-2xl float-shadow border border-line">
          {minimized ? (
            <button className="w-full flex items-center gap-2 px-4 py-2.5 text-left" onClick={() => setMin(false)}><span className="h-2 w-2 rounded-full bg-primary" /><span className="text-sm font-semibold flex-1 truncate" data-testid="tutorial-title">Vodič {idx + 1}/{STEPS.length} · {step.title}</span><Icon name="down" size={16} className="rotate-180 text-muted" /></button>
          ) : (
            <div className="p-4 space-y-2.5">
              <div className="flex items-center gap-2">
                <div className="flex-1 flex gap-[3px]">{STEPS.map((_, i) => <span key={i} className={`h-1 flex-1 rounded-full ${i < idx ? 'bg-primary' : i === idx ? 'bg-primary/60' : 'bg-neutral-200'}`} />)}</div>
                <button onClick={() => setMin(true)} className="h-7 w-7 grid place-items-center rounded-full text-neutral-400 hover:bg-neutral-50" aria-label="Smanji"><Icon name="down" size={16} /></button>
              </div>
              <div className="flex items-baseline justify-between gap-2"><h3 className="text-[17px] leading-tight" data-testid="tutorial-title">{step.title}</h3><span className="text-xs text-muted shrink-0">{idx + 1} / {STEPS.length}</span></div>
              <p className="text-[14px] leading-snug text-neutral-700">{step.body}</p>
              {step.tip && <p className="text-[13px] leading-snug text-primary bg-primary-100 rounded-xl px-3 py-2">{step.tip}</p>}
              <div className="flex items-center gap-2 pt-0.5">
                {step.goto && !here && <button className="btn btn-yellow btn-sm" onClick={() => router.push(`/k/tutorial${step.goto!.href}`)} data-testid="tutorial-goto">{step.goto.label}</button>}
                {step.action === 'resolve' && <button className="btn btn-yellow btn-sm" disabled={busy} onClick={resolve} data-testid="tutorial-resolve">Pokreni razrješenje</button>}
                {!isTask && !step.action && !last && <button className="btn btn-yellow btn-sm" onClick={next} data-testid="tutorial-next">Dalje</button>}
                {last && <button className="btn btn-yellow btn-sm" onClick={finish} data-testid="tutorial-finish">Završi vodič</button>}
                {isTask && <span className="text-xs text-muted flex-1">Čekam da izvršiš radnju…</span>}
                {isTask && <button className="text-xs font-semibold text-neutral-400 hover:text-neutral-700" onClick={next} data-testid="tutorial-skip">Preskoči</button>}
                {!last && <button className="ml-auto text-xs font-semibold text-neutral-400 hover:text-neutral-700" onClick={() => { resetTutorial(); finish(); }}>Izađi</button>}
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
