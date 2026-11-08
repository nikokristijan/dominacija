import { describe, expect, it } from 'vitest';
import { SupabaseStore } from '@/server/supabaseStore';
import { emptyDb } from '@/server/records';

/** Minimalna imitacija PostgREST tablice dominacija_state (jedan red, version-uvjetni PATCH). */
function fakeRest() {
  let row: { id: string; version: number; data: unknown } | null = null;
  const calls: string[] = [];
  const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json' } });
  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const u = new URL(String(input)); const m = init?.method ?? 'GET'; calls.push(`${m} ${u.search}`);
    if (m === 'GET') {
      if (!row) return json([]);
      return json([u.searchParams.get('select') === 'version' ? { version: row.version } : { version: row.version, data: row.data }]);
    }
    if (m === 'POST') { if (!row) row = JSON.parse(String(init!.body)); return new Response(null, { status: 201 }); }
    if (m === 'PATCH') {
      const want = Number(u.searchParams.get('version')!.replace('eq.', ''));
      if (!row || row.version !== want) return json([]);
      const body = JSON.parse(String(init!.body)); row = { ...row, ...body };
      return json([row]);
    }
    return json({}, 400);
  }) as typeof fetch;
  return { impl, calls, get row() { return row; }, set row(r) { row = r; } };
}

describe('SupabaseStore (optimistično zaključavanje)', () => {
  it('stvara dokument, sprema transakciju i čita natrag', async () => {
    const f = fakeRest(); const s = new SupabaseStore('http://x', 'k', f.impl);
    await s.tx((db) => { db.counter = 5; });
    const v = await s.read((db) => db.counter);
    expect(v).toBe(5);
    expect(f.row?.version).toBe(2);
  });
  it('izuzetak u tx znači rollback: ništa se ne zapisuje', async () => {
    const f = fakeRest(); const s = new SupabaseStore('http://x', 'k', f.impl);
    await s.read(() => 0);
    await expect(s.tx((db) => { db.counter = 99; throw new Error('nope'); })).rejects.toThrow('nope');
    expect(f.row?.version).toBe(1);
  });
  it('sukob verzija (druga instanca bila brža) ponavlja transakciju na svježim podacima', async () => {
    const f = fakeRest(); const a = new SupabaseStore('http://x', 'k', f.impl); const b = new SupabaseStore('http://x', 'k', f.impl);
    await a.read(() => 0); await b.read(() => 0);
    await a.tx((db) => { db.counter++; });
    // b ima zastarjelu predmemoriju; njegov prvi PATCH mora promašiti, drugi uspjeti
    let runs = 0;
    await b.tx((db) => { runs++; db.counter++; });
    const n = await a.read((db) => db.counter);
    expect(n).toBe(2);
    expect(runs).toBeGreaterThanOrEqual(1);
  });
  it('emptyDb je valjan početni dokument', () => { expect(emptyDb().users).toBeDefined(); });
});
