# Dominacija: Rise of Empires

Asinkrona višeigračka strategija (7 dana, 4–8 igrača). Next.js + React + TypeScript + Tailwind + Framer Motion.

## Pokretanje na svom računalu (localhost)

1. Instaliraj **Node.js (LTS)** s https://nodejs.org i **Git** s https://git-scm.com.
2. U Terminalu:

```bash
git clone https://github.com/nikokristijan/dominacija.git
cd dominacija
npm install
npm run dev
```

3. Otvori **http://localhost:3000** u pregledniku.
4. Za gašenje pritisni `Ctrl + C` u Terminalu.

### Kasnije, kad želiš novu verziju

```bash
cd dominacija
git pull origin main
npm install
npm run dev
```

### Ako izgleda staro, pokvareno ili nedostaju stilovi

```bash
npm run fresh
```

To briše privremene datoteke (`.next`) i pokreće sve ispočetka. Zatim u pregledniku pritisni `Ctrl + Shift + R`.

## Prvi koraci u igri

- **Nauči igrati (vodič)** na naslovnici — probna bitka kroz sve funkcije, bez računa.
- Prava igra: registracija → **Nova kampanja → Simulacija (botovi)** → na dashboardu „Razriješi sada” ili „Odigraj sve dane”.

Detalji, arhitektura, status i poznata ograničenja: **[DEVELOPMENT.md](DEVELOPMENT.md)**.

```bash
npm test      # engine + RLS testovi
```

## Objava na Vercel (da igraš s prijateljem)
Korak-po-korak upute na hrvatskom: **[docs/VERCEL.md](docs/VERCEL.md)** (Supabase za pohranu + Vercel za hosting, oko 10 minuta).
