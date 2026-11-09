/**
 * Dnevna dilema: svaki dan svaki igrač dobiva jednu malu odluku s cijenom (A ili B). Bez novih sustava koje treba učiti —
 * samo priča i izbor. Raspored je deterministički po igraču (nema dvije iste dilema u kampanji).
 */
import { createRng } from './rng';
import { adjustReputation } from './diplomacy';
import { emit } from './util';
import type { GameState, PlayerId, Resources, Units } from './types';

export interface Effects { res?: Partial<Resources>; stability?: number; reputation?: number; units?: Units }
export interface Option { label: string; effects: Effects; result: string }
export interface DilemmaDef { id: string; title: string; text: string; a: Option; b: Option }

export const DILEMMAS: DilemmaDef[] = [
  { id: 'bribe', title: 'Glasnik s kesom', text: 'Strani glasnik nudi kesu zlata ako „ne primijetiš” njegovu karavanu na granici.',
    a: { label: 'Primi mito', effects: { res: { gold: 45 }, reputation: -6 }, result: 'Zlato je legnulo u riznicu, ali glasine se šire.' },
    b: { label: 'Odbij i javno ga ukori', effects: { reputation: 4, stability: 1 }, result: 'Narod je ponosan na tvoju poštenu riječ.' } },
  { id: 'caravan', title: 'Karavana trgovaca', text: 'Duga karavana zaustavila se kod vrata. Carinici traže odluku.',
    a: { label: 'Naplati carinu', effects: { res: { gold: 35 }, stability: -3 }, result: 'Riznica je bogatija, trgovci mrmljaju.' },
    b: { label: 'Pusti ih slobodno', effects: { res: { food: 15 }, stability: 4 }, result: 'Zahvalni trgovci ostavljaju zalihe.' } },
  { id: 'hunger', title: 'Kruha, kralju!', text: 'Seljaci okupljeni pred dvorom traže hranu iz zaliha.',
    a: { label: 'Podijeli zalihe', effects: { res: { food: -25 }, stability: 6 }, result: 'Gladni su siti, a ti si voljen.' },
    b: { label: 'Pošalji stražu', effects: { res: { gold: 15 }, stability: -7 }, result: 'Red je vraćen, ali srdžba tinja.' } },
  { id: 'knight', title: 'Lutajući vitez', text: 'Vitez bez gospodara nudi svoj mač i svoje ljude — za cijenu.',
    a: { label: 'Zaposli ga', effects: { res: { gold: -30 }, units: { infantry: 5 } }, result: 'Pet iskusnih boraca pridružilo se glavnom gradu.' },
    b: { label: 'Otpusti ga uz dar', effects: { res: { gold: -5 }, reputation: 4 }, result: 'Vitez te hvali po svim krčmama.' } },
  { id: 'mine', title: 'Stari rudnik', text: 'Pastiri su pronašli zaboravljeni rudnik. Što s njim?',
    a: { label: 'Iskopaj odmah', effects: { res: { wood: -20, iron: 25 } }, result: 'Prva ruda već stiže u kovačnice.' },
    b: { label: 'Prodaj kartu', effects: { res: { gold: 30 } }, result: 'Poduzetnik je platio lijepu svotu.' } },
  { id: 'plague', title: 'Kuga u luci', text: 'Bolesni mornari spustili su se u grad. Liječnici traže odluku.',
    a: { label: 'Proglasi karantenu', effects: { res: { gold: -20 }, stability: 3 }, result: 'Bolest je zaustavljena na vratima.' },
    b: { label: 'Ignoriraj', effects: { stability: -6 }, result: 'Bolest se proširila, narod je preplašen.' } },
  { id: 'spy', title: 'Špijun nudi tajnu', text: 'Uhvaćeni dvostruki špijun nudi ono što zna.',
    a: { label: 'Plati za tajnu', effects: { res: { gold: -15, influence: 8 } }, result: 'Tajne se pretvaraju u utjecaj na dvoru.' },
    b: { label: 'Strpaj ga u tamnicu', effects: { reputation: 2, res: { influence: 2 } }, result: 'Pošteno, ali bez koristi.' } },
  { id: 'feast', title: 'Žetvena svetkovina', text: 'Narod traži gozbu za kraj žetve.',
    a: { label: 'Priredi gozbu', effects: { res: { food: -30, gold: -10 }, stability: 8 }, result: 'Pjesma se čula do sutra.' },
    b: { label: 'Štedi zalihe', effects: { stability: -2, res: { food: 10 } }, result: 'Zalihe su sigurne, raspoloženje nije.' } },
  { id: 'prisoner', title: 'Zarobljeni vojnik', text: 'Tvoja straža zarobila je neprijateljskog vojnika. Obitelj nudi otkup.',
    a: { label: 'Pusti ga', effects: { reputation: 5 }, result: 'Gest milosti dobar je za ugled.' },
    b: { label: 'Uzmi otkup', effects: { res: { gold: 40 }, reputation: -4 }, result: 'Novac je stigao, čast je ostala.' } },
  { id: 'smith', title: 'Kovač nudi oružje', text: 'Majstor kovač nudi seriju novih mačeva po povoljnoj cijeni.',
    a: { label: 'Kupi sve', effects: { res: { gold: -35, iron: 22 } }, result: 'Kovačnice su pune željeza.' },
    b: { label: 'Odbij', effects: { res: { gold: 5 } }, result: 'Ostavio si novac za bolje dane.' } },
  { id: 'envoy', title: 'Poslanik na dvoru', text: 'Dalek poslanik čeka audijenciju i dar.',
    a: { label: 'Daj dar', effects: { res: { gold: -20, influence: 8 } }, result: 'Tvoje se ime sada spominje u tuđim dvorima.' },
    b: { label: 'Primi ga hladno', effects: { reputation: -3, res: { influence: -2 } }, result: 'Poslanik odlazi uvrijeđen.' } },
  { id: 'forest', title: 'Šuma gori', text: 'Vatra prijeti drvosječama. Gasiti ili spasiti drva?',
    a: { label: 'Gasi vatru', effects: { res: { food: -12 }, stability: 3 }, result: 'Sela su spašena.' },
    b: { label: 'Spasi što se spasiti može', effects: { res: { wood: 28 }, stability: -3 }, result: 'Drvo je spremno, ali tuga je velika.' } },
];

const RES_LBL: Record<string, string> = { gold: 'zlata', food: 'hrane', iron: 'željeza', wood: 'drva', influence: 'utjecaja' };
/** Kratki opis učinka za gumb („+45 zlata · −6 ugleda”). */
export function describeEffects(e: Effects): string {
  const out: string[] = [];
  for (const [k, n] of Object.entries(e.res ?? {})) if (n) out.push(`${n > 0 ? '+' : '−'}${Math.abs(n)} ${RES_LBL[k]}`);
  if (e.stability) out.push(`${e.stability > 0 ? '+' : '−'}${Math.abs(e.stability)} stabilnosti`);
  if (e.reputation) out.push(`${e.reputation > 0 ? '+' : '−'}${Math.abs(e.reputation)} ugleda`);
  if (e.units) for (const [k, n] of Object.entries(e.units)) out.push(`+${n} ${k === 'infantry' ? 'pješaka' : k}`);
  return out.join(' · ') || 'bez učinka';
}

/** Dilema za igrača i rundu (determinirano; permutacija po igraču, pa se ništa ne ponavlja). */
export function dilemmaFor(s: GameState, pid: PlayerId, round: number): DilemmaDef {
  const order = createRng(`${s.seed}:dilemma:${pid}`).shuffle(DILEMMAS.slice());
  return order[(round - 1) % order.length];
}

export function chooseDilemma(s: GameState, pid: PlayerId, choice: 'a' | 'b'): { ok: boolean; error?: string; summary?: string } {
  const p = s.players[pid];
  if (s.phase !== 'planning') return { ok: false, error: 'Dilema se rješava u fazi planiranja.' };
  p.dilemmas ??= {};
  if (p.dilemmas[s.round]) return { ok: false, error: 'Već si odlučio o današnjoj dilemi.' };
  const d = dilemmaFor(s, pid, s.round);
  const opt = choice === 'a' ? d.a : d.b;
  for (const [k, n] of Object.entries(opt.effects.res ?? {})) if (n < 0 && p.resources[k as keyof Resources] + n < 0) return { ok: false, error: `Nemaš dovoljno resursa za ovaj izbor (${RES_LBL[k]}).` };
  for (const [k, n] of Object.entries(opt.effects.res ?? {})) p.resources[k as keyof Resources] = Math.max(0, Math.round((p.resources[k as keyof Resources] + n) * 100) / 100);
  if (opt.effects.stability) { p.stability = Math.max(0, Math.min(100, p.stability + opt.effects.stability)); }
  if (opt.effects.reputation) adjustReputation(s, p, opt.effects.reputation);
  if (opt.effects.units) {
    const cap = s.map.territories[p.capitalId];
    if (cap.owner === pid) for (const [u, n] of Object.entries(opt.effects.units)) cap.garrison[u as keyof Units] = (cap.garrison[u as keyof Units] ?? 0) + (n ?? 0);
  }
  p.dilemmas[s.round] = choice;
  const summary = `${d.title}: ${opt.label}. ${opt.result} (${describeEffects(opt.effects)})`;
  emit(s, s.round, 'event', summary, [pid], (opt.effects.reputation ?? 0) < 0 || (opt.effects.stability ?? 0) < 0 ? 'warn' : 'good');
  return { ok: true, summary };
}
