# Reclame video Meridian — restaurante

Reclame de 9:16 (1080×1920, 30 fps) asamblate automat din bucățile de voce
înregistrate, în două stiluri, după clipurile de referință din
`E:\meridianx\reclame`:

- **Larven** — spațiul bleumarin cu arcuri albastre, carduri 3D, telefoane,
  titluri pe rânduri alb / albastru / gri cu linie sub ultimul rând.
- **Shopify** — fundal verde închis, text mare și subțire care apare pe voce,
  obiecte în locul cuvintelor (rebus), mână-cursor, litere care se împrăștie.

Fiecare clip = hook + body (b1) + CTA, pe aceeași voce. Body-ul e făcut din
5 secvențe, una pe frază, în două variante (A = Larven, B = Shopify); se pot
lega în orice combinație, pentru că fiecare începe pe o tăietură și se termină
curat.

## Comenzi

Se rulează din `reclame-video/`, care are `package.json` propriu, separat de
site (la un clone nou: `npm install` aici și în `tools/asr`).

```bash
npm run studio                      # previzualizare, cu sunet (compozițiile clip-*)
node scripts/segment-voices.mjs     # pauzele din voci → src/data/voice-map.json
node scripts/word-times.mjs         # timpii pe cuvânt (din tools/asr) → src/data/word-times.json
node scripts/normalize-audio.mjs    # voci și muzică la -16 LUFS → public/norm
node scripts/extract-stills.mjs     # cadre statice 9:16 → public/stills
node scripts/plan.mjs               # planul celor 20 de clipuri → out/plan.json
node scripts/render-all.mjs         # segmentele (ProRes 4444 cu alfa) → out/segments
node scripts/assemble.mjs           # clipurile finale → out/final
```

`render-all` sare peste segmentele deja randate; după o schimbare în cod se
reiau doar cele atinse: `node scripts/render-all.mjs --only "^seq-.*-shopify-4$" --force`.

Pentru cadre de verificare: `node scripts/render-frames.mjs out/qa hook-333f-h3-larven:10,60,%90`.

## Ce iese în `out/final`

- `clipuri/` — cele 20 de reclame, ex. `333f_h3-c2_9x16_larven.mp4`.
- `body/` — body-ul complet în fiecare stil, pe fiecare voce.
- `transparente/` — toate animațiile cu fundal transparent (ProRes 4444):
  hookuri, cele 5 fraze ale body-ului în ambele stiluri, CTA-urile.

## Filmările

Până vin filmările noastre, toate cadrele sunt din portofoliul de pe site
(Trattoria BonaMi, E45 Restobar; Allto doar pe planul doi), marcate
`isPlaceholder` în `src/data/footage.ts`. Filmările noi se pun în
`public/footage/` și se schimbă doar acolo (și, pentru cadrele statice, în
`scripts/extract-stills.mjs`).

Clipurile BonaMi au filigranul altei agenții în colțul de sus: `crop` le
mărește ancorat jos. Unele planuri au text ars sau genericul clipului spre
final: `from` și `rate` țin fiecare plan în porțiunea curată.

## Sunet

- Vocile: doar 333f și Mihai. 333f h3-c2 folosește fișierul complet, netăiat.
- Muzica (Mixkit, Stock Music Free License): „House 02" de Lily J la Larven,
  „Light it Up Boy" de Michael Ramir C. la Shopify. Coboară automat sub voce
  (sidechain), iar clipul final e la -14 LUFS.
- Efectele (Mixkit, Sound Effects Free License): whoosh la tranziții, clic la
  mâna-cursor, foșnet de hârtie la paginile întoarse.

## Ce nu e în git

Repo-ul e public, așa că în git e doar codul. Pe calculatorul pe care s-au
făcut clipurile, lângă cod stau și:

- `public/voci`, `public/norm` — vocile (originalele, în `E:\meridianx\reclame\voci`);
- `public/footage`, `public/stills` — filmările din portofoliu și cadrele extrase din ele;
- `public/music`, `public/sfx` — muzica și efectele Mixkit;
- `out/` — randările: segmentele ProRes, clipurile finale, cadrele de verificare;
- `analiza/` — cadrele și paginile salvate din referințe;
- `tools/asr/wav` — vocile la 16 kHz pentru Whisper.

Pe alt calculator, folderele astea se copiază înainte de randare.
