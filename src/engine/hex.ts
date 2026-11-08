/** Heksagonalna geometrija — "odd-r" offset raspored (šiljak prema gore). */
export interface Offset { col: number; row: number }

const EVEN_ROW = [[1, 0], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1]];
const ODD_ROW = [[1, 0], [1, -1], [0, -1], [-1, 0], [0, 1], [1, 1]];

export const tid = (col: number, row: number) => `h${col}_${row}`;

export function parseTid(id: string): Offset {
  const [c, r] = id.slice(1).split('_').map(Number);
  return { col: c, row: r };
}

export function neighborOffsets(col: number, row: number, width: number, height: number): Offset[] {
  const dirs = row % 2 === 0 ? EVEN_ROW : ODD_ROW;
  const out: Offset[] = [];
  for (const [dc, dr] of dirs) {
    const c = col + dc, r = row + dr;
    if (c >= 0 && c < width && r >= 0 && r < height) out.push({ col: c, row: r });
  }
  return out;
}

export function toAxial(col: number, row: number) {
  return { q: col - (row - (row & 1)) / 2, r: row };
}

export function axialDistance(a: { q: number; r: number }, b: { q: number; r: number }) {
  const dq = a.q - b.q, dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

export function offsetDistance(a: Offset, b: Offset) {
  return axialDistance(toAxial(a.col, a.row), toAxial(b.col, b.row));
}

/** Pikselna pozicija središta heksa (šiljak prema gore), size = polumjer. */
export function hexCenter(col: number, row: number, size: number) {
  const w = Math.sqrt(3) * size;
  return { x: w * (col + 0.5 * (row & 1)) + w / 2, y: size * 1.5 * row + size };
}

export function hexCorners(cx: number, cy: number, size: number): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < 6; i++) {
    const ang = (Math.PI / 180) * (60 * i - 30);
    pts.push([cx + size * Math.cos(ang), cy + size * Math.sin(ang)]);
  }
  return pts;
}

export function mapPixelSize(width: number, height: number, size: number) {
  const w = Math.sqrt(3) * size;
  return { width: w * (width + 0.5), height: size * 1.5 * (height - 1) + size * 2 };
}
