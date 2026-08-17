import type { FAQItem } from "@/content/types";

/**
 * FAZA 4 — întrebările care se pun oricum la primul call.
 * Copy de brand real, NU placeholder. Răspunsurile reduc riscul perceput:
 * proprietate asupra codului, preț, dependență de agenție, ce se întâmplă
 * dacă ne certăm. Clientul de software compară și decide lent — răspunde-i
 * înainte să întrebe.
 *
 * Întrebările specifice finanțărilor stau separat, în
 * `content/software/funding.ts` (`fundingFAQ`), pentru că răspunsurile
 * de acolo au nevoie de verificare juridică înainte de lansare.
 */
export const softwareFAQ: FAQItem[] = [
  {
    id: "cine-detine-codul",
    division: "software",
    isPlaceholder: false,
    question: "Cine deține codul la final?",
    answer:
      "Tu, integral, din prima zi. Lucrăm în repository-ul tău, nu în al nostru, iar la recepție primești și cheile de acces la găzduire, domeniu și servicii externe. Dacă mâine vrei să continui cu altcineva, poți — fără să ne ceri nimic.",
  },
  {
    id: "pret-fix",
    division: "software",
    isPlaceholder: false,
    question: "Prețul e fix sau se schimbă pe parcurs?",
    answer:
      "Fix, pe ce e scris în specificație. Se schimbă doar dacă ceri tu ceva în plus, iar atunci primești o estimare separată pe care o aprobi înainte să lucrăm. Nu emitem facturi pentru lucruri pe care nu le-ai aprobat în scris.",
  },
  {
    id: "cat-dureaza",
    division: "software",
    isPlaceholder: false,
    question: "De ce durează mai mult decât la o platformă gata făcută?",
    answer:
      "Pentru că nu îți schimbăm modul de lucru ca să încapă într-un șablon. Dacă un produs de raft îți rezolvă problema, îți spunem asta la call-ul de descoperire și te trimitem spre el — e mai ieftin pentru tine și mai onest pentru noi.",
  },
  {
    id: "ce-se-intampla-daca",
    division: "software",
    isPlaceholder: false,
    question: "Ce se întâmplă dacă proiectul se blochează la jumătate?",
    answer:
      "Contractul e pe etape. Dacă oprești proiectul, plătești etapele livrate și primești tot ce s-a construit până atunci: cod, design, documentație. Nu există penalizare de retragere și nu ținem nimic ostatic.",
  },
  {
    id: "echipa",
    division: "software",
    isPlaceholder: false,
    question: "Cine lucrează efectiv la proiect?",
    answer:
      "Aceiași oameni cu care ai vorbit la descoperire. Nu vinde unul și construiește altcineva pe care nu l-ai văzut niciodată. Știi numele persoanei care îți răspunde și intervalul în care o găsești.",
  },
  {
    id: "sisteme-existente",
    division: "software",
    isPlaceholder: false,
    question: "Se poate lega de programul de contabilitate sau de gestiune?",
    answer:
      "În cele mai multe cazuri, da. Verificăm la descoperire ce interfață de comunicare are programul tău și îți spunem clar dacă se poate, dacă se poate parțial sau dacă nu se poate deloc — înainte să semnezi, nu după.",
  },
  {
    id: "mentenanta-obligatorie",
    division: "software",
    isPlaceholder: false,
    question: "Sunt obligat să iau mentenanță de la voi?",
    answer:
      "Nu. Garanția de 12 luni e inclusă indiferent. După ea, mentenanța e opțională și fără perioadă minimă. Procedura de actualizare e documentată, ca echipa ta sau altă firmă să o poată prelua.",
  },
  {
    id: "unde-suntem",
    division: "software",
    isPlaceholder: false,
    question: "Lucrați și cu firme din alt oraș?",
    answer:
      "Da. Descoperirea o facem la tine, pe teren, pentru că nu poți înțelege un flux de producție pe apel video. Restul proiectului merge online, cu livrări pe care le verifici la fiecare două săptămâni.",
  },
];
