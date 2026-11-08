import Link from 'next/link';
import { currentUser } from '@/server/auth';
import { Landscape } from '@/components/Landscape';
import { Logo } from '@/components/Logo';
import { Penguin } from '@/components/art/Penguin';

export const dynamic = 'force-dynamic';
export default async function Welcome() {
  const user = await currentUser();
  return (
    <main className="relative min-h-dvh overflow-hidden bg-kingdom flex flex-col items-center text-white">
      <Landscape className="absolute inset-x-0 bottom-0 h-[78%] w-full" />
      <div className="relative z-10 flex flex-col items-center pt-[calc(2rem+var(--safe-t))] px-6 w-full max-w-md flex-1">
        <Logo />
        <div className="bob mt-2 drop-shadow-[0_10px_0_rgba(46,26,143,0.25)]"><Penguin mood="confident" size={210} /></div>
        <p className="mt-1 text-center font-extrabold text-lg text-white drop-shadow">7 dana. Jedno kraljevstvo. Pametni pobjeđuju.</p>
        <div className="mt-auto w-full pb-[calc(1.5rem+var(--safe-b))] pt-6 space-y-3">
          <Link href={user ? '/igra' : '/prijava?mode=register'} className="btn btn-yellow w-full text-xl min-h-14" data-testid="start-game">{user ? 'Nastavi igru' : 'Započni igru'}</Link>
          {!user && <Link href="/prijava" className="btn btn-ghost w-full" data-testid="login-link">Prijava</Link>}
          <p className="text-center text-xs text-white/80 font-bold">Asinkrona strategija za 4–8 igrača · Radi u pregledniku, bez instalacije</p>
        </div>
      </div>
    </main>
  );
}
