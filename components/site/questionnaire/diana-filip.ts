import type { QuestionnaireConfig } from "./types";

/**
 * Chestionarul pentru Diana Claudia Filip (dianafilip.com).
 *
 * Două proiecte: site-ul refăcut și o secțiune de cursuri pe site, în care
 * lecțiile se deschid la intervale stabilite. Întrebările sunt doar despre
 * ce vrea ea să existe; fără întrebări tehnice, fără prețuri, fără
 * configurarea planurilor (le discutăm la ofertă). Adresare cu
 * „dumneavoastră”, răspunsuri scrise liber, la liniuță.
 */
export const DIANA_FILIP: QuestionnaireConfig = {
  slug: "diana-filip",
  salutation: "doamna Diana",
  clientName: "Diana Claudia Filip",
  clientCompany: "AUDIT GOLD EXPERT FDC SRL",
  subject: "dianafilip.com",
  intro:
    "Ca să vă facem o ofertă exactă, am vrea să știm ce vă doriți de la site și de la secțiunea de cursuri. Scrieți liber, cât de pe scurt sau de pe larg doriți.",
  defaults: {
    name: "Diana Claudia Filip",
    email: "diana@dianafilip.com",
  },
  questions: [
    {
      id: "tot",
      section: "Pe scurt",
      title: "Descrieți exact tot ce vreți să fie făcut.",
      hint: "Scrieți la liniuță, liber, absolut tot: pe site, în secțiunea de cursuri, orice detaliu, oricât de mic.",
    },
    {
      id: "vizitator",
      section: "Site",
      title: "Ce ar trebui să facă un vizitator după ce intră pe site?",
    },
    {
      id: "ramane",
      section: "Site",
      title: "Ce vă place la site-ul de acum și ar trebui să rămână?",
    },
    {
      id: "modele",
      section: "Site",
      title: "Există site-uri care vă plac? Ce anume vă place la ele?",
      hint: "Puteți lipi și linkurile.",
    },
    {
      id: "drum",
      section: "Secțiunea de cursuri",
      title: "Cum vedeți drumul unui cursant, de la înscriere până la test?",
      hint: "Pas cu pas, așa cum îl vedeți dumneavoastră.",
    },
    {
      id: "functii",
      section: "Secțiunea de cursuri",
      title:
        "Lecțiile se vor deschide treptat, la intervale stabilite. Ce altceva ar trebui să poată face cursanții în secțiunea de cursuri?",
    },
    {
      id: "admin",
      section: "Secțiunea de cursuri",
      title: "Ce ați vrea să puteți vedea sau face dumneavoastră în secțiunea de cursuri?",
    },
    {
      id: "inscriere",
      section: "Secțiunea de cursuri",
      title: "Ce ar trebui să vadă un cursant imediat după ce se înscrie?",
    },
    {
      id: "lectie",
      section: "Secțiunea de cursuri",
      title: "Ce ar trebui să găsească un cursant lângă fiecare lecție?",
    },
    {
      id: "anunt",
      section: "Secțiunea de cursuri",
      title: "Cum ar trebui să afle un cursant că s-a deschis o lecție nouă?",
    },
    {
      id: "comunicare",
      section: "Secțiunea de cursuri",
      title: "Cum ar trebui să comunice cursanții cu dumneavoastră și între ei?",
    },
    {
      id: "in-urma",
      section: "Secțiunea de cursuri",
      title:
        "Ce ar trebui să se întâmple când un cursant rămâne în urmă sau nu mai intră o vreme?",
    },
    {
      id: "dupa-test",
      section: "Secțiunea de cursuri",
      title: "Ce ar trebui să se întâmple după ce un cursant trece testul?",
    },
    {
      id: "timp",
      section: "Secțiunea de cursuri",
      title:
        "Ce vă ia acum cel mai mult timp în lucrul cu cursanții și ați vrea să se facă singur?",
    },
    {
      id: "probleme",
      section: "Secțiunea de cursuri",
      title: "Ce probleme au acum cursanții cu felul în care primesc lecțiile?",
    },
    {
      id: "platforme",
      section: "Secțiunea de cursuri",
      title: "Ați folosit vreo platformă de cursuri care v-a plăcut? Ce anume v-a plăcut?",
    },
  ],
};
