# CLAUDE.md — `/vault`

Se citește ÎNAINTE de orice modificare în `app/vault/`, `lib/vault/` sau `supabase/migrations/0000000000000{3,4}_vault*.sql`. Completează `CLAUDE.md` din rădăcină (care rămâne valabil: română, quality floor, disciplina pe zone); acolo unde acest fișier e mai strict, câștigă acesta.

---

## 1. Ce e

Un vault de parole **zero-knowledge** pentru echipa MERIDIAN, la `/vault`. Serverul (Supabase) stochează DOAR blob-uri criptate, id-uri, timestamp-uri, numere de versiune, cheile publice ale membrilor și emailurile lor. Cheia care deschide datele (DEK) există în clar **numai în memoria browserului, după deblocare**, și moare cu fila, la blocare sau după 15 minute fără activitate.

Repo-ul e public. Securitatea vine din criptare, nu din obscuritate: **niciun secret în cod, teste, commit-uri sau fișiere de seed**; valorile de test sunt evident false (`fake-…`, `@example.test`).

În afara i18n-ului (doar RO), în afara shell-ului public, fără pixeli, `noindex` + `disallow` + absent din sitemap, profil CSP propriu cu `'wasm-unsafe-eval'`. Rulează pe scope-ul neutru al porții (`data-scope="gate"`), cu aceeași gramatică ca admin-ul: glass, hairline, Satoshi + JetBrains Mono, lumina celor două lumi. **Nu importă din `app/(admin)/`** — ce are nevoie, copiază local în `_components/ui.tsx`.

---

## 2. Invariante — nu se negociază

1. **Nimic în clar nu pleacă la server.** Titluri, tipuri, câmpuri, etichete, notițe, NUMELE CLIENȚILOR — toate stau în payload-uri criptate. Dacă o funcționalitate nouă „are nevoie" de un câmp în clar în bază (ca să sorteze, să caute, să numere), răspunsul e: se face în browser, peste datele decriptate. Vault-ul unei agenții are sute de rânduri, nu milioane.
2. **Cheile stau în `useRef`, niciodată în `useState`, URL, `localStorage`, cookie, log sau mesaj de eroare.** `KEK` se zeroizează (`wipe`) imediat ce cheile membrului s-au deschis; `dek`/`privateKey` la blocare și la `pagehide`. Sesiunea Supabase e în memorie (`persistSession: false`).
3. **`lib/vault/crypto.ts` nu se modifică fără cerere explicită a omului și revizuire umană.** E singurul loc care importă `libsodium-wrappers-sumo`. Parametrii KDF (Argon2id ops 4 / 256 MiB), contextul `mrdvault`, salt-ul din email, AD-urile — sunt CONTRACT: schimbarea lor invalidează toate cheile existente. Fără `Math.random`, fără AES-CBC/MD5/SHA1, fără funcții de export în clar. Ce e nevoie de aleator în afara lui (generatorul de parole) folosește WebCrypto — vezi `generate.ts`.
4. **Datele adiționale leagă ciphertextul de rândul lui**: `vault_entries:<id>`, `vault_clients:<id>`, `vault_members:<id>`, `vault_meta:recovery`. Id-ul se generează în browser (`crypto.randomUUID`) ÎNAINTE de criptare. Un payload mutat pe alt rând nu se decriptează — și așa trebuie să rămână.
5. **Secretele nu intră în indexul de căutare, nu apar în listă (nici mascate), nu apar în previzualizări de import, nu apar în istoric decât la cerere.** Când se arată: mască cu lungime FIXĂ (lungimea e informație), „Arată" cu ascundere automată la 30 s și contor vizibil, „Copiază" fără descoperire, clipboard golit după 45 s și la blocare.
6. **Un rând care nu se decriptează se ARATĂ ca ilizibil, nu se ascunde și nu prăbușește lista.** Integritatea e informație pentru om. Nu se editează; se poate șterge (soft).
7. **Ștergerea e soft, istoricul e scris doar de trigger, ștergerea definitivă nu există în UI** (RLS n-are politică de delete; e intenționat). Restaurarea unei versiuni scrie o versiune NOUĂ — nimic nu se pierde niciodată.
8. **Concurență optimistă**: orice update/ștergere de intrare cere `version` = cea văzută; zero rânduri = „altcineva a salvat între timp", mesaj pentru om, fără suprascriere oarbă. Versiunea o crește triggerul, nu clientul.
9. **Nicio dependență nouă** fără notă în `PLAN.md`. Vault-ul are exact una proprie: `libsodium-wrappers-sumo`.
10. **Copy-ul spune ce se întâmplă**: „Deblochează", „Ofertă cerută"-style — vocabular consecvent; erorile spun ce s-a întâmplat și ce să faci; eyebrow-urile mono poartă informație reală (fâșia „N intrări · M clienți · decriptate local în X ms" e afirmația modelului, nu decor).
11. **Inelul de chei** (migrarea 4): fiecare rând poartă `dek_id` (`null` = cheia originală). Se CITEȘTE cu cheia rândului (`dekFor`), se SCRIE mereu cu cheia curentă (`keys.dek`, `keys.currentDekId`). Cheile vechi nu se șterg niciodată (istoricul e pe ele). Rotația = cheie nouă sigilată pentru TOȚI membrii activi (serverul refuză altfel) + cod de recuperare NOU. Un update nu schimbă niciodată conținutul și `dek_id` în același pas (triggerul ar lua re-criptarea drept editare sau invers).
12. **Export doar criptat**, cu o parolă de export separată de cea master; fără istoric și coș.

---

## 3. Contracte

### Payload-ul criptat (schema `v: 1`) — `lib/vault/entries.ts`

```ts
EntryPayload  = { v: 1, kind, title, fields: EntryField[], tags: string[], notes: string }
EntryField    = { label, value, secret: boolean, kind: "text" | "url" | "multiline" | "totp" }
kind          ∈ login | server | api | database | card | note | other
ClientPayload = { v: 1, name }
```

Câmpurile sunt o listă LIBERĂ; `kind` doar propune un șablon (`templateFields`). Un câmp `totp` (faza 8) ține seed-ul (base32 sau `otpauth://`), e MEREU secret (parserul forțează), iar fișa arată codul viu; un cititor mai vechi îl tratează ca text. O schimbare de formă cere `v: 2` și un cititor care înțelege ambele (`parseEntryPayload` e deja defensiv). Rândurile vechi rămân criptate cu forma veche.

### Schema Supabase — migrările 3 și 4

`vault_members`, `vault_meta` (un singur rând), `vault_clients`, `vault_entries`, `vault_entry_versions`. RLS pe toate, nimic pentru `anon`, nicio politică `using (true)`. Membrii intră DOAR prin funcțiile `security definer`: `vault_bootstrap` (o singură dată), `vault_join`, `vault_approve_member`, `vault_rekey_self`, `vault_remove_member`; `wrapped_dek` e păzit și de trigger. **Migrarea 4** (obligatorie): `vault_deks` (cheile rotite, împachetate cu codul de recuperare curent), `vault_member_deks` (sigilările per membru), `dek_id` pe clienți / intrări / versiuni, triggerul care nu versionează re-criptarea, funcțiile `vault_rotate_dek`, `vault_grant_deks`, `vault_reseal_self`, `vault_rewrap_recovery`. Migrările se aplică de om în SQL editor, în ordine (nu există CLI/Docker local). Nu se editează 3 sau 4 — o schimbare = migrarea 5, aditivă.

**Regulă Postgres pe Supabase, învățată pe bază reală (2026-09-21):** rolul API-ului rulează extensia `safeupdate`, care refuză orice `UPDATE`/`DELETE` fără `WHERE` — inclusiv în funcții `security definer` și inclusiv pe tabele cu un singur rând. `vault_meta` se actualizează mereu cu `where id` (rândul unic). Backend-ul fals din teste nu are regula asta; pe SQL nou, verifică fiecare `update`/`delete` cu ochii.

### Providerul — `_components/vault-provider.tsx`

`useVault()` → `{ phase, member, supabase, keys, lock, changeMasterPassword, recoverWithCode, … }`. `keys` (`KeyMaterial` = `{ dek, currentDekId, ring, publicKey, privateKey }`) și `supabase` sunt non-null DOAR când `phase.kind === "unlocked"`. Rotația MUTEAZĂ `keys` în loc (`keyring.ts`). Fazele: `locked → busy → keys-missing → recovery-code | pending → unlocked`, plus `recovery` (membru activ cu chei sub parola veche — KEK-ul nou rămâne în memorie până se refac cheile). Datele deblocate vin dintr-un singur loc: `useVaultData()` (`snapshot` + `members` + `meta`, `reload`) — cele două vederi nu trebuie să se contrazică.

### Conturi

Contul de vault e SEPARAT de contul de admin (activarea înlocuiește parola Supabase cu `authHash`-ul derivat). Conturile se creează din dashboard (Authentication → Users), sign-up-ul public e OPRIT. Al doilea membru stă „în așteptare" până când un membru activ îi sigilează DEK-ul.

---

## 4. Harta fișierelor

| Fișier | Rol |
|---|---|
| `lib/vault/crypto.ts` | Stratul criptografic. PUR. Nu se atinge fără om. |
| `lib/vault/kdf.ts`, `kdf.worker.ts` | Argon2id în Web Worker de unică folosință; rezervă pe firul principal. |
| `lib/vault/supabase.ts` | Client de browser, sesiune în memorie. |
| `lib/vault/bytea.ts` | `\x…` hex ⇄ bytes pentru PostgREST. |
| `lib/vault/members.ts` | `vault_members` / `vault_meta` / funcțiile `vault_*`; erorile SQLSTATE → mesaje. `describeDbError` e folosit de tot stratul de date. `rekeySelf` / `rewrapSelf` / `openDekWithRecoveryCode` (faza 7). |
| `lib/vault/entries.ts` | Contractul payload-ului; citire/decriptare cu inelul (`loadVault`), scrieri cu cheia curentă (client/intrare, loturi de import), istoric, coș, re-criptare (`reencryptAll`, `countStaleRows`). |
| `lib/vault/search.ts` | Căutare pură, fără diacritice, ȘI pe tokeni, `#etichetă`; secretele NU intră în index. |
| `lib/vault/import.ts` | Parser CSV RFC 4180, roluri de coloane, JSON Bitwarden, fișierul de export; `finishPlan` marchează duplicatele pentru orice sursă. PUR. |
| `lib/vault/generate.ts` | Generator de parole pe WebCrypto, entropie afișată. |
| `lib/vault/diff.ts` | Diferența dintre două payload-uri, pentru istoric. PUR. |
| `lib/vault/totp.ts` | TOTP (RFC 6238) pe WebCrypto HMAC; base32 RFC 4648; `otpauth://`. PUR, verificat pe vectorii din RFC. |
| `lib/vault/keyring.ts` | Rotația cheii (`rotateDek`, mutează `keys`), starea inelului, acordarea cheilor lipsă. |
| `lib/vault/export.ts` | Exportul criptat (parolă de export, salt aleator per fișier) și decriptarea lui la import. |
| `app/vault/layout.tsx`, `page.tsx` | Root layout separat; pagina decide doar dacă există Supabase. |
| `_components/vault-provider.tsx` | Mașina de stări, secretele în ref-uri, auto-blocare. |
| `_components/vault-app.tsx` | Providerul + ecranul fazei curente. |
| `_components/unlock-screen.tsx`, `onboarding-screen.tsx`, `recovery-code.tsx`, `key-ring.tsx` | Deblocare / activare / chei / codul de recuperare afișat o dată / **recuperarea cu codul** (faza 7) / semnătura (inelul de meridian). |
| `_components/vault-shell.tsx` | Antetul (vederi Intrări / Membri, contorul de auto-blocare), `useVaultData`. |
| `_components/entries-workspace.tsx` | Căutare + listă + panoul din dreapta (fișă / editor / import / coș), gardă la modificări nesalvate, dialog cu focus captiv pe telefon. |
| `_components/entry-list.tsx`, `entry-panel.tsx`, `entry-field.tsx`, `entry-history.tsx`, `totp-code.tsx` | Lista grupată pe client; fișa; un câmp (mască, Arată, Copiază); istoricul cu diff și restaurare; codul 2FA viu. |
| `_components/entry-editor.tsx`, `password-generator.tsx` | Adăugare / editare / duplicare; generatorul inline. |
| `_components/import-panel.tsx`, `export-panel.tsx`, `trash-panel.tsx` | Import (CSV / Bitwarden JSON / export MERIDIAN) în trei pași; exportul criptat; coșul. |
| `_components/members-panel.tsx` | Membri (aprobă / elimină) + codul de recuperare. |
| `_components/account-panel.tsx`, `key-panel.tsx` | Contul tău: schimbarea parolei master (faza 7). Cheia de date: starea inelului, rotația, re-criptarea, acordarea cheilor (faza 10). |
| `_components/clipboard.ts`, `use-vault-data.ts`, `ui.tsx` | Clipboard cu expirare; datele deblocate; vocabularul vizual local. |

---

## 5. Cum se verifică

Nu există Supabase local, CLI sau Docker pe mașina de dezvoltare, și extensia de browser nu e conectată. Ce a mers în toate fazele (detalii în `PLAN.md`, secțiunea VAULT):

- **Chrome headless + CDP din Node** (WebSocket nativ, fără pachete), cu `Fetch.enable` pe `*fake-supabase*` și un **backend Supabase fals în memorie** care reproduce semantica migrării 3 (auth, REST cu `Prefer`/`Accept`, RPC-uri cu SQLSTATE, versionarea din trigger).
- Dev-ul pornit cu `NEXT_PUBLIC_SUPABASE_URL=http://localhost:3000/fake-supabase` (same-origin, fără CORS) și o cheie anon falsă, în fundal.
- **Seed criptat în Node** cu `lib/vault/crypto.ts` (`node --experimental-strip-types`): derivă KEK-ul din parola falsă, generează perechea, DEK-ul, sigilarea, criptează intrările cu AD-ul real. Browserul deblochează cu parola falsă și vede date reale-ca-formă.
- **Pe Supabase-ul real** (din 2026-09-21): dev-ul local cu `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` reale în `.env.local`, iar un driver CDP conduce un **membru de test** (cont de unică folosință, creat în Authentication → Users) prin activare / deblocare / schimbare de parolă / scriere; fondatorul e omul, în browserul lui. Nu cere niciodată parola master a unui membru real.
- Scripturile stau în scratchpad-ul sesiunii, **nu în repo**. Capcane cunoscute: `innerText` aplică `uppercase` pe eyebrow-uri (compară case-insensitive); așteaptă hidratarea înainte de submit; Enter prin CDP cere `text: "\r"`; `el.click()` nu mută focusul; `next build` strică serverul de dev din același `.next`.
- Quality floor: 360 fără scroll orizontal, tastatură completă (`/`, săgeți, Enter, Esc, Tab cu focus vizibil, focus captiv în dialog), `prefers-reduced-motion`, consolă curată, `tsc` + ESLint + `next build` verzi. Toate, la fiecare fază.

---

## 6. Ce nu există (și de ce)

Lista de „ce lipsește" e goală de la faza 11: recuperare, schimbarea parolei, TOTP, export criptat, rotația cheii, import JSON — toate există. Ce rămâne intenționat în afară:

TOTP EXISTĂ (faza 8): câmp de fel `totp`, HMAC prin WebCrypto, codul viu în fișă. Recuperarea cu codul și schimbarea parolei master EXISTĂ (faza 7): parola pierdută → parolă temporară setată de echipă din Supabase → „Activează contul" → ecranul de recuperare → codul de pe hârtie. Fără cod: eliminare + reinvitare de un membru activ. Nu se șterge și recrează contul (cascade pe `vault_members`).

- **Re-criptarea istoricului** la rotație: `vault_entry_versions` nu se poate rescrie din client (intenționat), deci istoricul rămâne pe cheile vechi. Un ex-membru care a văzut istoricul l-a văzut oricum.
- **Export în clar.** Niciodată — vezi invariantul 12.
- **Ștergerea definitivă din UI** — vezi invariantul 7.

Orice adaugi din lista asta: fază proprie, commit propriu, notă în `PLAN.md`, verificare completă. Și, înainte de a scrie o linie: **ar ieși la fel dacă brief-ul ar fi fost pentru orice alt manager de parole?** Dacă da, refă.
