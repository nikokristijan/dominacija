/**
 * Provjera SQL sheme i RLS politika u pravom PostgreSQL-u (PGlite = Postgres u WASM-u).
 * Supabase-specifično (auth.users, auth.uid(), uloge) simulirano je minimalnim stubovima.
 */
import { describe, expect, it, beforeAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

const U1 = '11111111-1111-1111-1111-111111111111', U2 = '22222222-2222-2222-2222-222222222222', U3 = '33333333-3333-3333-3333-333333333333';
let db: PGlite;
async function as(uid: string | null, sql: string, params: unknown[] = []) {
  await db.exec(`set role ${uid ? 'authenticated' : 'anon'}; select set_config('request.jwt.claim.sub', '${uid ?? ''}', false);`);
  try { return await db.query(sql, params); } finally { await db.exec('reset role;'); }
}
const rows = async (uid: string | null, sql: string) => (await as(uid, sql)).rows as any[];

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth; create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  `);
  await db.exec(readFileSync('supabase/migrations/0001_schema.sql', 'utf8'));
  await db.exec(readFileSync('supabase/migrations/0002_rls.sql', 'utf8'));
  await db.exec(`
    insert into auth.users values ('${U1}'), ('${U2}'), ('${U3}');
    insert into profiles (id, display_name, is_admin) values ('${U1}', 'Marko', false), ('${U2}', 'Ana', false), ('${U3}', 'Admin', true);
    insert into campaigns (id, name, owner_id, invite_code, seed, schedule, status) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Test', '${U1}', 'ABC123', 's', '{}', 'active');
    insert into campaign_players (id, campaign_id, user_id, slot, name) values
      ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', '${U1}', 'p1', 'Marko'),
      ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', '${U2}', 'p2', 'Ana');
    insert into resources (campaign_player_id, gold) values ('bbbbbbbb-0000-0000-0000-000000000001', 100), ('bbbbbbbb-0000-0000-0000-000000000002', 777);
    insert into orders (campaign_id, campaign_player_id, round, type, params, status, cp_cost) values
      ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 1, 'attack', '{"secret":"plan Marka"}', 'submitted', 3),
      ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 1, 'recruit', '{"secret":"plan Ane"}', 'submitted', 1);
    insert into secret_objectives values ('bbbbbbbb-0000-0000-0000-000000000001', 'gold', 'Zlatna riznica', 'x', '{}', false), ('bbbbbbbb-0000-0000-0000-000000000002', 'mines', 'Rudar', 'x', '{}', false);
    insert into territories (id, campaign_id, code, name, col, row, q, r, terrain, region_id, owner_player_id) values
      ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'h1_1', 'Prvi', 1, 1, 1, 1, 'plains', 'r0', 'bbbbbbbb-0000-0000-0000-000000000001'),
      ('cccccccc-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'h2_1', 'Drugi', 2, 1, 2, 1, 'forest', 'r0', 'bbbbbbbb-0000-0000-0000-000000000002');
    insert into military_units values ('infantry', 4, 5, 1, '{}', '{}', '{}');
    insert into armies (territory_id, unit_type, count) values ('cccccccc-0000-0000-0000-000000000002', 'infantry', 50);
    insert into messages (campaign_id, from_player, to_player, body, round) values ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 'tajna', 1);
    insert into campaign_scores values ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 1, 6, '{"objective":5}');
  `);
});

describe('RLS: privatnost podataka igrača', () => {
  it('igrač vidi samo vlastite naredbe, ne tuđe', async () => {
    const mine = await rows(U1, 'select params from orders');
    expect(mine.length).toBe(1); expect(JSON.stringify(mine)).toContain('Marka'); expect(JSON.stringify(mine)).not.toContain('Ane');
  });
  it('tajni ciljevi su privatni', async () => {
    const o = await rows(U2, 'select title from secret_objectives');
    expect(o).toEqual([{ title: 'Rudar' }]);
  });
  it('tuđi resursi i garnizoni nisu čitljivi', async () => {
    expect(await rows(U1, 'select gold from resources')).toEqual([{ gold: '100' }]);
    expect(await rows(U1, 'select count from armies')).toEqual([]);
    expect((await rows(U1, 'select code from territories')).map((r) => r.code)).toEqual(['h1_1']);
  });
  it('javni pogled teritorija ne otkriva vojsku, ali pokazuje vlasnika', async () => {
    const pub = await rows(U1, 'select * from territories_public order by code');
    expect(pub.length).toBe(2);
    expect(Object.keys(pub[0])).not.toContain('population'); expect(Object.keys(pub[0])).not.toContain('stability');
  });
  it('poruke vide samo sudionici', async () => {
    expect((await rows(U1, 'select 1 from messages')).length).toBe(1);
    expect((await rows(U2, 'select 1 from messages')).length).toBe(1);
    expect((await rows(U3, 'select 1 from messages')).length).toBe(1); // admin
    expect((await rows(null, 'select 1 from messages').catch(() => [])).length).toBe(0);
  });
  it('nečlan (anon) ne vidi ništa', async () => {
    await db.exec(`insert into auth.users values ('44444444-4444-4444-4444-444444444444') on conflict do nothing; insert into profiles (id, display_name) values ('44444444-4444-4444-4444-444444444444', 'Vanjski') on conflict do nothing;`);
    const stranger = '44444444-4444-4444-4444-444444444444';
    expect((await rows(stranger, 'select 1 from orders')).length).toBe(0);
    expect((await rows(stranger, 'select 1 from campaigns')).length).toBe(0);
    expect((await rows(stranger, 'select 1 from territories_public')).length).toBe(0);
  });
  it('rastav bodova (tajni cilj) skriven je do završetka kampanje', async () => {
    const r = await rows(U2, 'select public_score, breakdown from campaign_scores_public');
    expect(r[0].breakdown).toBeNull();
    await db.exec("update campaigns set status = 'completed'");
    expect((await rows(U2, 'select breakdown from campaign_scores_public'))[0].breakdown).not.toBeNull();
    await db.exec("update campaigns set status = 'active'");
  });
  it('klijent ne može mijenjati stanje igre (naredbe, resurse, bodove)', async () => {
    await expect(as(U1, "update resources set gold = 9999")).rejects.toThrow();
    await expect(as(U1, "insert into orders (campaign_id, campaign_player_id, round, type, params, cp_cost) values ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 1, 'attack', '{}', 0)")).rejects.toThrow();
    await expect(as(U1, "update profiles set is_admin = true")).rejects.toThrow();
  });
  it('admin vidi sve', async () => {
    expect((await rows(U3, 'select 1 from orders')).length).toBe(2);
  });
});

describe('Ograničenja integriteta i idempotentnost', () => {
  it('CHECK ograničenja sprječavaju negativne resurse', async () => {
    await expect(db.exec("update resources set gold = -5")).rejects.toThrow();
  });
  it('razrješenje iste runde ne može se upisati dvaput (primarni ključ)', async () => {
    await db.exec("insert into resolutions (campaign_id, round) values ('aaaaaaaa-0000-0000-0000-000000000001', 1)");
    await expect(db.exec("insert into resolutions (campaign_id, round) values ('aaaaaaaa-0000-0000-0000-000000000001', 1)")).rejects.toThrow();
  });
  it('jedan korisnik ne može biti dvaput u istoj kampanji; igrač ne može imati savez sam sa sobom', async () => {
    await expect(db.exec(`insert into campaign_players (campaign_id, user_id, slot, name) values ('aaaaaaaa-0000-0000-0000-000000000001', '${U1}', 'p3', 'Dupli')`)).rejects.toThrow();
    await expect(db.exec("insert into alliances (campaign_id, kind, player_a, player_b, started_round) values ('aaaaaaaa-0000-0000-0000-000000000001', 'alliance', 'bbbbbbbb-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 1)")).rejects.toThrow();
  });
});
