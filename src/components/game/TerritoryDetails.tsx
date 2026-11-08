'use client';
import { useState } from 'react';
import { UNIT_TYPES } from '@/engine/config';
import type { OrderType } from '@/engine/types';
import { Icon } from '@/components/art/Icons';
import { Building } from '@/components/art/Buildings';
import { ResourceIcon } from '@/components/art/Resources';
import { UnitIcon } from '@/components/art/Characters';
import { ActionRow, Progress, Seg } from '@/components/ui/kit';
import { fmtRange } from '@/engine/intel';
import { unitTotal } from '@/engine/util';
import { timeAgo } from '@/lib/format';
import { useGame } from './GameProvider';
import { REL } from './HexMap';
import type { TerritoryView } from '@/engine/view';

const CONF: Record<string, string> = { high: 'visoka', medium: 'srednja', low: 'niska', none: '—' };
const RES_L = { gold: 'zlato', food: 'hrana', iron: 'željezo', wood: 'drvo', influence: 'utjecaj' } as const;

export function adjacentOwned(view: NonNullable<ReturnType<typeof useGame>['view']>, id: string) {
  const t = view.territories[id];
  const out: string[] = [];
  const dirs = t.row % 2 === 0 ? [[1, 0], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1]] : [[1, 0], [1, 1], [0, 1], [-1, 0], [0, -1], [1, -1]];
  for (const [dc, dr] of dirs) {
    const n = view.territories[`h${t.col + dc}_${t.row + dr}`];
    if (n && n.owner === view.me.id && n.terrain !== 'water') out.push(n.id);
  }
  return out;
}

type Act = OrderType | 'conditional';

/** Sadržaj kontekstualnog popupa teritorija: Pregled · Razvoj · Vojska · Obrana · Više (vlastiti) / Pregled · Obavještajno (tuđi). */
export function TerritoryDetails({ t, onAction, onOperation }: { t: TerritoryView; onAction: (type: Act, territoryId: string) => void; onOperation: (targetId: string) => void }) {
  const g = useGame();
  const v = g.view!;
  const cfg = v.config;
  const mine = t.owner === v.me.id;
  const owner = t.owner ? v.players[t.owner] : null;
  const region = v.map.regions.find((r) => r.id === t.regionId);
  const [tab, setTab] = useState<'pregled' | 'razvoj' | 'vojska' | 'obrana' | 'vise' | 'intel'>('pregled');
  const intelReports = v.intel.filter((r) => r.territoryId === t.id).sort((a, b) => b.round - a.round);
  const adj = adjacentOwned(v, t.id);
  const planning = v.phase === 'planning' && !v.me.ready;
  const canAttack = !mine && t.terrain !== 'water' && adj.length > 0;
  const prod = t.production;
  const relCol = mine ? REL.me : owner ? (owner.relation === 'ally' || owner.relation === 'pact' ? REL.ally : REL.enemy) : REL.neutral;
  const armyTotal = mine ? unitTotal(t.garrison ?? {}) : t.armyEstimate?.exact ? unitTotal(t.armyEstimate.exact) : null;
  const tabs = mine
    ? [{ value: 'pregled', label: 'Pregled' }, { value: 'razvoj', label: 'Razvoj' }, { value: 'vojska', label: 'Vojska' }, { value: 'obrana', label: 'Obrana' }, { value: 'vise', label: 'Više' }]
    : [{ value: 'pregled', label: 'Pregled' }, { value: 'intel', label: 'Obavještajno' }];
  const defTotal = Math.round(((t.defenseLevel ?? 0) * cfg.defense.levelBonus + (t.isCapital ? cfg.defense.capitalBonus : 0) + (t.building === 'fortress' ? cfg.defense.fortressBonusPerLevel * (t.buildingLevel ?? 0) : 0)) * 100);

  return (
    <div className="space-y-4" data-testid="territory-details">
      <div className="flex items-center gap-3.5">
        <div className="h-12 w-12 rounded-xl grid place-items-center bg-neutral-50 text-neutral-700 shrink-0">{t.building || t.isCapital ? <Building type={t.building ?? 'capital'} size={26} /> : <Icon name="map" size={24} stroke={1.6} />}</div>
        <div className="min-w-0 flex-1">
          <h3 className="text-xl leading-tight truncate" data-testid="territory-name">{t.name}</h3>
          <div className="text-sm text-muted flex items-center gap-1.5 flex-wrap"><span>{cfg.terrain[t.terrain].name}{region ? ` · ${region.name}` : ''}</span></div>
        </div>
      </div>
      <div className="flex items-center gap-2 text-sm font-semibold flex-wrap">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1"><span className="h-2 w-2 rounded-full" style={{ background: relCol }} />{mine ? 'Tvoj teritorij' : owner ? `${owner.name}${owner.relation === 'ally' ? ' · saveznik' : ''}` : 'Neutralni stanovnici'}</span>
        {t.isCapital && <span className="chip">Glavni grad{t.capitalOf && t.capitalOf !== t.owner ? ' (okupiran)' : ''}</span>}
        {t.resource && <span className="chip chip-good">Nalazište: {RES_L[t.resource]}</span>}
      </div>

      <Seg small value={tab} onChange={(x) => setTab(x as typeof tab)} options={tabs} />

      {tab === 'pregled' && (
        <div className="space-y-4">
          {mine && prod ? (
            <div className="grid grid-cols-3 gap-2 text-center border-y border-line py-3">
              {(['food', 'iron', 'gold'] as const).map((k) => <div key={k} className="flex items-center justify-center gap-1.5 font-semibold"><ResourceIcon name={k} size={18} className="text-neutral-500" />+{Math.round(prod.total[k])}<span className="text-xs text-muted">/d</span></div>)}
            </div>
          ) : null}
          <div className="grid grid-cols-2 border-b border-line pb-3">
            <div className="flex items-center gap-3"><Icon name="shield" size={24} stroke={1.5} className="text-neutral-500" /><div><div className="text-xs text-muted">Obrana</div><div className="text-xl font-semibold leading-tight">{mine || t.defenseLevel !== undefined ? `+${defTotal}%` : '?'}</div></div></div>
            <div className="flex items-center gap-3 pl-4 border-l border-line"><Icon name="swords" size={24} stroke={1.5} className="text-neutral-500" /><div><div className="text-xs text-muted">Vojska</div><div className="text-xl font-semibold leading-tight">{mine ? armyTotal : t.armyEstimate?.range ? fmtRange(t.armyEstimate.range) : armyTotal ?? '?'}</div></div></div>
          </div>
          {t.supplied === false && <div className="rounded-xl bg-red-50 p-3 text-sm text-bad font-medium">Odsječen od opskrbe: vojska slabi, proizvodnja −50%. Spoji ga s gradom preko svojih teritorija.</div>}
          {planning && t.terrain !== 'water' && (
            <div className="space-y-2" data-testid="territory-actions">
              {mine ? (<>
                <ActionRow icon="layers" title="Razvoj" sub="Unaprijedi proizvodnju i infrastrukturu" onClick={() => onAction('build', t.id)} disabled={t.isCapital} testId="act-Gradi" tour="act-build" />
                <ActionRow icon="users" title="Novači" sub="Nove postrojbe stižu početkom iduće runde" onClick={() => onAction('recruit', t.id)} testId="act-Novači" tour="act-recruit" />
                <ActionRow icon="shield" title="Obrana" sub="Utvrdi teritorij ili pošalji pojačanje" onClick={() => onAction('defend', t.id)} testId="act-Obrana" />
                <ActionRow icon="target" title="Uvjetna naredba" sub="AKO se dogodi okidač, TADA automatska radnja" onClick={() => onAction('conditional', t.id)} testId="act-Uvjetna naredba" tour="act-cond" />
              </>) : (<>
                {canAttack && <ActionRow icon="swords" title="Napadni" sub="Planiraj vojnu operaciju" onClick={() => onOperation(t.id)} testId="attack-btn" tour="act-attack" />}
                {owner && <ActionRow icon="search" title="Istraži" sub="Prikupi informacije o susjedima" onClick={() => onAction('espionage', t.id)} testId="act-Špijuniraj" tour="act-spy" />}
                {owner && <ActionRow icon="fire" title="Sabotiraj" sub="Oštećeni proizvodnju, stabilnost ili utvrde" onClick={() => onAction('sabotage', t.id)} testId="act-Sabotiraj" />}
                {owner ? <ActionRow icon="handshake" title="Diplomacija" sub="Pregovaraj, sklopi saveze ili ugovore" onClick={() => onAction('diplomacy', t.id)} testId="act-Diplomacija" tour="act-dip" /> : adj.length > 0 && <ActionRow icon="handshake" title="Pripoji mirno" sub="Plati utjecajem i preuzmi bez borbe" onClick={() => onAction('diplomacy', t.id)} testId="act-Pripoji" />}
                {!canAttack && <p className="text-sm text-muted">Za napad ili pripajanje teritorij mora biti uz tvoje kraljevstvo.</p>}
              </>)}
            </div>
          )}
          {!planning && v.phase === 'planning' && <p className="text-sm text-muted">Naredbe su označene kao spremne — otključaj ih za izmjene.</p>}
        </div>
      )}

      {tab === 'razvoj' && mine && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm"><span className="text-muted">Zgrada</span><b>{t.building ? `${cfg.buildings[t.building].name}${t.building !== 'capital' ? ` · razina ${t.buildingLevel}/${cfg.buildings[t.building].maxLevel}` : ''}` : 'Nema'}</b></div>
          {t.construction && <div className="chip chip-yellow">U gradnji: {cfg.buildings[t.construction.building].name} — gotovo početkom iduće runde</div>}
          <div className="space-y-1.5"><div className="label">Proizvodnja po danu</div>
            {prod?.lines.length ? prod.lines.map((l, i) => <div key={i} className="flex items-center justify-between text-sm"><span className="flex items-center gap-2 text-neutral-600"><ResourceIcon name={l.resource} size={16} className="text-neutral-400" />{l.label}</span><b>+{l.amount.toFixed(1)}</b></div>) : <p className="text-sm text-muted">Bez proizvodnje.</p>}
            {prod?.notes.map((n, i) => <div key={i} className="text-xs text-warn font-medium">{n}</div>)}
            {prod && <div className="text-xs text-muted">Faktor stabilnosti ×{prod.stabilityFactor.toFixed(2)}</div>}
          </div>
          <div className="space-y-2"><div className="flex justify-between text-sm"><span className="text-muted">Stanovništvo</span><b>{t.population}</b></div>
            <div className="flex justify-between text-sm"><span className="text-muted">Stabilnost</span><b className={(t.stability ?? 0) < 40 ? 'text-bad' : ''}>{t.stability}</b></div><Progress value={t.stability ?? 0} color={(t.stability ?? 0) < 40 ? 'bg-bad' : 'bg-primary'} /></div>
          {planning && !t.isCapital && <button className="btn btn-yellow w-full" onClick={() => onAction('build', t.id)}>{t.building ? 'Nadogradi zgradu' : 'Izgradi zgradu'}</button>}
        </div>
      )}

      {tab === 'vojska' && mine && (
        <div className="space-y-3">
          {UNIT_TYPES.filter((u) => (t.garrison?.[u] ?? 0) > 0).map((u) => (
            <div key={u} className="flex items-center gap-3 border-b border-line pb-2.5"><UnitIcon unit={u} size={26} /><div className="flex-1"><div className="font-semibold">{cfg.units[u].name}</div><div className="text-xs text-muted">napad {cfg.units[u].attack} · obrana {cfg.units[u].defense} · održavanje {cfg.units[u].upkeep.gold} zlata</div></div><b className="text-lg">{t.garrison?.[u]}</b></div>))}
          {!UNIT_TYPES.some((u) => (t.garrison?.[u] ?? 0) > 0) && <p className="text-sm text-muted">Nema postrojbi — teritorij je neobranjen.</p>}
          {planning && <div className="grid grid-cols-2 gap-2"><button className="btn btn-yellow" onClick={() => onAction('recruit', t.id)}>Novači</button><button className="btn btn-ghost" onClick={() => onAction('defend', t.id)}>Pojačanje</button></div>}
        </div>
      )}

      {tab === 'obrana' && mine && (
        <div className="space-y-4">
          <div><div className="flex justify-between text-sm mb-1.5"><span className="text-muted">Razina obrane</span><b>{t.defenseLevel} / {cfg.defense.maxDefenseLevel}</b></div><Progress value={t.defenseLevel ?? 0} max={cfg.defense.maxDefenseLevel} /></div>
          <p className="text-sm text-neutral-600">Ukupni obrambeni bonus (razina, utvrde, glavni grad): <b>+{defTotal}%</b>. Utvrđivanje daje dodatnih +{Math.round(cfg.defense.entrenchBonus * 100)}% samo ove runde.</p>
          {t.effects?.length ? <div className="flex flex-wrap gap-1.5">{t.effects.map((e, i) => <span key={i} className="chip chip-warn">{e.kind === 'entrenched' ? 'utvrđeno' : e.kind === 'sabotaged_production' ? 'sabotirano' : 'kuga'}</span>)}</div> : null}
          {planning && <div className="grid grid-cols-1 gap-2"><button className="btn btn-yellow" onClick={() => onAction('defend', t.id)}>Obrambena operacija</button><button className="btn btn-ghost" onClick={() => onAction('conditional', t.id)}>Uvjetna obrana</button></div>}
        </div>
      )}

      {tab === 'vise' && mine && (
        <div className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-muted">Važnost</span><b>{t.importance}/5</b></div>
          <div className="flex justify-between"><span className="text-muted">Vid</span><b>potpun</b></div>
          <div className="flex justify-between"><span className="text-muted">Opskrba</span><b className={t.supplied === false ? 'text-bad' : 'text-good'}>{t.supplied === false ? 'odsječen' : 'povezan'}</b></div>
          {t.siegeProgress ? <div className="flex justify-between"><span className="text-muted">Opsada</span><b className="text-bad">razina {t.siegeProgress}</b></div> : null}
        </div>
      )}

      {tab === 'intel' && !mine && (
        <div className="space-y-3">
          {t.building && <div className="flex justify-between text-sm"><span className="text-muted">Vidljiva zgrada</span><b>{cfg.buildings[t.building].name}</b></div>}
          {t.defenseLevel !== undefined && <div className="flex justify-between text-sm"><span className="text-muted">Utvrde (procjena)</span><b>razina ≈ {t.defenseLevel}</b></div>}
          <div className="flex justify-between text-sm items-center"><span className="text-muted">Postrojbe</span>{t.armyEstimate?.range ? <b>{fmtRange(t.armyEstimate.range)} <span className="chip ml-1">pouzdanost {CONF[t.armyEstimate.confidence]}</span></b> : t.armyEstimate?.exact ? <b>{unitTotal(t.armyEstimate.exact)}</b> : <span className="chip chip-bad">nepoznato</span>}</div>
          {t.armyEstimate?.source === 'intel' && t.armyEstimate.round && <p className="text-xs text-muted">Izvor: špijunaža, dan {t.armyEstimate.round}.</p>}
          {t.siegeProgress ? <div className="chip chip-warn">Opsada: razina {t.siegeProgress}</div> : null}
          <div className="label pt-1">Izviđačka izvješća</div>
          {intelReports.length === 0 && <p className="text-sm text-muted">Nema izvješća o ovom teritoriju.</p>}
          {intelReports.map((r) => <div key={r.id} className="rounded-xl border border-line p-3 text-sm"><div className="font-medium">{r.summary}</div><div className="text-xs text-muted mt-1">{timeAgo(r.createdAt)} · dan {r.round}{v.round - r.round > cfg.espionage.staleAfterRounds ? ' · zastarjelo' : ''}</div></div>)}
        </div>
      )}
    </div>
  );
}
