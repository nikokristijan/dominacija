import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { emptyDb, type Db } from './records';
import type { Store } from './store';

/** Razvojni store: JSON datoteka + mutex. Transakcija radi na kopiji pa se pri grešci ništa ne sprema. */
export class FileStore implements Store {
  private db: Db;
  private chain: Promise<unknown> = Promise.resolve();
  constructor(private file: string) {
    const abs = path.resolve(process.cwd(), file);
    this.file = abs;
    mkdirSync(path.dirname(abs), { recursive: true });
    this.db = existsSync(abs) ? { ...emptyDb(), ...JSON.parse(readFileSync(abs, 'utf8')) } : emptyDb();
  }
  private persist() {
    const tmp = `${this.file}.tmp`;
    writeFileSync(tmp, JSON.stringify(this.db));
    renameSync(tmp, this.file);
  }
  read<T>(fn: (db: Db) => T): Promise<T> {
    const run = this.chain.then(() => fn(this.db));
    this.chain = run.catch(() => undefined);
    return run as Promise<T>;
  }
  tx<T>(fn: (db: Db) => T): Promise<T> {
    const run = this.chain.then(() => {
      const draft = structuredClone(this.db);
      const res = fn(draft);
      this.db = draft;
      this.persist();
      return res;
    });
    this.chain = run.catch(() => undefined);
    return run as Promise<T>;
  }
}
