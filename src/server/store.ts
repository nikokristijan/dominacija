/**
 * Perzistentni sloj iza sučelja Store.
 * - Razvoj bez vanjskih servisa: FileStore (.data/dominacija.json) — jedini proces, serijalizirani zapisi.
 * - Produkcija (Vercel): SupabaseStore — jedan JSON dokument + optimistično zaključavanje (vidi supabaseStore.ts).
 */
import { FileStore } from './fileStore';
import { SupabaseStore } from './supabaseStore';
import type { Db } from './records';

export interface Store {
  /** Čitanje bez promjena. */
  read<T>(fn: (db: Db) => T): Promise<T>;
  /** Atomarna transakcija: sve promjene se spremaju ili nijedna (izuzetak = rollback). */
  tx<T>(fn: (db: Db) => T): Promise<T>;
}

const g = globalThis as unknown as { __dom_store?: Store };
export function getStore(): Store {
  if (!g.__dom_store && process.env.VERCEL && !useSupabase()) throw new Error('Pohrana nije podešena: na Vercelu postavi SUPABASE_URL i SUPABASE_SERVICE_ROLE_KEY (vidi docs/VERCEL.md).');
  if (!g.__dom_store) g.__dom_store = useSupabase()
    ? new SupabaseStore(supabaseUrl()!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    : new FileStore(process.env.DOMINACIJA_DATA ?? '.data/dominacija.json');
  return g.__dom_store;
}
/** URL projekta: SUPABASE_URL (samo server, čita se u trenutku izvođenja) ili NEXT_PUBLIC_SUPABASE_URL. */
const supabaseUrl = () => process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
export function useSupabase(): boolean {
  return !!(supabaseUrl() && process.env.SUPABASE_SERVICE_ROLE_KEY);
}
