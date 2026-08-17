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

## SEO, consimțământ și analytics (FAZA 7)

- **Canonical** se generează automat pentru orice rută: root layout-ul are `alternates: { canonical: "./" }`, pe care Next îl rezolvă la calea curentă. O pagină nouă primește canonical corect fără să facă nimic.
- **hreflang** (ro, en, x-default) se adaugă per pagină prin `pageSeo()` din `lib/seo.ts`. Paginile noi ar trebui să-l folosească — vezi exemplul din docstring.
- **Imagini Open Graph** generate dinamic la `/og.png?division=video|software&title=…&subtitle=…`, două șabloane, unul per divizie. Ruta se numește cu extensie pentru că middleware-ul i18n prinde orice cale fără punct.
- **JSON-LD**: Organization + WebSite pe toate rutele publice, Service pe paginile de servicii. Deliberat **fără** `LocalBusiness` și `AggregateRating` — nu emitem structured data pe care n-o putem susține.
- **Consimțământ**: `lib/consent.ts` + bannerul din `components/consent/`. Scripturile opționale nu se încarcă înainte de accept — `lib/analytics.ts` verifică înainte de a injecta ceva. Retragerea se face din `/legal/cookies`.
- **Vercel Analytics** se încarcă prin script propriu, nu prin pachetul `@vercel/analytics`, exact ca să poată fi condiționat de consimțământ. Zero dependențe adăugate.

## Deploy

1. Importă repo-ul în Vercel. Framework-ul e detectat automat (Next.js, Turbopack).
2. Setează variabilele de mediu de mai jos în **Project Settings → Environment Variables**, pentru Production și Preview.
3. Rulează migrarea din `supabase/migrations/` în proiectul Supabase, apoi creează contul de admin.
4. Conectează domeniul `meridianagency.ro` și verifică `NEXT_PUBLIC_SITE_URL` — din el se construiesc canonical, hreflang, sitemap și robots. Dacă e greșit, tot SEO-ul arată spre domeniul greșit.
5. Verifică după deploy: `/sitemap.xml`, `/robots.txt`, `/og.png?division=video&title=test`.

## Variabile de mediu

| Variabilă | Obligatorie | Ce se strică fără ea |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | da | canonical, hreflang, sitemap și robots arată spre domeniul implicit |
| `NEXT_PUBLIC_SUPABASE_URL` | da (F6) | nu se salvează niciun lead |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | da (F6) | idem |
| `SUPABASE_SERVICE_ROLE_KEY` | da (F6) | insert-ul de pe server |
| `RESEND_API_KEY` | da (F6) | nu pleacă emailuri de notificare |
| `LEAD_NOTIFICATION_EMAIL` | da (F6) | nu se știe cui se trimit lead-urile |
| `NEXT_PUBLIC_PHONE` | da | blocul „Sună direct" dispare de pe paginile video |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | da | butoanele de WhatsApp dispar (inclusiv cele contextuale) |
| `NEXT_PUBLIC_INSTAGRAM` | nu | canalul Instagram dispare din panou și din footer |
| `NEXT_PUBLIC_CAL_VIDEO` | nu | secțiunea de programare de pe `/video/contact` nu se randează |
| `NEXT_PUBLIC_CAL_SOFTWARE` | nu | discovery call-ul de pe `/software/brief` nu se randează |

Canalele neconfigurate se **ascund**, nu rămân ca link-uri moarte. În dev apare în locul lor un avertisment vizibil.

## Ce e placeholder și trebuie înlocuit

| Ce | Unde | Cum se vede că e placeholder |
|---|---|---|
| Texte legale | `app/[locale]/(legal)/legal/_content/documents.ts` | Notă vizibilă sus pe fiecare pagină: **nevalidat juridic** |
| Datele firmei (denumire, CUI, reg. com., sediu, email) | același fișier, `COMPANY_PLACEHOLDER` | `[DENUMIRE SRL]` etc. + badge PLACEHOLDER |
| Prețurile din estimator | `lib/estimator-config.ts` | comentariu de avertizare în capul fișierului |
| Ghidul PDF | `public/software/ghid-modernizare-placeholder.pdf` | badge PLACEHOLDER pe card + notă după descărcare |
| Portofoliu video (8 proiecte) și testimoniale | `content/video/` | `isPlaceholder: true` |
| Proiecte software și testimoniale | `content/software/` | `isPlaceholder: true` |
| Postere video | `public/video/posters/*.svg` | SVG-uri generate, nu cadre reale |
| Bază și program | `app/[locale]/(video)/video/contact/page.tsx`, `STUDIO` | badge PLACEHOLDER lângă bloc |
| Logo | peste tot (`components/shell/logo.tsx`) | marcaj geometric provizoriu |

Lista de lansare completă e în `PLAN.md` § „De verificat înainte de lansare".
