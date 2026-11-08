'use client';
import Link from 'next/link';
import { UNIT_TYPES, FACTIONS } from '@/engine/config';
import type { OrderType } from '@/engine/types';
import { neighborIds } from '@/engine/util';
import { Building } from '@/components/art/Buildings';
import { Icon } from '@/components/art/Icons';
import { FactionBadge } from '@/components/art/Factions';
import { ResourceIcon } from '@/components/art/Resources';
import { TerrainTile } from '@/components/art/Terrain';
import { UnitIcon } from '@/components/art/Characters';
import { Progress } from '@/components/ui/kit';
import { fmtRange } from '@/engine/intel';
import { timeAgo } from '@/lib/format';
import { useGame } from './GameProvider';
import type { TerritoryView } from '@/engine/view';

const CONF: Record<string, string> = { high: 'visoka', medium: 'srednja', low: 'niska', none: '—' };

export function adjacentOwned(view: NonNullable<ReturnType<typeof useGame>['view']>, id: string) {
  const t = view.territories[id];
  const out: string[] = [];
  for (const o of view.map.order) {
    const n = view.territories[o];
    if (n.owner !== view.me.id || n.terrain === 'water') continue;
    const dc = n.col - t.col, dr = n.row - t.row;
    const even = t.row % 2 === 0;
    const dirs = even ? [[1, 0], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1]] : [[1, 0], [1, 1], [0, 1], [-1, 0], [0, -1], [1, -1]];
    if (dirs.some(([a, b]) => a === dc && b === dr)) out.push(o);
  }
  return out;
}
void neighborIds;

export function TerritoryDetails({ t, onAction, compact = false }: { t: TerritoryView; onAction: (type: OrderType | 'conditional', territoryId: string) => void; compact?: boolean }) {
  const g = useGame();
  const v = g.view!;
  const cfg = v.config;
  const mine = t.owner === v.me.id;
  const owner = t.owner ? v.players[t.owner] : null;
  const region = v.map.regions.find((r) => r.id === t.regionId);
  const intel = v.intel.filter((r) => r.territoryId === t.id).sort((a, b) => b.round - a.round)[0];
  const adj = adjacentOwned(v, t.id);
  const canAttack = !mine && t.terrain !== 'water' && adj.length > 0;
  const planning = v.phase === 'planning' && !v.me.ready;
  const base = `/k/${g.id}`;
  const prod = t.production;
  const myOrders = v.orders.filter((o) => (o.status === 'submitted' || o.status === 'locked' || o.status === 'draft') && o.round === v.round && JSON.stringify(o.params).includes(`"${t.id}"`));

  return (
    <div className="space-y-3" data-testid="territory-details">
      <div className="flex items-start gap-3">
        <div className="shrink-0 relative"><TerrainTile terrain={t.terrain} size={compact ? 76 : 92} seed={t.id} />
          {(t.building || t.isCapital) && <div className="absolute inset-0 grid place-items-center pointer-events-none"><Building type={t.building ?? 'capital'} faction={owner?.faction ?? 'red'} size={compact ? 46 : 56} /></div>}</div>
        <div className="flex-1 min-w-0">
          <h3 className="text-2xl text-secondary leading-tight truncate" data-testid="territory-name">{t.name}</h3>
          <div className="flex flex-wrap gap-1.5 mt-1">
            <span className="chip">{cfg.terrain[t.terrain].name}</span>
            {region && <span className="chip chip-yellow">{region.name}</span>}
            {t.isCapital && <span className="chip chip-bad">Glavni grad{t.capitalOf && t.capitalOf !== t.owner ? ' (okupiran)' : ''}</span>}
            {t.resource && <span className="chip chip-good">Nalazište: {({ gold: 'zlato', food: 'hrana', iron: 'željezo', wood: 'drvo', influence: 'utjecaj' } as const)[t.resource]}</span>}
          </div>
          <div className="mt-1.5 flex items-center gap-2 font-extrabold">{owner ? <><FactionBadge faction={owner.faction} size={24} />{owner.name}{mine && <span className="chip">Ti</span>}{owner.relation === 'ally' && <span className="chip chip-good">Saveznik</span>}</> : <span className="text-muted">Neutralni stanovnici</span>}</div>
          <div className="text-xs text-muted font-bold mt-0.5">Važnost: {'★'.repeat(t.importance)}{'☆'.repeat(5 - t.importance)} · vid: {t.visibility === 'own' ? 'potpun' : t.visibility === 'near' ? 'djelomičan' : 'ograničen'}</div>
        </div>
      </div>

      {/* Vlastiti teritorij */}
      {mine && (<>
        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat label="Stanovništvo" value={`${t.population}`} />
          <Stat label="Stabilnost" value={`${t.stability}`} tone={(t.stability ?? 0) < 40 ? 'bad' : undefined} />
          <Stat label="Obrana" value={`Razina ${t.defenseLevel}`} />
        </div>
        <Progress value={t.stability ?? 0} color={(t.stability ?? 0) < 40 ? 'bg-bad' : (t.stability ?? 0) < 60 ? 'bg-warn' : 'bg-good'} />
        <div className="rounded-2xl bg-primary-100/50 p-3 space-y-2">
          <div className="label">Postrojbe</div>
          <div className="flex flex-wrap gap-2">{UNIT_TYPES.filter((u) => (t.garrison?.[u] ?? 0) > 0).map((u) => <span key={u} className="inline-flex items-center gap-1 bg-white rounded-2xl pl-1 pr-2.5 border-2 border-line font-extrabold"><UnitIcon unit={u} color={FACTIONS[v.me.faction].color} size={32} />{t.garrison?.[u]}<span className="text-xs text-muted">{cfg.units[u].name}</span></span>)}
            {!UNIT_TYPES.some((u) => (t.garrison?.[u] ?? 0) > 0) && <span className="text-sm text-muted">Nema postrojbi — teritorij je neobranjen!</span>}</div>
        </div>
        <div className="rounded-2xl bg-primary-100/50 p-3 space-y-1.5">
          <div className="label">Proizvodnja po danu</div>
          {prod && Object.entries(prod.total).filter(([, n]) => n > 0).length > 0 ? (
            <div className="flex flex-wrap gap-3">{(Object.entries(prod.total) as Array<[keyof typeof prod.total, number]>).filter(([, n]) => n > 0).map(([k, n]) => <span key={k} className="inline-flex items-center gap-1 font-extrabold"><ResourceIcon name={k} size={22} />+{n}</span>)}</div>
          ) : <span className="text-sm text-muted">Bez proizvodnje.</span>}
          {prod?.notes.map((n, i) => <div key={i} className="text-xs text-orange-700 font-bold">{n}</div>)}
          <details className="text-xs text-muted"><summary className="cursor-pointer font-extrabold">Kako se računa</summary>{prod?.lines.map((l, i) => <div key={i}>{l.label}: +{l.amount.toFixed(1)} {l.resource}</div>)}<div>Faktor stabilnosti: ×{prod?.stabilityFactor.toFixed(2)}</div></details>
        </div>
        {t.building && <div className="text-sm font-bold">Zgrada: <b>{cfg.buildings[t.building].name}</b>{t.building !== 'capital' ? ` (razina ${t.buildingLevel}/${cfg.buildings[t.building].maxLevel})` : ''}</div>}
        {t.construction && <div className="chip chip-yellow">U gradnji: {cfg.buildings[t.construction.building].name} → gotovo početkom iduće runde</div>}
        {t.supplied === false && <div className="rounded-2xl bg-red-50 border-2 border-red-200 p-2.5 text-sm text-red-800 font-bold">Odsječen od opskrbe — vojska slabi, proizvodnja −50%. Spoji ga s gradom preko svojih teritorija.</div>}
      </>)}

      {/* Tuđi / neutralni teritorij */}
      {!mine && t.terrain !== 'water' && (
        <div className="rounded-2xl bg-primary-100/50 p-3 space-y-2">
          <div className="label">Obavještajne informacije</div>
          {t.building && <div className="text-sm font-bold">Vidljiva zgrada: {cfg.buildings[t.building].name}</div>}
          {t.defenseLevel !== undefined && <div className="text-sm font-bold">Utvrde (procjena): razina ≈ {t.defenseLevel}</div>}
          {t.armyEstimate?.range && <div className="text-sm font-bold">Postrojbe: <span className="font-display text-lg text-secondary">{fmtRange(t.armyEstimate.range)}</span> <span className={`chip ${t.armyEstimate.confidence === 'high' ? 'chip-good' : t.armyEstimate.confidence === 'medium' ? 'chip-yellow' : 'chip-warn'}`}>pouzdanost: {CONF[t.armyEstimate.confidence]}</span>{t.armyEstimate.source === 'intel' && t.armyEstimate.round && <span className="text-xs text-muted"> · špijunaža, dan {t.armyEstimate.round}</span>}</div>}
          {!t.armyEstimate?.range && !t.armyEstimate?.exact && <div className="text-sm text-muted font-bold">Postrojbe: <span className="chip chip-bad">nepoznato</span> — teritorij je predaleko. Pošalji špijuna.</div>}
          {intel && <div className="text-xs text-muted">Zadnje izviđanje: {timeAgo(intel.createdAt)} (dan {intel.round}) · {intel.confidence === 'failed' ? 'neuspjelo' : `pouzdanost ${CONF[intel.confidence]}`}</div>}
          {t.siegeProgress ? <div className="chip chip-warn">Opsada: razina {t.siegeProgress}</div> : null}
        </div>
      )}

      {myOrders.length > 0 && <div className="rounded-2xl bg-accent/25 p-2.5 text-sm font-bold">Za ovaj teritorij imaš {myOrders.length} naredbu/e u planu.</div>}

      {/* Akcije */}
      {planning && t.terrain !== 'water' && (
        <div className="grid grid-cols-2 gap-2 pt-1" data-testid="territory-actions">
          {mine && <>
            <Act icon="users" label="Novači" onClick={() => onAction('recruit', t.id)} />
            <Act icon="hammer" label={t.building && t.building !== 'capital' ? 'Nadogradi' : 'Gradi'} onClick={() => onAction('build', t.id)} disabled={t.isCapital} />
            <Act icon="shield" label="Obrana" onClick={() => onAction('defend', t.id)} />
            <Act icon="target" label="Uvjetna naredba" onClick={() => onAction('conditional', t.id)} />
          </>}
          {!mine && canAttack && <Link href={`${base}/operacija?target=${t.id}`} className="btn btn-red col-span-2" data-testid="attack-btn"><Icon name="sword" size={20} />Planiraj napad</Link>}
          {!mine && owner && <Act icon="eye" label="Špijuniraj" onClick={() => onAction('espionage', t.id)} />}
          {!mine && owner && <Act icon="fire" label="Sabotiraj" onClick={() => onAction('sabotage', t.id)} />}
          {!mine && !owner && adj.length > 0 && <Act icon="handshake" label="Pripoji mirno" onClick={() => onAction('diplomacy', t.id)} />}
          {!mine && !canAttack && <div className="col-span-2 text-sm text-muted font-bold">Za napad teritorij mora biti uz tvoje kraljevstvo.</div>}
        </div>
      )}
      {!planning && v.phase === 'planning' && <div className="text-sm text-muted font-bold">Naredbe su označene kao spremne — otključaj ih za izmjene.</div>}
    </div>
  );
}

const Stat = ({ label, value, tone }: { label: string; value: string; tone?: 'bad' }) => <div className={`rounded-2xl py-2 ${tone === 'bad' ? 'bg-red-50' : 'bg-primary-100/50'}`}><div className="label !text-[10px]">{label}</div><div className={`font-display font-extrabold text-lg ${tone === 'bad' ? 'text-bad' : 'text-secondary'}`}>{value}</div></div>;
function Act({ icon, label, onClick, disabled }: { icon: Parameters<typeof Icon>[0]['name']; label: string; onClick: () => void; disabled?: boolean }) {
  return <button className="btn btn-ghost btn-sm" onClick={onClick} disabled={disabled} data-testid={`act-${label}`}><Icon name={icon} size={18} />{label}</button>;
}
