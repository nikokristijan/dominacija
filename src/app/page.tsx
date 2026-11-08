import Link from 'next/link';
import { currentUser } from '@/server/auth';
import { HeroMap } from '@/components/HeroMap';
import { Logo } from '@/components/Logo';

export const dynamic = 'force-dynamic';
export default async function Welcome() {
  const user = await currentUser();
  return (
    <main className="min-h-dvh bg-white flex flex-col">
      <header className="px-6 lg:px-10 py-5 flex items-center justify-between"><Logo />{!user && <Link href="/prijava" className="text-sm font-semibold text-neutral-600" data-testid="login-link">Prijava</Link>}</header>
      <section className="flex-1 flex flex-col lg:flex-row items-center lg:gap-6 px-6 lg:px-10 max-w-7xl w-full mx-auto">
        <div className="lg:w-[34rem] pt-6 lg:pt-0 text-center lg:text-left shrink-0">
          <h1 className="text-[2.6rem] lg:text-6xl leading-[1.04] font-semibold tracking-tight">Sedam dana.<br />Jedno kraljevstvo.</h1>
          <p className="mt-4 text-lg text-neutral-500 max-w-md mx-auto lg:mx-0">Asinkrona strategija za 4–8 igrača. Planiraj, pregovaraj, špijuniraj — sve naredbe izvršavaju se istovremeno. Pobjeđuje onaj tko misli, ne onaj tko klika.</p>
          <div className="mt-7 flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
            <Link href={user ? '/igra' : '/prijava?mode=register'} className="btn btn-yellow min-h-12 px-8 text-base" data-testid="start-game">{user ? 'Nastavi igru' : 'Započni igru'}</Link>
            <Link href="/k/tutorial/karta" className="btn btn-ghost min-h-12 px-8 text-base" data-testid="tutorial-link">Nauči igrati (vodič)</Link>
          </div>
        </div>
        <div className="relative w-full flex-1 min-h-[22rem] lg:min-h-[34rem] lg:h-[calc(100dvh-8rem)] min-w-0"><HeroMap className="absolute inset-0 lg:scale-[1.22] origin-center" /></div>
      </section>
    </main>
  );
}
