import { renderToStaticMarkup } from 'react-dom/server';
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { Penguin } from '../src/components/art/Penguin';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const svgIcon = (pad: number) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7B5CFF"/><stop offset="1" stop-color="#38218C"/></linearGradient></defs><rect width="512" height="512" fill="url(#bg)"/><g transform="translate(${pad} ${pad - 14}) scale(${(512 - pad * 2) / 512})">${renderToStaticMarkup(<Penguin mood="confident" size={512} animated={false} />).replace(/^<svg[^>]*>/, '<svg viewBox="-10 -10 220 244" width="512" height="568">')}</g></svg>`;
writeFileSync('public/icon.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7B5CFF"/><stop offset="1" stop-color="#38218C"/></linearGradient></defs><rect width="512" height="512" rx="110" fill="url(#bg)"/><g transform="translate(36 22) scale(0.86)">${renderToStaticMarkup(<Penguin mood="confident" size={512} animated={false} />).replace(/^<svg[^>]*>/, '<svg viewBox="-10 -10 220 244" width="512" height="568">')}</g></svg>`);
(async () => {
  const b = await chromium.launch();
  for (const [name, size, pad] of [['icon-192', 192, 40], ['icon-512', 512, 90], ['maskable-512', 512, 110], ['apple-touch-icon', 180, 36]] as const) {
    const p = await b.newPage({ viewport: { width: size, height: size } });
    await p.setContent(`<body style="margin:0">${svgIcon(pad).replace('<svg xmlns', `<svg width="${size}" height="${size}" xmlns`)}</body>`);
    await p.screenshot({ path: `public/icons/${name}.png` });
  }
  await b.close();
})();
