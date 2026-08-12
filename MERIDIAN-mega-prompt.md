# MERIDIAN — Mega-prompt pentru Claude Code

> **Cum folosești acest document:** FAZA 0 se rulează singură, într-un singur terminal, până la capăt. După ce e gata și commit-uită, deschizi 6 terminale și rulezi Fazele 1–6 în paralel. FAZA 7 se rulează la final, singură. Fiecare fază are propriul prompt de start, propriile fișiere și propriul model recomandat.

---

## PARTEA I — CONTEXT COMUN
*(Copiază această parte la începutul fiecărui prompt de fază. E context obligatoriu pentru toate.)*

### Brandul

**MERIDIAN** este o agenție cu două divizii care se adresează unor clienți complet diferiți:

- **MERIDIAN VIDEO** — producție video comercială + management campanii de publicitate
- **MERIDIAN SOFTWARE** — dezvoltare web și aplicații la comandă

Numele vine de la meridian: linia de referință, punctul zero față de care se măsoară tot. Acest concept este firul care leagă vizual cele două lumi — **arcul, linia, coordonatele** — dar se exprimă radical diferit pe fiecare divizie (detalii în Partea II).

**Logo:** vezi fișierul atașat / referința din repo. Extrage paleta din el și verifică lizibilitatea pe fundal închis. Dacă logo-ul e monocrom, construiește variantele necesare (light, dark, mark-only pentru favicon).

**Domeniu:** meridianagency.ro

**Tagline** — alege una dintre variantele de mai jos și folosește-o consecvent, sau propune una mai bună dacă ai o idee clară:

1. „Punctul zero al creșterii tale." / *"Your growth starts here."*
2. „Imagine. Infrastructură. Rezultate." / *"Image. Infrastructure. Results."*
3. „Traversăm distanța dintre idee și piață." / *"We close the distance between idea and market."*
4. „Linia care leagă brandul de rezultat." / *"The line between brand and result."*
5. „Filmăm. Construim. Scalăm." / *"We film. We build. We scale."*

### Publicul țintă

**Video** — imobiliare și dezvoltatori, corporate, evenimente, personal brands, industrial (CNC, HVAC, producție). Portofoliul existent e puternic pe HoReCa, dar poziționarea trebuie să tragă spre segmentele de mai sus. Buget țintă: 3.000–10.000 €, cu deschidere peste.

**Software** — IMM-uri care își modernizează prezența digitală și, **prioritate absolută**, firme care au obținut fonduri de modernizare/digitalizare și trebuie să le cheltuie pe soluții software. Secundar: corporate cu nevoi de sisteme interne. Buget țintă: 5.000–15.000 €, cu deschidere până la 60.000 €.

Segmentul „fonduri de modernizare" e cel mai valoros și trebuie să aibă tratament dedicat pe partea de software: aceste firme au buget alocat, deadline de decontare și nevoie de documentație. Vorbește limba lor.

### Obiectivul de business

Site-ul e un instrument de vânzare, nu un portofoliu. Fiecare pagină trebuie să ducă spre un lead calificat. Partea de software optimizează pentru **conversie și încredere**. Partea de video optimizează pentru **impact și memorabilitate** — clientul de video cumpără cu ochii, iar site-ul e prima demonstrație a ce știi să faci.

### Stack tehnic

```
Next.js 15 (App Router) + TypeScript strict
Tailwind CSS v4
GSAP + ScrollTrigger + Lenis (doar unde e nevoie, vezi per-fază)
Supabase (Postgres + Auth) pentru lead-uri și admin
Resend pentru email transacțional
next-intl pentru i18n (RO default, EN secundar)
Vercel pentru deploy
```

Fără CMS în această iterație. Tot conținutul stă în fișiere TypeScript tipate în `content/`, structurate astfel încât migrarea ulterioară spre un CMS să fie trivială.

### Reguli globale, non-negociabile

1. **Nu inventa conținut de portofoliu ca și cum ar fi real.** Toate proiectele, testimonialele și logo-urile de clienți sunt placeholder-e marcate clar în cod (`isPlaceholder: true`). Copy-ul general de brand îl scrii tu, complet.
2. **RO e limba primară.** Scrie copy-ul întâi în română, natural, nu tradus din engleză. EN vine după.
3. **Quality floor**, fără să-l anunți: responsive până la 360px, focus vizibil la tastatură, `prefers-reduced-motion` respectat integral, contrast minim AA, imagini cu `alt` real.
4. **Performanță:** LCP sub 2.5s pe 4G simulat. Video-urile nu se autoplay-ează cu sunet, niciodată. Poster image obligatoriu. `next/image` peste tot.
5. **Nu depăși granițele fazei tale.** Fișierele din afara listei tale sunt proprietatea altei faze care rulează în paralel. Dacă ai nevoie de ceva de acolo, presupune contractul definit în FAZA 0 și mergi mai departe.
6. **Copy-ul e material de design.** Fără filler, fără „soluții inovatoare pentru afacerea ta". Verbe active, propoziții scurte, specific în loc de deștept.

---

## PARTEA II — DIRECȚIA DE DESIGN

Ambele lumi sunt dark. Aici se termină asemănarea. Un vizitator care trece dintr-o parte în alta trebuie să simtă că a schimbat clădirea, nu camera.

### Lumea VIDEO — „Temperatura culorii"

Ancoră conceptuală: vocabularul vizual al platoului de filmare. Nu „film" ca metaforă generică, ci instrumentele reale — temperatura culorii, timecode, expunere, focus.

**Tensiunea centrală a paletei este tungsten vs. daylight** — cei doi poli ai balansului de alb, 3200K și 5600K. Fiecare secțiune înclină spre unul dintre ei. Acesta e signature-ul cromatic și vine direct din lumea subiectului, nu dintr-un generator de palete.

```
--v-void:      #08090C   /* platou nelimunat */
--v-surface:   #101319
--v-tungsten:  #FF8C3B   /* 3200K, cald */
--v-daylight:  #43C9E0   /* 5600K, rece */
--v-bone:      #EDE8E0   /* text principal, nu alb pur */
--v-dim:       #6B6F78
```

**Tipografie:** display cu personalitate puternică, folosit la dimensiuni mari și tracking strâns — Clash Display sau Archivo Expanded variable (axa de lățime e importantă, o folosești). Body: Switzer sau General Sans. Utility: JetBrains Mono, exclusiv pentru timecode, durate, specificații tehnice — nu ca decor.

**Signature element:** un HUD de cameră persistent peste toată divizia video. Colțuri de cadru subțiri fixate în viewport, un indicator REC discret, și un timecode care avansează în funcție de poziția de scroll (nu de timp — de scroll; asta e detaliul care face diferența). Accentul cromatic al HUD-ului migrează de la tungsten la daylight pe măsură ce cobori în pagină.

**Motion — maxim.** Aici cheltuiești tot bugetul de animație:
- Secvență de page-load tip obturator care se deschide (o dată per sesiune, cookie)
- Lenis pentru smooth scroll pe toată divizia
- Reel orizontal scroll-driven în portofoliu
- Cursor custom care devine reticul de focus peste thumbnail-uri video, cu efect de focus-pull la hover
- Tranziții de pagină cu View Transitions API
- Text care intră pe cuvinte, nu pe blocuri

Riscul asumat aici: pagina trebuie să fie aproape inconfortabil de îndrăzneață. Un client care caută video corporate trebuie să simtă că a nimerit la cineva mai bun decât ce a văzut până acum.

### Lumea SOFTWARE — „Instrumentul de precizie"

Ancoră conceptuală: meridianul ca instrument de navigație și măsurare. Blueprint, grilă de coordonate, gradații, precizie. Corporate, dar nu plictisitor — corporate în sensul în care un instrument bine făcut e frumos.

```
--s-ink:       #060A12   /* fundal */
--s-panel:     #0D1421
--s-grid:      #1A2536   /* linii de blueprint */
--s-signal:    #4C7DFF   /* primar, acțiune */
--s-data:      #D9A441   /* cifre, metrici, evidențiere */
--s-paper:     #DEE5F0   /* text */
--s-muted:     #7C8798
```

**Tipografie:** Satoshi variable pentru display și body (corporate fără să fie Inter, care e default-ul tuturor), IBM Plex Mono pentru date, coordonate, cifre și etichete tehnice. Scara de tipuri strictă, disciplinată — aici precizia spațierii e tot.

**Signature element:** o linie meridian verticală fixă în marginea stângă, cu gradații tip latitudine care marchează secțiunile paginii și indică unde te afli. Se comportă ca un instrument de măsură, nu ca un progress bar decorativ. Diagramele și schemele de arhitectură se desenează singure la scroll (SVG stroke-dashoffset).

**Motion — mediu, rapid, disciplinat.** Reveals la scroll, contoare care numără, diagrame care se trasează, micro-interacțiuni pe controale. **Fără** cursor custom, **fără** smooth scroll (scroll nativ, rapid), **fără** tranziții lungi. Nimic nu întârzie accesul la informație sau la CTA. Fiecare animație sub 400ms.

### Firul comun

Arcul de meridian apare în ambele lumi, dar înseamnă altceva: în video e un arc de lumină care mătură cadrul; în software e o geodezică precisă pe o grilă de coordonate. Logo-ul, spacing-ul de bază (scară 4px), și radius-ul sunt identice. Restul diferă.

---

## PARTEA III — HARTA SITE-ULUI

```
/                           Gateway split-screen
/video                      Home divizie video
/video/servicii
/video/portofoliu
/video/reclame              Management campanii (pagină dedicată)
/video/proces
/video/contact
/software                   Home divizie software
/software/servicii
/software/fonduri           Landing dedicat firmelor cu fonduri de modernizare
/software/proiecte
/software/proces
/software/brief             Formular multi-step + estimator
/admin                      Dashboard lead-uri (protejat)
/legal/confidentialitate
/legal/termeni
/legal/cookies
```

Toate rutele publice există în `/ro` și `/en`. RO e default fără prefix vizibil sau cu prefix — decizi în FAZA 0, dar fii consecvent.

---

## PARTEA IV — FAZELE

### Tabel de execuție

| Fază | Ce construiește | Model | Rulează |
|---|---|---|---|
| 0 | Fundație, tokens, contracte, schema DB | **Opus** | Singură, prima |
| 1 | Gateway + shell global | **Opus** | Paralel |
| 2 | Video: home, servicii, portofoliu, proces | **Opus** | Paralel |
| 3 | Video: reclame + funnel video | **Sonnet** | Paralel |
| 4 | Software: home, servicii, fonduri, proiecte, proces | **Opus** | Paralel |
| 5 | Software: brief multi-step + estimator | **Sonnet** | Paralel |
| 6 | Backend, API, admin dashboard, email | **Sonnet** | Paralel |
| 7 | i18n, SEO, legal, performanță, audit final | **Sonnet** | Singură, ultima |

**Git:** fiecare fază pe branch propriu (`faza-1-gateway`, `faza-2-video-core`, etc.), merge în `main` pe măsură ce sunt gata. Fazele nu ating fișiere din afara zonei lor, deci conflictele ar trebui să fie zero.

---

## FAZA 0 — Fundație
**Model: Opus. Rulează singură. Blochează tot restul.**

> Ești la începutul proiectului MERIDIAN. [Lipește Partea I + Partea II + Partea III aici.]
>
> Construiește fundația pe care 6 echipe vor lucra în paralel. Nu construi nicio pagină. Sarcina ta e să faci imposibil ca fazele următoare să intre în conflict sau să diverge stilistic.
>
> **Livrabile:**
>
> 1. Proiect Next.js 15 + TypeScript strict + Tailwind v4, structurat cu route groups `(gateway)`, `(video)`, `(software)`, `(admin)`.
> 2. **Design tokens** în `app/globals.css` ca CSS custom properties, cu cele două seturi complete (`--v-*` și `--s-*`) plus scara comună de spacing, radius, shadow, z-index. Mapate în configul Tailwind ca utilități semantice.
> 3. **Fonturi** încărcate prin `next/font/local` sau Fontshare, cu fallback-uri și `font-display: swap`.
> 4. **Primitive partajate** în `components/ui/`: Button (variante per divizie), Input, Textarea, Select, Label, Field cu stare de eroare, Dialog, Toast, Container, Section. Neutre stilistic, colorate prin tokens moștenite de la părinte.
> 5. **Contractul de conținut** în `content/types.ts` — tipuri pentru Service, Project, Testimonial, ProcessStep, FAQItem, TeamMember. Fiecare cu câmp `isPlaceholder`. Plus fișiere goale schelet în `content/video/` și `content/software/` pe care fazele le vor umple.
> 6. **Schema Supabase** în `supabase/migrations/`:
>    - `leads`: id, created_at, division (enum video|software), source, locale, name, email, phone, company, project_type, budget_range, timeline, message, status (enum new|contacted|qualified|proposal|won|lost), utm_source, utm_medium, utm_campaign, referrer
>    - `lead_events`: id, lead_id FK, type, payload jsonb, created_at
>    - RLS: insert public prin service role în API route, select doar pentru utilizatori autentificați
> 7. **Contractul API** — semnăturile route handler-elor în `app/api/`, cu implementare stub care validează Zod și returnează 200. Fazele 3, 5, 6 se bazează pe ele.
> 8. **i18n scaffold** cu next-intl: middleware, `messages/ro.json`, `messages/en.json` cu structura de chei pe namespace-uri (`common`, `nav`, `gateway`, `video`, `software`, `forms`, `legal`).
> 9. **Utilitare:** hook `useReducedMotion`, helper `cn()`, wrapper `<Reveal>` pentru animații de intrare care respectă reduced-motion, hook de cookie pentru preferința de divizie.
> 10. **README** cu harta fișierelor și tabelul de proprietate pe faze.
>
> Înainte să scrii cod, prezintă-mi planul de tokens și de tipografie și așteaptă confirmarea. După asta, construiește tot.

---

## FAZA 1 — Gateway și shell global
**Model: Opus. Paralel.**
**Proprietate:** `app/(gateway)/`, `components/shell/`, `components/gateway/`

> [Partea I + II + III]
>
> Construiești prima impresie și scheletul care înconjoară ambele divizii.
>
> **Gateway (`/`)** — split-screen vertical, VIDEO stânga, SOFTWARE dreapta. Arcul de meridian traversează cusătura dintre ele. La hover, jumătatea activă se extinde și își dezvăluie lumea: partea video prinde viață cu mișcare și temperatură de culoare, partea software se dezvăluie ca un instrument care se calibrează. Pe mobil devine două panouri stivuite, la fel de puternice.
>
> Alegerea se salvează în cookie (`meridian_division`, 90 zile). La revenire, redirect automat spre divizia aleasă — dar cu un „Vezi ambele divizii" discret în nav care întoarce la gateway și șterge cookie-ul. Nu face redirect-ul brutal: dacă vine dintr-un link direct, respectă linkul.
>
> **Shell** — două header-e distincte care împart aceeași structură logică:
> - Header video: minimal, aproape invizibil peste conținut, se condensează la scroll, HUD-ul de cameră integrat
> - Header software: solid, sticky, cu CTA permanent vizibil („Cere ofertă") și indicator de secțiune
> - Ambele: comutator de divizie clar dar nu strident, switch de limbă RO/EN, meniu mobil complet
>
> **Footer** — unul singur, adaptiv cromatic după divizie. Conține: contact, cele două divizii, link-uri legale, ANPC SAL și SOL (obligatoriu legal în România), social.
>
> Nu construi pagini de divizie. Doar gateway, header-e, footer, meniu mobil, tranziții între divizii.

---

## FAZA 2 — Video: paginile principale
**Model: Opus. Paralel.**
**Proprietate:** `app/(video)/video/`, `app/(video)/video/servicii/`, `app/(video)/video/portofoliu/`, `app/(video)/video/proces/`, `content/video/`, `components/video/`

> [Partea I + II + III]
>
> Construiești inima diviziei video. Aceste pagini sunt demonstrația abilității — un client care le vede trebuie să nu mai aibă nevoie să vadă showreel-ul ca să sune.
>
> **`/video` — home.** Hero-ul e teza. Deschide cu cel mai caracteristic lucru din lumea producției video, în forma care servește cel mai bine — nu cu „Producție video profesională" peste un video cu overlay negru. Portofoliul e placeholder (fișiere locale, încă inexistente), deci construiește sistemul astfel încât să accepte `<video>` local cu poster, și folosește poster-e generate/placeholder marcate clar. Secțiuni: hero, segmentele deservite (imobiliare, corporate, evenimente, personal brand, industrial — fiecare cu propria promisiune, nu o listă de bife), showreel, dovezi sociale placeholder, punte spre pagina de reclame, CTA final.
>
> **`/video/servicii`.** Filmare comercială, editare, conținut UGC pentru social, dronă. Fiecare serviciu explicat prin ce obține clientul, nu prin ce echipament ai. Include ce livrezi concret (formate, durate, drepturi de utilizare) — asta calmează clientul corporate.
>
> **`/video/portofoliu`.** Reel scroll-driven orizontal. Filtrare pe segment. Fiecare proiect deschide un case study scurt în overlay: contextul, ce am filmat, rezultatul. Toate placeholder, structurate să fie înlocuite cu un singur commit.
>
> **`/video/proces`.** De la brief la livrare. Aici numerotarea 01/02/03 chiar are sens, pentru că e o secvență reală — folosește-o, dar fă-o să arate ca marcaje de peliculă, nu ca un template.
>
> **Motion:** aici e maximul. Lenis, GSAP ScrollTrigger, cursor reticul, page-load cu obturator, HUD cu timecode legat de scroll. Fiecare animație trebuie să dispară complet sub `prefers-reduced-motion`, iar pagina să rămână perfect utilizabilă.
>
> Nu atinge pagina de reclame și nu construi formulare — sunt FAZA 3.

---

## FAZA 3 — Video: reclame și funnel
**Model: Sonnet. Paralel.**
**Proprietate:** `app/(video)/video/reclame/`, `app/(video)/video/contact/`, `components/video/forms/`, `components/video/cta/`

> [Partea I + II + III]
>
> Construiești pagina de management campanii și tot ce transformă un vizitator video în lead.
>
> **`/video/reclame`** — serviciu separat, cu pagină proprie. Meta, Google, TikTok, LinkedIn. Poziționarea: producem creativul *și* îl distribuim — asta e avantajul față de o agenție care doar cumpără media sau doar filmează. Structura: problema (creative fatigue, cost per rezultat în creștere), ce facem diferit, platformele, ce raportăm și cât de des, pachetul combinat producție + distribuție, CTA spre audit gratuit.
>
> **Lead magnet:** audit gratuit de campanii. Formular scurt: nume, telefon, ce platforme rulează acum, buget lunar aproximativ. Trei câmpuri obligatorii maxim.
>
> **Căile de contact — toate active și vizibile:**
> - Formular scurt (nume, telefon, tip proiect, buget orientativ)
> - WhatsApp cu mesaj pre-completat contextual (diferit de pe pagina de reclame față de portofoliu)
> - Click-to-call
> - Programare call (Cal.com embed)
> - Link Instagram DM
>
> Clientul de video decide rapid și preferă vocea. Fă butonul de telefon și WhatsApp la fel de proeminente ca formularul — nu le ascunde sub „alte metode de contact".
>
> **`/video/contact`** — toate căile de mai sus într-un singur loc, plus locație și program.
>
> Toate formularele fac POST la `/api/leads` cu `division: "video"`, capturează UTM-urile din sessionStorage, validează cu Zod, arată stări de loading și eroare care spun ce s-a întâmplat și ce să facă utilizatorul. Confirmare care nu apologizează și nu e vagă.

---

## FAZA 4 — Software: paginile principale
**Model: Opus. Paralel.**
**Proprietate:** `app/(software)/software/`, subrutele `servicii`, `fonduri`, `proiecte`, `proces`, `content/software/`, `components/software/`

> [Partea I + II + III]
>
> Construiești divizia care trebuie să convertească cel mai bine. Publicul e diferit de cel video: decide mai lent, compară, are nevoie de dovezi și de siguranță. Fiecare pagină trebuie să reducă riscul perceput.
>
> **`/software` — home.** Hero-ul comunică competență și rezultat, nu creativitate. Secțiuni: propunerea de valoare, ce construim (site-uri de prezentare, landing pages, eCommerce, aplicații web la comandă, aplicații mobile, automatizări și integrări AI, mentenanță, SEO — cu accent pe aplicații la comandă, acolo e bugetul mare), pentru cine, semnale de încredere, cum lucrăm pe scurt, punte spre `/fonduri`, CTA spre brief.
>
> **`/software/fonduri` — pagina cea mai importantă a diviziei.** Landing dedicat firmelor care au obținut fonduri de modernizare sau digitalizare. Acești clienți au buget alocat, deadline de decontare și nevoie de documentație corectă. Ce trebuie să conțină: care sunt liniile de finanțare relevante (scrise generic, verificabile, fără să inventezi programe sau sume), ce livrăm și cum se încadrează în cheltuieli eligibile, ce documente furnizăm pentru decontare, timeline-ul raportat la termenele lor, un CTA de calificare separat de restul site-ului. Tonul: consultant care a mai făcut asta, nu vânzător. Dacă nu ești sigur de un detaliu legislativ, scrie-l ca placeholder marcat, nu inventa.
>
> **`/software/servicii`.** Fiecare serviciu cu: pentru cine e, ce include, ce tehnologii, cât durează orientativ, ce primești la final. Fără prețuri.
>
> **`/software/proiecte`.** Studii de caz structurate: context, provocare, soluție, rezultat măsurabil. Toate placeholder, dar cu structura completă și cu locuri clare pentru metrici.
>
> **`/software/proces`.** Descoperire, propunere, design, dezvoltare, lansare, mentenanță. Fiecare etapă cu ce faci tu și ce se cere de la client — asta e detaliul care liniștește un IMM care n-a mai lucrat cu o agenție.
>
> **Motion:** mediu și rapid. Reveals, contoare, diagrame SVG care se desenează. Linia meridian cu gradații în marginea stângă. Scroll nativ, fără Lenis. Nimic peste 400ms. Nu împrumuta nimic din vocabularul vizual al diviziei video.
>
> Nu construi formularul de brief — e FAZA 5.

---

## FAZA 5 — Software: brief și estimator
**Model: Sonnet. Paralel.**
**Proprietate:** `app/(software)/software/brief/`, `components/software/forms/`, `components/software/estimator/`

> [Partea I + II + III]
>
> Construiești mecanismul de calificare al diviziei software. Scopul nu e să colectezi cât mai multe lead-uri, ci să separi clientul de 15.000 € de cel care caută un site de 300 €, fără să-l jignești pe niciunul.
>
> **`/software/brief` — formular multi-step.** 4–5 pași, o întrebare majoră per pas, progres vizibil, navigare înapoi fără pierderea datelor, state persistat în sessionStorage. Structura:
> 1. Tipul proiectului (site de prezentare / eCommerce / aplicație web la comandă / aplicație mobilă / automatizare-AI / altceva)
> 2. Contextul — descrie pe scurt ce vrei să rezolvi
> 3. Buget orientativ, în intervale. Include explicit un interval peste 15.000 € și unul „nu știu încă". Formulează întrebarea în așa fel încât să nu pară filtru: „Ne ajută să propunem o soluție realistă."
> 4. Termen dorit + dacă e finanțat din fonduri (checkbox care, dacă e bifat, deschide un câmp pentru linia de finanțare și deadline-ul de decontare)
> 5. Date de contact
>
> **Estimator de preț** — instrument separat, poate fi integrat în pasul 1–2 sau standalone. Utilizatorul își compune proiectul din opțiuni (tip, număr de pagini/ecrane, funcționalități, integrări, multilingv, mentenanță) și primește un **interval**, nu un preț. Afișează întotdeauna „estimare orientativă, prețul final se stabilește după discuție". Logica de calcul o definești tu, într-un fișier de config ușor de ajustat (`lib/estimator-config.ts`). Nu afișa prețuri pe restul site-ului — estimatorul e singura excepție și e explicit un instrument, nu un tarif.
>
> **Programare discovery call** — Cal.com embed, disponibil ca alternativă la formular pentru cine preferă să vorbească direct.
>
> **Lead magnete:** ghid PDF descărcabil (gated cu email) și consultanță gratuită 30 min. Structura de download o construiești; PDF-ul e placeholder.
>
> POST la `/api/leads` cu `division: "software"`, payload complet inclusiv răspunsurile la fiecare pas în `lead_events`. Validare Zod, stări de eroare utile, protecție anti-spam (honeypot + rate limit).

---

## FAZA 6 — Backend, API și admin dashboard
**Model: Sonnet. Paralel.**
**Proprietate:** `app/api/`, `app/(admin)/admin/`, `lib/supabase/`, `lib/email/`, `emails/`

> [Partea I + II + III]
>
> Construiești infrastructura de lead-uri și panoul de administrare. Fazele 3 și 5 trimit date către tine pe baza contractului definit în FAZA 0 — implementează-l exact.
>
> **API:**
> - `POST /api/leads` — validare Zod, insert în Supabase, creare `lead_event` de tip `created`, trimitere email de notificare, răspuns cu id. Rate limiting pe IP. Honeypot. Nu returna detalii de eroare internă către client.
> - `POST /api/leads/[id]/events` — pentru evenimente ulterioare
> - `GET /api/leads` — protejat, cu filtrare și paginare
> - `PATCH /api/leads/[id]` — actualizare status și note
>
> **Email prin Resend:** notificare către admin la fiecare lead nou, cu toate datele formatate lizibil și un link direct spre lead în dashboard. Subiect care distinge divizia și indică bugetul, ca să se poată prioritiza din inbox. Plus un email de confirmare către client, diferit ca ton pentru video față de software.
>
> **`/admin` — dashboard MVP.** Autentificare Supabase (email + parolă, un singur cont admin la început). Conținut:
> - Listă de lead-uri, cele mai noi primele, cu filtrare pe divizie, status, interval de timp și căutare
> - Indicatori simpli în capul paginii: lead-uri săptămâna asta, split video/software, rată de calificare
> - Panou de detaliu care se deschide lateral: toate datele, istoricul de evenimente, schimbare de status, note libere
> - Export CSV
> - Marcaj vizual pentru lead-urile din segmentul „fonduri" — sunt cele mai valoroase
>
> Design-ul dashboard-ului: funcțional, dens, rapid. Folosește paleta software, dar nu-l trata ca pagină de marketing. E o unealtă de lucru zilnic. Text gol care spune ce să faci, nu „No data available".
>
> Construiește-l astfel încât să poată crește ulterior spre CRM complet: separă clar stratul de date de UI, folosește tipuri partajate.

---

## FAZA 7 — i18n, SEO, legal, performanță
**Model: Sonnet. Rulează ultima, după merge-ul tuturor celorlalte.**
**Proprietate:** `messages/`, `app/(legal)/`, `app/sitemap.ts`, `app/robots.ts`, plus edituri punctuale peste tot

> [Partea I + II + III]
>
> Faci proiectul complet și livrabil. Toate celelalte faze sunt merge-uite în `main`.
>
> 1. **i18n complet.** Extrage toate string-urile hardcodate în `messages/ro.json` și `messages/en.json`. RO e sursa; EN e o adaptare, nu o traducere literală — copy-ul de marketing se rescrie, nu se traduce. Verifică că switch-ul de limbă păstrează ruta curentă. `hreflang` corect.
> 2. **SEO.** Metadata per pagină, Open Graph și Twitter cards cu imagini generate dinamic prin `next/og` — două template-uri, unul per divizie. JSON-LD: Organization, LocalBusiness, Service pentru fiecare serviciu, BreadcrumbList. `sitemap.ts` și `robots.ts`. Canonical URLs.
> 3. **Legal, conform legislației din România.** Politică de confidențialitate GDPR, termeni și condiții, politică de cookie-uri. Banner de cookie-uri cu consimțământ granular (necesare / analitice / marketing) care chiar blochează scripturile până la acceptare. Link-uri ANPC SAL și SOL în footer. Toate textele legale scrise complet, dar marcate cu o notă în README că trebuie validate juridic înainte de lansare.
> 4. **Analytics** — Vercel Analytics plus un wrapper de event tracking pentru conversii, condiționat de consimțământ.
> 5. **Audit de performanță.** Rulează Lighthouse pe rutele principale. Țintă: 90+ pe performanță și 100 pe accesibilitate. Optimizează ce e sub prag: lazy loading pentru librăriile de animație, code splitting, preload la fonturi, dimensiuni de imagine corecte.
> 6. **Audit de accesibilitate.** Navigare completă la tastatură, skip link, landmark-uri, focus trap în modale, anunțuri pentru cititoare de ecran la trimiterea formularelor, verificare de contrast pe ambele palete.
> 7. **Audit de coerență.** Parcurge tot site-ul și verifică: cele două lumi sunt cu adevărat distincte? A migrat ceva dintr-o parte în alta? Copy-ul e consecvent ca voce? Un buton numit „Cere ofertă" produce un mesaj de confirmare care spune „Ofertă cerută"?
> 8. **README final** cu instrucțiuni de deploy, variabilele de mediu necesare, și o listă clară a tot ce e placeholder și trebuie înlocuit cu conținut real.

---

## PARTEA V — VARIABILE DE MEDIU

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
LEAD_NOTIFICATION_EMAIL=
NEXT_PUBLIC_SITE_URL=https://meridianagency.ro
NEXT_PUBLIC_CAL_VIDEO=
NEXT_PUBLIC_CAL_SOFTWARE=
NEXT_PUBLIC_WHATSAPP_NUMBER=
NEXT_PUBLIC_PHONE=
NEXT_PUBLIC_INSTAGRAM=
```

---

## PARTEA VI — DEFINIȚIA DE „GATA" PER FAZĂ

O fază e terminată când:

- [ ] Build-ul trece fără erori TypeScript sau ESLint
- [ ] Toate rutele din zona ta se randează fără erori de hidratare
- [ ] Responsive verificat la 360, 768, 1024, 1440, 1920
- [ ] `prefers-reduced-motion` testat — pagina rămâne complet funcțională
- [ ] Navigare completă la tastatură, focus vizibil peste tot
- [ ] Niciun string hardcodat în afara `content/` sau `messages/` (dacă rulezi înainte de FAZA 7, marchează-le cu `// i18n:`)
- [ ] Niciun fișier modificat în afara zonei tale de proprietate
- [ ] Placeholder-ele sunt marcate explicit, nu prezentate ca reale
- [ ] Commit pe branch-ul propriu, cu mesaj care descrie ce s-a livrat
