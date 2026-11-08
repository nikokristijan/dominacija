'use client';
import Link from 'next/link';
import { Sheet, Expandable } from '@/components/ui/kit';

const TIPS = [
  'Naredbe su tajne do razrješenja. Nacrt ne troši ništa — resurse rezervira tek predana naredba.',
  'Prvo hrana i novac, zatim vojska. Gladna vojska i prazna riznica gube bitke prije neprijatelja.',
  'Izvidi prije napada. Procjena vojske nikad nije savršena, zato šalji barem 1,3× procijenjene snage.',
  'Uvijek ostavi rezervu kod kuće. Glavni grad nosi 10 bodova protivniku.',
  'Visoki porezi daju zlato, ali stabilnost pada. Ispod 30 prijeti pobuna.',
  'Pakt prije napada: saveznik dijeli vid, ali izdaja pada na ugled.',
];
const GLOSSARY: Array<[string, string]> = [
  ['ZB (zapovjedni bodovi)', 'Dnevni limit naredbi. Napad i istraživanje 3, gradnja/obrana/špijunaža/diplomacija 2, novačenje i trgovina 1.'],
  ['Stabilnost', 'Raspoloženje naroda. Pada zbog poreza, gladi i poraza; ispod 30 izbija pobuna.'],
  ['Opskrba', 'Teritorij mora biti lancem povezan s glavnim gradom, inače je odsječen i slabi.'],
  ['Magla rata', 'Tuđu vojsku vidiš samo procijenjenu (~). Špijunaža podiže pouzdanost.'],
  ['Otpor', 'Ako padne glavni grad, ne ispadaš: ulaziš u Otpor s jeftinim novačenjem i mogućnošću ustanka.'],
  ['Tajni cilj', 'Skriven do kraja; ispunjen donosi 5 bodova.'],
  ['Razrješenje', 'Server u zadani sat istovremeno izvršava naredbe svih igrača.'],
];

export function HelpSheet({ open, onClose, id }: { open: boolean; onClose: () => void; id: string }) {
  return (
    <Sheet open={open} onClose={onClose} title="Pomoć" side tall>
      <div className="p-5 pt-2 space-y-4 overflow-y-auto">
        {id !== 'tutorial' && (
          <Link href="/k/tutorial/karta" onClick={onClose} className="btn btn-yellow w-full" data-testid="help-tutorial">Pokreni vodič (probna bitka)</Link>
        )}
        <div className="space-y-2"><div className="label">Pro savjeti</div><ul className="space-y-2">{TIPS.map((t) => <li key={t} className="flex gap-2.5 text-sm text-neutral-700"><span className="mt-2 h-1 w-1 rounded-full bg-primary shrink-0" />{t}</li>)}</ul></div>
        <div className="space-y-2"><div className="label">Pojmovnik</div>{GLOSSARY.map(([k, v]) => <Expandable key={k} title={k}><p className="text-sm text-neutral-600">{v}</p></Expandable>)}</div>
        <div className="text-xs text-muted">Karta: povuci za pomicanje, štipni ili +/− za zoom. Dodirni teritorij za karticu s akcijama.</div>
      </div>
    </Sheet>
  );
}
