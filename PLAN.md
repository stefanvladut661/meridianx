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
| F3 | `lib/validations/lead.ts` **sau** `app/api/leads/route.ts` | Honeypot-ul nu ajunge niciodată să fie evaluat: `website: z.string().max(0)` respinge valoarea non-goală, deci `safeParse` pică și ruta răspunde **400**, nu `200 { ok: true, id: "" }` cum scrie contractul. Fie `website` devine `z.string().optional()` fără `max(0)` (verificarea rămâne în rută), fie ruta verifică honeypot-ul pe body-ul brut, înainte de parse. | Verificat la runtime cu POST real. F3 a acoperit local (scurtcircuit în client, botul vede succes fals și nu se lovește de API), dar **F5 va lovi exact la fel**, iar pe server contractul rămâne rupt | ⬜ (F6 — e ruta lui) |
| F4 | `app/globals.css` (tokens) | `--accent-contrast` pe `[data-world="software"]`: alb pe `--s-signal` #4C7DFF dă **3,69:1**, sub AA pentru text normal. Cu `--s-ink` (#060A12) urcă la **5,36:1** | Orice buton primar din divizia software pică AA — inclusiv „Cere ofertă" din header-ul F1. F4 a ocolit local cu `softwareCtaClasses()`; când tokenul se repară, clasele rămân valide și headerul se aliniază singur | ⬜ (F7 sau acord om) |
| F4 | `components/shell/nav-links.ts` (F1) | Nicio modificare cerută — doar semnalez că rutele software linkuite de F4 (`/software/{servicii,fonduri,proiecte,proces,brief}`) se potrivesc exact cu sursa F1 | Verificat, fără acțiune | ✅ |

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
| F3 | `components/shell/footer.tsx` | Footerul construiește `tel:` cu `phone.replace(/\s/g,"")`, deci păstrează `+` doar dacă env-ul îl are. `components/video/cta/channels.ts` normalizează la `tel:+<cifre>`, ca linkul să meargă și dacă numărul e scris fără prefix. De unificat la F7 — nu am atins footerul. |

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
