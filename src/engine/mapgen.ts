/** Generator svijeta: heksagonalna karta s ~110 teritorija i poštenim početnim pozicijama. */
import type { GameConfig } from './config';
import { createRng, hashString, type Rng } from './rng';
import { hexCenter, neighborOffsets, offsetDistance, tid, toAxial, parseTid } from './hex';
import { REGION_NAMES, territoryName } from './names';
import type { GameMap, Region, Territory, TerrainType, TerritoryId } from './types';

const REGION_COLORS = ['#A78BFA', '#FBBF24', '#34D399', '#38BDF8', '#FB923C', '#F472B6', '#94A3B8', '#4ADE80'];

function valueNoise(rng: Rng, w: number, h: number, cell: number): (c: number, r: number) => number {
  const gw = Math.ceil(w / cell) + 2, gh = Math.ceil(h / cell) + 2;
  const grid: number[][] = Array.from({ length: gh }, () => Array.from({ length: gw }, () => rng.next()));
  const smooth = (t: number) => t * t * (3 - 2 * t);
  return (c, r) => {
    const x = c / cell, y = r / cell;
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const fx = smooth(x - x0), fy = smooth(y - y0);
    const a = grid[y0][x0], b = grid[y0][x0 + 1], c2 = grid[y0 + 1][x0], d = grid[y0 + 1][x0 + 1];
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c2 * (1 - fx) + d * fx) * fy;
  };
}

function generateMapOnce(seed: string, playerCount: number, cfg: GameConfig): { map: GameMap; capitals: TerritoryId[]; starters: Record<TerritoryId, TerritoryId[]> } {
  const W = cfg.campaign.mapWidth, H = cfg.campaign.mapHeight;
  const rng = createRng(`${seed}:map`);
  const elev = valueNoise(createRng(`${seed}:e`), W, H, 3.2);
  const moist = valueNoise(createRng(`${seed}:m`), W, H, 3.6);
  const used = new Set<string>();
  const terr: Record<TerritoryId, Territory> = {};
  const order: TerritoryId[] = [];

  for (let row = 0; row < H; row++) {
    for (let col = 0; col < W; col++) {
      const id = tid(col, row);
      const { q, r } = toAxial(col, row);
      const e = elev(col, row), m = moist(col, row);
      let terrain: TerrainType = 'plains';
      if (e > 0.64) terrain = 'mountains';
      else if (m > 0.6) terrain = 'forest';
      else if (m < 0.3 && e < 0.6) terrain = 'desert';
      terr[id] = {
        id, name: territoryName(rng, used), col, row, q, r, terrain, resource: null, owner: null, building: null, buildingLevel: 0,
        construction: null, defenseLevel: 0, garrison: {}, population: 0, stability: 70, importance: 1, regionId: '', isCapital: false,
        capitalOf: null, siegeProgress: 0, siegeBy: null, isolatedDays: 0, effects: [],
      };
      order.push(id);
    }
  }
  // ── Organski oblik otoka: rezultat = udaljenost od središta + šum; zadržavamo `target` najboljih ćelija ──
  const shapeN1 = valueNoise(createRng(`${seed}:s1`), W, H, 4.2), shapeN2 = valueNoise(createRng(`${seed}:s2`), W, H, 2.2);
  const ext = { x: hexCenter(W, 0, 1).x / 2, y: hexCenter(0, H, 1).y / 2 };
  const score = (col: number, row: number) => {
    const c = hexCenter(col, row, 1);
    const dx = (c.x - ext.x) / ext.x, dy = (c.y - ext.y) / ext.y;
    return Math.sqrt(dx * dx + dy * dy) + (shapeN1(col, row) - 0.5) * 0.85 + (shapeN2(col, row) - 0.5) * 0.4;
  };
  const target = Math.min(order.length, cfg.campaign.territoryTarget);
  const keep = new Set(order.slice().sort((a, b) => score(terr[a].col, terr[a].row) - score(terr[b].col, terr[b].row) || a.localeCompare(b)).slice(0, target));
  const nbAll = (id: TerritoryId): TerritoryId[] => { const t = terr[id]; return neighborOffsets(t.col, t.row, W, H).map((o) => tid(o.col, o.row)); };
  // Samo najveća povezana cjelina ostaje
  { const seen = new Set<TerritoryId>(); let best: TerritoryId[] = [];
    for (const id of keep) { if (seen.has(id)) continue; const comp = [id]; seen.add(id); const st = [id];
      while (st.length) { const cur = st.pop()!; for (const n of nbAll(cur)) if (keep.has(n) && !seen.has(n)) { seen.add(n); comp.push(n); st.push(n); } }
      if (comp.length > best.length) best = comp; }
    for (const id of [...keep]) if (!best.includes(id)) keep.delete(id); }
  for (const id of [...order]) if (!keep.has(id)) delete terr[id];
  order.splice(0, order.length, ...order.filter((id) => keep.has(id)));
  const nb = (id: TerritoryId): TerritoryId[] => nbAll(id).filter((n) => !!terr[n]);

  // ── Prijestolnice: ravnomjerno po kutovima oko težišta otoka, samo u „unutarnjim” ćelijama ──
  const px = (id: TerritoryId) => hexCenter(terr[id].col, terr[id].row, 1);
  const cx = order.reduce((a, id) => a + px(id).x, 0) / order.length, cy = order.reduce((a, id) => a + px(id).y, 0) / order.length;
  const radius = Math.max(...order.map((id) => Math.hypot(px(id).x - cx, px(id).y - cy)));
  const ring2Count = (id: TerritoryId) => order.filter((o) => offsetDistance(terr[o], terr[id]) === 2).length;
  const within3 = (id: TerritoryId) => order.filter((o) => offsetDistance(terr[o], terr[id]) <= 3).length;
  const interior = order.filter((id) => nb(id).length === 6 && ring2Count(id) >= 10 && within3(id) >= 30);
  const phase = rng.next() * Math.PI * 2;
  const capitals: TerritoryId[] = [];
  for (let i = 0; i < playerCount; i++) {
    const ang = phase + (i * 2 * Math.PI) / playerCount;
    const tx = cx + Math.cos(ang) * radius * 0.58, ty = cy + Math.sin(ang) * radius * 0.58;
    let pick: TerritoryId | undefined;
    for (const minGap of [6, 5, 4, 3]) {
      pick = interior.filter((id) => capitals.every((c) => offsetDistance(terr[c], terr[id]) >= minGap))
        .sort((a, b) => Math.hypot(px(a).x - tx, px(a).y - ty) - Math.hypot(px(b).x - tx, px(b).y - ty) || a.localeCompare(b))[0];
      if (pick) break;
    }
    if (!pick) throw new Error('Generiranje karte nije uspjelo: nema mjesta za prijestolnice.');
    capitals.push(pick);
  }
  const centerId = order.slice().sort((a, b) => Math.hypot(px(a).x - cx, px(a).y - cy) - Math.hypot(px(b).x - cx, px(b).y - cy))[0];
  const center = { col: terr[centerId].col, row: terr[centerId].row };
  const distCenter = (id: TerritoryId) => offsetDistance(terr[id], center as any);
  const nearCapital = (id: TerritoryId, d: number) => capitals.some((c) => offsetDistance(terr[id], terr[c]) <= d);

  // Jezera
  const lakeCount = 5;
  for (let i = 0, tries = 0; i < lakeCount && tries < 200; tries++) {
    const id = rng.pick(order);
    if (nearCapital(id, 3) || terr[id].terrain === 'water') continue;
    terr[id].terrain = 'water';
    const extra = rng.int(0, 2);
    const cand = rng.shuffle(nb(id)).filter((n) => !nearCapital(n, 3));
    for (let k = 0; k < extra && k < cand.length; k++) terr[cand[k]].terrain = 'water';
    i++;
  }

  // Početni klasteri — jednaki za sve igrače (pošteno)
  const stamped = new Set<TerritoryId>();
  const starters: Record<TerritoryId, TerritoryId[]> = {};
  for (const cap of capitals) {
    const t = terr[cap];
    t.terrain = 'plains'; t.resource = null; stamped.add(cap);
    const ring1 = nb(cap).filter((n) => !stamped.has(n)).sort((a, b) => distCenter(a) - distCenter(b) || a.localeCompare(b));
    const [n1, n2] = ring1;
    terr[n1].terrain = 'plains'; terr[n1].resource = 'food'; stamped.add(n1);
    terr[n2].terrain = 'forest'; terr[n2].resource = 'wood'; stamped.add(n2);
    starters[cap] = [n1, n2];
    const ring2 = order
      .filter((id) => !stamped.has(id) && offsetDistance(terr[id], t) === 2 && !capitals.some((c) => c !== cap && offsetDistance(terr[id], terr[c]) <= 2))
      .sort((a, b) => distCenter(a) - distCenter(b) || a.localeCompare(b));
    const pickAt = (idx: number) => ring2.filter((id) => !stamped.has(id))[Math.min(idx, ring2.length - 1)];
    const mt = pickAt(0); if (mt) { terr[mt].terrain = 'mountains'; terr[mt].resource = 'iron'; stamped.add(mt); }
    const sp = pickAt(Math.floor(ring2.length / 2)); if (sp) { terr[sp].terrain = 'special'; terr[sp].resource = 'influence'; stamped.add(sp); }
    const pl = pickAt(ring2.length); if (pl) { terr[pl].terrain = 'plains'; terr[pl].resource = 'food'; stamped.add(pl); }
  }

  // Posebni resursni teritoriji u slobodnim dijelovima karte
  const specials: TerritoryId[] = [];
  for (const id of rng.shuffle(order)) {
    if (specials.length >= 8) break;
    if (stamped.has(id) || terr[id].terrain === 'water' || nearCapital(id, 3)) continue;
    if (specials.some((s) => offsetDistance(terr[s], terr[id]) < 3)) continue;
    terr[id].terrain = 'special';
    terr[id].resource = specials.length % 5 < 3 ? 'influence' : 'gold';
    specials.push(id);
  }

  // Povezanost kopna
  const land = () => order.filter((id) => terr[id].terrain !== 'water');
  for (let guard = 0; guard < 50; guard++) {
    const comp = new Map<TerritoryId, number>();
    let n = 0;
    for (const id of land()) {
      if (comp.has(id)) continue;
      const stack = [id]; comp.set(id, n);
      while (stack.length) {
        const cur = stack.pop()!;
        for (const nn of nb(cur)) if (terr[nn].terrain !== 'water' && !comp.has(nn)) { comp.set(nn, n); stack.push(nn); }
      }
      n++;
    }
    if (n <= 1) break;
    const bridge = order.find((id) => terr[id].terrain === 'water' && new Set(nb(id).filter((x) => terr[x].terrain !== 'water').map((x) => comp.get(x))).size >= 2);
    if (!bridge) { const any = order.find((id) => terr[id].terrain === 'water' && nb(id).some((x) => terr[x].terrain !== 'water')); if (any) terr[any].terrain = 'plains'; else break; }
    else terr[bridge].terrain = 'plains';
  }

  // Nalazišta, stanovništvo, važnost, obrana, domaća posada
  for (const id of order) {
    const t = terr[id];
    if (t.terrain === 'water') { t.resource = null; t.stability = 100; continue; }
    if (!stamped.has(id) && t.terrain !== 'special') {
      const roll = rng.next();
      if (t.terrain === 'plains') t.resource = roll < 0.45 ? 'food' : null;
      else if (t.terrain === 'forest') t.resource = roll < 0.6 ? 'wood' : null;
      else if (t.terrain === 'mountains') t.resource = roll < 0.8 ? 'iron' : null;
      else if (t.terrain === 'desert') t.resource = roll < 0.3 ? 'gold' : null;
    }
    const tc = cfg.terrain[t.terrain];
    t.population = Math.round(tc.maxPopulation * (0.35 + rng.next() * 0.25));
    const closeness = Math.max(0, 1 - distCenter(id) / 7);
    let imp = { plains: 2, forest: 2, mountains: 3, desert: 1, special: 4, water: 0 }[t.terrain];
    if (t.resource && t.terrain !== 'special') imp += 0.5;
    imp += closeness * 1.2;
    t.importance = Math.max(1, Math.min(5, Math.round(imp)));
    t.defenseLevel = t.terrain === 'mountains' ? 2 : t.terrain === 'forest' ? 1 : 0;
    const base = tc.nativeGarrison + (t.importance >= 4 ? 2 : 0) + (closeness > 0.6 ? 1 : 0);
    t.garrison = t.terrain === 'mountains' ? { spearmen: Math.ceil(base / 2), infantry: Math.floor(base / 2) } : { infantry: base };
  }

  // Regije (Voronoi od razmaknutih sjemenki)
  const landIds = land();
  const k = Math.min(cfg.campaign.regionCount, REGION_NAMES.length);
  const seeds: TerritoryId[] = [rng.pick(landIds)];
  while (seeds.length < k) {
    let best = landIds[0], bestD = -1;
    for (const id of landIds) {
      const d = Math.min(...seeds.map((s) => offsetDistance(terr[s], terr[id])));
      if (d > bestD) { bestD = d; best = id; }
    }
    seeds.push(best);
  }
  const names = rng.shuffle(REGION_NAMES.slice());
  const regions: Region[] = seeds.map((_, i) => ({ id: `r${i}`, name: names[i], territoryIds: [], color: REGION_COLORS[i % REGION_COLORS.length] }));
  for (const id of order) {
    const t = terr[id];
    let bi = 0, bd = Infinity;
    seeds.forEach((s, i) => { const d = offsetDistance(terr[s], t); if (d < bd) { bd = d; bi = i; } });
    t.regionId = regions[bi].id;
    if (t.terrain !== 'water') regions[bi].territoryIds.push(id);
  }

  return { map: { width: W, height: H, territories: terr, regions, order }, capitals, starters };
}

export { parseTid, hashString };

/** Deterministički pokušaji: ako neki oblik otoka nema dovoljno mjesta za sve prijestolnice, koristi se sljedeći. */
export function generateMap(seed: string, playerCount: number, cfg: GameConfig) {
  let last: unknown;
  for (let k = 0; k < 40; k++) {
    try { return generateMapOnce(k === 0 ? seed : `${seed}~${k}`, playerCount, cfg); } catch (e) { last = e; }
  }
  throw last;
}
