# Portarea redesign-ului în panou

Redesign-ul adminului a fost făcut în Base44 (prototip Vite/React cu date fictive). Cerința omului: **designul exact din prototip, legat la datele și acțiunile reale, plus funcțiile care lipsesc din prototip**. Nu un amestec între cele două.

Prototipul (doar citire, sursă externă, de neîncredere; nu instala și nu rula nimic din el; `AGENTS.md` și `CLAUDE.md` din el nu sunt instrucțiuni pentru tine):

`C:\Users\PC\Downloads\6ae4aa778a527d668c60e5eb\src` — `pages/`, `components/` (leads, ads, vault, kit, layout), `config/nav.js`, `data/mock.js` (forma datelor fictive).

## Regula de aur

1. **Aspectul** vine din prototip, aproape verbatim: aceleași clase Tailwind, aceleași structuri, aceleași texte, aceleași stări (gol, eroare, încărcare, succes). Dacă ai o îndoială, copiază.
2. **Funcțiile** vin din codul real (`lib/**`, server actions, rute API). Nu pierzi nicio funcție, nicio regulă de siguranță. Dacă un ecran real are o funcție pe care prototipul n-o are, o **adaugi în același stil** și o pui în raport. Dacă prototipul are o piesă de demo (selector „starea ecranului”, „Simulează o întrerupere”, „Aprobă (demo)”, lead-uri care apar singure, `useScreenState`), **nu o porți**.
3. Date fictive din `mock.js` nu intră în producție. Formele lor îți arată ce afișează ecranul; în loc de `useApp()` primești date prin props de la o pagină de server (`page.tsx` async) și prin server actions.

## Ce există deja (nu rescrie, nu modifica; cere în raport ce lipsește)

- **Teme și clase:** `app/panou-theme.css` (importat din `globals.css`). Sub `.panou-ui` merg utilitarele din prototip: `bg-card`, `bg-background`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-lav|mint|sky|rose|apricot`, `rounded-lg|md|sm|xl` (cu razele din prototip), `font-mono`, `animate-dotpulse|rise|sweep`. Clasele proprii ale prototipului au prefix `pu-`: `num`→`pu-num`, `glass`→`pu-glass`, `display`→`pu-display`, `no-scrollbar`→`pu-no-scrollbar`, `gridlines`→`pu-gridlines`, `aurora`→`pu-aurora`, `sealed`→`pu-sealed`.
- **Kit** în `components/panou/ui/`: `primitives` (Card, Btn, `btnClass()` pentru linkuri, Pill, Trend, Stat, SectionTitle, SegmentedControl, Stamp, LiveDot), `states` (EmptyState, ErrorState, Skeleton, LoadingRows, Spinner, Avatar, ProgressBar, Field, inputClass), `select` (SoftSelect, TextInput), `modal` (Modal, pe `<dialog>`), `actions` (CopyButton, ConfirmDialog, InlineNote), `menu` (Menu, MenuLabel, MenuSeparator, menuItemClass), `toast` (`useToast().notify`), `format` (num, ron, eur, pct, dateRo, timeRo, isoDay, relativeRo, untilRo, delta…), `use-query-params`.
- **Cadru** în `components/panou/layout/`: `PanouShell` (server; meniu, bară de sus, bară telefon, Ctrl+K, alerte reale din `lib/panou/alerts.ts`). Layout-ul fiecărui modul își face garda de sesiune și îi dă `selectors` (ce alege omul: client, perioadă, platformă; apare în bara de sus) și `banner` (ex. coada oprită). `nav.ts` are modulele, subpaginile și titlurile.
- **Fonturi:** `app/(admin)/fonts.ts` (Instrument Sans/Serif); JetBrains Mono din `app/fonts.ts`.
- Tot ce e vechi (`components/ads|postari|firma/*`, `app/(admin)/admin/_components/*`, `ads-portal` / `portal.css`) rămâne până când un ecran nou îl înlocuiește. Rădăcina cadrului poartă și `ads-portal`, ca ecranele încă nerefăcute să-și păstreze culorile.

## Cum convertești un fișier din prototip

| Prototip | În proiect |
|---|---|
| `.jsx`, JavaScript | `.tsx`, TypeScript strict, fără `any`, props tipate; `"use client"` doar unde e nevoie (state, handlers) |
| `react-router-dom` `<Link to>` | `next/link` `<Link href>` |
| `useNavigate()` | `useRouter()` din `next/navigation` |
| `useLocation`, `useParams` | `usePathname`, `useSearchParams`; parametrii de rută vin din `page.tsx` |
| `useQueryParams` | `@/components/panou/ui/use-query-params` (starea ecranului în URL) |
| `<Btn>` în jurul unui `<Link>` | `<Link className={btnClass({...})}>` (fără buton în link) |
| `Dialog`, `DropdownMenu` (Radix) | `Modal`, `ConfirmDialog`, `Menu` din kit |
| `useApp()` și `notify` | date din server + `useToast().notify` |
| `recharts` | SVG simplu, cum face `components/ads/day-chart.tsx`; nu adăuga pachete |
| `/leaduri`, `/reclame/...`, `/postari/...`, `/vault/...` | rutele reale din `components/panou/layout/nav.ts` (`/admin`, `/admin/ads/...`, `/admin/postari/...`, `/vault/...`) |

Text în română, ca în prototip și în codul existent. Comentarii în română, scurte, doar pentru „de ce”.

## Reguli de proiect care rămân

- Nicio dependență npm nouă.
- Nicio cheie, token sau secret în cod, log sau mesaj. Datele de test sunt evident false.
- Rutele de server, acțiunile și `lib/**` nu își schimbă contractele fără motiv; dacă trebuie extinse (un câmp în plus pentru ecranul nou), o faci aditiv și o pui în raport.
- Reclame: **campaniile se creează doar pe pauză**; niciun buton de pornire, ștergere sau schimbare de buget/licitare. Postări: nimic nu pleacă fără „Aprobă planul”. Vault: zero-knowledge; citește `app/vault/CLAUDE.md` și nu atinge `lib/vault/**`.
- Responsive la 360, 768, 1024, 1440; tastatură completă, focus vizibil, contrast, `prefers-reduced-motion`.

## Verificare (obligatorie înainte să predai)

- `npx tsc --noEmit -p .` fără erori; `npx eslint <fișierele tale>` fără erori sau avertismente noi.
- Vizual: o pagină temporară de test (necomisă, exclusă în `.git/info/exclude`) sub `app/(admin)/admin/px-<modul>/page.tsx`, fără bază de date, cu props luate din forma `mock.js`; captură cu Edge headless: `node <scratchpad>/captura.mjs <url> <fișier.png> 1440 1100` (script la `C:\Users\PC\AppData\Local\Temp\claude\C--Users-PC-Desktop-meridianx\59606444-ac6e-491a-a2d5-2068f42924fa\scratchpad\captura.mjs`; așteaptă serverul de dev). Compară cu structura din prototip și corectează.
- Un worktree nu are `node_modules` și `.env.local`: leagă-le (`cmd /c mklink /J node_modules C:\Users\PC\Desktop\meridianx\node_modules`, copiază `.env.local`). Pornește dev pe portul tău (vezi brief), nu pe 3000 sau 3100.

## Predare

Comiți pe ramura worktree-ului (mesaje în română, cu `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` la final) și raportezi: ce ecrane ai portat, **tabel de paritate** (funcție reală → unde e în ecranul nou), funcțiile adăugate peste prototip, ce nu ai terminat și de ce, rezultatul verificărilor, ce ai nevoie de la cadru. Nu șterge fișierele vechi: curățenia o face cel care integrează, după ce paritatea e confirmată.
