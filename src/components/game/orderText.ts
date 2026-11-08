import { UNIT_TYPES } from '@/engine/config';
import type { OrderInput, Units } from '@/engine/types';
import type { PlayerView } from '@/engine/view';
import { TECH_BY_ID } from '@/engine/tech';

const unitsText = (v: PlayerView, u?: Units) => u ? UNIT_TYPES.filter((k) => (u[k] ?? 0) > 0).map((k) => `${u[k]} ${v.config.units[k].name.toLowerCase()}`).join(', ') || '—' : '—';
const tn = (v: PlayerView, id?: string) => (id && v.territories[id]?.name) || '?';
const pn = (v: PlayerView, id?: string) => (id && v.players[id]?.name) || '?';
export const RES_SHORT: Record<string, string> = { gold: 'zlato', food: 'hrana', iron: 'željezo', wood: 'drvo', influence: 'utjecaj' };

export function describeOrder(v: PlayerView, o: OrderInput): { title: string; detail: string } {
  const c = v.config;
  switch (o.type) {
    case 'recruit': return { title: `Novačenje: ${c.units[o.params.unit].name}`, detail: `${o.params.count} u ${tn(v, o.params.territoryId)}` };
    case 'trade': return { title: 'Trgovačka ekspedicija', detail: `${o.params.amount} ${RES_SHORT[o.params.give]} → ${RES_SHORT[o.params.receive]}` };
    case 'build': return { title: `Gradnja: ${c.buildings[o.params.building].name}`, detail: tn(v, o.params.territoryId) };
    case 'defend': return { title: o.params.stance === 'entrench' ? 'Utvrđena obrana' : o.params.stance === 'fortify' ? 'Ojačaj obranu' : 'Pojačanje', detail: o.params.stance === 'reinforce' ? `${unitsText(v, o.params.units)} iz ${tn(v, o.params.fromTerritoryId)} u ${tn(v, o.params.territoryId)}` : tn(v, o.params.territoryId) };
    case 'espionage': return { title: `Špijunaža: ${({ army: 'vojska', resources: 'resursi', buildings: 'građevine', preparations: 'pripreme', routes: 'pravci napada', false_info: 'lažne informacije', counter: 'protuobavještajna zaštita' } as Record<string, string>)[o.params.action]}`, detail: o.params.targetTerritoryId ? tn(v, o.params.targetTerritoryId) : o.params.targetPlayerId ? pn(v, o.params.targetPlayerId) : 'vlastito kraljevstvo' };
    case 'diplomacy': return { title: `Diplomacija: ${({ alliance: 'savez', nap: 'nenapadanje', trade: 'trgovina', support: 'vojna potpora', swap: 'razmjena teritorija', joint_attack: 'zajednički napad', annex: 'pripajanje', improve: 'dar' } as Record<string, string>)[o.params.kind]}`, detail: o.params.kind === 'annex' ? tn(v, o.params.targetTerritoryId) : pn(v, o.params.targetPlayerId) + (o.params.secret ? ' (tajno)' : '') };
    case 'attack': return { title: `Napad na ${tn(v, o.params.targetId)}`, detail: `${unitsText(v, o.params.units)} iz ${tn(v, o.params.fromId)} · ${c.combat.strategy[o.params.strategy].label}` };
    case 'sabotage': return { title: `Sabotaža: ${({ production: 'proizvodnja', stability: 'stabilnost', fortification: 'utvrde' } as Record<string, string>)[o.params.kind]}`, detail: `${tn(v, o.params.targetTerritoryId)} (${pn(v, o.params.targetPlayerId)})` };
    case 'research': return { title: `Istraživanje: ${TECH_BY_ID[o.params.techId]?.name ?? '?'}`, detail: TECH_BY_ID[o.params.techId]?.description ?? '' };
    case 'resistance': return { title: o.params.kind === 'uprising' ? 'Ustanak partizana' : 'Hitno novačenje', detail: tn(v, o.params.territoryId) };
  }
}
