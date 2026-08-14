# PLAN.md — MERIDIAN

Fișier de coordonare între terminale. Fiecare fază scrie aici la final de sesiune. Citește-l înainte să începi — s-ar putea să fi apărut ceva care te privește.

**Regulă:** adaugă, nu șterge. Nu rescrie ce a notat altă fază.

---

## Stare faze

| Fază | Branch | Status | Merge în main |
|---|---|---|---|
| 0 — Fundație | `faza-0-fundatie` | ✅ gata | ✅ |
| 1 — Gateway + shell | `faza-1-gateway` | ✅ gata | ✅ |
| 2 — Video core | `faza-2-video-core` | ✅ gata | ✅ |
| 3 — Video reclame + funnel | `faza-3-video-funnel` | ⬜ poate porni (F0 în main) | ⬜ |
| 4 — Software core | `faza-4-software-core` | ✅ gata | ⬜ |
| 5 — Software brief | `faza-5-software-brief` | ⬜ poate porni (F0 în main) | ⬜ |
| 6 — Backend + admin | `faza-6-backend` | ⬜ poate porni (F0 în main) | ⬜ |
| 7 — i18n, SEO, legal | `faza-7-final` | ⬜ blocat de F1–6 | ⬜ |

Legendă: ⬜ neînceput · 🟡 în lucru · ✅ gata · 🔴 blocat

---

## Contracte înghețate după FAZA 0

*(FAZA 0 completează această secțiune. După aceea, nimeni nu o modifică fără acordul omului.)*

**Tokens și fișiere partajate — INTERZIS la editare:**
- `app/globals.css` (Tailwind v4 — tokens + maparea `@theme` stau AICI; nu există `tailwind.config.*`)
- `app/fonts.ts` + `app/fonts/`
- `components/ui/*` (Button, Input, Textarea, Select, Label, Field, Dialog, Toast, Container, Section, Reveal)
- `content/types.ts`
- `lib/utils.ts` · `lib/division.ts` · `lib/utm.ts` · `lib/validations/lead.ts`
- `i18n/*` · `middleware.ts` · `next.config.ts`
- `app/[locale]/layout.tsx` (root layout public) · `app/(admin)/layout.tsx` (F6 poate extinde, nu rescrie)
- `supabase/migrations/*`

**Cum se consumă tokens-ii:** layout-urile de grup pun `data-world="video|software"`; componentele folosesc DOAR clase semantice — `bg-bg`, `bg-surface`, `text-fg`, `text-muted`, `border-line`, `bg-accent`, `text-accent-contrast`, `text-accent-2`, `font-display`, `font-body`, `font-mono`, `rounded-xs..xl`, `shadow-soft/raised/overlay`. Culori brute (`text-v-tungsten`, `bg-s-panel`...) doar în interiorul propriei divizii. Z-index: `var(--z-header|overlay|modal|toast|signature)`.

**Rutare i18n (decizie F0):** toate rutele publice sub `app/[locale]/` — RO default FĂRĂ prefix (`/video`), EN cu prefix (`/en/video`); `localePrefix: "as-needed"`. În pagini se folosește `Link`/`useRouter` din `@/i18n/navigation`, NU din `next/link`/`next/navigation`. Admin (`app/(admin)/`) și API sunt în afara i18n-ului. Zonele de proprietate din CLAUDE.md se citesc cu prefixul `[locale]`: `app/(video)/...` → `app/[locale]/(video)/...`.

**Contract API** (scheme complete în `lib/validations/lead.ts` — F3/F5 validează cu ele pe client, F6 pe server):
```
POST   /api/leads                    body LeadInput
       201 → { ok: true, id: string }
       400 → { ok: false, error: string }
       429 → { ok: false, error: string }            (rate limit, F6)
       honeypot (`website` non-gol) → 200 { ok: true, id: "" }, fără insert
POST   /api/leads/[id]/events        body LeadEventInput { type, payload }
       201 → { ok: true, id: string }
GET    /api/leads?division=&status=&q=&from=&to=&page=&perPage=   (protejat, F6)
       200 → { ok: true, items: Lead[], total, page, perPage }
PATCH  /api/leads/[id]               body LeadPatch { status?, notes? }
       200 → { ok: true, id: string }
```

**Alte contracte:**
- Cookie divizie: `meridian_division` (`video|software`, 90 zile) — `lib/division.ts` (server) + `useDivision()` (client)
- UTM first-touch: `captureUTM()` la mount, `getStoredUTM()` în payload — `lib/utm.ts`
- Reduced motion: `useReducedMotion()` din `lib/hooks/use-reduced-motion` + `<Reveal>` din `components/ui/reveal`
- Statusuri lead: `new → contacted → qualified → proposal → won|lost`

**Tipuri de conținut disponibile:**
`Service` · `Project` · `Testimonial` · `ProcessStep` · `FAQItem` · `TeamMember` — toate cu `isPlaceholder` obligatoriu; schelete goale în `content/video/` și `content/software/` (services, projects, testimonials, process, faq)

**Chei i18n — namespace-uri:**
`common` · `nav` · `gateway` · `video` · `software` · `forms` · `legal` — schelet în `messages/ro.json` + `en.json`; fazele adaugă chei în namespace-ul propriu, F7 finalizează

---

## Jurnal per fază

### FAZA 0 — Fundație
**Terminat:** Next.js 15.5 (Turbopack) + TS strict + Tailwind v4; tokens compleți (`--v-*`, `--s-*`, semantici remapați prin `data-world`) în `app/globals.css`; fonturi locale variable (Clash Display, Switzer, Satoshi — Fontshare/FFL) + JetBrains Mono, IBM Plex Mono (Google) în `app/fonts.ts`; primitivele `components/ui/` (11 componente, inclusiv `Reveal`); `content/types.ts` + 10 schelete de conținut; migrarea Supabase (`leads`, `lead_events`, enums, RLS, indexuri); stub-uri API cu validare Zod pe toate cele 4 rute; i18n next-intl (middleware, routing, mesaje RO/EN pe namespace-uri); utilitare (`cn`, `useReducedMotion`, `useDivision`, UTM); README cu harta fișierelor; `.env.example`. Build verde: TS + ESLint + 7 rute.
**Decizii luate care afectează pe alții:**
- Rutele publice stau sub `app/[locale]/` — zonele din CLAUDE.md se citesc cu acest prefix. RO fără prefix de URL, EN cu `/en`. Navigarea DOAR prin `@/i18n/navigation`.
- Tailwind v4 nu are `tailwind.config.*` — tot ce era „config" e în `@theme` din `globals.css`. Nu creați config nou.
- Layout-urile de grup `app/[locale]/(video)/layout.tsx` și `(software)/layout.tsx` există și pun `data-world` — F1 le DEȚINE pentru integrarea shell-ului (header/footer/HUD/linia meridian), restul fazelor nu le ating.
- Honeypot-ul din formulare se numește `website` și e obligatoriu în toate formularele (F3, F5).
- `Field` folosește render prop pentru id-uri/aria corecte — vezi exemplul din `components/ui/field.tsx`.
- Erorile de formular au deja mesaje standard în `messages/*.json` sub `forms.errors.*` — folosiți-le, nu inventați altele pentru aceleași cazuri.
**Observații:**
- `npm audit` raportează 3 vulnerabilități high (tranzitive, din tooling-ul scaffold-ului). De revizuit în F7, nu blochează dezvoltarea.
- Logo-ul real nu există încă în repo — paletele sunt cele din brief; ajustarea după logo e pe lista de lansare.
- GSAP + Lenis sunt instalate (lockfile stabil), dar NEIMPORTATE — se încarcă lazy doar în divizia video (F2/F3).

---

### FAZA 1 — Gateway + shell
**Terminat:** Gateway split-screen rescris (signature „un arc, două dialecte" — același path SVG traversează cusătura: arc de lumină în video, geodezică cu gradații în software; expansiune 60/40 la hover doar motion-safe; mobil stivuit; reduced motion complet static; fără GSAP — CSS + rAF minimal). Redirect după cookie implementat ÎN pagină (server, păstrează locale-ul), verificat la runtime: fără cookie 200, cu cookie 307, `?stay=1` sare redirectul. Shell complet: `video-header` (fix, transparent, se condensează), `camera-hud` (timecode legat de scroll — 6px = 1 frame @24fps, accent tungsten→daylight, static sub reduced motion), `software-header` (sticky, CTA „Cere ofertă" → /software/brief, indicator de rută), footer unic adaptiv cu ANPC SAL + SOL, meniu mobil pe `<dialog>` nativ, switch limbă/divizie. Layout-urile de grup au acum skip link + `<main id="continut">` + shell integrat.
**Decizii care afectează pe alții:**
- **F2–F5: NU puneți `<main>` în pagini** — există în layout-urile de grup (`id="continut"`); paginile încep direct cu secțiuni.
- Header video e FIX și transparent — hero-urile video se proiectează sub el, fără padding compensatoriu. HUD-ul e montat o dată în layout — nu-l reconstruiți.
- Header software e STICKY în flux (h-16) — conținutul F4/F5 începe natural sub el. Linia meridian cu gradații rămâne signature-ul paginilor F4, nu al shell-ului.
- „Vezi ambele divizii" = link `/?stay=1`; gateway-ul sare redirectul la orice `?stay` și șterge cookie-ul.
- Rutele de navigare au sursă unică în `components/shell/nav-links.ts` (+ `LEGAL_LINKS` pentru F7). Timecode util partajat: `components/shell/timecode.ts`.
**Componente construite local (candidate la deduplicare în F7):** `nav-links.ts` (refolosibil la sitemap), `MeridianMark`/`Logo` (de înlocuit cu logo real), geometria arcului în `components/gateway/meridian-arc.tsx` (`ARC_PATH`), burger/close SVG duplicat în mobile-menu.
**Observații:**
- `NextIntlClientProvider` fără `messages` explicit serializează toate namespace-urile în fiecare pagină — de restrâns per-rută în F7 pentru LCP.
- Worktree-uri: junction de node_modules nu merge cu Turbopack (`turbopack.root`); soluția e copie reală a node_modules în worktree, fără npm install.

---

### FAZA 2 — Video core
**Terminat:** Toate cele 4 pagini, cu signature per pagină: `/video` — „Balansul de alb" (slider Kelvin 3200K–5600K accesibil + pointer-tracking pe split tungsten/daylight; headline pe cuvinte; obturator o dată/sesiune, cheie `mv-shutter-seen`); `/video/servicii` — „fișa de producție" (4 servicii cu tabel LIVRABILE în mono, FAQ pe `details/summary`); `/video/portofoliu` — reel orizontal pinned scroll-driven (GSAP scrub ≥1024px; mobil/reduced-motion/fără JS: listă verticală SSR completă), filtrare pe segment cu deep-link `?segment=`, case study pe `Dialog`; `/video/proces` — rail de peliculă cu marcaje `TC` și linie de progres tungsten→daylight. Content complet: servicii/proces/FAQ copy de brand, 8 proiecte + 3 testimoniale integral placeholder. GSAP+Lenis exclusiv lazy (nu apar în JS-ul inițial). Reduced motion: pagini complet funcționale fără Lenis/GSAP/cursor/obturator.
**Decizii care afectează pe alții (F3 mai ales):**
- F3 refolosește din `components/video/`: `lenis-provider.tsx` (`<VideoLenis />` per pagină), `motion/motion.ts` (`loadMotion()` — loader singleton GSAP+ScrollTrigger), `focus-cursor.tsx` (ținte cu `data-focus-cursor` + `data-focus-label`), `cta-band.tsx`, `section-slate.tsx`, `word-reveal.tsx` + `motion-styles.tsx` (o dată per pagină).
- Postere placeholder: `public/video/posters/<project-id>.svg` (1600×900). Înlocuire portofoliu real = mp4 în `public/video/projects/<id>.mp4` + poster + edit `content/video/projects.ts`, un singur commit. Showreel: `public/video/showreel.mp4`.
- Cursorul reticul pune `body{cursor:none}` pe paginile video dar păstrează cursorul pe `input/textarea/select` — formularele F3 sunt sigure.
- Paginile video au `pt-28 sm:pt-36` la primul heading (header-ul F1 e overlay).
- `segments.ts` (etichete/coduri segmente) — util pentru mesajele WhatsApp contextuale din F3.
**Componente construite local (candidate la deduplicare în F7):** `SectionSlate`, `CtaBand`, `WordReveal`, badge-ul „PLACEHOLDER" (repetat în 3 locuri), `segments.ts`.
**Observații:** `content/types.ts` — `Project.media.poster` e opțional în tip deși e obligatoriu la video prin quality floor; de rafinat tipul în F7.

---

### FAZA 3 — Video reclame + funnel
**Terminat:**
**Componente construite local:**
**Observații:**

---

### FAZA 4 — Software core
**Terminat:** Toate cele 5 pagini, cu signature per pagină, în dialectul „instrument de precizie": `/software` — planșa de desen tehnic cu **CARTUȘ** (blocul de identificare al unui desen de execuție, umplut cu parametrii comerciali reali: interval de buget, termen, preț fix, cod sursă, garanție); `/software/servicii` — **indexul** de 8 intrări (cod, serviciu, public, durată) și fișe pe trei axe (pentru cine / ce primești / tehnologii), fără prețuri; `/software/fonduri` — **calendarul de decontare citit invers**, de la termenul clientului spre ziua în care trebuie semnat, pe două benzi (noi / el), plus test de încadrare care poate răspunde și „încă nu"; `/software/proiecte` — **sloturile de metrică în așteptare** (instrument necalibrat în loc de cifre inventate), filtrare `?tip=` pe server, fără JS; `/software/proces` — **graficul de responsabilitate**, o linie care țese între banda noastră și a clientului, cu nod la fiecare predare. Signature de divizie pe toate: linia meridian cu gradații, măsurată din DOM (poziția reală a secțiunilor, nu distribuție decorativă), navigație funcțională prin ancore reale. Content complet: 8 servicii + 6 etape de proces + 8 FAQ = copy de brand real; 6 studii de caz + 3 testimoniale integral placeholder, marcate vizibil. Zero GSAP, zero Lenis, zero cursor custom, zero iconițe: doar CSS + IntersectionObserver, toate animațiile ≤380ms. Build verde: TS + ESLint + 25 rute; JS specific pe pagină 2,0–5,9 kB.
**Decizii care afectează pe alții:**
- **F5:** `/software/brief` primește trafic din 5 locuri cu context diferit. De pe `/software/fonduri` vin oameni cu finanțare — merită un câmp „linie de finanțare + termen de decontare" în brief; pagina le-a promis explicit că îl pot menționa acolo.
- **F5/F7:** CTA-urile software NU folosesc `buttonClasses({variant:"primary"})` — vezi cererea de mai jos despre `--accent-contrast`. Folosiți `softwareCtaClasses()` din `components/software/cta.tsx` până se repară tokenul, altfel butonul pică AA.
- **F5:** `EligibilityCheck` din `/software/fonduri` NU e formular și nu trimite nimic — dacă F5 vrea să preia răspunsurile în brief, trebuie un contract nou (query params sau sessionStorage). Nu l-am inventat eu.
- Filtrarea pe `/software/proiecte` se face pe server prin `?tip=`, ca la `?segment=` din F2, dar fără client JS. Valoare invalidă → toate proiectele, fără eroare.
- Machetele de studiu de caz: `public/software/cases/<project-id>.svg` (1600×900). Înlocuire cu proiect real = capturi în același folder + edit `content/software/projects.ts`, un singur commit. Cifra reală înlocuiește `PENDING_METRIC`, iar slotul își schimbă singur randarea.
- `content/software/projects.ts` exportă `SoftwareProject extends Project` cu `kind` și `industry`, pentru că `content/types.ts` e înghețat și `segment` e doar pentru video. Dacă F7 rafinează tipul, aici e locul.
**Componente construite local (candidate la deduplicare în F7):** `SectionHead` + `PlaceholderTag` (echivalentele software ale `SectionSlate` / badge-ului din F2), `CtaPanel` + `softwareCtaClasses` (echivalentul `CtaBand`), `MeridianRail`, `DrawIn` + `drawDelay` + `SoftwareMotionStyles` (perechea lui `motion-styles.tsx` din video), `CountUp`, `MetricSlot`, `BlueprintPlate` + `TitleBlock`, `FundingTimeline`, `EligibilityCheck`, `ResponsibilityChart`. Geodezica e definită local în `hero-plate.tsx` — nu am importat `ARC_PATH` din zona F1, ca să nu cuplez fazele; F7 poate unifica.
**Observații:**
- `drawDelay()` a trebuit scos într-un fișier fără `"use client"` (`components/software/draw.ts`): o funcție exportată dintr-un modul client devine referință client și nu poate fi apelată la randare pe server. Diagramele SVG sunt componente de server. Capcană utilă pentru F5.
- Diagramele SVG (calendar, grafic de responsabilitate) sunt `aria-hidden` și `hidden md:block`; informația completă stă mereu în lista semantică de sub ele. Nimic nu există doar în desen — și la 360px pagina nu pierde conținut.
- Tot ce atinge zona legislativă pe `/software/fonduri` e scris generic, fără nume de program, sume, procente sau sesiuni, și e marcat `needsLegalReview: true` în `content/software/funding.ts`. Pagina spune explicit că nu scriem dosarul și nu garantăm aprobarea. **Nu publicați fără citire juridică.**

---

### FAZA 5 — Software brief
**Terminat:**
**Componente construite local:**
**Observații:**

---

### FAZA 6 — Backend + admin
**Terminat:**
**Componente construite local:**
**Observații:**

---

### FAZA 7 — Final
**Terminat:**
**Observații:**

---

## Cereri către fișiere partajate

*(Ai nevoie de o modificare într-un fișier înghețat sau din zona altei faze? Scrie aici, nu edita.)*

| Cine cere | Ce fișier | Ce modificare | De ce | Rezolvat |
|---|---|---|---|---|
| F2 | `app/globals.css` (tokens) | Re-verificat `--v-dim` #6B6F78 pe `--v-void`: contrast 3.9:1, sub AA pentru text mic | F2 a ocolit local cu `text-fg/60`; F1/F3/F7 să nu folosească `text-muted` pentru text informativ mic pe video | ⬜ (decizie om / F7) |
| F2 | `components/ui/dialog.tsx` | Dialog-ul nu blochează scroll-ul de fundal | F2 a rezolvat local în `CaseStudyDialog`; F5/F6 vor lovi la fel | ⬜ (F7 sau acord om) |
| F2 | `content/types.ts` | `Project.media.poster` să fie obligatoriu când `kind: "video"` (union discriminat) | Quality floor cere poster obligatoriu | ⬜ (F7) |
| F4 | `app/globals.css` (tokens) | `--accent-contrast` pe `[data-world="software"]`: alb pe `--s-signal` #4C7DFF dă **3,69:1**, sub AA pentru text normal. Cu `--s-ink` (#060A12) urcă la **5,36:1** | Orice buton primar din divizia software pică AA — inclusiv „Cere ofertă" din header-ul F1. F4 a ocolit local cu `softwareCtaClasses()`; când tokenul se repară, clasele rămân valide și headerul se aliniază singur | ⬜ (F7 sau acord om) |
| F4 | `components/shell/nav-links.ts` (F1) | Nicio modificare cerută — doar semnalez că rutele software linkuite de F4 (`/software/{servicii,fonduri,proiecte,proces,brief}`) se potrivesc exact cu sursa F1 | Verificat, fără acțiune | ✅ |

---

## Dependențe noi adăugate

*(Notează înainte de `npm install`, ca să nu se ciocnească două terminale în lockfile.)*

| Fază | Pachet | De ce |
|---|---|---|
| 0 | zod | validare formulare + API (contract partajat) |
| 0 | next-intl | i18n RO/EN |
| 0 | gsap, lenis | motion divizia video (preinstalate ca lockfile-ul să nu se mai atingă; import lazy în F2/F3) |
| 0 | @supabase/supabase-js, @supabase/ssr | client DB + auth admin (F6) |
| 0 | resend | email transacțional (F6) |
| 0 | clsx, tailwind-merge | `cn()` din lib/utils.ts |

---

## Observații între faze

*(Ai văzut un bug sau o inconsecvență în zona altcuiva? Scrie aici, nu repara.)*

| Cine a observat | Unde | Ce |
|---|---|---|
| | | |

---

## De verificat înainte de lansare

- [ ] Logo integrat în toate variantele (light, dark, mark pentru favicon)
- [ ] Paletele ajustate față de culorile reale din logo
- [ ] Portofoliu video real înlocuiește placeholder-ele
- [ ] Proiecte software reale înlocuiesc placeholder-ele
- [ ] Testimoniale reale, cu acord scris de la clienți
- [ ] Textele legale validate juridic
- [ ] Link-uri ANPC SAL și SOL funcționale în footer
- [ ] Detaliile despre programele de finanțare verificate și actualizate
- [ ] **DECIZIE DE BUSINESS (F4):** intervalul „5.000 – 60.000 €" e publicat în cartușul din hero-ul `/software`. E scos din brief (buget țintă 5–15k, deschidere până la 60k) și califică lead-urile, dar e o cifră publică — confirmă sau schimbă în `TITLE_BLOCK_ROWS` din `app/[locale]/(software)/software/page.tsx`
- [ ] **JURIDIC (F4):** `content/software/funding.ts` — citit de consultant de fonduri / jurist tot ce e marcat `needsLegalReview: true` și comentariile `// TODO: verificat juridic`
- [ ] Cont admin creat în Supabase, parolă schimbată
- [ ] Toate variabilele de mediu setate în Vercel
- [ ] Domeniu `meridianagency.ro` cumpărat și conectat
- [ ] Email transacțional testat pe ambele divizii
- [ ] Cal.com configurat pentru video și software separat
- [ ] Numere WhatsApp și telefon corecte
- [ ] Lighthouse 90+ performanță, 100 accesibilitate pe rutele principale
- [ ] Testat pe iPhone real și Android real, nu doar în devtools
- [ ] Un om care nu a lucrat la site parcurge ambele divizii și confirmă că par două lumi diferite

---

## Ce rămâne pentru iterația 2

- CRM complet: pipeline vizual, task-uri, follow-up automat, istoric de comunicare
- ERP: facturare, proiecte, pontaj, costuri, rentabilitate per proiect
- Migrare conținut din `content/` în CMS (Sanity sau Payload)
- Blog și studii de caz detaliate
- Pagină de echipă
