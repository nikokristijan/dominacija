/** Izvozi SVG komponente u /public/assets/* kao pojedinačne datoteke (asset biblioteka). */
import { renderToStaticMarkup } from 'react-dom/server';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { Penguin } from '../src/components/art/Penguin';
import { Character, CHARACTER_KINDS } from '../src/components/art/Characters';
import { Building, BUILDING_TYPES } from '../src/components/art/Buildings';
import { TerrainTile } from '../src/components/art/Terrain';
import { ResourceIcon } from '../src/components/art/Resources';
import { FactionBanner, FactionBadge } from '../src/components/art/Factions';
import { Icon, ICON_NAMES } from '../src/components/art/Icons';
import { ClashEffect, ResearchEffect, ExpandEffect, BuildEffect } from '../src/components/art/Effects';
import { FACTION_IDS, UNIT_TYPES } from '../src/engine/config';
import type { Mood } from '../src/engine/types';

const root = path.resolve(process.cwd(), 'public/assets');
let count = 0;
function out(dir: string, name: string, node: React.ReactElement) {
  const d = path.join(root, dir); mkdirSync(d, { recursive: true });
  let svg = renderToStaticMarkup(node);
  svg = svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ').replace('xmlns="http://www.w3.org/2000/svg" xmlns="http://www.w3.org/2000/svg"', 'xmlns="http://www.w3.org/2000/svg"');
  writeFileSync(path.join(d, `${name}.svg`), `<?xml version="1.0" encoding="UTF-8"?>\n${svg}\n`);
  count++;
}
const MOODS: Mood[] = ['neutral', 'happy', 'celebrating', 'angry', 'thinking', 'surprised', 'defeated', 'confident'];
for (const m of MOODS) out('characters', `king-${m}`, <Penguin mood={m} size={256} animated={false} />);
for (const k of CHARACTER_KINDS) out('characters', k, <Character kind={k} size={128} />);
const U: Record<string, string> = { infantry: 'soldier', archers: 'archer', spearmen: 'spearman', knights: 'knight', cavalry: 'cavalry', siege: 'siege' };
for (const u of UNIT_TYPES) out('units', u, <Character kind={U[u] as any} size={128} />);
for (const b of BUILDING_TYPES) if (b !== 'capital') out('buildings', b.replace('_', '-'), <Building type={b} size={128} />);
for (const f of FACTION_IDS) out('buildings', `capital-${f}`, <Building type="capital" faction={f} size={128} />);
for (const t of ['plains', 'forest', 'mountains', 'desert', 'water', 'special'] as const) out('terrain', t, <TerrainTile terrain={t} size={160} seed={t} />);
for (const r of ['gold', 'food', 'iron', 'wood', 'influence', 'population', 'stability', 'command'] as const) out('resources', r, <ResourceIcon name={r} size={64} />);
for (const n of ICON_NAMES) out("icons", n, <Icon name={n} size={48} className="" />);
for (const f of FACTION_IDS) { out('factions', `banner-${f}`, <FactionBanner faction={f} size={96} />); out('factions', `badge-${f}`, <FactionBadge faction={f} size={96} />); }
out('effects', 'battle', <ClashEffect size={128} />); out('effects', 'research', <ResearchEffect size={128} />); out('effects', 'expand', <ExpandEffect size={128} />); out('effects', 'build', <BuildEffect size={128} />);
console.log(`Izvezeno ${count} SVG datoteka u ${root}`);
