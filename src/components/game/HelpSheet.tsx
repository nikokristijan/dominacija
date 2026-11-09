'use client';
import Link from 'next/link';
import { Sheet, Expandable } from '@/components/ui/kit';
import { GLOSSARY } from '@/lib/glossary';

const TIPS = [
  'Naredbe su tajne do razrješenja. Nacrt ne troši ništa — resurse rezervira tek predana naredba.',
  'Prvo hrana i novac, zatim vojska. Gladna vojska i prazna riznica gube bitke prije neprijatelja.',
  'Izvidi prije napada. Procjena vojske nikad nije savršena, zato šalji barem 1,3× procijenjene snage.',
  'Uvijek ostavi rezervu kod kuće. Glavni grad nosi 10 bodova protivniku.',
  'Visoki porezi daju zlato, ali stabilnost pada. Ispod 30 prijeti pobuna.',
  'Pakt prije napada: saveznik dijeli vid, ali izdaja pada na ugled.',
];


export function HelpSheet({ open, onClose, id }: { open: boolean; onClose: () => void; id: string }) {
  return (
    <Sheet open={open} onClose={onClose} title="Pomoć" side tall>
      <div className="p-5 pt-2 space-y-4 overflow-y-auto">
        {id !== 'tutorial' && (
          <Link href="/k/tutorial/karta" onClick={onClose} className="btn btn-yellow w-full" data-testid="help-tutorial">Pokreni vodič (probna bitka)</Link>
        )}
        <div className="space-y-2"><div className="label">Pro savjeti</div><ul className="space-y-2">{TIPS.map((t) => <li key={t} className="flex gap-2.5 text-sm text-neutral-700"><span className="mt-2 h-1 w-1 rounded-full bg-primary shrink-0" />{t}</li>)}</ul></div>
        <div className="space-y-2"><div className="label">Pojmovnik</div>{Object.values(GLOSSARY).map((g) => <Expandable key={g.term} title={g.term}><p className="text-sm text-neutral-600">{g.text}</p></Expandable>)}</div>
        <div className="text-xs text-muted">Karta: povuci za pomicanje, štipni ili +/− za zoom. Dodirni teritorij za karticu s akcijama.</div>
      </div>
    </Sheet>
  );
}
