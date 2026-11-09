import type { PlayerView } from '@/engine/view';
import type { CampaignMeta } from '@/server/service';
import type { Order } from '@/engine/types';

const MIDDAY_KINDS = ['alliance', 'nap', 'trade', 'improve'];
export const fmtClock = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleTimeString('hr-HR', { hour: '2-digit', minute: '2-digit' }) : null);

/** Podnevno razrješenje je uključeno za današnju rundu i još nije odrađeno (ako je vrijeme prošlo, stiže pri prvom otvaranju igre ili cron pozivu). */
export const middayPending = (v: PlayerView, meta: CampaignMeta | null) =>
  !!meta?.clock.middayAt && v.phase === 'planning' && !v.middayDone;

/** Razrješava li se ova vrsta naredbe u podne (špijunaža, ponude saveza/nenapadanja/trgovine, darovi)? */
export const isMiddayKind = (type: string, kind?: string) => type === 'espionage' || (type === 'diplomacy' && !!kind && MIDDAY_KINDS.includes(kind));
export const orderIsMidday = (o: Order) => isMiddayKind(o.type, o.type === 'diplomacy' ? (o.params as { kind: string }).kind : undefined);
