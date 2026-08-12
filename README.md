# MERIDIAN — meridianagency.ro

Site-ul agenției MERIDIAN: două divizii (VIDEO și SOFTWARE) într-un singur app Next.js, cu gateway split-screen la rădăcină. **Citește `CLAUDE.md` înainte de orice** — e legea proiectului. Coordonarea între faze se face în `PLAN.md`.

## Stack

Next.js 15 (App Router, Turbopack) · TypeScript strict · Tailwind CSS v4 · next-intl (RO default fără prefix, EN cu `/en`) · Supabase · Resend · GSAP + Lenis (doar divizia video) · Vercel.

## Pornire

```bash
npm install
cp .env.example .env.local   # completează cheile
npm run dev
```

## Harta fișierelor

```
app/
  globals.css               ÎNGHEȚAT — tokens (--v-*, --s-*, semantici) + maparea Tailwind
  fonts.ts                  ÎNGHEȚAT — Clash Display, Switzer, Satoshi (locale) + mono-uri
  fonts/                    fișierele woff2 (Fontshare, licența FFL)
  [locale]/                 TOATE rutele publice trăiesc aici (i18n)
    layout.tsx              root layout public (html/body, provider next-intl)
    (gateway)/page.tsx      F1 — gateway split-screen (placeholder F0 momentan)
    (video)/layout.tsx      scope data-world="video" (F1 integrează shell-ul)
    (video)/video/...       F2 (home, servicii, portofoliu, proces) · F3 (reclame, contact)
    (software)/layout.tsx   scope data-world="software" (F1 integrează shell-ul)
    (software)/software/... F4 (home, servicii, fonduri, proiecte, proces) · F5 (brief)
    (legal)/                F7
  (admin)/
    layout.tsx              root layout admin (fără i18n, paleta software)
    admin/                  F6 — dashboard lead-uri
  api/
    leads/                  contract F0, implementare reală F6
components/
  ui/                       ÎNGHEȚAT — Button, Input, Textarea, Select, Label, Field,
                            Dialog, Toast, Container, Section, Reveal
  shell/                    F1 — header-e, footer, meniu mobil
  gateway/                  F1
  video/                    F2 (+ forms/, cta/ = F3)
  software/                 F4 (+ forms/, estimator/ = F5)
content/
  types.ts                  ÎNGHEȚAT — Service, Project, Testimonial, ProcessStep, FAQItem, TeamMember
  video/                    F2 umple scheletele
  software/                 F4 umple scheletele
i18n/                       routing, navigation, request config (ÎNGHEȚAT)
messages/                   ro.json, en.json — namespace-uri: common, nav, gateway,
                            video, software, forms, legal (F2–F6 adaugă chei, F7 finalizează)
lib/
  utils.ts                  ÎNGHEȚAT — cn()
  division.ts               ÎNGHEȚAT — tip Division, cookie meridian_division
  utm.ts                    ÎNGHEȚAT — captura UTM first-touch (sessionStorage)
  validations/lead.ts       ÎNGHEȚAT — contractul Zod al API-ului de lead-uri
  hooks/                    useReducedMotion, useDivision
  supabase/                 F6
  email/                    F6
supabase/migrations/        schema leads + lead_events + RLS
middleware.ts               rutare i18n (exclude /api, /admin)
```

## Proprietate pe faze

| Fază | Zona | Model |
|---|---|---|
| 0 | fundația (acest commit) — fișierele marcate ÎNGHEȚAT | Opus |
| 1 | `app/[locale]/(gateway)/`, layout-urile de grup `(video)`/`(software)`, `components/shell/`, `components/gateway/` | Opus |
| 2 | `app/[locale]/(video)/video/{,servicii,portofoliu,proces}/`, `content/video/`, `components/video/` | Opus |
| 3 | `app/[locale]/(video)/video/{reclame,contact}/`, `components/video/forms/`, `components/video/cta/` | Sonnet |
| 4 | `app/[locale]/(software)/software/{,servicii,fonduri,proiecte,proces}/`, `content/software/`, `components/software/` | Opus |
| 5 | `app/[locale]/(software)/software/brief/`, `components/software/forms/`, `components/software/estimator/` | Sonnet |
| 6 | `app/api/`, `app/(admin)/`, `lib/supabase/`, `lib/email/`, `emails/` | Sonnet |
| 7 | `messages/`, `app/[locale]/(legal)/`, sitemap, robots + edituri punctuale | Sonnet |

Fișierele **ÎNGHEȚATE** nu se editează după FAZA 0 — cererile de modificare se scriu în `PLAN.md`.

## Cum funcționează cele două lumi

Tokens-ii semantici (`--bg`, `--surface`, `--fg`, `--muted`, `--line`, `--accent`, `--accent-2`, `--font-display/body/mono`) sunt remapați de atributul `data-world="video|software"` pus pe layout-urile de grup. Primitivele din `components/ui/` folosesc doar clase semantice (`bg-accent`, `text-fg`, `font-display`...), deci se colorează automat după divizia în care sunt randate. Culorile brute (`text-v-tungsten`, `bg-s-panel`) se folosesc doar în interiorul propriei divizii.

## Placeholder-e care trebuie înlocuite înainte de lansare

Vezi lista completă în `PLAN.md` § „De verificat înainte de lansare". Pe scurt: logo real, portofoliu/proiecte/testimoniale reale (`isPlaceholder: true` peste tot momentan), texte legale validate juridic, detaliile programelor de finanțare verificate, chei Supabase/Resend/Cal.com, numere de telefon/WhatsApp.
