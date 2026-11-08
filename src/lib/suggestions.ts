import type { PlayerView } from '@/engine/view';

export type Suggestion = { id: string; title: string; text: string; href: string; cta: string; tone: 'bad' | 'warn' | 'good' | 'info' };

/** Pametne preporuke "Što dalje?" — samo iz podataka koje igrač ionako vidi (nema curenja skrivenih informacija). */
export function suggestions(v: PlayerView, base: string): Suggestion[] {
  const out: Suggestion[] = [];
  if (v.phase !== 'planning') return out;
  const left = v.cp.available - v.cp.used;
  const mine = Object.values(v.territories).filter((t) => t.owner === v.me.id);
  const orders = v.orders.filter((o) => o.round === v.round && ['submitted', 'locked', 'draft'].includes(o.status));
  const has = (type: string) => orders.some((o) => o.type === type);
  const pending = v.offers.filter((o) => o.to === v.me.id && o.status === 'pending').length;
  const res = v.me.resources;

  if (v.me.status === 'resistance') out.push({ id: 'resist', title: 'Pokreni ustanak', text: 'Glavni grad je pao. Naredba „Ustanak“ jedini je put natrag.', href: `${base}/naredbe`, cta: 'Naredbe', tone: 'bad' });
  if (v.forecast.foodShortageRisk) out.push({ id: 'food', title: 'Prijeti glad', text: 'Hrana neće pokriti vojsku. Izgradi farmu ili smanji vojsku.', href: `${base}/kraljevstvo`, cta: 'Razvoj', tone: 'bad' });
  if (v.forecast.rebellionWarning !== 'none') out.push({ id: 'stab', title: 'Stabilnost pada', text: 'Snizi poreze ili izgradi hram prije nego izbije pobuna.', href: `${base}/kraljevstvo`, cta: 'Razvoj', tone: v.forecast.rebellionWarning === 'red' ? 'bad' : 'warn' });
  if (pending > 0) out.push({ id: 'offers', title: `${pending} diplomatska ponuda`, text: 'Netko čeka tvoj odgovor. Savez štiti granicu, ali može i izdati.', href: `${base}/diplomacija`, cta: 'Pogledaj', tone: 'info' });
  if (left > 0 && !has('recruit') && res.gold >= 40 && res.food >= 20) out.push({ id: 'recruit', title: 'Regrutiraj vojsku', text: 'Neiskorištena riznica ne pobjeđuje bitke. Počni od pješaka.', href: `${base}/karta`, cta: 'Karta', tone: 'info' });
  if (left > 0 && !has('build') && mine.length > 0 && res.wood >= 20) out.push({ id: 'build', title: 'Izgradi nešto', text: 'Farma, rudnik ili utvrda donose dugoročnu prednost.', href: `${base}/karta`, cta: 'Karta', tone: 'info' });
  if (left > 0 && !has('research') && v.me.techs.length < 2) out.push({ id: 'tech', title: 'Istraži tehnologiju', text: 'Prvo istraživanje isplati se već sutra.', href: `${base}/tehnologija`, cta: 'Istraživanje', tone: 'info' });
  if (left >= 2 && !has('espionage')) out.push({ id: 'spy', title: 'Izvidi susjeda', text: 'Špijunaža otkriva vojsku prije nego napadneš.', href: `${base}/naredbe`, cta: 'Naredbe', tone: 'info' });
  if (left <= 0 && !v.me.ready) out.push({ id: 'lock', title: 'Sve je potrošeno — zaključaj', text: 'Označi popis kao spreman da se runda razriješi bez čekanja.', href: `${base}/naredbe`, cta: 'Zaključaj', tone: 'good' });
  if (!out.length) out.push({ id: 'ok', title: 'Sve je u redu', text: 'Provjeri kartu ili zaključaj naredbe kad si spreman.', href: `${base}/karta`, cta: 'Karta', tone: 'good' });
  return out.slice(0, 3);
}
