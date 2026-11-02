# API-ul Prospectare pentru roboți

Roboții din `auto-web-rebuilder` vorbesc cu adminul doar prin rutele de mai jos. Nu au acces direct la Supabase: fiecare cerere trece prin server, care verifică tokenul și cheamă funcțiile din migrările 28–34. Regulile (un singur canal pe firmă, „Nu contacta”, o nișă și o firmă la un singur robot) stau în bază, nu în robot.

**Fluxul unui robot:** (1) rezervă o nișă (`/nisa`), (2) înainte să cercetezi un domeniu, întreabă dacă e deja evaluat (`/evaluare` → `verifica`), (3) notează fiecare firmă evaluată, și pe cele respinse (`/evaluare` → `noteaza`), (4) trimite progresul și, la final, termină nișa (`/nisa`), (5) ia din coada comună o firmă de construit (`/rezerva`), semn de viață (`/heartbeat`), publici și o marchezi imediat (`/termina`), (6) emailul doar după ce ceri canalul (`/eveniment`).

**Regula canalelor:** o firmă e contactată pe **un singur canal** (email, WhatsApp sau apel); primul canal o blochează pentru celelalte. Al doilea canal îl dă doar un admin, din fișa firmei, cu motiv. Robotul de email primește 409 dacă firma are deja alt canal.

Adresa: `https://www.meridianx.ro/api/prospectare/robot/<ruta>`. Toate rutele primesc **doar `POST` cu JSON**.

## Autentificare

```
Authorization: Bearer mrx_robot_…
Content-Type: application/json
```

Tokenul se creează în admin → Prospectare → Roboți → „Adaugă robot”. Se arată **o singură dată**; în bază rămâne doar hash-ul lui. Pe calculatorul robotului îl ții într-o variabilă de mediu (de exemplu `MERIDIAN_ROBOT_TOKEN`), nu într-un fișier din repo. Un robot dezactivat din admin primește 401 la următoarea cerere.

**Limita de cereri:** 120 pe minut pe robot (Setări → „Cereri pe minut”). Peste ea: 429 cu `Retry-After: 60`.

## Răspunsurile

Mereu aceeași formă:

```json
{ "ok": true, "…": "…" }
{ "ok": false, "eroare": { "cod": "conflict", "mesaj": "Firma #412 a primit deja email (30.10.2026 09:40): același canal nu se folosește de două ori." } }
```

| Status | `cod` | Ce faci |
|---|---|---|
| 200 | — | Continui. |
| 401 | `neautorizat` | Token greșit sau robot dezactivat. Te oprești și anunți omul. |
| 404 | `negasit` | Firma nu există (domeniu sau nr greșit). |
| 409 | `conflict` | Firma a primit deja email sau are alt canal (WhatsApp, telefon), e „Nu contacta” / respinsă / client, rezervarea nu mai e a ta, sau nișa e rezervată de alt robot / terminată. **Nu trimiți emailul, nu mai lucrezi la firmă sau la nișă.** |
| 422 | `date_invalide` | Corp greșit; mesajul spune câmpul. Nu repeta aceeași cerere. |
| 429 | `prea_multe` | Peste limita de cereri, sau căsuța și-a atins limita zilei. Aștepți (sau altă căsuță). |
| 503 | `neconfigurat` | Baza nu e configurată sau lipsesc migrările. Reîncerci mai târziu. |
| 500 | `eroare` | Reîncerci după un minut; dacă se repetă, anunți omul. |

## 1. `POST /firme`: firmele cercetate

Adaugă sau actualizează firme, potrivite pe **domeniu** (normalizat: `https://www.Firma.ro/contact` → `firma.ro`). Datele existente se completează, nu se golesc. Robotul poate pune cel mult etapa `site_in_lucru` (firma aleasă pentru construit); canalele (email, WhatsApp, telefon), linkul demo și etapele de contact nu se schimbă de aici. Cel mult 500 de firme pe cerere; `date_extra` cel mult 20.000 de caractere pe firmă.

```bash
curl -s https://www.meridianx.ro/api/prospectare/robot/firme \
  -H "Authorization: Bearer $MERIDIAN_ROBOT_TOKEN" -H "Content-Type: application/json" \
  -d '{"firme":[{"domeniu":"tamplariepvc-somes.ro","nume":"Tâmplărie PVC Someș","nisa":"tâmplărie","oras":"Baia Mare","scor":82,"telefon":"0749 118 664","email":"office@tamplariepvc-somes.ro","lot":"2026-11-02 tâmplărie","etapa":"cercetat","date_extra":{"status_robot":"candidat"}}]}'
```

```json
{ "ok": true, "rezultat": { "adaugate": 1, "actualizate": 0, "neschimbate": 0, "etape_pastrate": 0, "conflicte": [] } }
```

Câmpuri: `domeniu` (obligatoriu), `nr`, `nume`, `site_vechi`, `nisa`, `oras`, `judet`, `scor`, `telefon`, `email`, `persoana_contact`, `lot`, `slug`, `de_refacut`, `etapa` (`cercetat` | `site_in_lucru`), `date_extra` (obiect).

## 2. `POST /rezerva`: următoarea firmă de construit

**Coada de construcție e comună:** orice robot poate lua orice firmă, nu doar cea pe care a cercetat-o. Intră în coadă firmele alese pentru construit (`site_in_lucru`) și orice firmă cercetată, neevaluată ca respinsă, cu scor ≥ 45 (Setări → „Scor minim pentru coada de construcție”), cu email sau mobil și fără site. Când o iei, trece în „Site în lucru”.

Firma e a ta 3 ore (Setări → „Rezervare”). Ordinea: întâi firma pe care o lucrai deja (după o repornire primești aceeași, cu `reluata: true`), apoi cele rămase de la un robot oprit, apoi refacerile, apoi cele alese deja pentru construit, apoi scorul cel mai mare. Două cereri simultane nu primesc niciodată aceeași firmă.

```bash
curl -s https://www.meridianx.ro/api/prospectare/robot/rezerva \
  -H "Authorization: Bearer $MERIDIAN_ROBOT_TOKEN" -H "Content-Type: application/json" \
  -d '{"tip_lucru":"construire"}'
```

`tip_lucru`: `construire`, `refacere` sau lipsă (oricare).

```json
{ "ok": true, "firma": { "id": "6f1c…", "nr": 412, "nume": "…", "domeniu": "…", "slug": "…", "de_refacut": false, "date_extra": {}, "rezervare": { "tip_lucru": "construire", "expira_la": "2026-11-02T15:04:05+00:00", "reluata": false } } }
{ "ok": true, "firma": null }
```

`firma: null` = nu e nimic de construit acum.

## 3. `POST /heartbeat`: lucrez încă

O dată la 30–60 de minute cât construiești. Prelungește rezervarea cu încă 3 ore. **409** = rezervarea a expirat și a luat-o alt robot: te oprești din lucrul la firma asta.

```bash
curl -s https://www.meridianx.ro/api/prospectare/robot/heartbeat \
  -H "Authorization: Bearer $MERIDIAN_ROBOT_TOKEN" -H "Content-Type: application/json" \
  -d '{"firma_id":"6f1c…"}'
```

```json
{ "ok": true, "expira_la": "2026-11-02T18:04:05+00:00" }
```

## 4. `POST /termina`: site gata

După ce site-ul demo e publicat. Firma trece pe „Site gata”, primește linkul demo și linkul capturii (Drive, nu fișierul), iar rezervarea se închide. Doar robotul care are firma rezervată.

Din acest moment firma e gata de contact: dacă are adresă de email, o ia robotul de email (`email_de_trimis`); dacă are mobil și n-are email, intră singură în lista de WhatsApp din admin (cele cu email intră acolo la o zi după email).

```bash
curl -s https://www.meridianx.ro/api/prospectare/robot/termina \
  -H "Authorization: Bearer $MERIDIAN_ROBOT_TOKEN" -H "Content-Type: application/json" \
  -d '{"firma_id":"6f1c…","link_demo":"https://demo.meridianxstudio.com/tamplarie-somes/","captura_url":"https://drive.google.com/file/d/…/view","detalii":{"versiune":"v3"}}'
```

```json
{ "ok": true, "firma": { "nr": 412, "etapa": "site_gata", "link_demo": "https://demo.meridianxstudio.com/tamplarie-somes/" } }
```

## 5. `POST /nisa`: tabla comună de nișe

O nișă e o pereche „nișă · zonă” (ex. „instalatori · Muntenia”). Înainte să cauți firme, o rezervi: alt robot nu o mai poate lua cât timp dai semn de viață. Fără semn de viață 24 de ore, rezervarea expiră și o poate prelua alt robot.

```bash
curl -s https://www.meridianx.ro/api/prospectare/robot/nisa \
  -H "Authorization: Bearer $MERIDIAN_ROBOT_TOKEN" -H "Content-Type: application/json" \
  -d '{"actiune":"rezerva","nisa":"instalatori","zona":"Muntenia"}'
```

```json
{ "ok": true, "nisa": { "id": 12, "nisa": "instalatori", "zona": "Muntenia", "status": "rezervata", "rezervata_la": "2026-11-02T14:20:00+00:00", "gasite": 0, "eligibile": 0, "respinse": 0, "reluata": false, "preluata_de_la": null } }
{ "ok": false, "eroare": { "cod": "conflict", "mesaj": "Nișa „instalatori · Muntenia” e rezervată de robot-2 din 02.11.2026 16:20." } }
```

- **200**: nișa e a ta. Dacă nu exista, s-a creat. `reluata: true` = era deja a ta; `preluata_de_la` = robotul de la care ai preluat-o după 24 h fără semn de viață.
- **409**: rezervată de alt robot (cine și de când), sau terminată. Alegi altă nișă.

Progresul (și semnul de viață, măcar o dată pe oră) și terminarea:

```bash
-d '{"actiune":"progres","nisa_id":12,"gasite":40,"eligibile":18,"respinse":22,"nota":"București gata, urmează Ilfov"}'
-d '{"actiune":"termina","nisa_id":12,"gasite":61,"eligibile":25,"respinse":36}'
```

Cifrele nu scad niciodată (se păstrează cea mai mare). Ele cresc și singure când notezi firme cu `nisa_id` (secțiunea 6). **409** = nișa nu mai e a ta (a preluat-o alt robot) sau e deja terminată.

## 6. `POST /evaluare`: firmele evaluate

**Toate firmele evaluate se notează, și cele respinse**, cu scorul și motivul. Un domeniu deja evaluat (de oricine, oricând) nu se mai cercetează.

```bash
-d '{"actiune":"verifica","domenii":["tamplariepvc-somes.ro","https://www.instal-nou.ro/"]}'
```

```json
{ "ok": true, "deja_evaluate": [{ "domeniu": "tamplariepvc-somes.ro", "nr": 412, "etapa": "site_gata", "evaluare": "eligibila", "scor": 82, "motiv": null, "evaluat_la": "2026-10-30T08:00:00+00:00" }], "noi": ["instal-nou.ro"] }
```

Cercetezi doar ce e în `noi`. Apoi notezi rezultatul (cel mult 500 de firme pe cerere):

```bash
-d '{"actiune":"noteaza","nisa_id":12,"firme":[
  {"domeniu":"instal-nou.ro","nume":"Instal Nou","oras":"Ploiești","scor":64,"evaluare":"eligibila","email":"office@instal-nou.ro","telefon":"0744 000 000"},
  {"domeniu":"instal-modern.ro","nume":"Instal Modern","scor":21,"evaluare":"respinsa","motiv":"site modern, bine întreținut"}]}'
```

```json
{ "ok": true, "adaugate": 2, "eligibile": 1, "respinse": 1, "deja_evaluate": [], "invalide": [] }
```

Câmpuri: `domeniu`, `scor` (0–1000), `evaluare` (`eligibila` | `respinsa`) obligatorii; `motiv` obligatoriu la respinse; opțional `nume`, `site_vechi`, `nisa`, `oras`, `judet`, `telefon`, `email`, `persoana_contact`, `date_extra`. Un domeniu deja evaluat apare în `deja_evaluate` și **nu se suprascrie**. Firmele eligibile cu scor ≥ prag, cu email sau mobil, intră singure în coada comună de construcție (secțiunea 2).

## 7. `POST /eveniment`: emailurile

**Ordinea e obligatorie.** Robotul cere canalul email **înainte** să trimită. O firmă primește **un singur canal**: dacă a primit deja WhatsApp sau e în lista de apeluri, cererea de email e refuzată (409), afară de cazul în care un admin a permis emailul din fișa firmei. Fiecare firmă primește cel mult un email. Cererea pune data emailului; din acel moment firma nu mai intră în lista de WhatsApp sau de apeluri.

### 7.1 Înainte de trimitere: `email_de_trimis`

```bash
curl -s https://www.meridianx.ro/api/prospectare/robot/eveniment \
  -H "Authorization: Bearer $MERIDIAN_ROBOT_TOKEN" -H "Content-Type: application/json" \
  -d '{"tip":"email_de_trimis","domeniu":"tamplariepvc-somes.ro","casuta":"stefan@meridianxweb.com","limita_azi":40}'
```

- **200** `{ "ok": true, "trimite": true, "firma": { "email": "…", "link_demo": "…", "persoana_contact": "…" }, "casuta": { "trimise_azi": 12, "limita_azi": 40 } }`: trimiți. Firma are acum data emailului: alt email nu mai primește.
- **409**: firma a primit deja email, are alt canal (WhatsApp sau telefon) fără permisiune din fișă, sau e „Nu contacta” / respinsă / client. **Nu trimiți.**
- **429**: căsuța și-a atins limita de azi (sau e oprită din admin). Încerci altă căsuță sau mâine. Firma rămâne fără email, poate primi mai târziu.
- **422**: firma nu are adresă de email sau nu are site gata cu link (etapa `site_gata` sau `whatsapp_trimis`).

`limita_azi` (opțional): limita căsuței pe ziua de azi, din încălzire. Dacă în admin e pusă o limită fixă pentru căsuță, aceea câștigă.

### 7.2 După trimitere: `email_trimis`

```bash
curl -s https://www.meridianx.ro/api/prospectare/robot/eveniment \
  -H "Authorization: Bearer $MERIDIAN_ROBOT_TOKEN" -H "Content-Type: application/json" \
  -d '{"tip":"email_trimis","domeniu":"tamplariepvc-somes.ro","casuta":"stefan@meridianxweb.com","message_id":"<a1b2c3@meridianxweb.com>","subiect":"Site demo pentru Tâmplărie PVC Someș"}'
```

`{ "ok": true, "nou": true, "nr": 412, "etapa": "email_trimis" }`. Același `message_id` trimis a doua oară (o cerere repetată după o pană de rețea) întoarce `nou: false` și nu se mai numără.

Dacă SMTP-ul a refuzat emailul după `email_de_trimis`, nu trimiți `email_trimis`. Data emailului rămâne pusă (regula: o singură dată), deci firma nu mai primește email, nici la o cerere nouă (409), și nici alt canal fără permisiune din fișă.

### 7.3 Bounce și răspunsuri

```bash
-d '{"tip":"bounce","domeniu":"tamplariepvc-somes.ro","casuta":"stefan@meridianxweb.com","message_id":"<bounce-1@…>","motiv":"550 mailbox not found"}'
-d '{"tip":"raspuns","domeniu":"tamplariepvc-somes.ro","casuta":"stefan@meridianxweb.com","raspuns":"nu","extras":"Nu suntem interesați.","message_id":"<re-1@…>"}'
```

`raspuns`: `pozitiv` | `nu` | `automat` | `altul`. Un **„nu” trece firma pe „Nu contacta”**: iese din toate listele și nu mai primește niciun mesaj. Răspunsurile pozitive apar în admin → Email, de unde omul o mută la „Interesați”.

Firma se identifică pe `domeniu` (preferat) sau pe `nr`.

## Exemplu Python (robotul)

```python
import os, requests

API = "https://www.meridianx.ro/api/prospectare/robot"
H = {"Authorization": f"Bearer {os.environ['MERIDIAN_ROBOT_TOKEN']}"}

def cere(ruta, corp):
    r = requests.post(f"{API}/{ruta}", json=corp, headers=H, timeout=30)
    date = r.json()
    if r.status_code == 429:
        raise RuntimeError("limită: " + date["eroare"]["mesaj"])
    return r.status_code, date

# Cercetare: rezervi nișa, sari peste domeniile deja evaluate, notezi tot (și respinsele).
st, d = cere("nisa", {"actiune": "rezerva", "nisa": "instalatori", "zona": "Muntenia"})
if st == 200:
    nisa_id = d["nisa"]["id"]
    st, v = cere("evaluare", {"actiune": "verifica", "domenii": domenii_gasite})
    evaluate = [evalueaza(dom) for dom in v["noi"]]   # {"domeniu", "scor", "evaluare", "motiv", …}
    cere("evaluare", {"actiune": "noteaza", "nisa_id": nisa_id, "firme": evaluate})
    cere("nisa", {"actiune": "termina", "nisa_id": nisa_id})
# 409 la nișă: e a altui robot (mesajul spune cine) sau e terminată; alegi alta.

# Construcție: orice firmă din coada comună.
st, d = cere("rezerva", {"tip_lucru": "construire"})
firma = d.get("firma")
if firma:
    # … construiești site-ul, cu cere("heartbeat", {"firma_id": firma["id"]}) o dată la 30–60 de minute …
    cere("termina", {"firma_id": firma["id"], "link_demo": link, "captura_url": link_drive})

st, d = cere("eveniment", {"tip": "email_de_trimis", "domeniu": dom, "casuta": casuta})
if st == 200 and d.get("trimite"):
    message_id = trimite_smtp(d["firma"], casuta)          # doar acum
    cere("eveniment", {"tip": "email_trimis", "domeniu": dom, "casuta": casuta, "message_id": message_id})
# 409: nu trimiți. 429: altă căsuță sau mâine.
```

## Proba locală

`scripts/prospectare-verifica-api.mjs` rulează toate cazurile de mai sus (401, 409, 422, 429, reluarea rezervării, `message_id` repetat) pe un server **local** legat de o bază de test. Refuză orice adresă care nu e `localhost`.
