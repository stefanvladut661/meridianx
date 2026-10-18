// Unde apar filmările în reclame. Până primim filmările noastre din
// restaurante, toate sursele sunt clipuri HORECA din portofoliul site-ului
// (isPlaceholder: true). Când vin filmările, se schimbă doar acest fișier
// (și, pentru cadrele statice, lista din scripts/extract-stills.mjs).

export type Shot = { src: string; from: number; label: string; isPlaceholder: true };

const s = (name: string) => `stills/${name}.jpg`;

/** Chenarul de sticlă de la „cinematografie gastronomică": patru cadre în mișcare. */
export const CINEMA_SHOTS: Shot[] = [
  { src: "footage/e45-burger-film.mp4", from: 2.0, label: "Focul", isPlaceholder: true },
  { src: "footage/e45-burger-film.mp4", from: 6.4, label: "Grătarul", isPlaceholder: true },
  { src: "footage/bonami-pizza.mp4", from: 9.2, label: "Cuptorul", isPlaceholder: true },
  { src: "footage/e45-burger-film.mp4", from: 22.8, label: "Servirea", isPlaceholder: true },
];

/** Telefoanele de la „publicăm": un clip în feed-ul Meta, unul în TikTok. */
export const PHONE_CLIPS = {
  meta: { src: "footage/e45-cappuccino.mp4", from: 9.0, isPlaceholder: true },
  tiktok: { src: "footage/allto-tiktok-cornete.mp4", from: 3.0, isPlaceholder: true },
} as const;

/** Site-ul fictiv al restaurantului. */
export const SITE_IMAGES = {
  hero: s("e45-burger-film-23_5"),
  thumbs: [s("bonami-pizza-27"), s("e45-cappuccino-17_5"), s("allto-passione-gelato-23"), s("e45-burger-film-11_5")],
};

/**
 * Grila de reclame, celulă cu celulă (6 coloane). Celulele scoase în față la
 * „administrăm campaniile" sunt 14, 20, 21, 26, 27, 33 și 39: acolo stau
 * cadrele cele mai apetisante, fiecare o singură dată.
 */
export const GRID_STILLS = [
  s("allto-tiktok-cafea-9"), s("bonami-pizza-27"), s("e45-cappuccino-7"), s("allto-tiktok-cornete-5_5"),
  s("e45-burger-film-21_5"), s("allto-rosso-22"), s("bonami-mana-rotativa-12_5"), s("allto-passione-gelato-2_5"),
  s("e45-burger-film-2_3"), s("allto-rosso-42"), s("bonami-pizza-22"), s("e45-cappuccino-2"),
  s("allto-tiktok-cafea-13"), s("e45-burger-film-5_5"), s("e45-cappuccino-13_5"), s("bonami-pizza-5"),
  s("allto-tiktok-cornete-1"), s("e45-burger-film-11_5"), s("allto-passione-gelato-7"), s("bonami-mana-rotativa-5_5"),
  s("e45-burger-film-23_5"), s("allto-rosso-2"), s("bonami-pizza-15"), s("allto-tiktok-cornete-18"),
  s("e45-burger-film-0_5"), s("allto-passione-gelato-23"), s("bonami-pizza-11"), s("allto-tiktok-cornete-14"),
  s("e45-cappuccino-17_5"), s("allto-rosso-12"), s("bonami-mana-rotativa-14_5"), s("e45-burger-film-13_5"),
  s("allto-tiktok-cafea-2_5"), s("e45-burger-film-7_5"), s("e45-cappuccino-4_5"), s("bonami-pizza-1"),
  s("allto-tiktok-cafea-4_5"), s("bonami-pizza-9_5"), s("e45-burger-film-15_5"), s("allto-passione-gelato-17"),
  s("e45-burger-film-18_5"),
];

/** Cardurile înclinate de pe marginile panoului albastru. */
export const CTA_CARDS = [s("bonami-pizza-27"), s("e45-burger-film-23_5")];

/** Benzile de miniaturi din cardul „Ziua 30". */
export const STRIP_STILLS = GRID_STILLS.slice(0, 26);
