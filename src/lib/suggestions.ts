import type { PlayerView } from '@/engine/view';
import { radar } from './radar';

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

  const fresh = v.middayDone ? [...v.intel].reverse().find((r) => r.round === v.round && r.owner === v.me.id && r.confidence !== 'failed') : undefined;
  const msg = [...v.messages].reverse().find((m) => m.to === v.me.id && m.round === v.round);
  const rad = radar(v);
  const th = rad.find((r) => r.kind === 'threat'), ch = rad.find((r) => r.kind === 'chance');
  if (th) out.push({ id: 'threat', title: th.title, text: th.text, href: `${base}/karta?focus=${th.id}`, cta: 'Na kartu', tone: 'bad' });
  if (fresh) out.push({ id: 'intel', title: 'Izvidnici su se vratili', text: fresh.summary.length > 90 ? fresh.summary.slice(0, 88) + '…' : fresh.summary, href: fresh.territoryId ? `${base}/karta?focus=${fresh.territoryId}` : `${base}/karta`, cta: 'Na kartu', tone: 'good' });
  if (v.dilemma && !v.dilemma.chosen) out.push({ id: 'dilemma', title: `Dilema dana: ${v.dilemma.title}`, text: 'Čeka te odluka s posljedicama — A ili B.', href: base, cta: 'Odluči', tone: 'info' });
  if (v.me.status === 'resistance') out.push({ id: 'resist', title: 'Pokreni ustanak', text: 'Glavni grad je pao. Naredba „Ustanak“ jedini je put natrag.', href: `${base}/naredbe`, cta: 'Naredbe', tone: 'bad' });
  if (v.forecast.foodShortageRisk) out.push({ id: 'food', title: 'Prijeti glad', text: 'Hrana neće pokriti vojsku. Izgradi farmu ili smanji vojsku.', href: `${base}/kraljevstvo`, cta: 'Razvoj', tone: 'bad' });
  if (v.forecast.rebellionWarning !== 'none') out.push({ id: 'stab', title: 'Stabilnost pada', text: 'Snizi poreze ili izgradi hram prije nego izbije pobuna.', href: `${base}/kraljevstvo`, cta: 'Razvoj', tone: v.forecast.rebellionWarning === 'red' ? 'bad' : 'warn' });
  if (ch) out.push({ id: 'chance', title: ch.title, text: ch.text, href: `${base}/karta?op=${ch.id}`, cta: 'Napadni', tone: 'good' });
  if (msg) out.push({ id: 'msg', title: `${v.players[msg.from]?.name ?? 'Netko'} ti piše`, text: `„${msg.body.length > 70 ? msg.body.slice(0, 68) + '…' : msg.body}”`, href: `${base}/diplomacija`, cta: 'Odgovori', tone: 'info' });
  if (pending > 0) out.push({ id: 'offers', title: `${pending} diplomatska ponuda`, text: 'Netko čeka tvoj odgovor. Savez štiti granicu, ali može i izdati.', href: `${base}/diplomacija`, cta: 'Pogledaj', tone: 'info' });
  if (left > 0 && !has('recruit') && res.gold >= 40 && res.food >= 20) out.push({ id: 'recruit', title: 'Regrutiraj vojsku', text: 'Neiskorištena riznica ne pobjeđuje bitke. Počni od pješaka.', href: `${base}/karta`, cta: 'Karta', tone: 'info' });
  if (left > 0 && !has('build') && mine.length > 0 && res.wood >= 20) out.push({ id: 'build', title: 'Izgradi nešto', text: 'Farma, rudnik ili utvrda donose dugoročnu prednost.', href: `${base}/karta`, cta: 'Karta', tone: 'info' });
  if (left > 0 && !has('research') && v.me.techs.length < 2) out.push({ id: 'tech', title: 'Istraži tehnologiju', text: 'Prvo istraživanje isplati se već sutra.', href: `${base}/tehnologija`, cta: 'Istraživanje', tone: 'info' });
  if (left >= 2 && !has('espionage')) out.push({ id: 'spy', title: 'Izvidi susjeda', text: 'Špijunaža otkriva vojsku prije nego napadneš.', href: `${base}/naredbe`, cta: 'Naredbe', tone: 'info' });
  if (left <= 0 && !v.me.ready) out.push({ id: 'lock', title: 'Sve je potrošeno — zaključaj', text: 'Označi popis kao spreman da se runda razriješi bez čekanja.', href: `${base}/naredbe`, cta: 'Zaključaj', tone: 'good' });
  if (!out.length) out.push({ id: 'ok', title: 'Sve je u redu', text: 'Provjeri kartu ili zaključaj naredbe kad si spreman.', href: `${base}/karta`, cta: 'Karta', tone: 'good' });
  return out.slice(0, 4);
}
