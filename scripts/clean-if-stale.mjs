// Briše .next ako se izvorni stilovi promijene (spriječava "novi sadržaj + stari CSS" nakon git pull).
// Pokreće se automatski prije `npm run dev` / `npm run build`; `npm run fresh` uvijek briše sve.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const next = path.join(root, '.next');
const force = process.argv.includes('--force');
const files = ['src/app/globals.css', 'postcss.config.mjs', 'next.config.mjs', 'package.json'];
const h = createHash('sha1');
for (const f of files) { const p = path.join(root, f); if (existsSync(p)) h.update(readFileSync(p)); }
const key = h.digest('hex');
const stamp = path.join(root, 'node_modules', '.dominacija-cache-key');
const old = existsSync(stamp) ? readFileSync(stamp, 'utf8') : '';
if (force || old !== key) {
  if (existsSync(next)) { rmSync(next, { recursive: true, force: true }); console.log('[dominacija] Obrisan stari .next cache.'); }
  mkdirSync(path.dirname(stamp), { recursive: true });
  writeFileSync(stamp, key);
}
