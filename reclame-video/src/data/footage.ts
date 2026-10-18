// Filmările din reclame. Până vin filmările noastre din restaurante, sursele
// sunt clipurile HORECA din portofoliul site-ului — toate înlocuitoare
// (isPlaceholder). În prim-plan: BonaMi și E45 (fără burgerul, care e
// orizontal); Allto apare doar pe planul doi (grile, telefoane).
//
// Clipurile BonaMi au în colțurile de sus filigranul altei agenții („Boom
// Agency"). `crop` mărește cadrul ancorat jos, cât să-l scoată din imagine.

export type FootId = "pizza" | "mana" | "sclipici" | "capp" | "gelato" | "cornete" | "cafea";

export const FOOT: Record<FootId, { src: string; crop: number; isPlaceholder: true }> = {
  pizza: { src: "footage/bonami-pizza.mp4", crop: 1.17, isPlaceholder: true },
  mana: { src: "footage/bonami-mana-rotativa.mp4", crop: 1.17, isPlaceholder: true },
  sclipici: { src: "footage/bonami-sclipici.mp4", crop: 1.17, isPlaceholder: true },
  capp: { src: "footage/e45-cappuccino.mp4", crop: 1, isPlaceholder: true },
  gelato: { src: "footage/allto-passione-gelato.mp4", crop: 1, isPlaceholder: true },
  cornete: { src: "footage/allto-tiktok-cornete.mp4", crop: 1, isPlaceholder: true },
  cafea: { src: "footage/allto-tiktok-cafea.mp4", crop: 1, isPlaceholder: true },
};

export type Shot = { id: FootId; from: number; /** Încetinire, ca planul să nu treacă în porțiunile cu text ars sau în genericul clipului. */ rate?: number };

// Cadre fără text ars în imagine, alese de pe planșele de contact.
export const SHOTS = {
  flames: { id: "pizza", from: 8.6 },
  pizzaInOven: { id: "pizza", from: 10.2 },
  dough: { id: "pizza", from: 0.4 },
  sauce: { id: "pizza", from: 4.3 },
  cutting: { id: "pizza", from: 21.5 },
  pizzaFinal: { id: "pizza", from: 25.3 },
  carbonaraFly: { id: "mana", from: 5.4 },
  chefPlate: { id: "mana", from: 7.9 },
  veggieRing: { id: "mana", from: 9.3 },
  capreseFly: { id: "mana", from: 12.2 },
  pizzaBoard: { id: "mana", from: 14.1 },
  guestMenu: { id: "sclipici", from: 0.2, rate: 0.6 },
  guestSmile: { id: "sclipici", from: 12.2, rate: 0.6 },
  espresso: { id: "capp", from: 6.3 },
  milkPour: { id: "capp", from: 9.6 },
  latteArt: { id: "capp", from: 13.6 },
  grinder: { id: "capp", from: 1.0 },
  tamp: { id: "capp", from: 4.2 },
  affogato: { id: "gelato", from: 15.4 },
  gelatoScoop: { id: "gelato", from: 1.5 },
  threeScoops: { id: "cornete", from: 12.5 },
  cone: { id: "cornete", from: 4.0 },
  pistachio: { id: "cafea", from: 8.2 },
} satisfies Record<string, Shot>;

export type ShotName = keyof typeof SHOTS;

const st = (name: string) => `stills/${name}.jpg`;

/** Cadre statice 9:16 (scripts/extract-stills.mjs), deja fără filigran. */
export const STILLS = {
  pizzaFinal: st("bonami-pizza-27"),
  pizzaOven: st("bonami-pizza-11"),
  flames: st("bonami-pizza-9_5"),
  dough: st("bonami-pizza-1"),
  sauce: st("bonami-pizza-5"),
  cutting: st("bonami-pizza-22"),
  pizzaPeel: st("bonami-pizza-15"),
  carbonaraFly: st("bonami-mana-rotativa-5_5"),
  chefPlate: st("bonami-mana-rotativa-8_2"),
  veggieRing: st("bonami-mana-rotativa-9_6"),
  capreseFly: st("bonami-mana-rotativa-12_5"),
  pizzaBoard: st("bonami-mana-rotativa-14_5"),
  guestMenu: st("bonami-sclipici-0_5"),
  guestSmile: st("bonami-sclipici-13_5"),
  latteArt: st("e45-cappuccino-13_5"),
  cappuccino: st("e45-cappuccino-17_5"),
  espresso: st("e45-cappuccino-7"),
  milkPour: st("e45-cappuccino-10"),
  grinder: st("e45-cappuccino-2"),
  tamp: st("e45-cappuccino-4_5"),
  affogato: st("allto-passione-gelato-17"),
  affogatoCups: st("allto-passione-gelato-23"),
  gelato: st("allto-passione-gelato-2_5"),
  portafilter: st("allto-passione-gelato-7"),
  threeScoops: st("allto-tiktok-cornete-14"),
  cones: st("allto-tiktok-cornete-1"),
  cone: st("allto-tiktok-cornete-18"),
  scoop: st("allto-tiktok-cornete-5_5"),
  pistachio: st("allto-tiktok-cafea-9"),
  yellowGelato: st("allto-tiktok-cafea-13"),
  coffeeCorner: st("allto-tiktok-cafea-2_5"),
  crispyCones: st("allto-tiktok-cafea-4_5"),
  rosso: st("allto-rosso-2"),
  verona: st("allto-rosso-12"),
  midori: st("allto-rosso-22"),
  iceCookie: st("allto-rosso-42"),
} as const;

export type StillName = keyof typeof STILLS;
export const STILL_LIST = Object.values(STILLS);
