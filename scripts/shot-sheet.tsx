import { renderToStaticMarkup } from 'react-dom/server';
import { createRequire } from 'node:module';
import { Character, CHARACTER_KINDS } from '../src/components/art/Characters';
import { Building, BUILDING_TYPES } from '../src/components/art/Buildings';
import { TerrainTile } from '../src/components/art/Terrain';
import { ResourceIcon } from '../src/components/art/Resources';
import { FactionBanner } from '../src/components/art/Factions';
import { Icon, ICON_NAMES } from '../src/components/art/Icons';
import { ClashEffect, ResearchEffect, ExpandEffect, BuildEffect } from '../src/components/art/Effects';
import { FACTION_IDS } from '../src/engine/config';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const row = (title: string, items: React.ReactNode[]) => `<div style="margin:8px 0"><b style="font:700 13px sans-serif">${title}</b><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end">${items.map((i) => renderToStaticMarkup(<>{i}</>)).join('')}</div></div>`;
const html = `<html><body style="margin:0;background:#F7F4FF;padding:14px;width:1100px;color:#5B3DF6">
${row('Likovi', CHARACTER_KINDS.map((k) => <Character kind={k} size={84} />))}
${row('Zgrade', BUILDING_TYPES.map((b) => <Building type={b} size={84} faction="purple" />))}
${row('Teren', (['plains', 'forest', 'mountains', 'desert', 'water', 'special'] as const).map((t, i) => <TerrainTile terrain={t} size={110} seed={t + i} />))}
${row('Resursi', (['gold', 'food', 'iron', 'wood', 'influence', 'population', 'stability', 'command'] as const).map((r) => <ResourceIcon name={r} size={56} />))}
${row('Frakcije', FACTION_IDS.map((f) => <FactionBanner faction={f} size={60} />))}
${row('Efekti', [<ClashEffect />, <ResearchEffect />, <ExpandEffect />, <BuildEffect />])}
${row('Ikone', ICON_NAMES.map((n) => <Icon name={n} size={30} />))}
</body></html>`;
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1128, height: 900 } }); await p.setContent(html); await p.screenshot({ path: process.argv[2], fullPage: true }); await b.close(); })();
