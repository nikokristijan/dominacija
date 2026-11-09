# Objava na Vercel (za tebe i prijatelje) — korak po korak

Igra na Vercelu treba **trajnu pohranu**, jer Vercel nema disk koji se pamti. Koristimo **Supabase** (besplatan plan je dovoljan).
Trebaju ti dva računa (oba besplatna): [supabase.com](https://supabase.com) i [vercel.com](https://vercel.com) (prijava preko GitHuba).

## 1. Supabase (pohrana) — ~5 min
1. Na supabase.com: **New project** → daj ime (npr. `dominacija`), izaberi regiju blizu (Frankfurt), zapiši lozinku baze (nećemo je trebati).
2. Kad se projekt stvori: lijevo **SQL Editor** → **New query** → zalijepi cijeli sadržaj datoteke `supabase/migrations/0003_state_blob.sql` → **Run**.
   (Ostale migracije, `0001` i `0002`, **nisu potrebne** za ovu verziju.)
3. **Project Settings → API**: kopiraj
   - **Project URL** (npr. `https://abcd1234.supabase.co`)
   - **service_role** ključ (*secret*, dugačak ključ). ⚠️ Nikome ga ne šalji i ne stavljaj u kod — ide samo u Vercel.

## 2. Vercel (hosting) — ~5 min
1. Na vercel.com: **Add New… → Project** → izaberi repozitorij `nikokristijan/dominacija` → **Import**.
2. Prije klika na *Deploy* otvori **Environment Variables** i dodaj:

| Ime | Vrijednost |
|---|---|
| `SUPABASE_URL` | Project URL iz Supabasea |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role ključ |
| `SESSION_SECRET` | bilo koji dugačak nasumičan niz (npr. 40 znakova) |
| `ADMIN_USERS` | tvoje korisničko ime u igri (po želji; daje ti admin panel) |

3. **Deploy**. Za ~2 min dobiješ adresu tipa `https://dominacija-xxxx.vercel.app`. To je to.

## 3. Igranje s prijateljem
1. Ti i prijatelj otvorite adresu i registrirajte se (korisničko ime + lozinka, bez e-maila).
2. Ti: **Nova kampanja** → ostavi „Brza” i „Popuni botovima” → **Stvori**. Vidiš **pozivni kod**.
3. Prijatelj: **Pridruži se** → upiše kod.
4. Ti: **Pokreni**. Botovi popune ostala mjesta. U brzoj partiji dan traje do 10 min ili dok oboje ne označite **Spremno** — 7 dana je oko sat vremena.

## 4. (Po želji) Push obavijesti na mobitelu
Bez ovoga obavijesti rade samo unutar igre. Za obavijesti na mobitelu ("Ana te napala"):
1. Na svom računalu, u mapi projekta: `npx web-push generate-vapid-keys` — ispiše **Public Key** i **Private Key**.
2. U Vercelu dodaj varijable: `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (Public Key), `VAPID_PRIVATE_KEY` (Private Key), po želji `VAPID_SUBJECT` (npr. `mailto:ti@email.com`). Zatim **Redeploy** (javni ključ ulazi u aplikaciju pri buildu).
3. U igri će se na početnoj stranici pojaviti prijedlog "Javimo ti kad te netko napadne" — dodirni **Uključi** i dopusti obavijesti.
4. **iPhone:** obavijesti rade tek kad igru dodaš na početni zaslon (Safari → Dijeli → *Dodaj na početni zaslon*) i otvoriš je odatle.
Ovo je napisano i provjereno jediničnim testom, ali **nije isprobano s pravim push poslužiteljem** — ako ne stigne obavijest, javi mi.

## Napomene (iskreno)
- **Razrješenje runde** događa se kad netko otvori igru nakon isteka roka ili kad oboje označite „Spremno”. Vercel cron (jednom dnevno) je samo zaštita; na besplatnom planu ne može češće.
- **Pohrana** je jedan JSON dokument u bazi s optimističnim zaključavanjem — sasvim dovoljno za prijatelje i testiranje, ali nije rješenje za tisuće igrača.
- Nakon svakog `git push` na `main` Vercel sam objavi novu verziju. Podaci iz baze ostaju.
- Ako vidiš grešku „Pohrana nije podešena”, provjeri varijable iz koraka 2 pa u Vercelu **Deployments → ⋯ → Redeploy**.
