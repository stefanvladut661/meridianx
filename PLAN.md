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
| 3 — Video reclame + funnel | `faza-3-video-funnel` | ✅ gata | ✅ |
| 4 — Software core | `faza-4-software-core` | ✅ gata | ✅ |
| 5 — Software brief | `faza-5-software-brief` | ✅ gata | ✅ |
| 6 — Backend + admin | `faza-6-backend` | ✅ gata | ✅ |
| 7 — i18n, SEO, legal | `faza-7-final` | 🟡 în lucru — legal/SEO/consimțământ gata; vezi jurnalul F7 | ⬜ |

> **Merge-ul de deblocare e FĂCUT.** `faza-7-final` conține acum toate fazele
> 0–6 (F4 prin `c3a4e36`, F6 prin merge-ul de integrare backend). Auditul final
> se face pe arborele complet. Singurul conflict a fost, ca prevăzut, `PLAN.md`.

> **Backend consolidat.** După merge, a rulat o trecere separată doar pe backend
> (jurnalul „FAZA 6b"), într-un singur terminal: autorizare pe `/admin`, migrarea 2,
> dedup, `/api/health`, `npm run verify:backend`. Zonele de design ale F1–F5 nu au
> fost atinse — se poate lucra la ele în paralel fără riscul de conflicte.

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
**Terminat:** Ambele pagini + tot funnel-ul video. `/video/reclame` — signature „curba de uzură”: argumentul paginii desenat ca grafic SVG (curba caldă = aceeași reclamă opt săptămâni, curba rece = creativ nou la fiecare trei săptămâni, cu marcajele de reîmprospătare). Se desenează la intrarea în viewport prin `stroke-dashoffset` + `pathLength=1`; sub reduced motion e completă din prima. **Fără valori pe axa Y și fără cifre de rezultat** — graficul descrie mecanismul, nu performanțe măsurate, iar asta scrie sub el. Restul paginii stă cuminte: diptic „de obicei / la noi”, patru fișe de platformă (Meta, Google, TikTok, LinkedIn — fiecare cu ce livrăm + adevărul incomod), ritmul de raportare, pachetul combinat. `/video/contact` — signature „panoul de regie”: canalele ca linii de patch (CH.01–CH.05), fiecare cu latență reală și motivul pentru care l-ai alege; vocea prima și la aceeași greutate ca formularul. Formulare: audit (4 câmpuri, 3 obligatorii) și ofertă (7 câmpuri, 2 obligatorii), ambele cu validare pe schema F0, captură UTM first-touch, honeypot `website`, stări distincte de loading/eroare/succes și confirmare în vocabularul butonului („Audit cerut.” / „Ofertă cerută.”). Cal.com prin iframe montat la intrarea în viewport, fără dependență nouă. Build verde: TS + ESLint + 19 rute.
**Decizii care afectează pe alții:**
- **Zod a ieșit din bundle-ul inițial.** `components/video/forms/validate.ts` (singurul loc care importă `leadInputSchema` pe client) se încarcă prin `await import()` la prima trimitere. Fără asta, paginile cu formular ajungeau la 221 kB First Load JS față de ~150 kB restul. **F5: fă la fel pe brief/estimator** — altfel divizia software plătește ~70 kB degeaba.
- Contactul se poate deep-linka: `/video/contact?tip=<segment>` preselectează tipul de proiect, folosind exact segmentele din `components/video/segments.ts` (F2). Verificat că merge și în build de producție, nu doar în dev. F2 poate lega butoanele din case study direct aici.
- Datele de contact vin EXCLUSIV din env (`NEXT_PUBLIC_PHONE`, `..._WHATSAPP_NUMBER`, `..._INSTAGRAM`, `..._CAL_VIDEO`). Canal neconfigurat = canal ascuns, nu `href="#"`. În dev apare în loc un avertisment vizibil. **Fără aceste variabile, pagina de contact rămâne doar cu formularul.**
- `source` pentru F6: `video-audit` (lead magnet reclame) și `video-contact` (ofertă). La audit, platformele bifate ajung în `projectType`, sub forma `Audit campanii · Meta, TikTok`, iar bugetul lunar de media în `budgetRange` — contractul nu are câmp dedicat pentru platforme.
**Componente construite local (candidate la deduplicare în F7):** `components/video/cta/` (`channels.ts` — sursa unică de canale + mesaje WhatsApp contextuale, `voice-cta.tsx`, `channel-panel.tsx`, `cal-embed.tsx`), `components/video/forms/` (`use-lead-submit.ts` — motorul comun UTM+validare+POST, `validate.ts`, `honeypot.tsx`, `form-success.tsx`, `audit-form.tsx`, `contact-form.tsx`). **`useLeadSubmit` + `Honeypot` + `FormSuccess` sunt scrise ca să le poată prelua F5 aproape neschimbate** — singurul lucru specific video e `division: "video"` hardcodat în hook.
**Observații:**
- Honeypot-ul din contract nu funcționează pe server — detaliat în „Cereri către fișiere partajate”. F3 îl rezolvă local, în client.
- Programul de lucru și baza (oraș, acoperire) de pe `/video/contact` sunt **placeholder marcat vizibil** — de confirmat cu omul înainte de lansare.
- Nu am putut face verificare vizuală: extensia de browser nu era conectată în sesiune. Responsive-ul e verificat prin calcul, nu prin ochi — graficul primește `overflow-x-auto` + `min-w-[48rem]` pentru că altfel etichetele mono ajungeau la ~4px pe 360. **De trecut cu ochiul peste ambele pagini la 360 și 768 înainte de lansare.**

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
**Terminat:** `/software/brief` — brief multi-step (5 pași) cu estimatorul integrat în pasul 2, exact cum permitea promptul. Signature: **„fișa de calibrare"** — un instrument a cărui precizie crește: pornește la ±35% cu tipul proiectului, ajunge la ±10% cu brief-ul completat, iar lățimea benzii de pe riglă e chiar cât de puțin știm încă. Rezultatul e ÎNTOTDEAUNA un interval, niciodată un preț; peste 60.000 € afișează „Peste 60.000 €" în loc de cifre, ca să nu sugereze o precizie pe care n-o avem. Riglă logaritmică cu gradații 2.5k–60k, contor sub 400ms, tranziții sub 150ms (lumea software). Pașii: tip proiect · ce conține (ecrane, funcționalități, integrări, limbi, mentenanță) · context · buget+termen+fonduri · contact. Stare persistată în sessionStorage cu bară de restaurare („continuă" / „începe din nou"), navigare înapoi fără pierderi, focus mutat pe titlul pasului, anunț `aria-live` la fiecare schimbare. Lead magnete: discovery call (Cal.com în iframe montat la intrarea în viewport) și ghid PDF cu gate pe email. Build verde: TS + ESLint.
**Decizii care afectează pe alții:**
- **`lib/estimator-config.ts` e fișier nou, creat de F5** (promptul de fază îl cere explicit acolo, ca omul să regleze prețurile fără să umble prin componente). Nu e în lista de fișiere înghețate. **⚠️ CIFRELE DIN EL SUNT PROPUNERI, NU ADEVĂRURI — omul trebuie să le confirme înainte de lansare.** E singurul loc din site unde apar prețuri.
- **F4:** am folosit `components/software/forms/` și `components/software/estimator/` — restul lui `components/software/` e al tău, nu l-am atins. `/software/brief` e singura rută pe care am creat-o. Header-ul (F1) leagă deja „Cere ofertă" → `/software/brief`, deci ruta e vie chiar dacă restul diviziei nu e gata.
- **F4, coordonare de signature:** rigla mea are gradații orizontale într-un panou de instrument. Signature-ul tău e linia meridian **verticală** de pagină. Sunt obiecte diferite, dar dacă ți se pare că se calcă, spune — schimb eu, e mai ieftin.
- **F6:** brief-ul trimite `source: "software-brief"`, iar după crearea lead-ului postează 5 evenimente pe `/api/leads/[id]/events`: patru `brief_step` (câte unul per pas, cu răspunsurile structurate) și un `estimator_used` (interval, incertitudine, dacă a atins plafonul). Evenimentele pleacă după confirmare și, dacă pică, nu strică succesul — sunt analitice, nu lead-ul. Ghidul vine cu `source: "software-ghid"`.
- Detaliile de finanțare (linia + termenul de decontare) nu au câmp în contract, deci merg în `message`, într-un bloc marcat `— Finanțare —`, împreună cu un bloc `— Din estimator —`. `isFunded` e setat corect pe lead.
- Zod încărcat lazy și aici, ca la F3 — `/software/brief` stă la 158 kB First Load JS.
**Componente construite local (candidate la deduplicare în F7):** `validate.ts`, `honeypot.tsx` și `use-lead-submit.ts` sunt **duplicate conștiente** ale celor din `components/video/forms/` (CLAUDE.md §6.6 — duplicarea temporară bate conflictul de merge între terminale). La F7 se extrag într-un `lib/leads/` comun; diferențele reale sunt doar `division` și trimiterea de evenimente.
**Observații:**
- **Nu am inventat detalii despre programele de finanțare.** Linia de finanțare e câmp liber, fără listă de programe, iar sub el scrie explicit că nu dăm consultanță pe eligibilitate. F4 (`/software/fonduri`) e singura care afirmă ceva despre programe — dacă acolo apare un vocabular de linii de finanțare, merită folosit și aici.
- PDF-ul ghidului (`public/software/ghid-modernizare-placeholder.pdf`) e un fișier real și valid, dar cu conținut schelet, marcat „PLACEHOLDER" și în interfață, nu doar în cod. `public/software/` nu era atribuit nimănui — l-am ocupat prin analogie cu `public/video/` al F2.
- Verificat la runtime: lead 201 + eveniment 201 pe id-ul real, estimatorul rulat pe 5 scenarii (inclusiv plafon și „neestimabil"), toate au ieșit cum trebuie. **Verificarea vizuală lipsește din nou** — extensia de browser nu e conectată. De trecut cu ochiul la 360 și 768.

---

### FAZA 6 — Backend + admin
**Terminat:** API-ul complet pe contractul FAZEI 0, emailuri Resend și dashboard-ul de lead-uri.
`POST /api/leads` — honeypot verificat pe body-ul brut, rate limit pe IP, validare Zod cu schema partajată, insert + eveniment `created`, emailuri fire-and-forget. `GET /api/leads` (protejat, filtrare + paginare), `PATCH /api/leads/[id]` (protejat, cu evenimente `status_changed`/`note_added`), `GET /api/leads/[id]` (protejat, lead + istoric), `POST /api/leads/[id]/events` (public, rate-limited — F5 trimite pașii de brief), `GET /api/leads/export` (protejat, CSV), `POST /api/admin/session` (reîmprospătare sesiune).
`/admin` — autentificare Supabase email+parolă, bandă de indicatori (săptămâna asta cu deltă, total, split video/software, fonduri, rată de calificare), tabel dens cu marcaj vizual pentru lead-urile din segmentul fonduri, filtre în URL prin formular GET nativ, panou de detaliu lateral pe `?lead=<id>` cu istoric, schimbare de status și note, export CSV al filtrului curent.
Emailuri: notificare către admin cu subiect de triaj (`[SOFTWARE · FONDURI] Nume · buget · formular`) și confirmare către client, cu ton diferit pe divizii — video direct și obraznic, software calm și cu pașii următori.
Build verde: TS + ESLint + toate rutele. Verificat la runtime: honeypot 200 cu id gol, JSON invalid 400, rate limit 429 cu `Retry-After`, toate rutele protejate 401 fără sesiune, `/admin` 307 spre login.
**Decizii care afectează pe alții:**
- **Cererea F3 e rezolvată.** Honeypot-ul se verifică pe body-ul BRUT, înainte de `safeParse` (`isHoneypotTripped` din `app/api/_lib/api.ts`). Schema FAZEI 0 rămâne neatinsă. `POST /api/leads` cu `website` non-gol întoarce acum **200 `{ ok: true, id: "" }`**, conform contractului. F3 poate scoate scurtcircuitul din client când vrea — sau îl poate lăsa, e o apărare în plus care economisește un drum la server.
- **F5:** `POST /api/leads/[id]/events` e public și rate-limited (60 / 10 min / IP). Trimite `{ type, payload }` exact ca în schema F0. Un lead inexistent dă 404, nu 500.
- **F3/F5 — comportament fără `.env.local`:** în DEZVOLTARE, `POST /api/leads` și ruta de evenimente răspund 201 cu id sintetic și scriu lead-ul în consola serverului, ca formularele să rămână testabile. În PRODUCȚIE, aceleași cazuri dau 503 — un lead pierdut în tăcere e mai rău decât o eroare vizibilă.
- **F5:** dacă brief-ul afișează un mesaj propriu la 429, folosește antetul `Retry-After` (secunde) — îl trimit pe toate răspunsurile de rate limit.
- Statusul „calificat" din indicatori = orice status diferit de `new` și `lost`. Dacă F7 sau omul vrea altă definiție, e o singură linie în `getLeadStats`.
**Componente construite local (candidate la deduplicare în F7):** `app/api/_lib/api.ts` (răspunsuri, IP, rate limit, honeypot), `lib/supabase/{types,clients,leads}.ts`, `lib/email/send.ts`, `emails/{shell,lead-notification,lead-confirmation}.ts`, `app/(admin)/admin/_components/*`. `STATUS_LABELS` din `lib/supabase/types.ts` e sursa unică pentru etichetele de status în RO — folosiți-o, nu rescrieți lista.
**Observații:**
- **`.env.example` NU e în git.** `.gitignore` are `.env*`, care îl prinde și pe el, deci fișierul există doar pe mașina pe care l-a scris FAZA 0. La un clone nou sau la configurarea Vercel nu are nimeni lista de variabile. Cerere depusă mai jos. Variabilă nouă cerută de F6: `RESEND_FROM_EMAIL` (adresa expeditor verificată în Resend).
- **Rate limiting în memoria procesului**, fără dependență nouă. Pe serverless contorul e per instanță, deci plafonul real e mai mare decât cel afișat și se pierde la scale-down. E suficient pentru spam de formular; pentru protecție serioasă trebuie Upstash/Redis — decizie conștientă, nu scăpare.
- **Sesiunea de admin** nu se poate reîmprospăta în componente de server (nu se pot scrie cookie-uri acolo), iar locul obișnuit — `middleware.ts` — e înghețat. Soluția e `POST /api/admin/session` + `SessionKeeper`, care lovește ruta la 45 de minute și la revenirea în filă. Dacă F7 dezgheață middleware-ul, mută refresh-ul acolo și șterge ambele.
- **Nu am putut testa fluxul complet cu Supabase și Resend reale** — nu există proiect Supabase și nici cheie Resend în mediul de dezvoltare. Verificate la runtime: contractul HTTP, codurile de status, gărzile de autentificare, degradarea fără configurare. NEverificate cu date reale: insert-ul, interogările, RLS, randarea emailurilor în clienți de mail. `/admin` fără configurare arată ecranul de instalare în cinci pași, nu o eroare.
- `POST /api/leads/[id]/events` fiind publică, oricine are un id de lead poate adăuga zgomot în istoricul acelui lead. Nu poate citi nimic și nu poate schimba statusul. Alternativa (token semnat per lead) cerea un contract nou cu F5, care lucra în paralel.

---

### FAZA 7 — Final
**⚠️ RULATĂ PARȚIAL, ÎNAINTE DE TERMEN.** F7 trebuia să ruleze după merge-ul tuturor fazelor. La momentul rulării, F4 avea lucru committed dar **nemergat** în `main`, iar F6 nu livrase nimic. S-a făcut tot ce nu depinde de ele; ce depinde e listat mai jos ca rest de lucru.

**Terminat:**
- **Legal complet.** Trei documente scrise integral, RO + EN, în `app/[locale]/(legal)/legal/_content/documents.ts`: confidențialitate (GDPR — temeiuri legale per scop, durate de păstrare, împuterniciți, transferuri, drepturi, ANSPDCP), termeni (ofertare, plată, termene, **proprietate intelectuală separată pe video vs software**, răspundere, ANPC SAL + SOL) și cookie-uri. Notă vizibilă sus pe fiecare pagină că textul **nu e validat juridic**. Datele firmei sunt placeholder marcat — nu inventăm CUI sau sediu.
- **Politica de cookie-uri e concretă, nu generică:** listează cheile reale pe care le scrie site-ul — `meridian_division`, `meridian_consent`, `meridian_utm`, `meridian_brief_v1`, `mv-shutter-seen` — cu ce face fiecare, unde stă și cât ține.
- **Consimțământ care chiar blochează.** `lib/consent.ts` + banner cu trei categorii, nimic pre-bifat, „Doar necesare" la aceeași greutate vizuală ca „Acceptă tot". Verificat la runtime: **fără consimțământ, HTML-ul nu conține niciun script de analytics.** Retragerea se face dintr-un buton pe `/legal/cookies`, iar scriptul se scoate din pagină pe loc.
- **SEO.** Canonical automat pe orice rută (`canonical: "./"` în root, rezolvat de Next la calea curentă — funcționează și pentru paginile care încă nu există); hreflang ro/en/x-default pe toate paginile existente prin `pageSeo()`; imagini OG generate dinamic, două șabloane distincte per divizie; JSON-LD Organization + WebSite pe tot site-ul, Service pe `/video/servicii`; `sitemap.xml` (16 rute × 2 limbi, construit din `nav-links.ts` ca să nu existe două liste care se ceartă) și `robots.txt`.
- **Analytics** cu wrapper de conversii (`lib/analytics.ts`), listă închisă de evenimente, totul condiționat de consimțământ.
- **README** refăcut: deploy, tabel de variabile de mediu cu „ce se strică fără ea", tabel complet de placeholder-e cu locul exact în cod.

**Decizii care afectează pe alții:**
- **Ruta OG se numește `/og.png`, nu `/og`** — middleware-ul i18n (ÎNGHEȚAT) prinde orice cale fără punct și i-ar pune prefix de limbă. Nu schimbați numele.
- **`lib/seo.ts` e sursa unică pentru canonical, hreflang, OG și JSON-LD.** **F4: paginile tale au nevoie de `pageSeo({ route, locale, division: "software", title, description })` în `generateMetadata` — exemplu în docstring.** Fără el primesc canonical corect, dar rămân fără hreflang.
- Root layout-ul (înghețat) a primit trei adăugiri punctuale: JSON-LD de nivel site, bannerul de cookie-uri și încărcătorul de analytics. Toate trei trebuie să existe o singură dată pe site — de-aia stau acolo.
- `.gitattributes` (adăugat la F5) protejează binarele; PDF-ul verificat că trece intact prin checkout.
- Paginile legale preiau paleta diviziei din cookie, ca vizitatorul să nu simtă că a nimerit pe alt site când dă click în subsol. Fără cookie rămân neutre.

**Rest de lucru — NU e făcut, depinde de F4/F6:**
1. **Extragerea i18n a copy-ului din pagini.** Tot textul de marketing din F2, F3, F4 și F5 e încă hardcodat RO, marcat cu `// i18n:`. **Nu am extras jumătate din el intenționat**: EN nu e traducere, e adaptare, iar vocea trebuie ținută unitară pe tot site-ul — făcut în două tranșe, ar ieși două voci. De făcut într-o singură trecere, după ce F4 e în `main`. Infrastructura e gata (namespace-uri, `forms.errors.*`, `cookies.*`, `legal.*` complete în ambele limbi).
2. **Audit de coerență între lumi** — nu se poate face fără paginile F4.
3. **Lighthouse pe rutele principale** — jumătate din rute încă dau 404 în `main`; în plus, extensia de browser nu e conectată în sesiune, deci n-am putut rula nimic vizual.
4. **`pageSeo()` pe paginile F4** — vezi mai sus.
5. **Verificarea vizuală a bannerului de cookie-uri** — logica e verificată prin HTML (scriptul chiar lipsește fără accept), dar interacțiunea în browser nu.

**Observații:**
- Nu am emis `LocalBusiness` și nici `AggregateRating`: primul cere adresă reală, al doilea recenzii reale. Structured data inventată e minciună citită de mașini — și e și penalizată. De adăugat când există datele.
- Categoria „marketing" din banner nu corespunde momentan niciunui script. Am scris asta explicit în politică, în loc s-o ascundem.
- Imaginile OG s-au verificat vizual (singurul lucru pe care l-am putut vedea în sesiune): diacriticele românești ies corect, inclusiv ș/ț cu virgulă dedesubt, nu cu sedilă.

---

### FAZA 6b — Consolidare backend (rulată din terminalul F7, singură)

**Context:** rulată după merge-ul tuturor fazelor, într-un singur terminal, ca omul să poată lucra la design în paralel fără riscul de conflicte. Atinge doar zona de backend (F6) plus editurile punctuale care sunt oricum ale F7 (`messages/`, `README`, `.gitignore`, `.env.example`).

**Terminat:**
- **`ADMIN_EMAILS` — autorizare, nu doar autentificare.** Până acum, „autentificat în Supabase" însemna „admin". Proiectele Supabase acceptă înregistrarea prin email IMPLICIT, deci oricine își făcea cont pe proiect intra în panou și vedea toate lead-urile, cu telefoane și bugete. Acum: listă de adrese, comparate case-insensitive. Poarta e în `getAdminUser()` (prin care trec toate rutele și acțiunile), iar formularul de login verifică și el, ca să dea un mesaj în loc de o buclă de redirect. Fără variabilă: în dezvoltare trece orice cont, în **producție panoul se blochează** cu mesaj care spune exact ce lipsește.
- **Migrarea 2** — `supabase/migrations/00000000000002_lead_activity.sql`. Fișier NOU (migrarea 1 rămâne neatinsă, e înghețată): `updated_at` + trigger, index pe activitate, index parțial pentru segmentul fonduri, indexuri pentru căutarea de dubluri. Panoul arată acum „atins acum N zile" pe lead-urile pe care s-a lucrat. **Obligatorie** — `LEAD_COLUMNS` o cere.
- **Dublu-submit.** Aceeași divizie + același formular + același email/telefon în 5 minute → nu se mai creează al doilea lead. Se întoarce id-ul primului (contractul rămâne 201 cu id valid), se scrie un eveniment `duplicate_suppressed` și NU se retrimit emailurile. Un dublu-click nu mai produce două notificări și două rânduri între care nu știi pe care ai lucrat.
- **Plafon de 200 de evenimente per lead.** Ruta de evenimente e publică (contract cu F5), deci cine află un id putea umple istoricul. Peste plafon se răspunde ca la succes și nu se scrie nimic — unui bot nu-i spui că a atins o limită.
- **`GET /api/health`.** Public: doar „configurat / neconfigurat" pentru cele șase variabile care contează, plus `ready`. Autentificat ca admin: interogare reală în bază, care distinge „baza nu răspunde" de „migrarea 2 nu e aplicată". Rate-limited, `no-store`, zero valori scurse.
- **`npm run verify:backend`** — `scripts/verify-backend.mjs`, zero dependențe. 18 verificări pe contractul HTTP: honeypot, JSON invalid, validare, plafon + `Retry-After`, evenimente, toate cele patru rute protejate, sesiunea de admin, ecranul de instalare. Fiecare test pe alt `X-Forwarded-For`, ca plafoanele să nu se scurgă între ele. Merge și pe producție: `npm run verify:backend https://meridianagency.ro`.
- **`/admin` fără configurare arată acum chiar ecranul de instalare.** Nu îl arăta: garda din layout redirecta spre un login care nu avea cum să reușească. Afirmația din jurnalul F6 era corectă ca intenție, greșită ca fapt — acum e adevărată.
- **`.env.example` e în git** (excepție în `.gitignore`), cu `RESEND_FROM_EMAIL` și `ADMIN_EMAILS`. Cererile F6 sunt închise. `forms.errors.rateLimited` corectat în RO și EN — EN adaptat, nu tradus.

**Verificat la runtime:** build verde (TS strict + ESLint + 24 de rute); 18/18 pe `verify:backend` în dezvoltare ȘI pe un server de producție (`next build` + `next start`), unde s-a confirmat separat că fără Supabase `POST /api/leads` și ruta de evenimente dau **503**, nu 201 sintetic. Cu `ADMIN_EMAILS` setat, `/api/health` raportează `adminAllowlist: true`.

**NEverificat, și nu se poate în mediul ăsta:** insert-ul real, RLS, triggerul de `updated_at`, dedup-ul pe date reale, randarea emailurilor în clienți de mail. Nu există proiect Supabase, nu există cheie Resend, iar Docker nu e instalat, deci nici stack Supabase local. Toate astea se verifică în ziua configurării, cu `/api/health` autentificat + un lead de test din fiecare formular.

**Decizii care afectează pe alții:**
- **Rate limiting rămâne în memoria procesului.** Am cântărit un adaptor Upstash prin REST (fără dependență nouă) și l-am respins: ar fi fost cod care rulează doar în producție și pe care nu-l pot testa aici. Pentru un formular de agenție, plafonul per instanță e suficient — decizia F6 rămâne în picioare, cu ea intră `LIMITS` dintr-un singur loc când va fi nevoie.
- **Ruta de evenimente rămâne publică.** Token semnat per lead ar cere schimbarea contractului cu F5 și o editură în formularele lui. Plafonul de 200 mărginește paguba; restul e o decizie pentru iterația 2.
- **`middleware.ts` NU a fost dezghețat.** `POST /api/admin/session` + `SessionKeeper` rămân. Funcționează; mutarea în middleware e o curățenie, nu o reparație.
- **Design (F1–F5): nimic din zonele voastre nu a fost atins.** Singurele fișiere de interfață modificate sunt sub `app/(admin)/`.

---

## Cereri către fișiere partajate

*(Ai nevoie de o modificare într-un fișier înghețat sau din zona altei faze? Scrie aici, nu edita.)*

| Cine cere | Ce fișier | Ce modificare | De ce | Rezolvat |
|---|---|---|---|---|
| F2 | `app/globals.css` (tokens) | Re-verificat `--v-dim` #6B6F78 pe `--v-void`: contrast 3.9:1, sub AA pentru text mic | F2 a ocolit local cu `text-fg/60`; F1/F3/F7 să nu folosească `text-muted` pentru text informativ mic pe video | ⬜ (decizie om / F7) |
| F2 | `components/ui/dialog.tsx` | Dialog-ul nu blochează scroll-ul de fundal | F2 a rezolvat local în `CaseStudyDialog`; F5/F6 vor lovi la fel | ⬜ (F7 sau acord om) |
| F2 | `content/types.ts` | `Project.media.poster` să fie obligatoriu când `kind: "video"` (union discriminat) | Quality floor cere poster obligatoriu | ⬜ (F7) |
| F3 | `lib/validations/lead.ts` **sau** `app/api/leads/route.ts` | Honeypot-ul nu ajunge niciodată să fie evaluat: `website: z.string().max(0)` respinge valoarea non-goală, deci `safeParse` pică și ruta răspunde **400**, nu `200 { ok: true, id: "" }` cum scrie contractul. Fie `website` devine `z.string().optional()` fără `max(0)` (verificarea rămâne în rută), fie ruta verifică honeypot-ul pe body-ul brut, înainte de parse. | Verificat la runtime cu POST real. F3 a acoperit local (scurtcircuit în client, botul vede succes fals și nu se lovește de API), dar **F5 va lovi exact la fel**, iar pe server contractul rămâne rupt | ✅ (F6 — rezolvat în rută, schema neatinsă) |
| F4 | `app/globals.css` (tokens) | `--accent-contrast` pe `[data-world="software"]`: alb pe `--s-signal` #4C7DFF dă **3,69:1**, sub AA pentru text normal. Cu `--s-ink` (#060A12) urcă la **5,36:1** | Orice buton primar din divizia software pică AA — inclusiv „Cere ofertă" din header-ul F1. F4 a ocolit local cu `softwareCtaClasses()`; când tokenul se repară, clasele rămân valide și headerul se aliniază singur | ⬜ (F7 sau acord om) |
| F4 | `components/shell/nav-links.ts` (F1) | Nicio modificare cerută — doar semnalez că rutele software linkuite de F4 (`/software/{servicii,fonduri,proiecte,proces,brief}`) se potrivesc exact cu sursa F1 | Verificat, fără acțiune | ✅ |
| F6 | `.gitignore` (linia 34, `.env*`) | Adaugă excepția `!.env.example` și commit-uie fișierul | `.env*` îl prinde și pe `.env.example`, deci NU e în git — există doar pe mașina pe care l-a scris F0. La un clone nou sau la setarea variabilelor în Vercel nu are nimeni lista de configurat | ✅ (F7 — excepție adăugată, fișierul e în git) |
| F6 | `.env.example` (netrack-uit) | Variabilă nouă: `RESEND_FROM_EMAIL` — adresa expeditor verificată în Resend. Fără ea se cade pe `notificari@meridianagency.ro`, care trebuie oricum verificat pe domeniu | Emailurile tranzacționale nu pleacă de pe un domeniu neverificat | ✅ (F7 — în `.env.example` și în tabelul din README) |
| F6 | `messages/*.json` → `forms.errors.rateLimited` | Textul spune „Așteaptă un minut", dar fereastra reală e de 10 minute. Propunere: „Ai trimis prea multe cereri într-un timp scurt. Mai încearcă peste câteva minute — sau sună-ne, e mai rapid." | O eroare care minte despre durată e o eroare vagă (CLAUDE.md §4). Mesajul de pe server e deja corectat; cel afișat de F3/F5 vine din i18n | ✅ (F7 — RO și EN, EN adaptat nu tradus) |
| F6 | `middleware.ts` | Dacă se dezgheață vreodată: mută reîmprospătarea sesiunii Supabase acolo și șterge `POST /api/admin/session` + `SessionKeeper` | E locul standard pentru rotația tokenului. Ocolirea actuală funcționează, dar e o piesă în plus de întreținut | ⬜ (F7, opțional) |

---

## Dependențe noi adăugate

*(Notează înainte de `npm install`, ca să nu se ciocnească două terminale în lockfile.)*

| Fază | Pachet | De ce |
|---|---|---|
| 5 | *niciunul* | Cal.com e prin iframe, nu prin `@calcom/embed-react`; estimatorul și wizard-ul sunt scrise de mână. Zero dependențe noi în F3 și F5. |
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
| F3 | `components/ui/field.tsx` | `Field` merge doar pentru un singur control cu label. Pentru grupuri de checkbox-uri (platformele din formularul de audit) am construit local `fieldset`/`legend` cu `aria-describedby` propriu. Dacă F5 are aceeași nevoie, merită un `FieldGroup` în `components/ui/` la F7 — nu îl adaug eu într-un fișier înghețat. |
| F5 | `components/ui/reveal.tsx` | `duration` are default 500ms, dar lumea software cere sub 400 (CLAUDE.md §2). F5 trimite `duration={320}` la fiecare folosire. Merită ca `Reveal` să ia default-ul din `data-world`, la F7 — nu îl schimb într-un fișier înghețat. |
| F6 | `main` (integrare) | F4 și F6 merge-uite în `main` (`c36d77c`, `39eb8e0`). Prima construcție cu F4+F5+F6 împreună: **build verde**, 13 rute publice × 2 limbi + `/admin` + 5 rute API. Zero coliziuni de fișiere între F4 și F5 în `components/software/`. Verificat la runtime că payload-ul brief-ului F5 trece validarea serverului F6 (răspunde 503 „fără bază de date", nu 400 „date invalide"), și că honeypot-ul dă 200 cu id gol pe ambele divizii. Singurele conflicte la merge au fost în `PLAN.md`, rezolvate păstrând ambele părți |
| F3 | `components/shell/footer.tsx` | Footerul construiește `tel:` cu `phone.replace(/\s/g,"")`, deci păstrează `+` doar dacă env-ul îl are. `components/video/cta/channels.ts` normalizează la `tel:+<cifre>`, ca linkul să meargă și dacă numărul e scris fără prefix. De unificat la F7 — nu am atins footerul. |
| F7 | `i18n/routing.ts` (FAZA 0) | **Modificat, cu acord explicit de la om.** Am adăugat `localeDetection: false`. Fără el, next-intl citea `Accept-Language` și cookie-ul `NEXT_LOCALE` și redirecta `/` spre `/en` pentru orice browser setat pe engleză — deci gateway-ul în română nu se vedea niciodată pe o instalare de Windows în engleză, iar cu cookie-ul de divizie setat drumul era `/` → `/en` → `/en/video`. Româna e limba sursă (CLAUDE.md §4); engleza se alege manual din comutatorul de limbă. Efect secundar așteptat: comutatorul de pe paginile EN trimite spre `/ro/video`, pe care middleware-ul îl normalizează 307 spre `/video` — un hop în plus, corect funcțional. |

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
- [ ] Cont admin creat în Supabase (Authentication → Users → Add user); nu există înregistrare din site
- [ ] **`ADMIN_EMAILS` setat cu adresa contului de admin** — fără ea panoul se blochează în producție, intenționat
- [ ] Dezactivat „Enable email signups" în Supabase → Authentication → Providers, dacă nu e nevoie de el (a doua încuietoare, după `ADMIN_EMAILS`)
- [ ] **Ambele** migrări rulate pe proiectul real, în ordine: `00000000000001_leads.sql`, apoi `00000000000002_lead_activity.sql`
- [ ] `/api/health` răspunde `"ready": true`, iar autentificat ca admin arată `reachable: true` și `schemaCurrent: true`
- [ ] `npm run verify:backend https://meridianagency.ro` — 18/18
- [ ] Domeniu verificat în Resend + `RESEND_FROM_EMAIL` setat, altfel emailurile nu pleacă
- [ ] Un lead de test trimis din fiecare formular, verificat că apare în `/admin` și că ajung ambele emailuri
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

---

## LAB — redesign front-end VIDEO (2026-08-25)

Zonă nouă, complet izolată de producție: `app/(lab)/`.

**Rute:** `/lab` (index) · `/lab/v1` · `/lab/v2` · `/lab/v3` · `/lab/v4`

**Izolare:**
- root layout propriu (`app/(lab)/layout.tsx`), cu fonturi proprii (`--font-lab-*`)
- sistem de design propriu în `app/(lab)/lab.css` — NU importă `app/globals.css`,
  nu folosește tokens-ii `[data-world]`, nu are cum să se scurgă în `/video` sau `/software`
- paginile de producție rămân neatinse; build-ul le raportează identic

**Direcțiile:**
| | Concept | Accent | Display | Semnătura |
|---|---|---|---|---|
| v1 AURORA | cald, cinematic, hero asimetric | `#ff7a3d` / `#c33bff` | Clash Display | placa media cu aurora + carduri flotante |
| v2 SIGNAL | indigo, centrat, orientat pe produs | `#5b5bf0` | Satoshi | panoul „ce rulează acum" de sub hero |
| v3 REEL | editorial, crimson, serif | `#e5484d` | Instrument Serif | orizontul de lumină din CTA-ul final |
| v4 HIBRID | capul de la AURORA, corpul de la SIGNAL | paleta v2 | Satoshi | contrastul dintre deschiderea cinematică și corpul riguros |

**Copy:** scris integral de la zero pentru poziționarea „producție + distribuție
plătită + optimizare lunară", în `app/(lab)/lab/_components/content.ts`. Fără
prețuri, totul pe ofertă. Toate versiunile împart același copy — diferă
doar limbajul vizual, ca să fie comparabile.

**Placeholder marcat explicit** (nu se publică fără confirmarea clientului):
`TESTIMONIALS`, `CAPABILITY_STATS`, `CONTACT` (telefon, WhatsApp, email),
plăcile media din `MediaFrame`.

### Cerere către fișier partajat — REZOLVATĂ
- `middleware.ts`: adăugat `lab` la excluderile matcher-ului i18n, ca `/lab` să nu
  fie rescris spre `/ro/lab` (care nu există). O singură cuvânt-cheie în regex,
  zero efect asupra rutelor existente.

### De decis
- care direcție devine noul `/video`
- numerele din `CAPABILITY_STATS` și datele de contact reale
- dacă păstrăm marca redesenată vectorial (`_components/mark.tsx`) sau folosim
  `public/brand/meridian-logo.jpeg`

---

## LAB — divizia SOFTWARE (2026-08-25)

**Rută:** `/lab/soft` — o singură direcție, corporate, cu selector de paletă.

**Poziționare:** partener de implementare pentru firme care au obținut finanțare
de digitalizare și trebuie să transforme banii în infrastructură folosită real.
Copy nou în `app/(lab)/lab/_components/soft-content.ts`. Fără prețuri.

**Ce se vinde:** aplicații de business la comandă, fidelizare, dashboard-uri
custom, mecanisme de vânzare, SaaS, aplicații mobile, site-uri de conversie,
integrări. Argumente: livrare pe etape scurte, interfețe care se învață în
minute, performanță măsurată, preț competitiv, cod și conturi pe firma clientului.

**Lead magnet — configuratorul de proiect** (`_components/configurator.tsx`):
patru pași (module → scară → integrări → termen și finanțare), fișa proiectului
se completează în timp real la dreapta (scop, etape propuse, interval orientativ
de timp), iar pasul cinci e programarea consultanței. Estimarea de timp e
marcată vizibil ca orientativă; costul apare doar în ofertă, după consultanță.
NU e conectat la `/api/leads` — se oprește la starea de succes locală.

**Selector de paletă** (`_components/palette.tsx`): buton flotant jos-dreapta,
șase palete, alegerea se ține în `localStorage`. Funcționează pentru că nicio
culoare nu e scrisă direct în componente — totul trece prin `[data-palette]`.

| Paletă | Caracter | Accent | Contrast accent/fundal |
|---|---|---|---|
| Grafit | aur instituțional, „bancă și contract" | `#d8a02b` | 8.4 |
| Smarald | verde de creștere, operațional | `#16a46b` | 6.1 |
| Petrol | teal rece, infrastructură | `#0fb5c9` | 7.8 |
| Cupru | cald, industrial | `#c0703c` | 5.3 |
| Bordo | zmeură, memorabil | `#d24d7a` | 4.7 |
| Hârtie | **fundal deschis**, cel mai sobru | `#1c6e54` | 5.7 |

Toate trec AA pe text mic. Zero albastru — indigo-ul de la video rămâne al video-ului.

**Separarea de video** (CLAUDE.md §2): colțuri mai strânse (8/12/16 vs 10/16/24),
motion sub 400ms (`.reveal-fast`), IBM Plex Mono în loc de JetBrains, `.node-dot`
(pătrat rotit) în loc de `.rec-dot` (puls REC), grilă de blueprint, iar obiectul
memorabil din hero e o interfață de aplicație desenată din tokens, nu o placă
media.

### De decis
- ce paletă rămâne pentru software
- dacă păstrăm configuratorul ca lead magnet principal sau îl mutăm pe pagină separată
- textele marcate `TODO: verificat juridic` despre documentația de raportare

---

## LAB — POARTA (2026-08-26)

**Rută:** `/lab/gateway` — pagina intermediară, echivalentul rădăcinii site-ului.

Singura pagină în care cele două lumi apar împreună, fără să se amestece.
Fiecare jumătate poartă propriul `[data-lab]` pe elementul de link, deci propria
paletă, propriile raze de colț și propriul temperament de motion. Shell-ul —
bara de sus, banda de sub fold, footer-ul — rulează pe un scope neutru nou,
`[data-lab="gate"]`, fără accent propriu, ca să nu concureze cu niciuna.

**Firul comun, implementat de-adevăratelea** (`_components/meridian.tsx`):
același traseu SVG în ambele jumătăți — două curbe de meridian plus cercul —
tratat ca lumină care circulă pe traseu la video și ca geodezică desenată peste
grilă, cu gradații de latitudine, la software. Cele două arcuri sunt tăiate
exact la cusătură, unde stă marca.

**Interacțiune:** split-screen clasic — jumătatea privită crește (`flex-grow`),
cealaltă se retrage. Funcționează pe `:focus-within`, nu doar pe `:hover`, deci
și de la tastatură. Sub `prefers-reduced-motion` ambele rămân egale și complet
lizibile. Pe telefon se stivuiesc, chip-urile de industrii dispar și înălțimea
scade la `46dvh`, ca a doua opțiune să înceapă vizibil pe primul ecran.

**Selectorul de paletă e disponibil și aici** — poarta e locul în care se vede
dacă paleta aleasă pentru software stă bine lângă indigo-ul de la video.
Regula CSS care face `<body>` să urmeze paleta deschisă a fost restrânsă la
copil direct (`:has(> [data-palette="hartie"])`), altfel ar fi luminat și
shell-ul porții, unde paleta ocupă doar o jumătate de ecran.

**Copy:** decizia se ia în trei secunde, deci nu există nimic de citit înainte
de alegere. Argumentele („o agenție, două echipe" — un singur punct de contact,
nu amestecăm, se ajută reciproc) și ieșirea de siguranță pentru cine ezită stau
sub fold.

### De decis
- dacă poarta rămâne la `100dvh` pe desktop sau se scurtează
- ordinea diviziilor: video în stânga sau software în stânga

---

## LAB — comutatorul de lumi + tema implicită (2026-08-26)

**Tema Hârtie a devenit implicită** (`DEFAULT_PALETTE = "hartie"` în
`_components/palette.tsx`), deci și pentru `/lab/soft` și pentru `/lab/gateway`.
Selectorul rămâne disponibil; alegerea salvată în `localStorage` are prioritate
față de implicit.

**Fix de contrast pe poartă:** jumătățile nu-și declarau culoarea de text, deci
titlul „SOFTWARE" moștenea albul shell-ului neutru și dispărea pe fundal deschis.
Ambele jumătăți au acum `text-bone`, adică își iau culoarea din propria lume.

**Comutatorul de lumi** (`_components/world-switch.tsx`) — sfert de cerc lipit
în colț, după referința din `ideas/2`. Respectă memoria spațială a porții: pe
`/lab/v4` stă **dreapta sus** (acolo e software în poartă), pe `/lab/soft`
**stânga sus** (acolo e video). Poartă `data-lab` și paleta lumii în care duce,
nu ale paginii pe care stă — e o gaură în colț prin care se vede cealaltă lume.

- rază 120px, sticlă cu blur. Observația care schimbă tot: într-un sfert lipit
  în colț, lățimea maximă e chiar lângă muchia de sus — la 14px sub ea mai sunt
  ~119px. Deci textul nu trebuie curbat sau rotit ca să încapă, doar urcat.
  Toate modelele țin tipografia orizontală.
- **trei modele de comparat**, în `_components/corner-faces.tsx`, alese de pe
  `/lab/colt`:
  · **Fereastră** — colțul e o gaură în perete: se vede un fragment din lumea de
  dincolo (cadru cu redare și bandă de timecode la video, fragment de interfață
  cu bare la software), eticheta stă sus pe muchie
  · **Comutator** — arată și unde ești și unde ajungi: divizia curentă stinsă
  deasupra, cea de destinație aprinsă dedesubt, cu o linie care coboară între ele
  · **Etichetă** — marca, „TRECI LA", numele diviziei, o linie care se lungește
  la hover. Zero decor
- alegerea se ține în `localStorage` (`meridian-lab-face`, hook `useFace`), la fel
  ca paleta: pagina de test o scrie, `/lab/v4` și `/lab/soft` o citesc
- **intrare**: alunecă din colț (`translate` + `opacity`), după 620ms
- **hover**: `scale: 1.12` cu origine în colț, deci crește spre pagină; gradațiile
  se aprind în culoarea accentului, insigna crește și din ea pleacă o undă
- **apăsare**: văl circular care crește din colț până acoperă ecranul, în
  culoarea destinației, cu marca și numele diviziei; navigarea la 560ms

Intrarea folosește `translate`, hover-ul `scale` — proprietăți separate
intenționat: dacă animația de intrare ar atinge `scale`,
`animation-fill-mode: both` ar bloca tranziția de hover pe veci. Vălul merge
prin `createPortal` în `<body>`, fiindcă `translate` pe sfert îl face bloc de
conținere pentru descendenții `fixed`.

Sfertul stă la `z-index: 55`, deci **peste** bara de sus (50) — exact ca în
referință, unde bara trece pe sub colț. Ca să nu acopere logo-ul sau CTA-ul,
barele primesc `.ws-inset-left` / `.ws-inset-right`:
`clamp(1.5rem, calc(130px - (100vw - 72rem) / 2), 130px)` — rezervă loc doar
când e nevoie, iar peste ~1450px marginile lui `max-w-6xl` îl găzduiesc singure.

Sub 640px sfertul nu se afișează: în colțul de sus al unui telefon stă bara de
navigare. Acolo, trecerea dintre divizii e o linie în meniul mobil
(`WorldSwitchMobileLink`).

Sub `prefers-reduced-motion`: fără intrare, fără creștere, fără văl — link
obișnuit care navighează direct.

---

## LAB — pagină de test pentru colț (2026-08-26)

**Rută:** `/lab/colt`

Cele trei modele de interior, fiecare în ambele contexte (pagina de video cu
colțul în dreapta, pagina de software cu colțul în stânga), la dimensiune reală
de 120px, în rame care imită pagina-gazdă — cu bară de sus, titlu și butoane, ca
să se vadă cât înseamnă colțul peste conținut real. Ramele sunt mai înguste
decât un ecran, deci proporția pare mai mare acolo decât în pagină; scrie și pe
pagină.

Fiecare model are un buton „Pune-l pe site" care scrie alegerea în browser;
paginile de divizie o preiau automat, deci se poate compara și în pagina
întreagă, nu doar în ramă. Selectorul de paletă e disponibil și aici, fiindcă
colțul spre software își ia culoarea din paleta aleasă.

Varianta de previzualizare a colțului e aceeași componentă, cu `.ws-corner--preview`
peste: `position: absolute` în loc de `fixed` și fără animația de intrare.

### De decis
- care dintre cele trei modele rămâne (implicit acum: **Comutator**)

---

## LANSARE — noul site înlocuiește vechiul (2026-08-26)

Deciziile din secțiunile LAB de mai sus sunt închise. Ce s-a ales:
**V4 HIBRID** pentru video, paleta **Hârtie** pentru software, modelul
**Comutator** pentru colț, video în stânga la poartă. Selectoarele de
palete și de colț, rutele `/lab/*` și paginile de test au dispărut —
alegerea e acum singura variantă din cod, nu una dintre șase.

### Ce a înlocuit ce

| Înainte | Acum |
|---|---|
| `/`, `/video`, `/software` — versiunea de acum câteva zile | `components/site/pages/{gateway,video,software}.tsx` |
| 10 sub-pagini de divizie (servicii, portofoliu, reclame, proces, contact, fonduri, proiecte, brief) | **șterse** — landing-urile sunt o pagină cu ancore |
| `components/{video,software,shell,ui}/`, `content/` | **șterse** — nu mai avea ce le importa |
| `lib/estimator-config.ts`, `lib/hooks/use-reduced-motion.ts` | **șterse** — orfane după ștergerea estimatorului |

Vechile rute dau 404, nu redirect: site-ul n-a fost niciodată public,
deci nu există link-uri de intrare de salvat. `nav-links.ts` a dispărut
odată cu shell-ul, iar sitemap-ul are acum o listă explicită de șase
rute — o ancoră nu se indexează separat, deci n-avea ce căuta acolo.

### Ce a trebuit reparat odată cu ștergerea

- **Paginile legale** atârnau de `components/shell/footer` și de
  primitivele din `components/ui/`, deci ar fi rămas singurele pagini
  publice în limbajul vizual vechi. Au primit shell propriu, pe
  `[data-scope]`, cu paleta diviziei din care vine vizitatorul.
- **Bannerul de cookie-uri** era pe tokens-ii vechi și pe `data-world`.
  Trecut pe `[data-scope]` — atributul îi aduce tokens-ii în subarbore,
  fiindcă stă în afara oricărui `.md-root`. z-index urcat la 70, peste
  colțul de comutare (55): un banner de consimțământ care intră sub
  altceva e o problemă juridică, nu una vizuală.
- **Niciun subsol nu avea link-uri legale.** Adăugate în toate trei,
  din `components/site/legal-links.ts`.
- **Emailul de confirmare** trimitea lead-ul spre `/video/portofoliu`
  și `/software/proces` — ambele 404 după ștergere. Acum duc la ancore.
- **`font-md-mono` nu exista** în maparea Tailwind, deși e folosit în
  22 de locuri: tot textul mono din paginile noi se randa cu fontul de
  body. Token adăugat.

### Formularele, conectate

Ambele trec prin `components/site/lead.ts` — o singură cale spre
`POST /api/leads`, cu schema Zod din FAZA 0 rulată și pe client, ca un
payload care trece acolo să nu poată fi respins pe server.

- **Configuratorul** (`software-configurator`) nu mai se oprea la o
  stare locală de succes, iar ecranul de confirmare nu mai scrie
  „demonstrație de lab, nu trimite nimic". Alegerile devin
  `projectType`, `timeline` și un rezumat citibil în `message` —
  altfel dashboard-ul ar fi arătat doar un nume. `isFunded` e adevărat
  și pentru finanțarea „în curs": aceeași nevoie, același termen fix.
- **`/video` n-avea niciun formular** — doar WhatsApp și telefon, deci
  zero lead-uri video ajungeau în bază. Adăugat `video-form.tsx`: trei
  câmpuri, lângă blocul de voce, la aceeași greutate vizuală
  (CLAUDE.md §8 cere ambele proeminente, nu una în locul celeilalte).
- Honeypot-ul are acum o clasă proprie, `.hp-field`: off-screen, nu
  `display:none` — destule boturi sar peste câmpurile ascunse așa.

Verificat la runtime: 201 pe ambele forme de payload, 200 cu id gol pe
honeypot, 429 pe plafon.

### Datele de contact vin din env

`components/site/contact.ts` citește `NEXT_PUBLIC_PHONE`,
`NEXT_PUBLIC_WHATSAPP_NUMBER` și adresele per divizie. Fără ele rămân
numerele de demonstrație, iar subsolul scrie explicit că sunt
placeholder — nota dispare singură când se completează env-ul. Lansarea
nu mai cere editat cod.

### Engleza, oprită temporar

Copy-ul nou e scris direct în `components/site/*-content.ts`, nu în
`messages/`, deci `/en/*` ar fi afișat titluri englezești peste text
românesc. `en` a ieșit din `i18n/routing.ts` și dă 404.
`messages/en.json` și versiunile EN ale documentelor legale rămân în
repo, scrise, pentru când adaptăm restul.

### Rămâne de făcut înainte de lansarea propriu-zisă

- numărul de telefon, WhatsApp-ul și cele două adrese de email în env
- validarea juridică a celor trei documente + datele reale ale firmei
- materialul video real în locul plăcilor marcate „exemplu" (butonul de
  redare e inert cât timp placa e un exemplu — un control focusabil
  care nu face nimic e o promisiune ratată)
- testimonialele și cifrele din `CAPABILITY_STATS`
- afirmațiile despre programele de finanțare marcate `TODO: verificat juridic`
- versiunea EN, adaptată — nu tradusă
