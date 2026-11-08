import type { BuildingType, FactionId } from '@/engine/types';
import { Icon, type IconName } from './Icons';

const B_GLYPH: Record<BuildingType, IconName> = { capital: 'crown', farm: 'wheat', mine: 'pickaxe', city: 'city', fortress: 'castle', barracks: 'swords', market: 'stall', research_center: 'flask' };
/** Zgrade kao minimalni linijski glifovi. */
export function Building({ type, size = 28, className = '' }: { type: BuildingType; faction?: FactionId; level?: number; size?: number; className?: string }) {
  return <Icon name={B_GLYPH[type]} size={size} stroke={1.7} className={className} />;
}
export const BUILDING_TYPES: BuildingType[] = ['farm', 'mine', 'city', 'fortress', 'barracks', 'market', 'research_center', 'capital'];
