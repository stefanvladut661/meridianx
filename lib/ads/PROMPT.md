# Prompt Claude Code — Ads Portal (Meta + TikTok)

*Terminalul 2. Ramura `feat/ads-portal`. Copiază tot de sub linie.*

---

Lucrez în paralel, în două terminale, pe același repo. Tu ești pe ramura **`feat/ads-portal`**. Celălalt terminal lucrează pe `feat/software-page` și modifică pagina publică de software.

**Atingi doar fișierele portalului: `app/admin/ads/**`, `lib/ads/**`, `components/ads/**` și migrarea nouă.** Nu umbla la paginile publice (`app/page.tsx`, `app/video`, `app/software`), la `app/vault`, `lib/vault`, la `middleware.ts` sau la `next.config.ts` fără să-mi ceri. Nu face merge în `main` fără confirmarea mea. Dacă ai nevoie de o modificare în afara zonei tale, oprește-te și spune-mi.

**Înainte de cod:** citește `CLAUDE.md`, `PLAN.md`, structura din `app/admin` și migrarea cu `admin_emails` / `is_lead_admin()`. Refolosești exact același mecanism de autentificare ca panoul de lead-uri — nu construiești altul.

---

## 0. Regula care nu se negociază

**Portalul poate crea campanii DOAR în stare PAUSED. Niciodată active.**

Nu există niciun cod, nicio rută, niciun buton care să pornească o campanie. Activarea se face exclusiv de om, în Ads Manager. Dacă o funcție ar putea seta status `ACTIVE`, designul e greșit — oprește-te și semnalează.

Tokenurile au putere să cheltuie bani reali. Consecința oricărei erori de cod trebuie să fie o campanie oprită, nu o campanie care arde buget.

**Repo-ul e public.** Niciun token, id de cont sau secret în cod, în commit, în log sau în răspuns către browser. Datele de test sunt evident false.

---

## 1. Ce face portalul

1. Eu port o discuție în altă parte și primesc un **plan de campanie în JSON**.
2. Îl lipesc într-un câmp din `/admin/ads`.
3. Portalul îl validează și îmi arată, **în română**, ce urmează să se creeze.
4. Corectez direct în interfață dacă ceva e greșit.
5. Apăs **Creează pe pauză**. Campania apare în platformă, oprită, cu link direct.
6. Intru în platformă și o activez eu.

Plus un **dashboard** cu cifrele campaniilor existente.

---

## 2. Conturi și tokenuri

Structura reală, de respectat:

- **Meta** — două business portfolios separate, care vor rămâne separate: unul cu reclamele Meridian, unul cu conturile clienților. Posibil un al treilea mai târziu.
- **TikTok** — aceeași structură, două Business Centers.

Fiecare portofoliu are **tokenul lui**. Portalul le ține complet izolate: aleg din interfață în ce spațiu de lucru operez, și nu există nicio funcție care să combine date din două portofolii.

**Tokenurile stau în variabile de mediu**, citite exclusiv pe server:

```
META_TOKEN_MERIDIAN
META_TOKEN_CLIENTI
TIKTOK_TOKEN_MERIDIAN
TIKTOK_TOKEN_CLIENTI
```

Definește spațiile de lucru într-un fișier de configurare (`lib/ads/workspaces.ts`) — nume afișat, platformă, numele variabilei de mediu, lista de ad accounts. Adăugarea unui portofoliu nou trebuie să însemne un obiect nou acolo plus o variabilă în Vercel, nimic altceva.

Pentru Meta folosește **System User tokens** (nu expiră), nu tokenuri de utilizator (mor în 60 de zile). Spune-mi exact cum le generez.

---

## 3. Formatul JSON

Proiectează o schemă unică, **validată cu Zod**, care acoperă ambele platforme. Ce diferă între ele intră în secțiuni separate; ce e comun rămâne comun.

Trebuie să acopere cel puțin: spațiul de lucru și contul de reclame, obiectivul, bugetul zilnic, locația, vârsta, limba, targetarea pe interese sau comportamente, evenimentul de conversie și pixelul, destinația și URL-ul cu parametri, materialul video (id existent sau fișier nou), textele (mai multe variante), headline, description și CTA.

**Include și un câmp explicit pentru dezactivarea „îmbunătățirilor" automate** ale platformelor — pe Meta cele de tip Advantage+ creative enhancements, Ad sources, Multi-advertiser ads; pe TikTok automatic enhancements, auto-add assets, translate and dub, music refresh. Implicit toate **oprite**. Un testimonial filmat nu se lasă rescris de platformă.

Scrie schema, apoi dă-mi **un exemplu complet de JSON, comentat**, pentru o campanie Meta de tip Leads cu destinație Website — ca să știu ce format să generez.

Validarea trebuie să respingă un JSON incomplet cu mesaje clare în română, nu cu erori tehnice.

---

## 4. Încărcarea video

**Atenție, aici se rupe implementarea naivă:** Vercel limitează corpul cererilor către server la aproximativ 4,5 MB. Un video de reclamă e mult peste. Nu trimite fișierul prin serverul tău.

Video-ul trebuie să meargă **direct din browser către platformă**. Serverul doar pregătește sesiunea de upload și primește la final id-ul materialului.

Încărcarea e asincronă: platforma procesează fișierul înainte să poată fi folosit într-o reclamă. Interfața trebuie să aștepte și să arate starea, altfel pare blocată.

Oferă și varianta **„alege un video deja urcat"**, din biblioteca contului.

---

## 5. Ecranele

`/admin/ads` — listă de campanii din toate spațiile de lucru, cu status, buget, cheltuială și rezultate. Selector de spațiu de lucru sus, vizibil permanent, ca să știu mereu în ce portofoliu sunt.

`/admin/ads/nou` — câmpul pentru JSON, validarea, previzualizarea în română, încărcarea video-ului, butonul **Creează pe pauză**. După creare, link direct spre campanie în platformă.

`/admin/ads/[id]` — detaliile unei campanii, cifrele pe zile, textele și materialul folosit.

`/admin/ads/statistici` — dashboard-ul.

---

## 6. Dashboard

Un cron zilnic (Vercel Cron, rută protejată cu `CRON_SECRET`) trage cifrele din Meta Insights API și TikTok Reporting API și le salvează în Supabase. **Dashboard-ul citește din baza de date, niciodată direct din API** — altfel paginile sunt lente, lovești rate limit-ul și nu ai istoric.

Metrici: cheltuială, afișări, click-uri, CTR, CPC, CPM, rezultate (lead-uri), cost per rezultat. Pe campanie, pe zi, cu comparație între perioade.

Înainte de a scrie grafice, citește skill-ul `dataviz`.

Păstrează istoricul permanent. Platformele nu țin datele la infinit; snapshot-urile tale devin singura memorie.

---

## 7. Schema Supabase

Migrare nouă, RLS activ pe tot, acces doar prin `is_lead_admin()`, exact ca la lead-uri.

```
ads_campaigns     -- ce a creat portalul
  id, workspace, platform, platform_campaign_id,
  name, objective, daily_budget, status,
  plan_json jsonb, created_at, created_by

ads_metrics_daily -- un rând pe campanie pe zi
  id, campaign_id fk, date, spend, impressions, clicks,
  results, cost_per_result, raw jsonb
  unique (campaign_id, date)

ads_runs          -- jurnalul fiecărei rulări de cron
  id, started_at, finished_at, status, campaigns_synced, error
```

Nu suprascrie istoricul. Un rând de metrici existent se actualizează doar pentru ziua curentă.

---

## 8. Fazele

Fă-le pe rând, commit separat după fiecare, și **nu trece mai departe fără confirmarea mea**:

1. Schema JSON + validare + ecranul de previzualizare, **fără niciun apel către platforme**. Vreau să văd formatul înainte să conectăm ceva.
2. Meta: creare campanie pe pauză, cu video deja urcat.
3. Meta: încărcare video din browser.
4. Dashboard + cron pentru Meta.
5. TikTok, peste structura existentă.

---

## 9. La final

Spune-mi:
1. variabilele de adăugat în Vercel
2. pașii exacți pentru a genera un System User token pe Meta și echivalentul pe TikTok
3. exemplul de JSON comentat
4. ce mai lipsește ca să pot crea prima campanie reală
