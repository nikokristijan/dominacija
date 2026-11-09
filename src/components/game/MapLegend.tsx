'use client';
import { Sheet } from '@/components/ui/kit';
import { Icon } from '@/components/art/Icons';
import { REL } from './HexMap';

const Dot = ({ c }: { c: string }) => <span className="h-3 w-3 rounded-full shrink-0" style={{ background: c }} />;
const Chip = ({ children, tone = 'bg-white' }: { children: React.ReactNode; tone?: string }) => <span className={`inline-flex items-center gap-1 rounded-full border border-line px-2 h-6 text-xs font-semibold shadow-sm ${tone}`}>{children}</span>;
const Row = ({ mark, title, text }: { mark: React.ReactNode; title: string; text: string }) => (
  <div className="flex items-center gap-3 py-2"><div className="w-16 shrink-0 flex justify-center">{mark}</div><div className="min-w-0"><div className="text-sm font-semibold">{title}</div><div className="text-xs text-muted leading-snug">{text}</div></div></div>
);

/** „Kako čitati kartu”: boje, brojevi i znakovi na jednom mjestu. */
export function MapLegend({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Kako čitati kartu">
      <div className="space-y-4" data-testid="map-legend">
        <h2 className="text-xl">Kako čitati kartu</h2>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          {([['me', 'Ti'], ['ally', 'Saveznik'], ['enemy', 'Protivnik'], ['neutral', 'Neutralno']] as const).map(([k, l]) => <div key={k} className="flex items-center gap-2 text-sm font-semibold"><Dot c={REL[k]} />{l}</div>)}
        </div>
        <div className="divide-y divide-line">
          <Row mark={<span className="h-8 w-8 rounded-full grid place-items-center text-white" style={{ background: REL.me }}><Icon name="crown" size={16} stroke={2} /></span>} title="Glavni grad" text="Srce kraljevstva. Padne li, ulaziš u Otpor." />
          <Row mark={<Chip><span className="h-1.5 w-1.5 rounded-full" style={{ background: REL.me }} />6</Chip>} title="Tvoja vojska" text="Točan broj vojnika na tvom teritoriju." />
          <Row mark={<Chip><span className="h-1.5 w-1.5 rounded-full" style={{ background: REL.enemy }} />~8</Chip>} title="Procjena tuđe vojske" text="Vidiš je samo uz svoju granicu ili nakon izvida. Što je pouzdanije izvješće, to je broj točniji." />
          <Row mark={<span className="h-7 w-7 rounded-full bg-[#C9A24A] text-white grid place-items-center"><Icon name="flag" size={12} stroke={2.4} /></span>} title="Razbojnički kamp" text="Jače čuvan neutralni teritorij. Tko ga razbije, uzima plijen." />
          <Row mark={<span className="h-7 w-7 rounded-full bg-bad text-white grid place-items-center text-sm font-bold">!</span>} title="Prijetnja" text="Neprijatelj uz tvoju granicu jači je od tvoje straže. Dodirni teritorij za detalje." />
          <Row mark={<span className="h-7 w-7 rounded-full bg-good text-white grid place-items-center text-base font-bold">+</span>} title="Prilika" text="Slabo branjen cilj uz tvoju vojsku — mogući napad." />
        </div>
        <p className="text-xs text-muted">Dodirni teritorij za karticu s akcijama. Štipni za zoom — imena mjesta pojavljuju se približavanjem. Ikona slojeva mijenja prikaz (vlasnici, regije, proizvodnja).</p>
        <button className="btn btn-yellow w-full" onClick={onClose}>Razumijem</button>
      </div>
    </Sheet>
  );
}
