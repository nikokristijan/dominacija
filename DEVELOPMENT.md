# DOMINACIJA: Rise of Empires — razvojna dokumentacija

Asinkrona višeigračka strategija (4–8 igrača, 7 dana, istovremeno razrješenje naredbi). Mobile‑first PWA, sav sadržaj na hrvatskom.

> **Pravilo ovog dokumenta:** funkcija je označena „završeno” samo ako je implementirana **i** testirana. Sve ostalo je izričito navedeno kao ograničenje.

## Pokretanje

```bash
npm install
npm run dev            # http://localhost:3000 — lokalni razvojni način (JSON datoteka .data/dominacija.json)
npm test               # 82 testa: engine + RLS (PostgreSQL u WASM-u)
npm run simulate -- 6 demo      # simulacija cijele 7-dnevne kampanje s botovima (~100 ms)
npm run simulate -- batch       # 20 kampanja, statistika za balans
npm run assets         # izvoz SVG asseta u public/assets/*
```

E2E u pravom pregledniku (Playwright), na čistoj bazi:

```bash
scripts/restart.sh                       # build + start na :3100 s praznom bazom
node tests/e2e/smoke.mjs http://localhost:3100 /tmp/screens
```

**Razvojna simulacija:** na „Nova kampanja” odaberi *Simulacija (botovi)*. Botovi su jasno označeni, rade samo u kampanjama s `devSimulation`, a runde su ubrzane (zadano 90 s; do 600 s). Na dashboardu su gumbi *Razriješi sada* i *Odigraj sve dane* (cijela kampanja za nekoliko sekundi). Prva registrirana osoba u `DEV_MODE=true` postaje administrator; inače koristi `ADMIN_USERS`.

## Arhitektura

```
src/engine/    ČISTI TypeScript, bez UI-ja i baze — može ga koristiti i native klijent
  config.ts      JEDINA konfiguracija balansa (troškovi ZB, jedinice, teren, zgrade, porezi, borba, bodovi…)
  types.ts       tipovi stanja, naredbi, izvješća
  mapgen.ts      heks karta 11×10 = 110 teritorija, regije, pošteni početni klasteri
  economy.ts     proizvodnja, porezi, održavanje, stabilnost, prognoza (isti kod za UI i razrješenje)
  combat.ts      deterministički bojni račun u fazama (Lanchester), protuteže jedinica, objašnjenje čimbenika
  orders.ts      troškovi, validacija, rezervacija resursa, životni ciklus, uvjetne naredbe, pregled posljedica
  resolve.ts     razrješenje runde (idempotentno): redoslijed faza opisan na vrhu datoteke
  diplomacy.ts   ponude, savezi, sporazumi, poruke, ugled     espionage.ts / intel.ts  procjene i magla rata
  tech.ts        20 tehnologija u 5 kategorija               events.ts      svjetski događaji
  objectives.ts  tajni ciljevi                                scoring.ts     bodovanje i ljestvica
  view.ts        getPlayerView(): JEDINI put kojim stanje napušta server (filtrirano)
  ai.ts          botovi (samo dev)                            state.ts       stvaranje kampanje
src/server/    perzistencija, autentikacija, servis kampanja, zod sheme, raspored
src/app/api/   REST rute (sve ulaze validira zod + engine)
src/components art/ (SVG), game/ (karta, composer…), screens/ (ekrani), ui/ (kit)
supabase/migrations/   0001_schema.sql, 0002_rls.sql
tests/         engine.test.ts, rls.test.ts, e2e/smoke.mjs
```

### Sigurnosni model
- Klijent **nikad** ne računa borbe, resurse, razrješenje ni bodove. Sve ide kroz `src/server/service.ts` unutar transakcije; engine validira svaku naredbu.
- `getPlayerView` je jedina izlazna točka: tuđe naredbe, tajni ciljevi, točne udaljene postrojbe i tuđi resursi nikad ne napuštaju server (testirano).
- Dvostruko trošenje: resursi i ZB **rezerviraju se pri predaji**, a pri razrješenju se troše redom uz ponovnu provjeru.
- Idempotencija: `resolveRound` na već razriješenoj rundi vraća isto stanje; u SQL-u je `resolutions(campaign_id, round)` primarni ključ.
- Razrješenje je deterministično (nema slučajnosti; „šum” procjena je hash-based). Isti ulaz ⇒ isti izlaz (testirano kroz 3 runde s botovima).
- Servisni ključ postoji samo na serveru (`SUPABASE_SERVICE_ROLE_KEY`, bez `NEXT_PUBLIC_`).
- Admin sučelje: server-side provjera `isAdmin` (stranica + svaka API ruta).

### Redoslijed razrješenja runde
zaključavanje (nacrti se odbacuju; neaktivni → automatska obrana) → protuobavještajne mjere/dezinformacije → sabotaža → diplomacija (ponude, pripajanje, razmjene) → trgovina → istraživanje/gradnja/novačenje (stižu početkom iduće runde) → obrana → vojne operacije (istovremeni odlazak, uvjetne naredbe „prije” i „poslije”, koalicije, izdaja) → ekonomija (izolacija, porezi, glad, pobune) → dolasci → obavještajna izvješća (stanje na početku nove runde) → postignuća → bodovi → izvješća → nova runda.

## Stanje faza

| Faza | Status |
|---|---|
| 1 Vizualna osnova | **Završeno**: dizajn sustav, maskota (8 raspoloženja), 120 SVG asseta, navigacija, dashboard, responzivni raspored |
| 2 Svjetska karta | **Završeno**: SVG heks karta, zoom/pan/pinch, vlasništvo, granice, ceste, zgrade, vojske, magla rata, odabir, bottom sheet |
| 3 Osnovna igra | **Završeno**: kampanje, pozivni kodovi, lobby, ZB, naredbe, nacrti, dnevne runde, raspored po vremenskoj zoni |
| 4 Vojska | **Završeno**: 5 strategija, formacije, logistika, opskrba, povlačenje, rezerva, bojna izvješća |
| 5 Ekonomija | **Završeno**: proizvodnja, zgrade (3 razine), populacija, porezi, stabilnost, pobune s upozorenjem |
| 6 Napredna strategija | **Završeno**: diplomacija, špijunaža/sabotaža, tehnologije, uvjetne naredbe, tajni ciljevi, događaji, Otpor |
| 7 Pouzdanost | **Djelomično**: server-autoritativno razrješenje, idempotencija, RLS (testiran u PostgreSQL-u), zod validacija. **Nedostaje** Supabase adapter (vidi dolje) |
| 8 Završna obrada | **Djelomično**: animacije, PWA manifest + service worker, push priprema. Nije testirano: stvarni push, Lighthouse, native build |

## Poznata ograničenja (iskreno)

1. **Supabase adapter nije napisan.** Aplikacija danas radi nad `FileStore` (JSON datoteka; jedan proces). Sučelje `Store` (`src/server/store.ts`) je isto, SQL shema i RLS su gotovi i provjereni, ali kod koji engine stanje mapira u te tablice (i Supabase Auth umjesto lokalne prijave) **nije implementiran ni testiran na živom Supabase projektu**. Do tada Vercel produkcija nije moguća jer serverless nema trajni disk. Sljedeći korak: `SupabaseStore` + `@supabase/ssr` auth + Realtime pretplata (zamjena za polling svakih 12 s).
2. **Push obavijesti**: SW handler, pretplata i server-pošiljatelj postoje, ali nisu isprobani s VAPID ključevima/`web-push`.
3. **Faktorski bonusi nema** (frakcije su kozmetika, po specifikaciji). Monetizacija nije implementirana (po specifikaciji, tek nakon jezgre).
4. **Vojska u savezničkim teritorijima** modelirana je kao darivanje postrojbi (potpora prelazi pod kontrolu saveznika), ne kao zasebne stacionirane jedinice.
5. **Multi-napad na isti cilj**: napadači istog igrača ili saveznika borbe se kao koalicija; nepovezane koalicije biju bitku redom po snazi (pobjednik postaje branitelj sljedećoj). Redoslijed adjudikacije po ID‑u teritorija (dokumentirano, ima rubnih slučajeva).
6. **Balans**: botovi su slabi (malo istražuju/grade), pa statistika simulacija služi za provjeru ispravnosti, ne za konačno ugađanje. Potrebni su testovi igranja s ljudima.
7. **Pristupačnost**: ciljevi dodira ≥44 px, `prefers-reduced-motion` poštovan, ARIA oznake osnovne; nije rađen potpuni WCAG audit niti čitač zaslona.
8. Karta nema crtane rijeke/mostove (samo jezera, ceste i zastave); „mostovi” su plan.
9. `fileStore.ts` izaziva Turbopack upozorenje o praćenju datoteka (samo dev store).
10. Servisna radnja `devAction('resolve_all')` zaobilazi rokove — dostupna samo za `devSimulation` kampanje.

## Testovi (što je stvarno provjereno)

- `tests/engine.test.ts` (70): generiranje karte i poštene pozicije, ZB limit, rezervacija resursa, nacrti, validacija, konfigurabilnost troškova, prognoza = stvarno razrješenje, porezi/stabilnost, gradnja/novačenje, glad, pobuna (tek nakon upozorenja), borba (determinizam, teren, tvrđava, protuteže, opsada, zasjeda, opskrba, povlačenje, koalicija, objašnjenja), istovremenost i neovisnost o redoslijedu unosa, sukob pripajanja, uvjetne naredbe (4), diplomacija (savez, izdaja, oporavak ugleda, trgovina, poruke), špijunaža i fog (view ne otkriva tuđe), tehnologija, Otpor (pad glavnog grada, jeftino novačenje, ustanak, povratak), bodovanje, cijela kampanja od 7 dana, neaktivni igrači, događaji, opskrba, pregled naredbe.
- `tests/rls.test.ts` (12): izolacija naredbi, tajnih ciljeva, resursa, garnizona, poruka; javni pogled teritorija; skriven rastav bodova do kraja; klijent ne može pisati; CHECK ograničenja; idempotentan ključ razrješenja.
- `tests/e2e/smoke.mjs` (19 koraka u Chromiumu, mobilni viewport + desktop): registracija, stvaranje simulacije, karta, odabir teritorija, novačenje, nacrt→predaja→uređivanje→uklanjanje, uvjetna naredba, planer napada (6 koraka), diplomacija i poruke, tehnologija, porezi, profil, ljestvica, zaključavanje + razrješenje, izvještaj, obavijesti, cijela kampanja + ekran rezultata, admin, desktop raspored. Bez konzolnih grešaka i bez HTTP 5xx.

## Konfiguracija okoline

Vidi `.env.example`. `vercel.json` definira cron koji svakih sat vremena zove `/api/cron/resolve` (zaštićen `CRON_SECRET`) — razrješuje sve kampanje kojima je rok istekao. (Lijeni „tick” također se događa pri svakom dohvatu kampanje.)

## Sljedeći koraci
1. `SupabaseStore` + Supabase Auth + Realtime; migracije na živom projektu; E2E protiv njega.
2. Testovi igranja s ljudima, ugađanje balansa (admin može preko JSON nadjačavanja).
3. Push (VAPID), Lighthouse/performanse na stvarnim srednjim uređajima, WCAG audit.
4. Javni matchmaking, rijeke/mostovi na karti, kozmetička monetizacija.
