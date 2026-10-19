/**
 * Exemplul complet, comentat, al planului de căutare — pentru o firmă
 * INVENTATĂ („Termo Exemplu”, instalații termice în Cluj). Domeniul e
 * `example.com` (rezervat pentru exemple), telefonul și id-urile sunt
 * zerouri. Se poate lipi direct în portal, cu comentarii cu tot.
 *
 * Aceeași sursă ajunge în butonul „Încarcă exemplul” de pe /admin/ads/cautare,
 * în instrucțiunile pentru Claude și în lib/ads/README.md.
 */
export const EXAMPLE_SEARCH_PLAN = `{
  // Obligatoriu: așa recunoaște portalul un plan de căutare.
  "format": "meridian-google-search/1",

  // google-meridian sau google-clienti — cel din selectorul de sus.
  "workspace": "google-clienti",

  // Contul Google Ads al clientului, 10 cifre (dreapta sus în Google Ads).
  "ad_account": "000-000-0000",

  // RON | EUR | USD — trebuie să fie moneda contului.
  "currency": "RON",

  // Liste comune de negative: create o dată în cont, legate de oricâte campanii.
  // "key" e numele lor în plan (îl folosesc campaniile); "name", numele din Google Ads.
  "shared_negative_lists": [
    {
      "key": "irelevante",
      "name": "NEG - Irelevante",
      "keywords": [
        { "text": "angajari", "match": "broad" },
        { "text": "locuri de munca", "match": "phrase" },
        { "text": "gratis", "match": "broad" },
        { "text": "pdf", "match": "broad" },
        { "text": "second hand", "match": "phrase" }
      ]
    }
  ],

  "campaigns": [
    {
      // Cheia campaniei în plan (litere mici, cifre, - și _).
      "key": "centrale",
      // Numele din Google Ads — unic în cont.
      "name": "Termo Exemplu - Centrale termice - Cluj - Search",
      // Pe zi, în moneda contului. Plafonul spațiului se aplică pe SUMA campaniilor.
      "daily_budget": 40,
      // maximize_clicks (cu plafon opțional pe clic) sau manual_cpc (max_cpc = licitarea grupurilor).
      "bidding": { "strategy": "maximize_clicks", "max_cpc": 2.5 },
      // Doar căutarea Google: fără parteneri, fără display.
      "networks": { "search_partners": false, "display": false },
      // Țară, regiune sau oraș — întregi, fără rază.
      "locations": [ { "type": "region", "name": "Cluj", "country": "RO" } ],
      "excluded_locations": [],
      // presence = oamenii aflați în zonă; presence_or_interest = și cei interesați de ea, de oriunde.
      "location_mode": "presence",
      "languages": ["ro"],
      // Lipsă sau gol = oricând. Orele din 15 în 15 minute; "24:00" = miezul nopții.
      "schedule": [
        { "days": ["mon", "tue", "wed", "thu", "fri"], "from": "08:00", "to": "19:00" },
        { "days": ["sat"], "from": "09:00", "to": "14:00" }
      ],
      // Listele comune legate de campanie (cheile de mai sus).
      "negative_lists": ["irelevante"],
      // Negative doar pe campania asta: căutările de aer condiționat merg în cealaltă campanie.
      "negatives": [
        { "text": "aer conditionat", "match": "phrase" },
        { "text": "climatizare", "match": "broad" }
      ],
      // UTM pe toată campania (inclusiv linkurile suplimentare). Un grup îl poate înlocui.
      "utm": { "source": "google", "medium": "cpc", "campaign": "centrale-cluj" },
      "assets": {
        // Linkuri suplimentare: text ≤25; descrierile (≤35) — amândouă sau niciuna. Recomandat: cel puțin 4.
        "sitelinks": [
          { "text": "Programează o revizie", "description1": "Alegi ziua și ora online", "description2": "Confirmăm în aceeași zi", "url": "https://www.example.com/revizie/" },
          { "text": "Montaj centrale", "description1": "Montaj autorizat ISCIR", "description2": "Probe și punere în funcțiune", "url": "https://www.example.com/montaj/" },
          { "text": "Prețuri", "description1": "Tarife clare, fără surprize", "description2": "Deplasare inclusă în Cluj", "url": "https://www.example.com/preturi/" },
          { "text": "Contact", "description1": "Sună sau scrie-ne", "description2": "Răspundem în aceeași zi", "url": "https://www.example.com/contact/" }
        ],
        // Mesaje scurte: ≤25 de caractere fiecare.
        "callouts": ["Autorizați ISCIR", "Deplasare în tot județul", "Garanție la manoperă", "Programări și sâmbăta"],
        // Fragmente structurate: antetul dintr-o listă fixă (brands, models, services, types…), 3–10 valori ≤25. Se trimite în limba campaniei.
        "snippets": [
          { "header": "services", "values": ["Montaj centrale", "Revizii anuale", "Reparații", "Coșuri de fum"] }
        ],
        // Butonul de apel: telefonul și, opțional, acțiunea de conversie „apeluri din anunțuri”.
        "call": { "country": "RO", "phone": "0700 000 000", "conversion_action_id": "000000000" }
      },
      "ad_groups": [
        {
          // Numele grupului — unic în campanie.
          "name": "Montaj centrale - Cluj",
          "final_url": "https://www.example.com/montaj/",
          // Cuvintele cheie: broad (amplă), phrase (frază), exact (exactă). ≤80 de caractere, ≤10 cuvinte.
          "keywords": [
            { "text": "montaj centrala termica cluj", "match": "phrase" },
            { "text": "montaj centrala termica", "match": "exact" },
            { "text": "instalare centrala termica cluj", "match": "phrase" }
          ],
          "negatives": [],
          // Până la 3 anunțuri responsive pe grup. Titluri: 3–15, ≤30; descrieri: 2–4, ≤90; căile: ≤15.
          "ads": [
            {
              "headlines": [
                // "pin": 1 = mereu primul. Fixează doar ce trebuie să apară mereu.
                { "text": "Montaj Centrale în Cluj", "pin": 1 },
                { "text": "Instalatori Autorizați ISCIR" },
                { "text": "Ofertă în Aceeași Zi" },
                { "text": "Montaj și Punere în Funcțiune" },
                { "text": "Deplasare în Tot Județul" },
                { "text": "Garanție la Manoperă" },
                { "text": "Programează-te Online" },
                { "text": "Sună Acum pentru Ofertă" },
                { "text": "Centrale în Condensare" },
                { "text": "Verificare la Fața Locului" }
              ],
              "descriptions": [
                "Montăm centrala, facem probele și o punem în funcțiune. Totul cu acte, în Cluj.",
                "Vedem locul înainte de ofertă și îți spunem exact ce trebuie schimbat.",
                { "text": "Programări de luni până sâmbătă. Sună sau scrie-ne pe site.", "pin": 2 }
              ],
              "path1": "montaj",
              "path2": "cluj"
            }
          ]
        },
        {
          "name": "Revizie centrale - Cluj",
          "final_url": "https://www.example.com/revizie/",
          "keywords": [
            { "text": "revizie centrala termica cluj", "match": "phrase" },
            { "text": "revizie centrala", "match": "exact" },
            { "text": "service centrala termica cluj", "match": "phrase" }
          ],
          "negatives": [ { "text": "montaj", "match": "broad" } ],
          "ads": [
            {
              "headlines": [
                { "text": "Revizie Centrală în Cluj", "pin": 1 },
                { "text": "Revizie Anuală cu Acte ISCIR" },
                { "text": "Programare în 2 Minute" },
                { "text": "Tehnicieni Autorizați" },
                { "text": "Verificăm și Coșul de Fum" },
                { "text": "Deplasare în Tot Județul" },
                { "text": "Programări și Sâmbăta" },
                { "text": "Sună Acum" }
              ],
              "descriptions": [
                "Revizia anuală obligatorie, cu procesul-verbal ISCIR. Programezi online sau la telefon.",
                "Curățăm, reglăm și verificăm siguranța centralei. Îți spunem pe loc ce mai are nevoie."
              ],
              "path1": "revizie",
              "path2": "cluj"
            }
          ]
        }
      ]
    },
    {
      "key": "aer-conditionat",
      "name": "Termo Exemplu - Aer conditionat - Cluj - Search",
      "daily_budget": 25,
      "bidding": { "strategy": "maximize_clicks", "max_cpc": 2 },
      "locations": [ { "type": "city", "name": "Cluj-Napoca", "country": "RO" } ],
      "languages": ["ro"],
      "schedule": [ { "days": ["mon", "tue", "wed", "thu", "fri", "sat"], "from": "08:00", "to": "20:00" } ],
      "negative_lists": ["irelevante"],
      "negatives": [ { "text": "centrala", "match": "broad" } ],
      "assets": {
        "sitelinks": [
          { "text": "Montaj aer condiționat", "description1": "Montaj standard într-o zi", "description2": "Fără praf, fără surprize", "url": "https://www.example.com/aer-conditionat/" },
          { "text": "Igienizare", "description1": "Curățare și dezinfectare", "description2": "Recomandat o dată pe an", "url": "https://www.example.com/igienizare/" },
          { "text": "Prețuri", "url": "https://www.example.com/preturi/" },
          { "text": "Contact", "url": "https://www.example.com/contact/" }
        ],
        "callouts": ["Montaj într-o zi", "Garanție la manoperă"],
        "snippets": [
          { "header": "types", "values": ["Inverter", "Multisplit", "Pe tavan", "Pe perete"] }
        ],
        "call": { "country": "RO", "phone": "0700 000 000", "conversion_action_id": "000000000" }
      },
      "ad_groups": [
        {
          "name": "Montaj aer conditionat - Cluj",
          "final_url": "https://www.example.com/aer-conditionat/",
          "utm": { "source": "google", "medium": "cpc", "campaign": "ac-cluj" },
          "keywords": [
            { "text": "montaj aer conditionat cluj", "match": "phrase" },
            { "text": "montaj aer conditionat", "match": "exact" },
            { "text": "pret montaj aer conditionat", "match": "phrase" }
          ],
          "ads": [
            {
              "headlines": [
                { "text": "Montaj Aer Condiționat Cluj", "pin": 1 },
                { "text": "Montaj Standard într-o Zi" },
                { "text": "Preț Clar Înainte de Montaj" },
                { "text": "Garanție la Manoperă" },
                { "text": "Inverter și Multisplit" },
                { "text": "Programează-te Online" },
                { "text": "Sună Acum pentru Ofertă" },
                { "text": "Fără Praf, Fără Surprize" }
              ],
              "descriptions": [
                "Montăm aparatul într-o zi, cu traseu curat și probe la final. Prețul îl știi dinainte.",
                "Te ajutăm să alegi puterea potrivită pentru cameră. Programări de luni până sâmbătă."
              ],
              "path1": "aer-conditionat",
              "path2": "cluj"
            }
          ]
        }
      ]
    }
  ]
}
`;

/** Exemplul, în spațiul de pe ecran (dacă e un spațiu Google). */
export function exampleSearchPlanFor(workspaceId: string): string {
  return workspaceId.startsWith("google-")
    ? EXAMPLE_SEARCH_PLAN.replace(/"workspace": "[a-z-]+"/, `"workspace": "${workspaceId}"`)
    : EXAMPLE_SEARCH_PLAN;
}
