/** Izvozi SVG komponente u /public/assets/* kao pojedinačne datoteke (asset biblioteka). Stil: linijski glifovi + teren. */
import { renderToStaticMarkup } from 'react-dom/server';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { Building, BUILDING_TYPES } from '../src/components/art/Buildings';
import { UnitIcon } from '../src/components/art/Characters';
import { TerrainTile } from '../src/components/art/Terrain';
import { ResourceIcon } from '../src/components/art/Resources';
import { FactionBadge } from '../src/components/art/Factions';
import { EventIcon } from '../src/components/art/Effects';
import { Icon, ICON_NAMES } from '../src/components/art/Icons';
import { FACTION_IDS, UNIT_TYPES } from '../src/engine/config';

const root = path.resolve(process.cwd(), 'public/assets');
rmSync(root, { recursive: true, force: true });
let count = 0;
function out(dir: string, name: string, node: React.ReactElement) {
  const d = path.join(root, dir); mkdirSync(d, { recursive: true });
  let svg = renderToStaticMarkup(node).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ').replace('xmlns="http://www.w3.org/2000/svg" xmlns="http://www.w3.org/2000/svg"', 'xmlns="http://www.w3.org/2000/svg"');
  svg = svg.replace(/currentColor/g, '#171717');
  writeFileSync(path.join(d, `${name}.svg`), `<?xml version="1.0" encoding="UTF-8"?>\n${svg}\n`);
  count++;
}
for (const u of UNIT_TYPES) out('units', u, <UnitIcon unit={u} size={96} />);
for (const b of BUILDING_TYPES) out('buildings', b.replace('_', '-'), <Building type={b} size={96} />);
for (const t of ['plains', 'forest', 'mountains', 'desert', 'water', 'special'] as const) out('terrain', t, <TerrainTile terrain={t} size={160} seed={t} />);
for (const r of ['gold', 'food', 'iron', 'wood', 'influence', 'population', 'stability', 'command'] as const) out('resources', r, <ResourceIcon name={r} size={64} />);
for (const n of ICON_NAMES) out('icons', n, <Icon name={n} size={48} />);
for (const f of FACTION_IDS) out('factions', `badge-${f}`, <FactionBadge faction={f} size={96} />);
for (const e of ['none', 'drought', 'gold_rush', 'plague', 'rebellion', 'trade_boom', 'winter', 'storm', 'harvest']) out('effects', `event-${e}`, <EventIcon type={e} size={96} />);
for (const d of ['characters', 'ui']) mkdirSync(path.join(root, d), { recursive: true });
console.log(`Izvezeno ${count} SVG datoteka u ${root}`);
