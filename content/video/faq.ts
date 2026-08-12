import type { FAQItem } from "@/content/types";

/**
 * FAQ divizia VIDEO (FAZA 2) — copy de brand, NU placeholder.
 * Răspunde la obiecțiile reale dinaintea semnării: preț, termen,
 * drepturi, revizii, logistică.
 */
export const videoFAQ: FAQItem[] = [
  {
    id: "cat-costa",
    division: "video",
    isPlaceholder: false,
    question: "Cât costă un video?",
    answer:
      "Depinde de ce trebuie să facă filmul, nu de câte minute are. După un call de 30 de minute primești o ofertă cu livrabile fixe și preț fix — fără „de la”, fără surprize la factură. Proiectele noastre comerciale pornesc, orientativ, de la câteva mii de euro.",
  },
  {
    id: "cat-dureaza",
    division: "video",
    isPlaceholder: false,
    question: "În cât timp e gata?",
    answer:
      "Standard: 2–4 săptămâni de la brief la master, în funcție de complexitatea pre-producției. Ai un deadline mai strâns? Spune-l la brief — dacă ne angajăm la el, îl ținem.",
  },
  {
    id: "drepturi",
    division: "video",
    isPlaceholder: false,
    question: "Ale cui sunt drepturile pe material?",
    answer:
      "Ale tale. Pe toate versiunile livrate primești drepturi de utilizare comercială nelimitate — site, social, paid media, evenimente — negru pe alb, în contract. Materialul brut rămâne arhivat la noi 12 luni și îl poți răscumpăra integral oricând.",
  },
  {
    id: "revizii",
    division: "video",
    isPlaceholder: false,
    question: "Câte revizii sunt incluse?",
    answer:
      "Două runde, incluse în preț. Fiecare rundă înseamnă feedback consolidat — un singur e-mail cu toate observațiile, nu comentarii picurate o săptămână. Ce depășește două runde se tarifează transparent, la tarif orar comunicat dinainte.",
  },
  {
    id: "deplasare",
    division: "video",
    isPlaceholder: false,
    question: "Filmați și în afara orașului?",
    answer:
      "Da, oriunde în țară — și, cu planificare, oriunde în Europa. Costurile de deplasare apar ca linie separată în ofertă, nu ascunse în preț.",
  },
  {
    id: "vreme",
    division: "video",
    isPlaceholder: false,
    question: "Ce se întâmplă dacă plouă în ziua filmării?",
    answer:
      "Reprogramăm fără costuri suplimentare — vremea nu e vina nimănui. Pentru exterioare critice (dronă, imobiliare) monitorizăm prognoza și propunem fereastra de rezervă încă din call sheet.",
  },
];
