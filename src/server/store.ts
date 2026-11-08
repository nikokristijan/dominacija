/**
 * Perzistentni sloj iza sučelja Store.
 * - Razvoj bez vanjskih servisa: FileStore (.data/dominacija.json) — jedini proces, serijalizirani zapisi.
 * - Produkcija: Supabase (vidi supabase/migrations i docs u DEVELOPMENT.md). Sučelje je isto.
 */
import { FileStore } from './fileStore';
import type { Db } from './records';

export interface Store {
  /** Čitanje bez promjena. */
  read<T>(fn: (db: Db) => T): Promise<T>;
  /** Atomarna transakcija: sve promjene se spremaju ili nijedna (izuzetak = rollback). */
  tx<T>(fn: (db: Db) => T): Promise<T>;
}

const g = globalThis as unknown as { __dom_store?: Store };
export function getStore(): Store {
  if (!g.__dom_store) g.__dom_store = new FileStore(process.env.DOMINACIJA_DATA ?? '.data/dominacija.json');
  return g.__dom_store;
}
export function useSupabase(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}
