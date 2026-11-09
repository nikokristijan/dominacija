import type { PlayerView } from '@/engine/view';
import type { BattleReport } from '@/engine/types';

export interface EditionItem { id: string; kind: 'win' | 'loss' | 'news' | 'diplomacy' | 'spy' | 'good' | 'bad'; title: string; text: string; territoryId?: string }
export interface Edition {
  round: number; headline: string; kicker: string;
  score: { before: number; after: number }; rank: { before: number | null; after: number };
  items: EditionItem[]; rival: string | null; teaser: string | null;
}

const rankOf = (scores: Record<string, number>, id: string) => 1 + Object.entries(scores).filter(([k, s]) => k !== id && s > (scores[id] ?? 0)).length;

/** "Jutarnje izdanje": dramatizira ono što je igrač smio vidjeti u prošloj rundi (samo podaci iz pogleda — bez curenja). */
export function buildEdition(v: PlayerView, round: number): Edition | null {
  const rep = v.reports.find((r) => r.round === round);
  if (!rep) return null;
  const nm = (id: string | null | undefined) => (id ? v.players[id]?.name ?? 'Nepoznat' : 'Neutralni');
  const me = v.me.id;
  const battles: BattleReport[] = v.battles.filter((b) => b.round === round);
  const items: EditionItem[] = [];
  let headline = '';
  let weight = -1;
  const pick = (w: number, h: string) => { if (w > weight) { weight = w; headline = h; } };

  for (const b of battles) {
    const myAtt = b.attackers.some((a) => a.playerId === me);
    const won = b.outcome === 'attacker_victory';
    const attName = nm(b.attackers[0]?.playerId);
    if (myAtt) {
      if (won) { items.push({ id: b.id, kind: 'win', title: `Osvojio si ${b.territoryName}`, text: b.captured ? 'Teritorij je tvoj. Protivnik se povlači.' : 'Napad je uspio.', territoryId: b.territoryId }); pick(b.territoryName && /glavn/i.test(b.territoryName) ? 9 : 7, `${v.me.name} osvaja ${b.territoryName}!`); }
      else { items.push({ id: b.id, kind: 'loss', title: `Napad na ${b.territoryName} propao`, text: b.outcome === 'retreat' ? 'Vojska se povukla prije potpunog poraza.' : 'Obrana je izdržala. Izvidi bolje prije idućeg pokušaja.', territoryId: b.territoryId }); pick(4, `Slom kod ${b.territoryName}: napad odbijen`); }
    } else if (b.defenderId === me) {
      if (won) { items.push({ id: b.id, kind: 'loss', title: `Pao je ${b.territoryName}`, text: `${attName} ga je osvojio.`, territoryId: b.territoryId }); pick(8, `Pad ${b.territoryName}! ${attName} u ofenzivi`); }
      else { items.push({ id: b.id, kind: 'win', title: `Obranio si ${b.territoryName}`, text: `${attName} je odbijen.`, territoryId: b.territoryId }); pick(6, `${b.territoryName} drži! ${attName} odbijen`); }
    } else {
      items.push({ id: b.id, kind: 'news', title: `${attName} ${won ? 'osvaja' : 'bezuspješno napada'} ${b.territoryName}`, text: b.defenderId ? `Branitelj: ${nm(b.defenderId)}.` : 'Neutralni teritorij.', territoryId: b.territoryId });
      pick(3, `${attName} ${won ? 'osvaja' : 'napada'} ${b.territoryName}`);
    }
  }
  for (const e of rep.entries) {
    if (e.refs?.battleId) continue;
    if (e.category === 'diplomacy') { items.push({ id: e.id, kind: 'diplomacy', title: 'Diplomacija', text: e.text }); if (/izda|prekin|raskin/i.test(e.text)) pick(8, 'Izdaja! Savez je pao'); else pick(2, 'Dogovori iza zatvorenih vrata'); }
    else if (e.category === 'espionage') items.push({ id: e.id, kind: 'spy', title: 'Obavještajna služba', text: e.text });
    else if (e.category === 'event') { items.push({ id: e.id, kind: 'news', title: 'Svjetski događaj', text: e.text }); pick(2, e.text.length < 60 ? e.text : 'Svijet se mijenja'); }
    else if ((e.category === 'military' || e.category === 'territory') && e.refs?.territoryId && e.audience.includes(me)) { items.push({ id: e.id, kind: e.severity === 'bad' ? 'bad' : 'news', title: e.category === 'territory' ? 'Promjena na karti' : 'Vijesti s bojišta', text: e.text, territoryId: e.refs.territoryId }); pick(e.severity === 'bad' ? 7 : 3, e.text.length < 70 ? e.text : 'Karta se mijenja'); }
    else if (e.category === 'achievement') { items.push({ id: e.id, kind: 'good', title: 'Postignuće', text: e.text }); pick(5, 'Nova slava za tvoje kraljevstvo'); }
    else if (e.severity === 'bad' && e.category !== 'military') items.push({ id: e.id, kind: 'bad', title: 'Upozorenje', text: e.text });
  }
  const prev = v.history.find((h) => h.round === round - 1)?.scores ?? null;
  const cur = v.history.find((h) => h.round === round)?.scores ?? Object.fromEntries(v.ranking.map((r) => [r.playerId, r.score]));
  const rankAfter = rankOf(cur, me);
  const rankBefore = prev ? rankOf(prev, me) : null;

  // Rival iz istih bodova kao i mjesto (jedan izvor istine): najbliži iznad tebe, a ako si prvi — onaj tko te progoni
  const sorted = Object.entries(cur).sort((a, b) => b[1] - a[1]);
  const myIdx = sorted.findIndex(([id]) => id === me);
  let rival: string | null = null;
  if (myIdx > 0) rival = `${nm(sorted[myIdx - 1][0])} te vodi za ${Math.max(1, sorted[myIdx - 1][1] - sorted[myIdx][1])} bod.`;
  else if (sorted.length > 1) rival = `${nm(sorted[1][0])} ti je iza za samo ${Math.max(0, sorted[0][1] - sorted[1][1])} bod.`;

  if (!headline) {
    const leader = nm(sorted[0]?.[0]);
    headline = myIdx === 0 ? 'Na vrhu si. Pitanje je samo koliko dugo' : round === 1 ? `${leader} izlazi u vodstvo — još nije kasno` : `${leader} vodi, ali tišina vara`;
  }

  const op = v.me.objectiveProgress;
  const goal = op && !op.done && op.target > 0 && op.current / op.target >= 0.5 ? `Tajni cilj „${v.me.objective.title}”: ${op.label}. Još malo!` : null;
  const nextEv = v.events.find((e) => e.round === v.round && e.announced) ?? v.events.find((e) => e.round === v.round + 1 && e.announced);
  const left = v.totalRounds - round;
  const teaser = goal ?? (nextEv && nextEv.type !== 'none' ? `Danas stiže: ${nextEv.title}. ${nextEv.effects[0] ?? ''}`.trim()
    : left <= 1 ? 'Posljednji dan! Sve ili ništa.' : left <= 3 ? `Još ${left} dana — vrijeme je za odlučne poteze.` : 'Što će tvoji protivnici smisliti do sutra?');

  return { round, headline, kicker: `Dominacija Glasnik · dan ${round}`, score: { before: rep.scoreBefore, after: rep.scoreAfter }, rank: { before: rankBefore, after: rankAfter }, items: items.slice(0, 6), rival, teaser };
}
