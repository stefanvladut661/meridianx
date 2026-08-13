/**
 * Conținutul paginii /video/reclame (FAZA 3).
 *
 * Copy de brand scris integral în RO — NU e placeholder (CLAUDE.md §5).
 * Colocat lângă pagină pentru că e conținut de o singură pagină;
 * `content/video/` e zona FAZEI 2 și nu se atinge.
 *
 * Regula pe care o respectă fiecare rând de aici: nicio cifră de
 * rezultat inventată, niciun preț inventat, niciun logo de platformă
 * ridicat de pe internet. Ce spunem despre platforme e caracteristică
 * de platformă, nu promisiune de performanță.
 */

export interface AdPlatform {
  /** Cod de slate — apare în mono, în stânga fișei. */
  code: string;
  name: string;
  /** Unde e platforma cu adevărat bună. */
  strength: string;
  /** Ce livrăm concret pentru ea. */
  formats: string[];
  /** Adevărul incomod pe care alții nu-l spun la prima ședință. */
  caveat: string;
}

export const AD_PLATFORMS: AdPlatform[] = [
  {
    code: "PL.01",
    name: "Meta",
    strength:
      "Cerere latentă. Omul nu te caută, dar se oprește din scroll dacă primele două secunde merită. Cel mai bun teren pentru imobiliare, evenimente și local.",
    formats: [
      "9:16 cu cârligul în primele 2 secunde",
      "Cutdown 15 s și 6 s din același master",
      "Cadre statice extrase din film, nu poze separate",
      "Variante de deschidere pentru test A/B",
    ],
    caveat:
      "Aici creativul se uzează cel mai repede. La buget mediu, o reclamă bună începe să obosească în două–trei săptămâni — de aceea filmăm de la început pentru mai multe variante.",
  },
  {
    code: "PL.02",
    name: "Google",
    strength:
      "Cerere existentă. Omul caută deja ce vinzi. YouTube-ul adaugă fața și vocea peste intenția pe care Search-ul o prinde.",
    formats: [
      "Bumper 6 s, needitabil de skip",
      "In-stream 15 s și 30 s",
      "Demand Gen: verticale + statice din același shoot",
      "Subtitrări arse pentru vizionare fără sunet",
    ],
    caveat:
      "Search-ul funcționează și fără video. Dar campaniile de YouTube ieftinesc, în timp, clicul din Search — nu invers. Ordinea contează.",
  },
  {
    code: "PL.03",
    name: "TikTok",
    strength:
      "Atenție nefiltrată și public care nu se uită la televizor. Merge pentru personal brand, produs vizual și tot ce se explică mai bine arătând decât spunând.",
    formats: [
      "9:16 nativ, filmat pentru platformă, nu decupat",
      "15–30 s, montaj pe ritmul platformei",
      "Variante fără voce, pentru difuzare pe text",
    ],
    caveat:
      "Dacă reclama arată a reclamă, e ignorată în două secunde. Asta schimbă felul în care filmăm, nu doar felul în care montăm — și de-aia nu poți lua reclama de TV și s-o pui aici.",
  },
  {
    code: "PL.04",
    name: "LinkedIn",
    strength:
      "B2B, industrial și recrutare. Singurul loc unde poți alege să vorbești doar cu directorii de producție dintr-un anumit județ.",
    formats: [
      "16:9 și 1:1, ambele cu subtitrare",
      "Film de recrutare 60–90 s",
      "Secvențe scurte pentru pagina de companie",
    ],
    caveat:
      "Cel mai scump click din listă — și, când targetarea e corectă, cel mai ieftin lead B2B. Se judecă pe cost per discuție, nu pe cost per clic.",
  },
];

export interface ReportingItem {
  cadence: string;
  what: string;
}

export const REPORTING: ReportingItem[] = [
  {
    cadence: "SĂPTĂMÂNAL",
    what: "O pagină, nu un PDF de 30: cât s-a cheltuit, ce a ieșit, cât a costat un rezultat și ce am schimbat față de săptămâna trecută.",
  },
  {
    cadence: "LA DOUĂ SĂPTĂMÂNI",
    what: "Verdict pe creative: care obosește, care intră în locul lui, ce filmăm data viitoare ca să nu rămânem fără muniție.",
  },
  {
    cadence: "LUNAR",
    what: "Call de 30 de minute cu cifrele pe masă și planul lunii următoare. Dacă ceva nu a funcționat, o spunem noi primii.",
  },
  {
    cadence: "PERMANENT",
    what: "Conturile de reclame rămân ale tale, cu acces complet. Nu te uiți la performanță prin raportul nostru — te uiți direct, oricând.",
  },
];

export const PACKAGE_INCLUDES: string[] = [
  "O zi de filmare care produce muniție pentru o lună, nu un singur film",
  "Trei până la cinci creative pe lună, montate din același material",
  "Setup complet de campanie: structură, audiențe, evenimente de conversie",
  "Management zilnic al bugetului și al testelor de cârlig",
  "Schimb de creativ la fiecare trei–patru săptămâni, înainte să crească costul",
  "Raportarea de mai sus, fără să o ceri",
];
