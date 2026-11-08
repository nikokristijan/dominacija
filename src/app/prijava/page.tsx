'use client';
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { Logo } from '@/components/Logo';
import { Seg } from '@/components/ui/kit';

function Form() {
  const sp = useSearchParams();
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>(sp.get('mode') === 'register' ? 'register' : 'login');
  const [username, setU] = useState(''); const [password, setP] = useState(''); const [displayName, setD] = useState('');
  const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try {
      await api(mode === 'login' ? '/api/auth/login' : '/api/auth/register', mode === 'login' ? { username, password } : { username, password, displayName: displayName || username });
      router.push('/igra'); router.refresh();
    } catch (x) { setErr(x instanceof Error ? x.message : 'Greška'); } finally { setBusy(false); }
  };
  return (
    <main className="min-h-dvh bg-white flex flex-col items-center justify-center px-5 py-8">
      <Logo />
      <form onSubmit={submit} className="w-full max-w-sm mt-8 space-y-4" data-testid="auth-form">
        <h1 className="text-2xl text-center">{mode === 'login' ? 'Dobrodošao natrag!' : 'Postani kralj!'}</h1>
        <Seg value={mode} onChange={setMode} options={[{ value: 'login', label: 'Prijava' }, { value: 'register', label: 'Registracija' }]} />
        <label className="block"><span className="label">Korisničko ime</span><input className="input mt-1" autoComplete="username" value={username} onChange={(e) => setU(e.target.value)} required minLength={3} data-testid="username" /></label>
        {mode === 'register' && <label className="block"><span className="label">Ime kralja (prikaz)</span><input className="input mt-1" value={displayName} maxLength={24} onChange={(e) => setD(e.target.value)} placeholder="npr. Marko I." data-testid="displayname" /></label>}
        <label className="block"><span className="label">Lozinka</span><input className="input mt-1" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setP(e.target.value)} required minLength={8} data-testid="password" /></label>
        {err && <p role="alert" className="rounded-xl bg-red-50 border-2 border-red-200 p-2.5 text-sm text-red-800 font-bold">{err}</p>}
        <button className="btn btn-yellow w-full" disabled={busy} data-testid="auth-submit">{busy ? 'Trenutak…' : mode === 'login' ? 'Prijavi se' : 'Stvori račun'}</button>
        <p className="text-xs text-muted text-center">{mode === 'register' ? 'Lozinka: barem 8 znakova.' : 'Nemaš račun? Odaberi Registracija.'}</p>
      </form>
      <Link href="/" className="mt-6 text-sm text-muted font-medium">← Natrag</Link>
    </main>
  );
}
export default function Page() { return <Suspense><Form /></Suspense>; }
