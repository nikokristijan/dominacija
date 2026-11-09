/** Špijunaža i sabotaža. Izvješća su procjene s razinom pouzdanosti, nikad savršene informacije. */
import { RESOURCE_TYPES, UNIT_TYPES } from './config';
import { confidenceFromRatio, counterPower, estimateRange, fmtRange, spyPower } from './intel';
import { hash01 } from './rng';
import { getMods } from './tech';
import type { Confidence, GameState, IntelReport, Order, OrderParamsMap, PlayerId, Territory } from './types';
import { emit, neighborIds, nextId, notify, playerTerritories, pname, unitTotal } from './util';

const confLabel = (c: Confidence) => (c === 'high' ? 'visoka' : c === 'medium' ? 'srednja' : 'niska');

function skewFor(s: GameState, target: PlayerId): number {
  const d = s.players[target].disinfo;
  if (!d || d.untilRound < s.round) return 0;
  return d.skew;
}

export function setDisinfo(s: GameState, pid: PlayerId) {
  const sign = hash01(`${s.seed}:disinfo:${s.round}:${pid}`) < 0.5 ? -1 : 1;
  s.players[pid].disinfo = { untilRound: s.round + 1, skew: sign * s.config.espionage.disinfoSkew };
}

export type SpyOutcome = { ok: true; report: IntelReport } | { ok: false; caught: boolean; ratio: number };

/** Izvršava informacijsku špijunažu. Poziva se na kraju razrješenja kako bi izvješće odražavalo stanje na početku nove runde. */
export function gatherIntel(s: GameState, pid: PlayerId, params: OrderParamsMap['espionage'], now: string): SpyOutcome {
  const tgtTerritory = params.targetTerritoryId ? s.map.territories[params.targetTerritoryId] : undefined;
  const targetPlayer = params.targetPlayerId ?? tgtTerritory?.owner ?? null;
  const ratio = targetPlayer ? spyPower(s, pid) / counterPower(s, targetPlayer) : spyPower(s, pid) / 1.0;
  const conf = confidenceFromRatio(s.config, ratio);
  if (conf === 'failed') return { ok: false, caught: true, ratio };
  const skew = targetPlayer ? skewFor(s, targetPlayer) : 0;
  const key = (extra: string) => `${s.seed}:${s.round}:${pid}:${extra}`;
  const mk = (kind: IntelReport['kind'], data: Record<string, unknown>, summary: string, territoryId?: string): IntelReport => ({
    id: nextId(s, 'i'), owner: pid, target: targetPlayer, territoryId, kind, round: s.round, createdAt: now, confidence: conf, data, summary,
  });
  const targetName = pname(s, targetPlayer);
  switch (params.action) {
    case 'army': {
      if (tgtTerritory) {
        const g = tgtTerritory.garrison;
        const total = unitTotal(g);
        const exact = conf === 'high' && !skew;
        const r = exact ? { min: total, max: total } : estimateRange(total, conf, key(tgtTerritory.id), skew);
        // sastav po vrstama: točno (visoka), procjena (srednja) ili samo prevladavajuće vrste (niska)
        const comp = UNIT_TYPES.filter((u) => (g[u] ?? 0) > 0).map((u) => {
          const rr = exact ? { min: g[u]!, max: g[u]! } : estimateRange(g[u]!, conf, key(`${tgtTerritory.id}:${u}`), skew);
          return { unit: u, min: rr.min, max: rr.max };
        }).filter((x) => conf !== 'low' || x.max >= Math.max(2, total * 0.25)).sort((a, b) => b.max - a.max);
        const tdef = s.config.terrain[tgtTerritory.terrain].defense * (1 + 0.1 * tgtTerritory.defenseLevel) * (tgtTerritory.building === 'fortress' ? 1.25 : 1);
        const needed = Math.max(4, Math.ceil(r.max * 1.25 * tdef));
        const data: Record<string, unknown> = { min: r.min, max: r.max, best: Math.round((r.min + r.max) / 2), comp, defenseLevel: tgtTerritory.defenseLevel, building: tgtTerritory.building, terrain: tgtTerritory.terrain, needed, exact };
        const names = s.config.units;
        const mid = (x: { min: number; max: number }) => Math.round((x.min + x.max) / 2);
        const compText = comp.length ? comp.map((x) => `${exact ? '' : '~'}${mid(x)} ${names[x.unit as keyof typeof names].name.toLowerCase()}`).join(', ') : '';
        const head = exact ? `${total} vojnika` : `≈${mid(r)} vojnika (${fmtRange(r)})`;
        return { ok: true, report: mk('army', data, `${tgtTerritory.name} (${tgtTerritory.owner ? targetName : 'neutralni'}): ${head}${compText ? ` — ${compText}` : ''}. Pouzdanost: ${confLabel(conf)}. Za siguran napad šalji ≈${needed}+.`, tgtTerritory.id) };
      }
      const terr = playerTerritories(s, targetPlayer!);
      const total = terr.reduce((n, t) => n + unitTotal(t.garrison), 0);
      const r = estimateRange(total, conf, key(`all:${targetPlayer}`), skew);
      const top = [...terr].sort((a, b) => unitTotal(b.garrison) - unitTotal(a.garrison)).slice(0, 2).map((t) => `${t.name} (≈${Math.round(estimateRange(unitTotal(t.garrison), conf, key(`top:${t.id}`), skew).max * 0.85)})`).join(', ');
      return { ok: true, report: mk('army', { min: r.min, max: r.max, best: Math.round((r.min + r.max) / 2), total: true }, `Ukupna vojska kraljevstva ${targetName}: ≈${Math.round((r.min + r.max) / 2)} vojnika (${fmtRange(r)}). Najjača uporišta: ${top}. Pouzdanost: ${confLabel(conf)}.`) };
    }
    case 'resources': {
      const p = s.players[targetPlayer!];
      const data: Record<string, { min: number; max: number }> = {};
      for (const k of RESOURCE_TYPES) data[k] = estimateRange(p.resources[k], conf, key(`res:${targetPlayer}:${k}`), skew);
      const txt = RESOURCE_TYPES.map((k) => `${({ gold: 'zlato', food: 'hrana', iron: 'željezo', wood: 'drvo', influence: 'utjecaj' } as const)[k]} ${fmtRange(data[k])}`).join(', ');
      return { ok: true, report: mk('resources', { ranges: data }, `Resursi kraljevstva ${targetName}: ${txt}. Pouzdanost: ${confLabel(conf)}.`) };
    }
    case 'buildings': {
      const terr = playerTerritories(s, targetPlayer!);
      const seen = terr.filter((t) => t.building && (conf === 'high' || hash01(key(`b:${t.id}`)) < (conf === 'medium' ? 0.75 : 0.45)));
      const list = seen.map((t) => ({ territoryId: t.id, name: t.name, building: t.building, level: conf === 'high' ? t.buildingLevel : null }));
      return { ok: true, report: mk('buildings', { list }, `Otkriveno ${list.length} građevina kraljevstva ${targetName}. Pouzdanost: ${confLabel(conf)}.`) };
    }
    case 'preparations': {
      const pend = s.players[targetPlayer!].pendingRecruits.reduce((n, r) => n + r.count, 0);
      const recent = s.battles.filter((b) => b.round === s.round && b.attackers.some((a) => a.playerId === targetPlayer)).length;
      const r = estimateRange(pend, conf, key(`prep:${targetPlayer}`), skew);
      const top = playerTerritories(s, targetPlayer!).sort((a, b) => unitTotal(b.garrison) - unitTotal(a.garrison)).slice(0, 2).map((t) => ({ territoryId: t.id, name: t.name, est: estimateRange(unitTotal(t.garrison), conf, key(`pt:${t.id}`), skew) }));
      return { ok: true, report: mk('preparations', { inTraining: r, attacksLaunched: recent, concentrations: top }, `Vojne pripreme ${targetName}: u novačenju ${fmtRange(r)}, napada ove runde: ${recent}. Najveće koncentracije: ${top.map((x) => `${x.name} (${fmtRange(x.est)})`).join(', ') || '—'}. Pouzdanost: ${confLabel(conf)}.`) };
    }
    case 'routes': {
      const mine = new Set(playerTerritories(s, pid).map((t) => t.id));
      const routes: Array<{ fromId: string; fromName: string; toId: string; toName: string; est: { min: number; max: number } }> = [];
      for (const t of playerTerritories(s, targetPlayer!)) {
        for (const n of neighborIds(s, t.id)) if (mine.has(n)) routes.push({ fromId: t.id, fromName: t.name, toId: n, toName: s.map.territories[n].name, est: estimateRange(unitTotal(t.garrison), conf, key(`rt:${t.id}`), skew) });
      }
      routes.sort((a, b) => b.est.max - a.est.max);
      return { ok: true, report: mk('routes', { routes }, routes.length ? `Mogući pravci napada ${targetName}: ${routes.slice(0, 3).map((r) => `${r.fromName} → ${r.toName} (${fmtRange(r.est)})`).join('; ')}. Pouzdanost: ${confLabel(conf)}.` : `${targetName} trenutno ne graniči s tvojim teritorijima.`) };
    }
    default: return { ok: false, caught: false, ratio };
  }
}

/** Sabotaža: djeluje odmah (prije ekonomije). */
export function runSabotage(s: GameState, pid: PlayerId, p: OrderParamsMap['sabotage'], now: string): { ok: boolean; text: string } {
  const power = spyPower(s, pid) + getMods(s.players[pid]).sabotagePower - 0;
  const counter = counterPower(s, p.targetPlayerId);
  const ratio = power / counter;
  const t: Territory = s.map.territories[p.targetTerritoryId];
  const me = s.players[pid].name;
  if (ratio < s.config.espionage.mediumRatio * 0.85) {
    const identified = ratio < s.config.espionage.lowRatio;
    s.players[p.targetPlayerId].stats.spiesCaught++;
    notify(s, { playerId: p.targetPlayerId, kind: 'warning', title: 'Uhvaćen saboter', body: identified ? `Uhvatili smo sabotera iz kraljevstva ${me}!` : 'Uhvatili smo sabotera nepoznatog podrijetla.' });
    emit(s, s.round, 'espionage', identified ? `Uhvatili smo sabotera iz kraljevstva ${me} u teritoriju ${t.name}!` : `Uhvatili smo sabotera nepoznatog podrijetla u ${t.name}.`, [p.targetPlayerId], 'warn', { mood: 'surprised' });
    return { ok: false, text: `Sabotaža u ${t.name} nije uspjela — saboter je uhvaćen.` };
  }
  const cfg = s.config.espionage;
  if (p.kind === 'production') { t.effects = t.effects.filter((e) => e.kind !== 'sabotaged_production'); t.effects.push({ kind: 'sabotaged_production', untilRound: s.round, by: pid }); }
  if (p.kind === 'stability') { t.stability = Math.max(0, t.stability - cfg.sabotageStabilityHit); s.players[p.targetPlayerId].stability = Math.max(0, s.players[p.targetPlayerId].stability - cfg.sabotageStabilityHit / 3); }
  if (p.kind === 'fortification') t.defenseLevel = Math.max(0, t.defenseLevel - cfg.sabotageFortificationHit);
  const label = { production: 'proizvodnja je oštećena', stability: 'izazvani su nemiri', fortification: 'utvrde su oslabljene' }[p.kind];
  emit(s, s.round, 'espionage', `Sabotaža u teritoriju ${t.name}: ${label}. Počinitelj nije poznat.`, [p.targetPlayerId], 'bad', { refs: { territoryId: t.id }, mood: 'angry' });
  void now;
  return { ok: true, text: `Sabotaža u ${t.name} uspjela: ${label}.` };
}
