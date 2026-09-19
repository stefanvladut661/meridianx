# MERIDIAN — meridianx.ro

Site-ul agenției MERIDIAN: două divizii (VIDEO și SOFTWARE) într-un singur app Next.js, cu poarta split-screen la rădăcină. **Citește `CLAUDE.md` înainte de orice** — e legea proiectului. Jurnalul de decizii e în `PLAN.md`.

## Stack

Next.js 15 (App Router, Turbopack) · TypeScript strict · Tailwind CSS v4 · next-intl · Supabase · Resend · Vercel.

Fără librărie de animație: tot motion-ul e IntersectionObserver + tranziții CSS (`components/site/motion.tsx`). GSAP și Lenis au rămas în `package.json` din faza anterioară și nu mai sunt importate de nicăieri.

## Pornire

```bash
npm install
cp .env.example .env.local   # completează cheile
npm run dev
```

## Rutele publice

Șase, toate în română. Landing-urile sunt **o singură pagină cu ancore**, nu arbori de sub-pagini.

| Rută | Ce e | Calea spre lead |
|---|---|---|
| `/` | poarta split-screen | alege divizia; alegerea se ține în cookie-ul `meridian_division` |
| `/video` | landing video | WhatsApp + telefon + formular scurt, toate trei la aceeași greutate |
| `/software` | landing software | configuratorul de proiect (5 pași) + telefon |
| `/legal/confidentialitate`, `/legal/termeni`, `/legal/cookies` | documente legale | — |

Plus `/admin` (dashboard lead-uri, în afara i18n) și `/api/*`.

**Engleza e oprită deocamdată.** Copy-ul de după redesign e scris direct în componente, nu în `messages/`, deci `/en/*` ar fi însemnat titluri englezești peste text românesc. `en` a ieșit din `i18n/routing.ts` și dă 404; `messages/en.json` și versiunile EN ale documentelor legale au rămas în repo, scrise, pentru când adaptăm și restul (CLAUDE.md §4: EN se adaptează, nu se traduce).

## Harta fișierelor

```
app/
  globals.css               două sisteme de tokens: cel vechi ([data-world], --v-*/--s-*)
                            servește DOAR /admin; cel nou ([data-scope], --md-*) e site-ul
  fonts.ts                  Satoshi + JetBrains Mono + IBM Plex Mono pe public;
                            Clash și Switzer doar pe /admin (preload: false)
  [locale]/                 rutele publice (i18n)
    layout.tsx              html/body, provider next-intl, JSON-LD, banner de cookie-uri
    (gateway)/page.tsx      poarta + redirectul spre divizia memorată
    (video)/, (software)/   layout-uri goale: fiecare landing își poartă singur shell-ul
    (legal)/                shell propriu + cele trei documente
  (admin)/                  root layout separat, fără i18n
  api/leads/                intrarea tuturor formularelor
components/
  site/                     TOT site-ul public
    pages/                  gateway.tsx · video.tsx · software.tsx
    ui.tsx, motion.tsx      piese și primitive partajate de cele două lumi
    configurator.tsx        lead magnetul software
    video-form.tsx          formularul scurt de pe /video
    lead.ts                 singura cale spre POST /api/leads
    contact.ts              datele de contact, citite din env
    *-content.ts            copy-ul, separat de componente
    meridian.tsx, mark.tsx  arcul de meridian și marca
    world-switch.tsx        sfertul de cerc din colț, trecerea între lumi
  consent/, seo/, gateway/  banner de cookie-uri, JSON-LD, ștergerea cookie-ului de divizie
i18n/, messages/            rutare și chei (folosite acum doar de legal, consent și skip link)
lib/
  division.ts               tipul Division + cookie-ul meridian_division
  utm.ts                    captura UTM first-touch (sessionStorage)
  validations/lead.ts       contractul Zod al API-ului, comun client și server
  supabase/, email/         persistență și emailuri
supabase/migrations/        schema leads + lead_events + RLS
middleware.ts               rutare i18n (exclude /api, /admin)
```

## Cum funcționează cele două lumi

Un singur atribut: `data-scope="video" | "software" | "gate"` pe rădăcina fiecărei pagini remapează tokens-ii `--md-*` — culoare, raze de colț, familie de mono, temperament de motion. Componentele folosesc doar clase semantice (`text-bone`, `text-dim`, `border-hair`, `bg-glass`, `text-a1`), deci aceeași piesă își schimbă lumea fără nicio ramură în cod.

Video e închis și indigo, software e pe hârtie și verde, poarta e neutră. Firul comun e arcul de meridian din `meridian.tsx`: același traseu SVG în ambele lumi, tratat ca lumină la video și ca geodezică peste grilă la software.

## Formulare și lead-uri

Ambele formulare trec prin `components/site/lead.ts` → `POST /api/leads`, cu aceeași schemă Zod pe client și pe server, honeypot `website` scos din ecran (nu `display:none`), UTM-uri first-touch din sessionStorage și rate limiting pe IP.

- `/video` → `source: "video-apel"` — trei câmpuri: nume, telefon, ce te interesează.
- `/software` → `source: "software-configurator"` — alegerile devin `projectType`, `timeline` și un rezumat citibil în `message`, ca dashboard-ul să nu arate doar un nume.

Fără Supabase configurat, în dezvoltare API-ul răspunde 201 cu id sintetic și scrie lead-ul în consola serverului; în **producție** răspunde 503, ca să nu se piardă lead-uri în tăcere.

## SEO, consimțământ și analytics

- **Canonical** automat pe orice rută (root layout: `alternates: { canonical: "./" }`).
- **Open Graph** generat dinamic la `/og.png?division=video|software&title=…&subtitle=…`. Ruta are extensie pentru că middleware-ul i18n prinde orice cale fără punct.
- **JSON-LD**: Organization + WebSite. Deliberat **fără** `LocalBusiness` și `AggregateRating` — nu emitem structured data pe care n-o putem susține.
- **Consimțământ**: `lib/consent.ts` + `components/consent/`. Scripturile opționale nu se încarcă înainte de accept. Retragerea se face din `/legal/cookies`, la fel de simplu ca acordarea.
- **Vercel Analytics** se încarcă prin script propriu, nu prin pachet, exact ca să poată fi condiționat de consimțământ.

## Deploy

1. Importă repo-ul în Vercel. Framework-ul e detectat automat.
2. Setează variabilele de mediu de mai jos în **Project Settings → Environment Variables**, pentru Production și Preview.
3. Rulează **ambele** migrări din `supabase/migrations/`, în ordinea numerelor, apoi creează contul de admin (Authentication → Users → Add user) și pune aceeași adresă în `ADMIN_EMAILS`.
4. Conectează domeniul și verifică `NEXT_PUBLIC_SITE_URL` — din el se construiesc canonical, sitemap și robots.
5. Verifică după deploy: `/api/health` (trebuie `"ready": true`), `/sitemap.xml`, `/robots.txt`, `/og.png?division=video&title=test`.

### Verificarea backendului

`GET /api/health` răspunde cu starea fiecărei variabile care contează — public doar cu „configurat / neconfigurat", fără valori. Autentificat ca admin, adaugă și un diagnostic viu: baza răspunde? sunt ambele migrări aplicate? câte lead-uri sunt?

Contractul HTTP întreg (honeypot, coduri de eroare, plafoane, gărzi de autentificare) se verifică automat:

```bash
npm run dev            # într-un terminal
npm run verify:backend # în altul — sau: npm run verify:backend https://meridianx.ro
```

### Supabase ținut treaz

Planul gratuit Supabase pune pe pauză proiectele fără „suficientă activitate în bază în ultima săptămână" — pragul din [documentație](https://supabase.com/docs/guides/platform/free-project-pausing) e „câteva cereri pe zi". Agenția primește oferte rar, deci baza ar adormi, iar formularele ar răspunde cu eroare exact când vine un client.

`vercel.json` programează o sondă (`app/api/_lib/keepalive.ts`) care face patru cereri reale prin Data API — scrie un rând de test, îl citește, îl șterge, numără lead-urile — deci dovedește în trecere și că scrierea chiar merge:

| Rută | Când (UTC) | Email |
|---|---|---|
| `/api/cron/keepalive` | zilnic, 04:00 (±59 min pe Hobby) | doar dacă a picat — alertă roșie |
| `/api/cron/keepalive/report` | luni, 05:00 | mereu — raportul verde „🧪 [TEST AUTOMAT]" |

Emailurile de sistem vin de la „MERIDIAN · test automat" / „MERIDIAN · alertă", pe fond deschis, cu bandă sus — nu se confundă cu un lead nici din lista de inbox. Rândul de test se șterge în aceeași rulare și nu intră în panou sau statistici.

Declanșare de mână: logat în `/admin`, deschide `/api/cron/keepalive/report` — primești raportul pe loc. Util după ce repornești un proiect pus pe pauză. Invocările automate se văd în Vercel → Settings → Cron Jobs.

## Variabile de mediu

| Variabilă | Obligatorie | Ce se strică fără ea |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | da | canonical, sitemap și robots arată spre domeniul implicit |
| `NEXT_PUBLIC_SUPABASE_URL` | da | nu se salvează niciun lead |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | da | idem |
| `SUPABASE_SERVICE_ROLE_KEY` | da | insert-ul de pe server |
| `ADMIN_EMAILS` | **da în producție** | fără listă, orice cont creat pe proiectul Supabase ar vedea toate lead-urile — panoul se blochează intenționat |
| `RESEND_API_KEY` | da | nu pleacă emailuri de notificare |
| `LEAD_NOTIFICATION_EMAIL` | da | nu se știe cui se trimit lead-urile |
| `RESEND_FROM_EMAIL` | da | dacă domeniul nu e verificat în Resend, nu pleacă nimic |
| `CRON_SECRET` | **da în producție** | sonda zilnică refuză apelurile cron-ului, Supabase adoarme după o săptămână |
| `NEXT_PUBLIC_PHONE_VIDEO` | nu | butoanele de telefon de pe /video folosesc numărul din `contact.ts` |
| `NEXT_PUBLIC_PHONE_SOFTWARE` | nu | butoanele de telefon de pe /software folosesc numărul din `contact.ts` |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | **da la lansare** | butoanele de WhatsApp duc la un număr inexistent |
| `NEXT_PUBLIC_EMAIL_VIDEO` | da la lansare | adresa din subsolul video rămâne cea implicită |
| `NEXT_PUBLIC_EMAIL_SOFTWARE` | da la lansare | idem, pe software |
| `NEXT_PUBLIC_INSTAGRAM` | nu | dispare din structured data (`sameAs`) |

Cât timp lipsesc datele de contact, subsolul scrie explicit că sunt placeholder. Completează-le și nota dispare singură — nu e nimic de editat în cod.

## Ce e placeholder și trebuie înlocuit

| Ce | Unde | Cum se vede că e placeholder |
|---|---|---|
| Texte legale | `app/[locale]/(legal)/legal/_content/documents.ts` | notă vizibilă sus pe fiecare pagină: **nevalidat juridic** |
| Datele firmei (denumire, CUI, reg. com., sediu) | același fișier, `COMPANY_PLACEHOLDER` | `[DENUMIRE SRL]` + badge PLACEHOLDER |
| Telefon, WhatsApp, adrese de email | variabilele de mediu de mai sus | notă în subsol până se completează env-ul |
| Testimoniale | `components/site/video-content.ts`, `software-content.ts` | `isPlaceholder: true` |
| Cifrele de capabilitate | `CAPABILITY_STATS` | `isPlaceholder: true` |
| Plăcile media din hero și din secțiunea de servicii | `MediaFrame` în `components/site/ui.tsx` | badge **exemplu** pe placă; butonul de redare e inert până intră materialul real |
| Afirmații despre programele de finanțare | `software-content.ts` | comentarii `TODO: verificat juridic` |
| Logo | `components/site/mark.tsx` | marcă redesenată vectorial după `public/brand/meridian-logo.jpeg` |

Lista de lansare completă e în `PLAN.md`.
