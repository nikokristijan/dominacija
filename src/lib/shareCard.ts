/** Kartica rezultata za dijeljenje (PNG 1080×1350), crtana na canvasu u pregledniku — bez servera i bez vanjskih servisa. */
export interface ShareRow { place: number; name: string; points: number; color: string; me: boolean }
export interface ShareCardInput { headline: string; sub: string; campaign: string; rows: ShareRow[] }

function rr(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
function wrap(c: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number): number {
  const words = text.split(' '); let line = ''; let yy = y;
  for (const w of words) { const t = line ? `${line} ${w}` : w; if (c.measureText(t).width > maxW && line) { c.fillText(line, x, yy); line = w; yy += lh; } else line = t; }
  if (line) { c.fillText(line, x, yy); yy += lh; }
  return yy;
}

export async function renderShareCard(inp: ShareCardInput): Promise<Blob> {
  const W = 1080, H = 1350;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d')!;
  const F = 'Inter, -apple-system, "Segoe UI", system-ui, sans-serif';
  c.fillStyle = '#fff'; c.fillRect(0, 0, W, H);
  // blaga ljubičasta aureola u kutu
  const g = c.createRadialGradient(W, 0, 0, W, 0, 760); g.addColorStop(0, 'rgba(113,56,232,0.16)'); g.addColorStop(1, 'rgba(113,56,232,0)');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.fillStyle = '#171717'; c.font = `700 40px ${F}`; c.textBaseline = 'alphabetic'; c.fillText('DOMINACIJA', 80, 120);
  c.fillStyle = '#858585'; c.font = `600 28px ${F}`; c.fillText(inp.campaign.toUpperCase(), 80, 170);
  c.fillStyle = '#171717'; c.font = `700 92px ${F}`;
  let y = wrap(c, inp.headline, 80, 330, W - 160, 104);
  c.fillStyle = '#7138E8'; c.font = `600 40px ${F}`;
  y = wrap(c, inp.sub, 80, y + 16, W - 160, 52);
  y += 40;
  const rows = inp.rows.slice(0, 6);
  const step = Math.min(130, Math.floor((H - 130 - y) / Math.max(1, rows.length))), rh = step - 18, mid = rh / 2;
  for (const r of rows) {
    c.fillStyle = r.me ? '#F5F1FE' : '#fff'; rr(c, 80, y, W - 160, rh, 28); c.fill();
    c.strokeStyle = r.me ? '#7138E8' : '#EEEEEE'; c.lineWidth = r.me ? 3 : 2; rr(c, 80, y, W - 160, rh, 28); c.stroke();
    c.fillStyle = r.place === 1 ? '#7138E8' : '#171717'; c.font = `700 52px ${F}`; c.textAlign = 'left'; c.fillText(`${r.place}.`, 116, y + mid + 18);
    c.fillStyle = r.color; c.beginPath(); c.arc(246, y + mid, 24, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#171717'; c.font = `600 40px ${F}`; c.fillText(r.name.slice(0, 18), 292, y + mid + 14);
    c.fillStyle = '#7138E8'; c.font = `700 48px ${F}`; c.textAlign = 'right'; c.fillText(String(r.points), W - 116, y + mid + 18); c.textAlign = 'left';
    y += step;
  }
  c.fillStyle = '#858585'; c.font = `500 30px ${F}`; c.fillText('Sedam dana. Jedno kraljevstvo.', 80, H - 70);
  return await new Promise<Blob>((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error('Slika nije stvorena.'))), 'image/png'));
}

/** Dijeli sliku (mobilni izbornik za dijeljenje) ili je preuzima. Vraća 'shared' | 'downloaded' | 'cancelled'. */
export async function shareImage(blob: Blob, filename: string, text: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const file = new File([blob], filename, { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try { await nav.share({ files: [file], text, title: 'Dominacija' }); return 'shared'; }
    catch (e) { if ((e as Error).name === 'AbortError') return 'cancelled'; }
  }
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
  return 'downloaded';
}
