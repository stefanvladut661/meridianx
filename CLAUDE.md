# CLAUDE.md — MERIDIAN

Acest fișier se încarcă automat în fiecare sesiune Claude Code, în fiecare terminal. Citește-l integral înainte de orice acțiune. Dacă ceva din promptul tău de fază contrazice acest fișier, **acest fișier câștigă**, cu excepția cazului în care omul spune explicit altfel.

---

## 1. Ce construim

Site pentru agenția **MERIDIAN**, cu două divizii care se adresează unor clienți complet diferiți:

- **VIDEO** — producție video comercială + management campanii. Clienți: imobiliare, corporate, evenimente, personal brands, industrial (CNC/HVAC). Buget țintă 3–10k €.
- **SOFTWARE** — web și aplicații la comandă. Clienți: IMM-uri care se modernizează, **firme cu fonduri de modernizare (prioritate #1)**, corporate cu sisteme interne. Buget țintă 5–15k €, deschidere până la 60k €.

Un singur Next.js app: `meridianagency.ro` cu `/video` și `/software`, gateway split-screen la rădăcină.

**Site-ul e un instrument de vânzare, nu un portofoliu.** Video optimizează pentru impact. Software optimizează pentru conversie și încredere.

---

## 2. Regula #1 — cele două lumi nu se amestecă

Un vizitator care trece de la `/video` la `/software` trebuie să simtă că a schimbat clădirea, nu camera.

| | VIDEO | SOFTWARE |
|---|---|---|
| Concept | Temperatura culorii — tungsten vs daylight | Instrument de precizie — blueprint, coordonate |
| Fundal | `#08090C` | `#060A12` |
| Accente | `#FF8C3B` cald / `#43C9E0` rece | `#4C7DFF` semnal / `#D9A441` date |
| Text | `#EDE8E0` (bone, nu alb pur) | `#DEE5F0` |
| Display | Clash Display / Archivo Expanded | Satoshi Variable |
| Mono | JetBrains Mono (timecode, specificații) | IBM Plex Mono (date, coordonate) |
| Motion | **Maxim** — Lenis, GSAP, cursor reticul, page-load cu obturator | **Mediu, rapid** — reveals, contoare, SVG care se desenează |
| Scroll | Lenis smooth | Nativ, rapid |
| Cursor | Custom (reticul de focus) | Standard |
| Durată animații | Generoasă, orchestrată | Sub 400ms, mereu |
| Signature | HUD de cameră cu timecode legat de scroll | Linie meridian verticală cu gradații de latitudine |

**Interzis:** să folosești cursor custom pe software. Să folosești Lenis pe software. Să pui accente calde pe software. Să faci video-ul să arate corporate. Să împrumuți o componentă vizuală dintr-o lume în alta „ca să fie consecvent" — nu vrem consecvență între lumi, vrem consecvență în interiorul fiecăreia.

**Firul comun:** logo, scara de spacing (4px), radius, și motivul arcului de meridian — care în video e un arc de lumină, iar în software o geodezică pe grilă.

---

## 3. Anti-generic — cel mai important punct

Omul plătește pentru un site care nu poate fi confundat cu al altcuiva. Înainte să scrii o secțiune, întreabă-te: **asta ar ieși la fel dacă briefu-ar fi fost pentru orice altă agenție?** Dacă da, refă-o.

**Nu folosi, decât dacă sunt cu adevărat cea mai bună soluție:**
- Fundal crem `#F4F1EA` cu serif de contrast mare și accent terracotta `#D97757`
- Negru cu un singur accent verde-acid sau vermilion
- Layout tip broadsheet cu linii hairline și zero border-radius
- Hero cu „cifră mare + label mic + trei statistici + gradient"
- Card-uri identice de 3 pe rând cu iconiță Lucide sus, titlu, două rânduri de text
- Numerotare 01/02/03 acolo unde conținutul **nu** e o secvență reală (pe `/proces` e legitimă — acolo chiar e o secvență)
- Gradient mesh violet-albastru
- „Soluții inovatoare", „experiență de neuitat", „partenerul tău de încredere"

**Structura codifică informație, nu decorează.** Un eyebrow, un divider, o etichetă trebuie să spună ceva adevărat despre conținut.

**Cheltuiește îndrăzneala într-un singur loc per pagină.** Signature-ul e elementul memorabil; restul stă cuminte. Regula Chanel: înainte să ieși din casă, uită-te în oglindă și scoate un accesoriu.

**Riscul de a nu risca e real.** Pe divizia video, mai ales, un design „curat și sigur" e un eșec. Trebuie să fie aproape inconfortabil de îndrăzneț — clientul de video cumpără cu ochii, iar site-ul e prima ta demonstrație.

---

## 4. Copy-ul e material de design

- **Româna e limba sursă.** Scrii în română, natural, nu traduci din engleză. EN se adaptează, nu se traduce literal.
- Verbe active. Propoziții scurte. Specific bate deștept.
- Numește lucrurile cum le înțelege omul, nu cum sunt construite.
- Un buton spune exact ce se întâmplă: „Cere ofertă", nu „Trimite". Iar confirmarea zice „Ofertă cerută" — același vocabular pe tot parcursul.
- Erorile nu se scuză și nu sunt vagi: spun ce s-a întâmplat și ce să faci.
- Ecranele goale sunt o invitație la acțiune, nu „Nu există date".
- **Ton video:** direct, sigur pe el, puțin obraznic. **Ton software:** competent, calm, precis. Aceeași agenție, două voci.

---

## 5. Conținut placeholder — nu minți

Nu există încă portofoliu, testimoniale sau logo-uri de clienți reali.

- Fiecare item de conținut fals are `isPlaceholder: true` în `content/`
- Nu inventa nume de clienți reali, cifre de rezultat sau citate atribuite
- Nu inventa detalii legislative despre programele de finanțare — dacă nu ești sigur, marchează cu `// TODO: verificat juridic`
- Copy-ul de brand (headline-uri, descrieri de servicii, propuneri de valoare) îl scrii tu, complet — acela nu e placeholder
- Video-urile: structura acceptă `<video>` local cu poster obligatoriu; folosește poster placeholder marcat

---

## 6. Disciplina pe terminale paralele

Rulează 6 faze simultan, în terminale separate. **Conflictele se previn prin proprietate strictă asupra fișierelor.**

| Fază | Zona ta | Model |
|---|---|---|
| 0 | tot (rulează singură, prima) | Opus |
| 1 | `app/(gateway)/`, `components/shell/`, `components/gateway/` | Opus |
| 2 | `app/(video)/video/{,servicii,portofoliu,proces}/`, `content/video/`, `components/video/` | Opus |
| 3 | `app/(video)/video/{reclame,contact}/`, `components/video/forms/`, `components/video/cta/` | Sonnet |
| 4 | `app/(software)/software/{,servicii,fonduri,proiecte,proces}/`, `content/software/`, `components/software/` | Opus |
| 5 | `app/(software)/software/brief/`, `components/software/forms/`, `components/software/estimator/` | Sonnet |
| 6 | `app/api/`, `app/(admin)/`, `lib/supabase/`, `lib/email/`, `emails/` | Sonnet |
| 7 | `messages/`, `app/(legal)/`, `sitemap`, `robots` + edituri punctuale (rulează ultima) | Sonnet |

**Reguli de aur:**

1. **Nu atinge niciun fișier din afara zonei tale.** Nici măcar o corectură mică. Dacă vezi un bug în zona altcuiva, notează-l în `PLAN.md` la secțiunea „Observații între faze" și mergi mai departe.
2. **Fișierele partajate sunt înghețate** după FAZA 0: `app/globals.css`, `tailwind.config`, `components/ui/`, `content/types.ts`, `lib/utils.ts`. Ai nevoie de o modificare acolo? Notează în `PLAN.md`, nu edita.
3. **Contractele din FAZA 0 sunt lege.** API-ul, tipurile și tokens-urile există deja. Presupune că funcționează, construiește pe ele, nu le redefini local.
4. **Fiecare fază pe branch propriu:** `faza-N-nume`. Commit-uri mici, mesaje care descriu livrabilul.
5. **Nu instala pachete noi** fără să le notezi în `PLAN.md`. Două terminale care adaugă dependențe simultan strică lockfile-ul.
6. Ai nevoie de o componentă care nu există și nu e a ta? **Construiește-o local în zona ta.** Deduplicarea o facem la FAZA 7. Duplicarea temporară e mai ieftină decât un conflict de merge.

---

## 7. Quality floor — nu se negociază, nu se anunță

- Responsive real la 360, 768, 1024, 1440, 1920. 360 nu e opțional.
- `prefers-reduced-motion` respectat integral. Sub el, pagina rămâne **complet** funcțională și frumoasă — nu doar „fără animații".
- Navigare completă la tastatură, focus vizibil, skip link, focus trap în modale.
- Contrast minim AA pe ambele palete. Verifică, nu presupune.
- `alt` real la imagini, nu „image".
- LCP sub 2.5s pe 4G simulat. Librăriile de animație se încarcă lazy.
- Zero erori de hidratare. Zero erori TypeScript. `strict: true`.
- Video-urile nu pornesc niciodată cu sunet. Poster obligatoriu.

---

## 8. Formulare și lead-uri

Toate formularele:
- Validare Zod pe client **și** pe server
- POST la `/api/leads` cu `division` corect
- Capturează UTM-uri din sessionStorage
- Honeypot + rate limiting
- Stări de loading, succes și eroare distincte și utile
- Anunț pentru cititoare de ecran la trimitere

**Diferența de comportament între divizii:** clientul de video decide rapid și preferă vocea — WhatsApp și click-to-call trebuie să fie la fel de proeminente ca formularul, nu ascunse sub „alte metode de contact". Clientul de software compară și decide lent — brief-ul multi-step, estimatorul și discovery call-ul sunt căile principale.

---

## 9. Înainte să scrii cod

1. Citește promptul fazei tale integral.
2. Fă un plan scurt: ce secțiuni, ce componente, ce signature vizual pentru zona ta.
3. **Critică-ți planul:** dacă aș primi acest brief pentru altă agenție, aș ajunge în același loc? Dacă da, schimbă partea aia și spune ce ai schimbat și de ce.
4. Abia apoi construiește, urmând planul revizuit.
5. Critică din nou la final. Fă screenshot dacă poți — o imagine face cât 1000 de tokeni.

---

## 10. Definiția de „gata"

- [ ] Build fără erori TS sau ESLint
- [ ] Toate rutele din zona ta se randează, zero erori de hidratare
- [ ] Responsive verificat la toate breakpoint-urile
- [ ] `prefers-reduced-motion` testat
- [ ] Tastatură + focus vizibil peste tot
- [ ] Zero fișiere modificate în afara zonei tale
- [ ] Placeholder-ele marcate explicit
- [ ] `PLAN.md` actualizat: ce ai terminat, ce ai observat, ce ai nevoie de la alte faze
- [ ] Commit pe branch propriu

---

## 11. Când să te oprești și să întrebi

- Trebuie să modifici un fișier partajat sau din zona altcuiva
- Contractul din FAZA 0 nu acoperă cazul tău
- Trebuie să adaugi o dependență majoră
- Ai nevoie de o afirmație legală, financiară sau despre programe de finanțare de care nu ești sigur
- Direcția de design a fazei tale ți se pare că intră în conflict cu cealaltă divizie

Notează în `PLAN.md` și continuă cu restul, nu bloca terminalul.
