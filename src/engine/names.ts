import type { Rng } from './rng';

const PREFIX = ['Kamen', 'Zlat', 'Sunč', 'Vuč', 'Medv', 'Sokol', 'Hrast', 'Bor', 'Srebr', 'Zvjezd', 'Ledeni', 'Tihi', 'Crni', 'Bijeli', 'Zeleni', 'Rudni', 'Orlov', 'Jelen', 'Lipov', 'Brezov', 'Grom', 'Magleni', 'Vjetro', 'Sivi', 'Maslinov', 'Jasen', 'Kosov', 'Lisičji', 'Vrbov', 'Gavranov', 'Ružin', 'Jantarni', 'Pepeljasti', 'Zmajev', 'Biser'];
const SUFFIX = ['grad', 'polje', 'brdo', 'selo', 'gora', 'luka', 'dvor', 'bor', 'jezero', 'klanac', 'most', 'vrh', 'dol', 'kula', 'zaton', 'ravan', 'šuma', 'stijena'];

export function territoryName(rng: Rng, used: Set<string>): string {
  for (let i = 0; i < 60; i++) {
    const n = rng.pick(PREFIX) + rng.pick(SUFFIX);
    const name = n.charAt(0).toUpperCase() + n.slice(1);
    if (!used.has(name)) { used.add(name); return name; }
  }
  let k = used.size;
  while (used.has(`Zemlja ${k}`)) k++;
  used.add(`Zemlja ${k}`);
  return `Zemlja ${k}`;
}

export const REGION_NAMES = ['Sjeverne planine', 'Zlatne doline', 'Zelena prostranstva', 'Srebrna obala', 'Pustinjski rub', 'Središnja ravnica', 'Zvjezdani otoci', 'Maglena šuma'];
