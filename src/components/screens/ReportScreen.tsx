'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { UNIT_TYPES } from '@/engine/config';
import type { BattleReport, ReportCategory, Units } from '@/engine/types';
import { ClashEffect } from '@/components/art/Effects';
import { Penguin } from '@/components/art/Penguin';
import { ResourceIcon } from '@/components/art/Resources';
import { Expandable, Empty, SectionTitle } from '@/components/ui/kit';
import { useGame } from '@/components/game/GameProvider';
import { describeUnits } from '@/engine/util';
import { signed } from '@/lib/format';

const CATS: Array<{ id: ReportCategory[]; title: string }> = [
  { id: ['military'], title: 'Vojni ishodi' }, { id: ['territory'], title: 'Promjene teritorija' }, { id: ['economy', 'research'], title: 'Gospodarstvo i istraživanje' },
  { id: ['diplomacy', 'espionage'], title: 'Diplomacija i obavještajna služba' }, { id: ['event'], title: 'Svjetski događaji' }, { id: ['achievement'], title: 'Postignuća' }, { id: ['notice'], title: 'Obavijesti' },
];
const SEV: Record<string, string> = { good: 'border-green-200 bg-green-50', bad: 'border-red-200 bg-red-50', warn: 'border-orange-200 bg-orange-50', info: 'border-line bg-white' };
const unitsText = (u: Units) => describeUnits(u);

export function ReportScreen() {
  const g = useGame();
  const v = g.view!;
  const rounds = v.reports.map((r) => r.round);
  const [round, setRound] = useState<number | null>(null);
  const cur = round ?? rounds[rounds.length - 1] ?? null;
  const rep = v.reports.find((r) => r.round === cur);
  const battles = v.battles.filter((b) => b.round === cur);
  if (!rep) return <div className="flex-1 overflow-y-auto"><div className="max-w-xl mx-auto p-4"><Empty title="Još nema izvještaja" text="Prvi dnevni izvještaj stiže nakon što se razriješi prva runda. Dotad planiraj pametno!" mood="thinking" /></div></div>;
  const L = rep.ledger;
  const delta = (k: 'gold' | 'food' | 'iron' | 'wood' | 'influence') => L.after[k] - L.before[k];
  return (
    <div className="flex-1 overflow-y-auto" data-testid="report-screen">
      <div className="max-w-3xl mx-auto p-3 lg:p-5 space-y-4">
        <div className="scroll-x">{rounds.map((r) => <button key={r} onClick={() => setRound(r)} className={`shrink-0 rounded-2xl px-4 min-h-10 font-extrabold ${cur === r ? 'tab-active' : 'bg-white border-2 border-line text-primary'}`}>Dan {r}</button>)}</div>
        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="panel-dark p-4 flex items-center gap-3">
          <Penguin mood={rep.mood} size={96} />
          <div className="flex-1"><div className="text-xs font-extrabold text-white/70 uppercase">Dnevni izvještaj</div><h1 className="text-3xl">Dan {rep.round}</h1><div className="font-bold">Bodovi: {rep.scoreBefore} → <span className="text-accent font-display text-xl">{rep.scoreAfter}</span> ({signed(rep.scoreAfter - rep.scoreBefore)})</div></div>
        </motion.section>

        {battles.length > 0 && (<section className="space-y-2"><SectionTitle icon="sword">Bojna izvješća</SectionTitle>{battles.map((b) => <BattleCard key={b.id} b={b} />)}</section>)}

        <section className="card space-y-2">
          <SectionTitle icon="coins">Promjena resursa</SectionTitle>
          <div className="grid grid-cols-5 gap-1.5 text-center">{(['gold', 'food', 'iron', 'wood', 'influence'] as const).map((k) => <div key={k} className="rounded-2xl bg-primary-100/50 py-2"><ResourceIcon name={k} size={26} className="mx-auto" /><div className="font-display font-extrabold">{Math.floor(L.after[k])}</div><div className={`text-xs font-black ${delta(k) < 0 ? 'text-bad' : 'text-good'}`}>{signed(delta(k), 0)}</div></div>)}</div>
          <Expandable title="Razrada">
            <table className="w-full text-sm"><tbody>
              <Row l="Proizvodnja" r={(['gold', 'food', 'iron', 'wood', 'influence'] as const).map((k) => L.production[k] ? `${k === 'gold' ? 'z' : k[0]}${L.production[k].toFixed(0)}` : '').filter(Boolean).join(' · ')} />
              <Row l="Porezi" r={`+${L.taxes.toFixed(1)} zlata`} /><Row l="Održavanje vojske" r={`−${L.upkeep.gold.toFixed(1)} zlata, −${L.upkeep.food.toFixed(1)} hrane`} />
              <Row l="Potrošeno na naredbe" r={(['gold', 'food', 'iron', 'wood', 'influence'] as const).map((k) => L.spending[k] ? `${L.spending[k]} ${k}` : '').filter(Boolean).join(', ') || '—'} />
              <Row l="Razmjena i plijen" r={(['gold', 'food', 'iron', 'wood', 'influence'] as const).map((k) => L.trade[k] ? `${signed(L.trade[k], 0)} ${k}` : '').filter(Boolean).join(', ') || '—'} />
            </tbody></table>
          </Expandable>
        </section>

        {CATS.map((c) => { const list = rep.entries.filter((e) => c.id.includes(e.category)); if (!list.length) return null; return (
          <section key={c.title} className="space-y-1.5"><SectionTitle>{c.title}</SectionTitle>{list.map((e) => <div key={e.id} className={`rounded-2xl border-2 p-2.5 text-sm font-bold ${SEV[e.severity]}`}>{e.text}</div>)}</section>); })}
        {rep.entries.length === 0 && <div className="card-flat text-muted font-bold text-center">Mirna runda — ništa posebno.</div>}
      </div>
    </div>
  );
}
const Row = ({ l, r }: { l: string; r: string }) => <tr className="border-b border-line/60 last:border-0"><td className="py-1.5 text-muted font-bold">{l}</td><td className="py-1.5 text-right font-extrabold">{r}</td></tr>;

function BattleCard({ b }: { b: BattleReport }) {
  const g = useGame();
  const v = g.view!;
  const won = b.outcome === 'attacker_victory';
  const mineAtt = b.attackers.some((a) => a.playerId === v.me.id);
  const good = (mineAtt && won) || (!mineAtt && !won);
  const total = (u: Units) => UNIT_TYPES.reduce((n, k) => n + (u[k] ?? 0), 0);
  return (
    <Expandable defaultOpen={false} title={<span className="flex items-center gap-2"><ClashEffect size={34} /><span><span className="block font-display text-lg leading-tight">{b.territoryName}</span><span className={`text-xs font-extrabold ${good ? 'text-good' : 'text-bad'}`}>{b.outcome === 'attacker_victory' ? 'Napad uspio' : b.outcome === 'retreat' ? 'Napadač se povukao' : 'Obrana izdržala'}</span></span></span>} badge={<span className={`chip ${good ? 'chip-good' : 'chip-bad'}`}>{good ? 'Pobjeda' : 'Poraz'}</span>}>
      <div className="space-y-3" data-testid="battle-card">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-2xl bg-red-50 p-2.5"><div className="label !text-red-700">Napadač</div>{b.attackers.map((a, i) => <div key={i} className="font-bold">{v.players[a.playerId]?.name}: {unitsText(a.units)}</div>)}<div className="text-xs text-muted">Snaga {Math.round(b.attackerPower)} · gubici: {unitsText(b.attackerLosses)}</div></div>
          <div className="rounded-2xl bg-blue-50 p-2.5"><div className="label !text-blue-700">Branitelj</div><div className="font-bold">{b.defenderId ? v.players[b.defenderId]?.name : 'Neutralni'}: {unitsText(b.defenderUnits)}</div><div className="text-xs text-muted">Snaga {Math.round(b.defenderPower)} · gubici: {unitsText(b.defenderLosses)}</div></div>
        </div>
        <div><div className="label mb-1">Tijek bitke</div><div className="space-y-1.5">{b.phases.map((p) => <div key={p.n} className="flex items-center gap-2 text-xs font-bold"><span className="w-12 text-muted">Faza {p.n}</span><div className="flex-1 h-3 rounded-full bg-primary-100 overflow-hidden flex"><div className="h-full bg-red-400" style={{ width: `${Math.min(100, (p.attackerPower / (p.attackerPower + p.defenderPower || 1)) * 100)}%` }} /><div className="h-full bg-blue-400 flex-1" /></div><span className="w-24 text-right">−{p.attackerLossPct.toFixed(0)}% / −{p.defenderLossPct.toFixed(0)}%</span></div>)}</div></div>
        <div><div className="label mb-1">Čimbenici</div><div className="flex flex-wrap gap-1.5">{b.factors.map((f, i) => <span key={i} className={`chip ${f.impact === 'positive' ? (f.side === 'attacker' ? 'chip-bad' : 'chip-good') : 'chip-warn'}`}><span className="opacity-70">{f.side === 'attacker' ? 'Nap.' : 'Obr.'}</span> {f.label}: {f.value}</span>)}</div></div>
        <div className="rounded-2xl bg-primary-100/60 p-3 text-sm font-bold space-y-1">{b.explanation.map((e, i) => <p key={i}>{e}</p>)}<p className="text-xs text-muted">Preživjeli napadači: {total(b.attackerSurvivors)} · preživjeli branitelji: {total(b.defenderSurvivors)}</p></div>
      </div>
    </Expandable>
  );
}
