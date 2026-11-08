import { renderToStaticMarkup } from 'react-dom/server';
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { Icon } from '../src/components/art/Icons';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const crown = (size: number) => renderToStaticMarkup(<span style={{ color: '#fff' }}><Icon name="crown" size={size} stroke={1.7} /></span>).replace(/^<span[^>]*>/, '').replace(/<\/span>$/, '');
const svg = (rx: number, glyph: number) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="${rx}" fill="#7138E8"/><g transform="translate(${(512 - glyph) / 2} ${(512 - glyph) / 2})" color="#fff">${crown(glyph)}</g></svg>`;
writeFileSync('public/icon.svg', svg(112, 300));
(async () => {
  const b = await chromium.launch();
  for (const [name, size, glyph, rx] of [['icon-192', 192, 300, 0], ['icon-512', 512, 300, 0], ['maskable-512', 512, 230, 0], ['apple-touch-icon', 180, 300, 0]] as const) {
    const p = await b.newPage({ viewport: { width: size, height: size } });
    await p.setContent(`<body style="margin:0">${svg(rx, glyph).replace('<svg xmlns', `<svg width="${size}" height="${size}" xmlns`)}</body>`);
    await p.screenshot({ path: `public/icons/${name}.png` });
  }
  await b.close();
})();
