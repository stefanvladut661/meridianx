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
| 4 — Software core | `faza-4-software-core` | ⬜ poate porni (F0 în main) | ⬜ |
| 5 — Software brief | `faza-5-software-brief` | ⬜ poate porni (F0 în main) | ⬜ |
| 6 — Backend + admin | `faza-6-backend` | ✅ gata | ⬜ |
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
**Terminat:**
**Componente construite local:**
**Observații:**

---

### FAZA 5 — Software brief
**Terminat:**
**Componente construite local:**
**Observații:**

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
| F3 | `lib/validations/lead.ts` **sau** `app/api/leads/route.ts` | Honeypot-ul nu ajunge niciodată să fie evaluat: `website: z.string().max(0)` respinge valoarea non-goală, deci `safeParse` pică și ruta răspunde **400**, nu `200 { ok: true, id: "" }` cum scrie contractul. Fie `website` devine `z.string().optional()` fără `max(0)` (verificarea rămâne în rută), fie ruta verifică honeypot-ul pe body-ul brut, înainte de parse. | Verificat la runtime cu POST real. F3 a acoperit local (scurtcircuit în client, botul vede succes fals și nu se lovește de API), dar **F5 va lovi exact la fel**, iar pe server contractul rămâne rupt | ✅ (F6 — rezolvat în rută, schema neatinsă) |
| F6 | `.gitignore` (linia 34, `.env*`) | Adaugă excepția `!.env.example` și commit-uie fișierul | `.env*` îl prinde și pe `.env.example`, deci NU e în git — există doar pe mașina pe care l-a scris F0. La un clone nou sau la setarea variabilelor în Vercel nu are nimeni lista de configurat | ⬜ (F7 sau om) |
| F6 | `.env.example` (netrack-uit) | Variabilă nouă: `RESEND_FROM_EMAIL` — adresa expeditor verificată în Resend. Fără ea se cade pe `notificari@meridianagency.ro`, care trebuie oricum verificat pe domeniu | Emailurile tranzacționale nu pleacă de pe un domeniu neverificat | ⬜ (F7 sau om) |
| F6 | `messages/*.json` → `forms.errors.rateLimited` | Textul spune „Așteaptă un minut", dar fereastra reală e de 10 minute. Propunere: „Ai trimis prea multe cereri într-un timp scurt. Mai încearcă peste câteva minute — sau sună-ne, e mai rapid." | O eroare care minte despre durată e o eroare vagă (CLAUDE.md §4). Mesajul de pe server e deja corectat; cel afișat de F3/F5 vine din i18n | ⬜ (F7) |
| F6 | `middleware.ts` | Dacă se dezgheață vreodată: mută reîmprospătarea sesiunii Supabase acolo și șterge `POST /api/admin/session` + `SessionKeeper` | E locul standard pentru rotația tokenului. Ocolirea actuală funcționează, dar e o piesă în plus de întreținut | ⬜ (F7, opțional) |

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
| F3 | `components/ui/field.tsx` | `Field` merge doar pentru un singur control cu label. Pentru grupuri de checkbox-uri (platformele din formularul de audit) am construit local `fieldset`/`legend` cu `aria-describedby` propriu. Dacă F5 are aceeași nevoie, merită un `FieldGroup` în `components/ui/` la F7 — nu îl adaug eu într-un fișier înghețat. |
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
- [ ] Cont admin creat în Supabase (Authentication → Users → Add user); nu există înregistrare din site
- [ ] Migrarea `supabase/migrations/00000000000001_leads.sql` rulată pe proiectul real
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
