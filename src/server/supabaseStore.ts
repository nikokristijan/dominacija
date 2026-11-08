import { emptyDb, type Db } from './records';
import type { Store } from './store';

/**
 * Produkcijski store za serverless (Vercel): cijelo stanje igre je jedan JSON dokument u tablici `dominacija_state`
 * (vidi supabase/migrations/0003_state_blob.sql). Pristup je preko Supabase REST-a (PostgREST) s service-role ključem,
 * a istovremeni zapisi riješeni su optimističnim zaključavanjem (stupac `version`): tx čita, primijeni promjenu na kopiji
 * i zapiše samo ako se verzija u međuvremenu nije promijenila — inače ponovi cijelu transakciju na svježim podacima.
 * Namjerno jednostavno: dovoljno za desetke igrača i nekoliko kampanja; za veće opterećenje treba normalizirane tablice.
 */
export class SupabaseStore implements Store {
  private cache: { version: number; db: Db } | null = null;
  private chain: Promise<unknown> = Promise.resolve();
  private readonly url: string;
  constructor(base: string, private key: string, private fetchImpl: typeof fetch = fetch) {
    this.url = `${base.replace(/\/$/, '')}/rest/v1/dominacija_state`;
  }
  private headers(extra: Record<string, string> = {}) {
    return { apikey: this.key, Authorization: `Bearer ${this.key}`, 'Content-Type': 'application/json', ...extra };
  }
  private async call(path: string, init: RequestInit): Promise<Response> {
    const r = await this.fetchImpl(`${this.url}${path}`, { ...init, cache: 'no-store' });
    if (!r.ok) throw new Error(`Supabase ${r.status}: ${(await r.text()).slice(0, 300)}`);
    return r;
  }
  /** Najnovije stanje; za čitanje prvo pita samo za verziju pa preuzima dokument samo ako se promijenio. */
  private async load(fresh = false): Promise<{ version: number; db: Db }> {
    if (this.cache && !fresh) {
      const r = await this.call('?id=eq.main&select=version', { headers: this.headers() });
      const rows = (await r.json()) as Array<{ version: number }>;
      if (rows[0] && rows[0].version === this.cache.version) return this.cache;
    }
    const r = await this.call('?id=eq.main&select=version,data', { headers: this.headers() });
    const rows = (await r.json()) as Array<{ version: number; data: Partial<Db> }>;
    if (!rows[0]) {
      // prvo pokretanje: stvori prazan dokument (ignore-duplicates: druga instanca je možda već stvorila)
      await this.call('', { method: 'POST', headers: this.headers({ Prefer: 'resolution=ignore-duplicates,return=minimal' }), body: JSON.stringify({ id: 'main', version: 1, data: emptyDb() }) });
      return this.load(true);
    }
    this.cache = { version: rows[0].version, db: { ...emptyDb(), ...rows[0].data } };
    return this.cache;
  }
  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.chain.then(fn);
    this.chain = run.catch(() => undefined);
    return run;
  }
  read<T>(fn: (db: Db) => T): Promise<T> {
    return this.enqueue(async () => fn((await this.load()).db));
  }
  tx<T>(fn: (db: Db) => T): Promise<T> {
    return this.enqueue(async () => {
      for (let attempt = 0; attempt < 8; attempt++) {
        const cur = await this.load(attempt > 0);
        const draft = structuredClone(cur.db);
        const res = fn(draft); // izuzetak = rollback (ništa se ne zapisuje)
        const r = await this.call(`?id=eq.main&version=eq.${cur.version}`, {
          method: 'PATCH', headers: this.headers({ Prefer: 'return=representation' }),
          body: JSON.stringify({ version: cur.version + 1, data: draft }),
        });
        const rows = (await r.json()) as unknown[];
        if (rows.length === 1) { this.cache = { version: cur.version + 1, db: draft }; return res; }
        this.cache = null; // netko je bio brži — ponovi na svježim podacima
      }
      throw new Error('Pohrana je zauzeta, pokušaj ponovno.');
    });
  }
}
