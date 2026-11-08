/** Zapisi koje sprema perzistentni sloj (odvojeno od engine stanja igre). */
import type { FactionId, GameState, NotificationKind } from '@/engine/types';
import type { DeepPartial, GameConfig } from '@/engine/config';

export interface UserRecord { id: string; username: string; email?: string; passwordHash: string; createdAt: string; isAdmin: boolean; disabled?: boolean }
export interface NotificationPrefs { invitation: boolean; alliance_offer: boolean; trade_offer: boolean; attack: boolean; resolution: boolean; diplomatic: boolean; campaign_complete: boolean; phase: boolean; achievement: boolean; warning: boolean; push: boolean }
export interface ProfileRecord {
  userId: string; displayName: string; preferredFaction: FactionId | null; createdAt: string;
  achievements: string[]; totals: { campaigns: number; wins: number; battlesWon: number; territoriesCaptured: number };
  history: Array<{ campaignId: string; name: string; rank: number; players: number; score: number; faction: FactionId; finishedAt: string }>;
  prefs: NotificationPrefs; mood: string;
}
export type CampaignStatus = 'waiting' | 'active' | 'completed' | 'disabled';
export interface Member { userId: string | null; playerId: string; name: string; faction: FactionId | null; isBot: boolean; joinedAt: string }
export interface Schedule { mode: 'daily' | 'dev'; timezone: string; planningStartHour: number; lockHour: number; devPlanningSeconds: number; resolveWhenAllReady: boolean }
export interface CampaignRecord {
  id: string; name: string; ownerId: string; inviteCode: string; status: CampaignStatus; createdAt: string; startedAt: string | null; completedAt: string | null;
  minPlayers: number; maxPlayers: number; devSimulation: boolean; isPublic: boolean;
  schedule: Schedule; configOverrides: DeepPartial<GameConfig> | null;
  members: Member[];
  clock: { roundOpensAt: string | null; roundDeadline: string | null };
  version: number; seed: string;
  state: GameState | null;
  disabledReason?: string;
}
export interface NotificationRecord { id: string; userId: string; campaignId: string | null; kind: NotificationKind; title: string; body: string; createdAt: string; readAt: string | null }
export interface PushSub { userId: string; endpoint: string; keys: { p256dh: string; auth: string }; createdAt: string }
export interface ErrorRecord { id: string; at: string; where: string; message: string; campaignId?: string; userId?: string; stack?: string }
export interface AuditRecord { id: string; at: string; userId: string | null; campaignId?: string; kind: string; detail: string }
export interface Db {
  users: Record<string, UserRecord>; profiles: Record<string, ProfileRecord>; campaigns: Record<string, CampaignRecord>;
  notifications: NotificationRecord[]; pushSubs: PushSub[]; errors: ErrorRecord[]; audit: AuditRecord[];
  balanceOverrides: DeepPartial<GameConfig>; counter: number;
}
export const emptyDb = (): Db => ({ users: {}, profiles: {}, campaigns: {}, notifications: [], pushSubs: [], errors: [], audit: [], balanceOverrides: {}, counter: 0 });
