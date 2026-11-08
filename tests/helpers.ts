import { neighborIds as nb } from '../src/engine/util';
import { applyLossFraction } from '../src/engine/util';
import type { GameState, Units } from '../src/engine/types';
export const neighborIds = (s: GameState, id: string) => nb(s, id);
export const applyLossFractionForTest = (u: Units, f: number) => applyLossFraction(u, f);
