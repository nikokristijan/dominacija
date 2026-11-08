'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { DiplomaticOffer, OrderInput } from '@/engine/types';
import { Icon } from '@/components/art/Icons';
import { FactionBadge } from '@/components/art/Factions';
import { Penguin } from '@/components/art/Penguin';
import { Progress, Seg, Sheet, Empty, SectionTitle } from '@/components/ui/kit';
import { useGame } from '@/components/game/GameProvider';
import { OrderComposer } from '@/components/game/OrderComposer';
import { timeAgo } from '@/lib/format';
import { kindLabel } from '@/engine/diplomacy';
import { RES_SHORT } from '@/components/game/orderText';

const REL: Record<string, { t: string; c: string }> = { self: { t: 'Ti', c: '' }, ally: { t: 'Saveznik', c: 'chip-good' }, pact: { t: 'Nenapadanje', c: 'chip-yellow' }, neutral: { t: 'Neutralan', c: '' } };
const ST: Record<DiplomaticOffer['status'], { t: string; c: string }> = { pending: { t: 'Na čekanju', c: 'chip-yellow' }, accepted: { t: 'Prihvaćeno', c: 'chip-good' }, rejected: { t: 'Odbijeno', c: 'chip-bad' }, expired: { t: 'Isteklo', c: '' }, executed: { t: 'Izvršeno', c: 'chip-good' }, failed: { t: 'Neuspjelo', c: 'chip-bad' }, withdrawn: { t: 'Povučeno', c: '' } };

export function DiplomacyScreen() {
  const g = useGame();
  const v = g.view!;
  const [tab, setTab] = useState<'neg' | 'allies' | 'treaties'>('allies');
  const [thread, setThread] = useState<string | null>(null);
  const [composer, setComposer] = useState<{ order: OrderInput } | null>(null);
  const others = Object.values(v.players).filter((p) => p.id !== v.me.id);
  const planning = v.phase === 'planning' && !v.me.ready;
  const incoming = v.offers.filter((o) => o.to === v.me.id && o.status === 'pending');
  const post = async (body: unknown, msg?: string) => { try { await g.act(`/api/campaigns/${g.id}/diplomacy`, body, { successMsg: msg }); } catch { /* toast */ } };
  const newOffer = (secret = false, target?: string) => setComposer({ order: { type: 'diplomacy', params: { kind: 'alliance', targetPlayerId: target ?? others[0]?.id, secret } } });
  const myAlliances = v.alliances.filter((a) => a.status === 'active' && (a.a === v.me.id || a.b === v.me.id));

  return (
    <div className="flex-1 overflow-y-auto" data-testid="diplomacy-screen">
      <div className="max-w-3xl mx-auto p-3 lg:p-5 space-y-3">
        <header className="flex items-center gap-3"><Penguin mood={incoming.length ? 'surprised' : 'happy'} size={64} /><div className="flex-1"><h1 className="text-2xl text-secondary">Diplomacija</h1><p className="text-sm text-muted font-bold">Savezi, ugovori i tajni pregovori. Izdaja je uvijek moguća — ali se pamti.</p></div></header>
        <Seg value={tab} onChange={setTab} options={[{ value: 'neg', label: 'Pregovori' }, { value: 'allies', label: 'Savezi' }, { value: 'treaties', label: `Ugovori${incoming.length ? ` (${incoming.length})` : ''}` }]} />

        {tab === 'allies' && (<>
          <SectionTitle icon="users">Kraljevstva</SectionTitle>
          <div className="space-y-2">{others.map((p) => { const rel = REL[p.relation]; return (
            <div key={p.id} className="card-flat flex items-center gap-3" data-testid={`player-${p.id}`}>
              <FactionBadge faction={p.faction} size={44} />
              <div className="flex-1 min-w-0"><div className="font-display text-lg text-secondary truncate">{p.name} {p.isBot && <span className="chip chip-yellow">bot</span>}</div>
                <div className="flex flex-wrap gap-1.5 mt-0.5"><span className={`chip ${rel.c}`}>{rel.t}</span><span className="chip">{p.score} bod.</span><span className="chip">{p.territoryCount} teritorija</span>{p.status === 'resistance' && <span className="chip chip-bad">Otpor</span>}</div>
                <div className="mt-1.5 flex items-center gap-2"><span className="text-[11px] font-extrabold text-muted w-12">Ugled</span><Progress className="flex-1 !h-2" value={p.reputation.score} color={p.reputation.score < 35 ? 'bg-bad' : p.reputation.score < 55 ? 'bg-warn' : 'bg-good'} /><span className="text-xs font-black w-7 text-right">{Math.round(p.reputation.score)}</span></div></div>
              <div className="flex flex-col gap-1.5"><button className="btn btn-ghost btn-sm" onClick={() => { setThread(p.id); setTab('neg'); }} aria-label="Poruka"><Icon name="send" size={16} /></button>{planning && <button className="btn btn-purple btn-sm" onClick={() => newOffer(false, p.id)} data-testid={`offer-${p.id}`}>Ponuda</button>}</div>
            </div>); })}</div>
          <SectionTitle icon="handshake">Aktivni savezi i sporazumi</SectionTitle>
          {myAlliances.length === 0 && <div className="card-flat text-sm text-muted font-bold">Nemaš aktivnih saveza. Savez daje zajednički vid i mogućnost vojne potpore — ali ne štiti od izdaje.</div>}
          {myAlliances.map((a) => { const other = a.a === v.me.id ? a.b : a.a; return (
            <div key={a.id} className="card-flat flex items-center gap-3"><FactionBadge faction={v.players[other].faction} size={36} /><div className="flex-1 text-sm"><div className="font-extrabold">{a.kind === 'alliance' ? 'Savez' : 'Nenapadanje'} s {v.players[other].name}{a.secret && <span className="chip chip-yellow ml-1">tajno</span>}</div><div className="text-muted font-bold">Od dana {a.startedRound} · do dana {a.endsRound ?? '—'}{a.terms.sharedVision ? ' · zajednički vid' : ''}</div></div>
              {planning && <button className="btn btn-ghost btn-sm !text-bad" onClick={() => post({ action: 'terminate', allianceId: a.id }, 'Sporazum raskinut.')}>Raskini</button>}</div>); })}
        </>)}

        {tab === 'treaties' && (<>
          <div className="grid grid-cols-2 gap-2"><button className="btn btn-yellow btn-sm" disabled={!planning} onClick={() => newOffer(false)} data-testid="new-offer"><Icon name="plus" size={16} />Nova ponuda</button><button className="btn btn-ghost btn-sm" disabled={!planning} onClick={() => newOffer(true)}><Icon name="lock" size={16} />Tajni sporazum</button></div>
          {!planning && <p className="text-xs text-muted font-bold">Ponude se šalju diplomatskom misijom tijekom faze planiranja (2 ZB) i stižu nakon razrješenja.</p>}
          <SectionTitle icon="bell">Primljene ponude</SectionTitle>
          {incoming.length === 0 && <div className="card-flat text-sm text-muted font-bold">Nema ponuda na čekanju.</div>}
          {incoming.map((o) => <OfferCard key={o.id} o={o} incoming planning={planning} onRespond={(a) => post({ action: 'respond', offerId: o.id, accept: a }, a ? 'Ponuda prihvaćena.' : 'Ponuda odbijena.')} />)}
          <SectionTitle icon="scroll">Moje ponude i povijest</SectionTitle>
          {v.offers.filter((o) => !(o.to === v.me.id && o.status === 'pending')).slice().reverse().map((o) => <OfferCard key={o.id} o={o} planning={planning} onWithdraw={o.from === v.me.id && o.status === 'pending' ? () => post({ action: 'withdraw', offerId: o.id }, 'Ponuda povučena.') : undefined} />)}
          {v.offers.length === 0 && <Empty title="Još nema ugovora" text="Predloži savez, razmjenu resursa ili nenapadanje." mood="happy" />}
        </>)}

        {tab === 'neg' && <Messages thread={thread} setThread={setThread} others={others} />}
      </div>
      <Sheet open={!!composer} onClose={() => setComposer(null)} title="Diplomatska ponuda" tall>
        {composer && <><h2 className="text-2xl text-secondary mb-3">Diplomatska misija</h2><OrderComposer type="diplomacy" initial={composer.order} onDone={() => setComposer(null)} /></>}
      </Sheet>
    </div>
  );
}

function OfferCard({ o, incoming, planning, onRespond, onWithdraw }: { o: DiplomaticOffer; incoming?: boolean; planning: boolean; onRespond?: (a: boolean) => void; onWithdraw?: () => void }) {
  const g = useGame();
  const v = g.view!;
  const from = v.players[o.from], to = v.players[o.to];
  const give = Object.entries(o.terms.give ?? {}).filter(([, n]) => n).map(([k, n]) => `${n} ${RES_SHORT[k]}`).join(', ');
  const recv = Object.entries(o.terms.receive ?? {}).filter(([, n]) => n).map(([k, n]) => `${n} ${RES_SHORT[k]}`).join(', ');
  return (
    <div className={`card-flat space-y-2 ${incoming ? 'border-accent-600' : ''}`} data-testid="offer-card">
      <div className="flex items-center gap-2"><FactionBadge faction={from.faction} size={30} /><Icon name="chevron" size={16} /><FactionBadge faction={to.faction} size={30} /><div className="flex-1 font-extrabold">{o.from === v.me.id ? `Ti → ${to.name}` : `${from.name} → ti`}</div><span className={`chip ${ST[o.status].c}`}>{ST[o.status].t}</span>{o.secret && <span className="chip chip-yellow">tajno</span>}</div>
      <div className="text-sm font-bold">{kindLabel(o.kind).replace(/^./, (c) => c.toUpperCase())}
        {o.kind === 'trade' && <span className="block text-muted">{o.from === v.me.id ? 'Daješ' : 'Dobivaš'}: {give || '—'} · {o.from === v.me.id ? 'Primaš' : 'Daješ'}: {recv || '—'}</span>}
        {o.kind === 'swap' && <span className="block text-muted">{v.territories[o.terms.swapMine!]?.name} ↔ {v.territories[o.terms.swapTheirs!]?.name}</span>}
        {o.kind === 'joint_attack' && <span className="block text-muted">Cilj: {v.territories[o.terms.attackTarget!]?.name}</span>}
        {(o.kind === 'alliance' || o.kind === 'nap') && <span className="block text-muted">Trajanje: {o.terms.durationRounds ?? (o.kind === 'alliance' ? v.config.diplomacy.allianceDefaultDuration : v.config.diplomacy.napDefaultDuration)} dana</span>}
        {o.resultText && <span className="block text-muted">{o.resultText}</span>}
        <span className="block text-xs text-muted">Poslano dan {o.createdRound} · vrijedi do dana {o.expiresRound}</span></div>
      {incoming && onRespond && <div className="grid grid-cols-2 gap-2"><button className="btn btn-green btn-sm" disabled={!planning} onClick={() => onRespond(true)} data-testid="accept-offer">Prihvati</button><button className="btn btn-ghost btn-sm" disabled={!planning} onClick={() => onRespond(false)} data-testid="reject-offer">Odbij</button></div>}
      {onWithdraw && <button className="btn btn-ghost btn-sm" onClick={onWithdraw}>Povuci ponudu</button>}
    </div>
  );
}

function Messages({ thread, setThread, others }: { thread: string | null; setThread: (s: string | null) => void; others: Array<{ id: string; name: string; faction: any }> }) {
  const g = useGame();
  const v = g.view!;
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const active = thread ?? others[0]?.id ?? null;
  const msgs = useMemo(() => v.messages.filter((m) => (m.from === active || m.to === active)).sort((a, b) => a.createdAt.localeCompare(b.createdAt)), [v.messages, active]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [msgs.length, active]);
  const send = async () => { if (!active || !text.trim()) return; setBusy(true); try { await g.act(`/api/campaigns/${g.id}/diplomacy`, { action: 'message', to: active, body: text }, { quiet: true }); setText(''); } catch (e) { g.toast(e instanceof Error ? e.message : 'Greška', 'bad'); } finally { setBusy(false); } };
  return (
    <div className="space-y-3" data-testid="messages">
      <div className="scroll-x">{others.map((p) => <button key={p.id} onClick={() => setThread(p.id)} className={`shrink-0 inline-flex items-center gap-1.5 rounded-2xl border-2 px-2.5 py-1.5 font-extrabold text-sm ${active === p.id ? 'border-primary bg-primary-100' : 'border-line bg-white'}`}><FactionBadge faction={p.faction} size={22} />{p.name}{v.messages.some((m) => m.from === p.id && m.round === v.round) && <span className="h-2 w-2 rounded-full bg-bad" />}</button>)}</div>
      <div className="card-flat min-h-64 max-h-[50vh] overflow-y-auto space-y-2 !bg-primary-100/30">
        <p className="text-[11px] text-center text-muted font-bold"><Icon name="lock" size={12} className="inline mr-1" />Privatno: poruke vidite samo vi i {active ? v.players[active]?.name : 'primatelj'}.</p>
        {msgs.length === 0 && <p className="text-center text-muted font-bold py-8">Još nema poruka. Pošalji prvu!</p>}
        {msgs.map((m) => <div key={m.id} className={`flex ${m.from === v.me.id ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm font-semibold ${m.from === v.me.id ? 'bg-primary text-white rounded-br-md' : 'bg-white border-2 border-line rounded-bl-md'}`}>{m.body}<div className={`text-[10px] mt-0.5 ${m.from === v.me.id ? 'text-white/70' : 'text-muted'}`}>dan {m.round} · {timeAgo(m.createdAt)}</div></div></div>)}
        <div ref={endRef} />
      </div>
      <div className="flex gap-2"><input className="input" value={text} maxLength={1000} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="Napiši poruku…" data-testid="message-input" /><button className="btn btn-purple" disabled={busy || !text.trim()} onClick={send} data-testid="message-send" aria-label="Pošalji"><Icon name="send" size={20} /></button></div>
    </div>
  );
}
