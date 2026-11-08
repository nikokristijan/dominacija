import type { UnitType } from '@/engine/types';
import { Icon, type IconName } from './Icons';

const UNIT_GLYPH: Record<UnitType, IconName> = { infantry: 'shield', archers: 'bow', spearmen: 'spear', knights: 'helm', cavalry: 'horse', siege: 'catapult' };
/** Postrojbe kao minimalni linijski glifovi (bez crtanih likova). */
export function UnitIcon({ unit, size = 28 }: { unit: UnitType; color?: string; size?: number }) {
  return <Icon name={UNIT_GLYPH[unit]} size={size} stroke={1.7} />;
}
