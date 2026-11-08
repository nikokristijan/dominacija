import type { ResourceType } from '@/engine/types';
import { Icon, type IconName } from './Icons';

export type ResourceIconName = ResourceType | 'population' | 'stability' | 'command';
const MAP: Record<ResourceIconName, IconName> = { gold: 'coin', food: 'wheat', iron: 'cube', wood: 'logs', influence: 'crown', population: 'users', stability: 'smile', command: 'star' };

/** Resursi prikazani minimalnim linijskim glifovima (boja = currentColor). */
export function ResourceIcon({ name, size = 22, className = '' }: { name: ResourceIconName; size?: number; className?: string }) {
  return <Icon name={MAP[name]} size={size} stroke={1.7} className={className} />;
}
