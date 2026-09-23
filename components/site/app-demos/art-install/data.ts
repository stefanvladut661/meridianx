/* ============================================================
   Art Instal — datele demo-ului.

   Motorul de dimensionare e portat 1:1 din src/lib/heatPumpCalc.ts
   (repo-ul clientului): aceeași formulă, aceiași factori, aceeași
   „regulă de aur” — modelul afișat are mereu kW ≥ necesarul calculat.

   Ce e adăugat pentru demo (și marcat ca estimare în interfață):
   bugetul orientativ pe model și costul anual al încălzirii.
   Cifrele sunt inventate, dar credibile și deterministe.
   ============================================================ */

/* ---------------- Motorul (port din heatPumpCalc.ts) ---------------- */

export const EPS = 1e-9;

export type ClimateZone = "I" | "II" | "III" | "IV";
export const ZONE_FACTOR: Record<ClimateZone, number> = { I: 0.91, II: 1.0, III: 1.09, IV: 1.17 };
export const ZONE_TE: Record<ClimateZone, number> = { I: -12, II: -15, III: -18, IV: -21 };

export const COUNTY_ZONE: Record<string, ClimateZone> = {
  Constanța: "I", Tulcea: "I",
  București: "II", Ilfov: "II", Giurgiu: "II", Teleorman: "II", Olt: "II",
  Dolj: "II", Mehedinți: "II", Călărași: "II", Ialomița: "II", Brăila: "II",
  Galați: "II", Buzău: "II", Vrancea: "II", Prahova: "II", Dâmbovița: "II",
  Argeș: "II", Vâlcea: "II", Gorj: "II", Timiș: "II", Arad: "II", Bihor: "II",
  "Satu Mare": "II", "Caraș-Severin": "II",
  Cluj: "III", Sălaj: "III", Maramureș: "III", "Bistrița-Năsăud": "III", Mureș: "III",
  Alba: "III", Sibiu: "III", Hunedoara: "III", Iași: "III", Vaslui: "III",
  Bacău: "III", Neamț: "III", Botoșani: "III",
  Brașov: "IV", Covasna: "IV", Harghita: "IV", Suceava: "IV",
};
export const COUNTIES = Object.keys(COUNTY_ZONE).sort((a, b) => a.localeCompare(b, "ro"));

export type Levels = "parter" | "p_m" | "p_1" | "p_1_m" | "p_2";
export const LEVEL_FACTOR: Record<Levels, number> = {
  parter: 1.08, p_m: 1.04, p_1: 1.0, p_1_m: 0.98, p_2: 0.97,
};

export type Win = "simple" | "dbl_std" | "dbl_lowe" | "triple";
export const WIN_FACTOR: Record<Win, number> = {
  simple: 1.12, dbl_std: 1.0, dbl_lowe: 1.0, triple: 0.93,
};

export type Heat = "radiatoare" | "pardoseala" | "fan";
export const SYSTEM_FACTOR: Record<Heat, number> = {
  pardoseala: 1.0, fan: 1.0, radiatoare: 1.1,
};

/** q_base pe grosimea izolației [cm] → W/m², interpolare liniară între trepte. */
const Q_BASE_STEPS: [number, number][] = [[0, 95], [5, 75], [10, 60], [15, 50], [20, 45]];

export function qBase(thicknessCm: number): number {
  if (!Number.isFinite(thicknessCm)) return NaN;
  const t = Math.max(0, thicknessCm);
  if (t >= 20) return 45;
  for (let i = 0; i < Q_BASE_STEPS.length - 1; i++) {
    const [t0, q0] = Q_BASE_STEPS[i];
    const [t1, q1] = Q_BASE_STEPS[i + 1];
    if (t >= t0 && t <= t1) return q0 + ((q1 - q0) * (t - t0)) / (t1 - t0);
  }
  return 45;
}

export const round1 = (n: number) => Math.round(n * 10) / 10;

export interface CalcInput {
  county: string;
  areaM2: number;
  levels: Levels;
  insulationCm: number;
  windows: Win;
  system: Heat;
}

/** Q rotunjit la o zecimală, sau NaN pentru date invalide. */
export function calcQ(i: CalcInput): number {
  const zone = COUNTY_ZONE[i.county];
  const q = qBase(i.insulationCm);
  if (!zone || !Number.isFinite(i.areaM2) || i.areaM2 <= 0 || !Number.isFinite(q)) return NaN;
  const fz = ZONE_FACTOR[zone];
  const fl = LEVEL_FACTOR[i.levels];
  const fw = WIN_FACTOR[i.windows];
  const fs = SYSTEM_FACTOR[i.system];
  if (![fz, fl, fw, fs].every(Number.isFinite)) return NaN;
  return round1((i.areaM2 * q * fz * fl * fw * fs) / 1000);
}

/* Pe site, PRAG_COMERCIAL = false: pragul de selecție e chiar Q
   (tabelul comercial pe suprafață nu intră în calcul). */
export const prag = (q: number) => q;

export type Brand = "Daikin" | "TCL" | "Hyundai";

export interface Model {
  brand: Brand;
  gama: string;
  model: string;
  kW: number;
  agent: string;
  descriere: string;
  reversibil: boolean;
  tier: "premium" | "accesibil";
  productId: string;
  /** Adăugat în demo: tipul constructiv, pentru eticheta de pe card. */
  tip: string;
}

export const CATALOG: Model[] = [
  { brand: "Daikin", gama: "Altherma 3 R F", model: "ERGA04EV + EHVH04S18E6V", kW: 4, agent: "R-32", descriere: "Boiler 180L integrat, clasă A+++, tehnologie Bluevolution, design compact.", reversibil: true, tier: "premium", productId: "daikin-altherma-3r-f", tip: "Split + boiler 180 L" },
  { brand: "Daikin", gama: "Altherma 3 R F", model: "ERGA06EV + EHVH08S18E6V", kW: 6, agent: "R-32", descriere: "Boiler 180L integrat, clasă A+++, tehnologie Bluevolution, design compact.", reversibil: true, tier: "premium", productId: "daikin-altherma-3r-f", tip: "Split + boiler 180 L" },
  { brand: "Daikin", gama: "Altherma 3 R F", model: "ERGA08EV + EHVH08S18E6V", kW: 8, agent: "R-32", descriere: "Boiler 180L integrat, clasă A+++, tehnologie Bluevolution, design compact.", reversibil: true, tier: "premium", productId: "daikin-altherma-3r-f", tip: "Split + boiler 180 L" },
  { brand: "Daikin", gama: "Altherma 3 M", model: "EDLA09DA3V3", kW: 9, agent: "R-32", descriere: "Monobloc, componente hidraulice integrate.", reversibil: true, tier: "premium", productId: "daikin-altherma-3r-f", tip: "Monobloc" },
  { brand: "Daikin", gama: "Altherma 3 M", model: "EDLA11DA3V3", kW: 11, agent: "R-32", descriere: "Monobloc, componente hidraulice integrate.", reversibil: true, tier: "premium", productId: "daikin-altherma-3r-f", tip: "Monobloc" },
  { brand: "Daikin", gama: "Altherma 3 M", model: "EDLA14DA3V3", kW: 14, agent: "R-32", descriere: "Monobloc, componente hidraulice integrate.", reversibil: true, tier: "premium", productId: "daikin-altherma-3r-f", tip: "Monobloc" },
  { brand: "Daikin", gama: "Altherma 3 M", model: "EDLA16DA3V3", kW: 16, agent: "R-32", descriere: "Monobloc, componente hidraulice integrate.", reversibil: true, tier: "premium", productId: "daikin-altherma-3r-f", tip: "Monobloc" },
  { brand: "TCL", gama: "Tri-thermal R290", model: "TCL Tri-thermal Ultra AI R290 10kW", kW: 10, agent: "R-290", descriere: "Monobloc cu agent natural R290, clasă A+++, raport calitate-preț excelent.", reversibil: true, tier: "accesibil", productId: "tcl-tri-thermal", tip: "Monobloc" },
  { brand: "TCL", gama: "Tri-thermal R290", model: "TCL Tri-thermal R290 14kW", kW: 14, agent: "R-290", descriere: "Monobloc cu agent natural R290, backup heater 3kW inclus.", reversibil: true, tier: "accesibil", productId: "tcl-tri-thermal", tip: "Monobloc" },
  { brand: "TCL", gama: "Tri-thermal R290", model: "TCL Tri-thermal R290 16kW", kW: 16, agent: "R-290", descriere: "Monobloc de mare capacitate cu agent ecologic R290.", reversibil: true, tier: "accesibil", productId: "tcl-tri-thermal", tip: "Monobloc" },
  { brand: "Hyundai", gama: "Monobloc", model: "Hyundai Monobloc 8kW", kW: 8, agent: "R-32", descriere: "Toate componentele hidraulice integrate în unitatea exterioară.", reversibil: true, tier: "accesibil", productId: "hyundai-monobloc", tip: "Monobloc" },
  { brand: "Hyundai", gama: "Monobloc", model: "Hyundai Monobloc 10kW", kW: 10, agent: "R-32", descriere: "Ideală pentru încălzirea eficientă a locuințelor medii.", reversibil: true, tier: "accesibil", productId: "hyundai-monobloc", tip: "Monobloc" },
  { brand: "Hyundai", gama: "Monobloc", model: "Hyundai Monobloc 12kW", kW: 12, agent: "R-32", descriere: "Randament termic crescut, agent R32, alimentare monofazată.", reversibil: true, tier: "accesibil", productId: "hyundai-monobloc", tip: "Monobloc" },
];

export const PRIORITATE_ALTERNATIVA: Brand[] = ["TCL", "Hyundai"];

/** Cel mai mic model care respectă regula de aur, sau null. */
export function alegeModel(modele: Model[], threshold: number, vreaRacire: boolean): Model | null {
  if (!Number.isFinite(threshold)) return null;
  return (
    modele
      .filter((m) => !vreaRacire || m.reversibil)
      .filter((m) => m.kW >= threshold - EPS)
      .sort((a, b) => a.kW - b.kW)[0] ?? null
  );
}

export interface Recommendation {
  premium: Model | null;
  alternative: Model | null;
}

export function recommend(threshold: number, vreaRacire: boolean): Recommendation {
  const premium = alegeModel(CATALOG.filter((m) => m.brand === "Daikin"), threshold, vreaRacire);
  const alternatives = PRIORITATE_ALTERNATIVA
    .map((b) => alegeModel(CATALOG.filter((m) => m.brand === b), threshold, vreaRacire))
    .filter((m): m is Model => m !== null)
    .sort(
      (a, b) =>
        a.kW - b.kW ||
        PRIORITATE_ALTERNATIVA.indexOf(a.brand) - PRIORITATE_ALTERNATIVA.indexOf(b.brand)
    );
  return { premium, alternative: alternatives[0] ?? null };
}

/** Gardă la randare — niciodată un model subdimensionat. */
export function goldenRuleOk(card: Model | null, threshold: number) {
  return !card || card.kW >= threshold - EPS;
}

export const AREA_MIN = 20;
export const AREA_MAX = 600;

/* ---------------- Opțiunile formularului (ca pe site) ---------------- */

export const LEVEL_OPTIONS: { id: Levels; label: string; short: string }[] = [
  { id: "parter", label: "Parter (un singur nivel)", short: "Parter" },
  { id: "p_m", label: "Parter + mansardă", short: "P+M" },
  { id: "p_1", label: "Parter + 1 etaj", short: "P+1" },
  { id: "p_1_m", label: "Parter + 1 etaj + mansardă", short: "P+1+M" },
  { id: "p_2", label: "Parter + 2 etaje sau mai mult", short: "P+2" },
];

export type Insul = "none" | "eps" | "xps" | "vs" | "vb" | "pir";
export const INSUL_OPTIONS: { id: Insul; label: string; short: string }[] = [
  { id: "none", label: "Neizolat (zidărie fără termoizolație)", short: "Neizolat" },
  { id: "eps", label: "Polistiren expandat (EPS)", short: "EPS" },
  { id: "xps", label: "Polistiren extrudat (XPS)", short: "XPS" },
  { id: "vs", label: "Vată minerală (de sticlă)", short: "Vată minerală" },
  { id: "vb", label: "Vată bazaltică", short: "Vată bazaltică" },
  { id: "pir", label: "Spumă PIR / PUR", short: "PIR / PUR" },
];
export const THICKNESS = [5, 8, 10, 12, 15, 20, 25];

export const WIN_OPTIONS: { id: Win; label: string; short: string }[] = [
  { id: "simple", label: "Geam simplu / tâmplărie veche", short: "Geam simplu" },
  { id: "dbl_std", label: "Termopan cu geam dublu", short: "Termopan dublu" },
  { id: "dbl_lowe", label: "Termopan dublu Low-E (modern)", short: "Dublu Low-E" },
  { id: "triple", label: "Termopan cu geam triplu (tripan)", short: "Tripan" },
];

export const HEAT_OPTIONS: { id: Heat; label: string; line: string }[] = [
  { id: "radiatoare", label: "Radiatoare", line: "Agent termic ~55°C" },
  { id: "pardoseala", label: "În pardoseală", line: "Agent termic ~35°C" },
  { id: "fan", label: "Ventiloconvectoare", line: "Agent termic ~45°C" },
];

/* Starea formularului, cu valorile ca în CalculatorPage.tsx. */
export type CalcForm = {
  county: string;
  area: string;
  levels: Levels | "";
  insul: Insul | "";
  thick: string;
  win: Win | "";
  heat: Heat | "";
  heating: boolean;
  cooling: boolean;
  acm: boolean;
};

export const EMPTY_FORM: CalcForm = {
  county: "",
  area: "",
  levels: "",
  insul: "",
  thick: "10",
  win: "",
  heat: "",
  heating: true,
  cooling: false,
  acm: false,
};

/** Exemplul A din testele site-ului: Argeș, 100 m², P+1, 10 cm, dublu, radiatoare = 6,6 kW. */
export const EXAMPLE_FORM: CalcForm = {
  county: "Argeș",
  area: "100",
  levels: "p_1",
  insul: "eps",
  thick: "10",
  win: "dbl_std",
  heat: "radiatoare",
  heating: true,
  cooling: false,
  acm: true,
};

export const thicknessOf = (f: CalcForm) => (f.insul === "none" ? 0 : parseFloat(f.thick));

export function formInput(f: CalcForm): CalcInput | null {
  const areaNum = parseFloat(f.area);
  const areaValid = Number.isFinite(areaNum) && areaNum >= AREA_MIN && areaNum <= AREA_MAX;
  const filled = f.county !== "" && f.area !== "" && f.levels !== "" && f.insul !== "" && f.win !== "" && f.heat !== "";
  if (!filled || !areaValid) return null;
  return {
    county: f.county,
    areaM2: areaNum,
    levels: f.levels as Levels,
    insulationCm: thicknessOf(f),
    windows: f.win as Win,
    system: f.heat as Heat,
  };
}

/** Câte dintre cele 7 întrebări au răspuns (grosimea face parte din 4). */
export function answered(f: CalcForm) {
  const a = parseFloat(f.area);
  return [
    f.county !== "",
    f.area !== "" && Number.isFinite(a) && a >= AREA_MIN && a <= AREA_MAX,
    f.levels !== "",
    f.insul !== "",
    f.win !== "",
    f.heat !== "",
    true, // 7. destinația e opțională
  ].filter(Boolean).length;
}

/* ---------------- Estimări (doar în demo) ---------------- */

/** Buget orientativ, echipament + montaj standard, TVA inclus. Inventat, determinist. */
export const PRICE_RANGE: Record<string, [number, number]> = {
  "ERGA04EV + EHVH04S18E6V": [38500, 44000],
  "ERGA06EV + EHVH08S18E6V": [41500, 47500],
  "ERGA08EV + EHVH08S18E6V": [44500, 51000],
  EDLA09DA3V3: [43000, 49500],
  EDLA11DA3V3: [47500, 54000],
  EDLA14DA3V3: [53000, 60500],
  EDLA16DA3V3: [57000, 65000],
  "TCL Tri-thermal Ultra AI R290 10kW": [27500, 32000],
  "TCL Tri-thermal R290 14kW": [32500, 37500],
  "TCL Tri-thermal R290 16kW": [35500, 41000],
  "Hyundai Monobloc 8kW": [22500, 26500],
  "Hyundai Monobloc 10kW": [24500, 28500],
  "Hyundai Monobloc 12kW": [27000, 31500],
};

/** Ore echivalente la sarcină maximă, pe zonă climatică. */
const FULL_LOAD_HOURS: Record<ClimateZone, number> = { I: 1500, II: 1650, III: 1800, IV: 1950 };
/** SCOP estimat după temperatura agentului termic. */
export const SCOP: Record<Heat, number> = { pardoseala: 4.6, fan: 4.0, radiatoare: 3.4 };

export const TARIFE = {
  el: 1.35, // lei/kWh, energie electrică
  elPv: 0.7, // lei/kWh, medie cu autoconsum din fotovoltaice
  gaz: 0.33, // lei/kWh, gaz natural
  gazRand: 0.95, // randament centrală în condensare
  lemne: 0.31, // lei/kWh util, lemn de foc în centrală
  gpl: 0.52, // lei/kWh util
};

export type CostRow = { id: string; label: string; lei: number; pump?: boolean };

export function estimate(i: CalcInput, q: number, pv: boolean) {
  const zone = COUNTY_ZONE[i.county];
  /* Factorul de sistem e o marjă de dimensionare, nu consum în plus. */
  const heatKwh = (q / SYSTEM_FACTOR[i.system]) * FULL_LOAD_HOURS[zone];
  const scop = SCOP[i.system];
  const elKwh = heatKwh / scop;
  const price = pv ? TARIFE.elPv : TARIFE.el;
  const rows: CostRow[] = [
    { id: "pompa", label: "Pompă de căldură", lei: elKwh * price, pump: true },
    { id: "gaz", label: "Centrală pe gaz", lei: (heatKwh * TARIFE.gaz) / TARIFE.gazRand },
    { id: "lemne", label: "Centrală pe lemne", lei: heatKwh * TARIFE.lemne },
    { id: "gpl", label: "Centrală pe GPL", lei: heatKwh * TARIFE.gpl },
    { id: "el", label: "Calorifere electrice", lei: heatKwh * TARIFE.el },
  ];
  return { heatKwh, elKwh, scop, rows };
}

/* ---------------- Magazinul (din src/data/products.ts) ---------------- */

export type ProductCategory = "pompe-caldura" | "aer-conditionat";

export interface ProductVariant {
  id: string;
  label: string;
  code: string;
  capacity: string;
  refrigerant: string;
  shortAdvantages: string;
  fullDescription: string;
}

export interface Product {
  id: string;
  name: string;
  brand: string;
  category: ProductCategory;
  categoryLabel: string;
  /** Indexul în produse.webp (bandă de 10 imagini). */
  img: number;
  variants: ProductVariant[];
}

export const PRODUCTS: Product[] = [
  {
    id: "daikin-altherma-3r-f", name: "Daikin Altherma 3 R F", brand: "DAIKIN", category: "pompe-caldura", categoryLabel: "Pompă de Căldură", img: 0,
    variants: [
      { id: "default", label: "4 kW", code: "ERGA04EV + EHVH04S18E6V", capacity: "4 kW", refrigerant: "R-32",
        shortAdvantages: "Boiler 180L integrat, clasă A+++, tehnologie Bluevolution, design compact.",
        fullDescription: "Sistem compus din unitate exterioară și unitate interioară cu boiler de 180L integrat. Oferă o eficiență energetică superioară de clasă A+++, alimentare monofazată, tehnologie avansată Bluevolution și un design compact pentru economie de spațiu." },
    ],
  },
  {
    id: "hyundai-monobloc", name: "Hyundai Monobloc", brand: "HYUNDAI", category: "pompe-caldura", categoryLabel: "Pompă de Căldură Monobloc", img: 1,
    variants: [
      { id: "8kw", label: "8 kW", code: "Hyundai Monobloc 8kW", capacity: "8 kW", refrigerant: "R-32",
        shortAdvantages: "Toate componentele hidraulice integrate în unitatea exterioară.",
        fullDescription: "Pompă de căldură aer-apă de tip monobloc (toate componentele hidraulice sunt integrate în unitatea exterioară). Funcționează cu agent frigorific ecologic R32 și are alimentare monofazată." },
      { id: "10kw", label: "10 kW", code: "Hyundai Monobloc 10kW", capacity: "10 kW", refrigerant: "R-32",
        shortAdvantages: "Ideală pentru încălzirea eficientă a locuințelor medii.",
        fullDescription: "Pompă de căldură aer-apă monobloc, ideală pentru încălzirea eficientă a locuințelor medii. Funcționează cu agent frigorific R32 și dispune de alimentare monofazată." },
      { id: "12kw", label: "12 kW", code: "Hyundai Monobloc 12kW", capacity: "12 kW", refrigerant: "R-32",
        shortAdvantages: "Randament termic crescut, agent R32, alimentare monofazată.",
        fullDescription: "Pompă de căldură aer-apă de tip monobloc, optimizată pentru un randament termic crescut. Funcționează cu agent R32 și are alimentare monofazată." },
    ],
  },
  {
    id: "tcl-tri-thermal", name: "TCL Tri-thermal R290", brand: "TCL", category: "pompe-caldura", categoryLabel: "Pompă de Căldură Monobloc", img: 2,
    variants: [
      { id: "ultra-ai-10", label: "Ultra AI 10 kW", code: "TCL Tri-thermal Ultra AI R290 10kW", capacity: "10 kW", refrigerant: "R-290 (Propan)",
        shortAdvantages: "Inteligență artificială Ultra AI, agent natural R290, clasă A+++, trifazată.",
        fullDescription: "Pompă de căldură monobloc avansată cu inteligență artificială (Ultra AI) din gama Tri-thermal. Utilizează noul agent frigorific complet ecologic și natural R290 (propan), oferind o clasă energetică de top A+++ și alimentare trifazată." },
      { id: "14kw", label: "14 kW", code: "TCL Tri-thermal R290 14kW", capacity: "14 kW", refrigerant: "R-290 (Propan)",
        shortAdvantages: "Putere mare, agent natural R290, clasă A+++, backup heater 3kW inclus.",
        fullDescription: "Pompă de căldură monobloc de putere mare pentru clădiri cu necesar termic ridicat. Funcționează cu agent natural R290, oferă clasa energetică A+++ pentru încălzire și răcire și vine echipată din fabrică cu un încălzitor electric suplimentar (backup heater) de 3kW." },
      { id: "16kw", label: "16 kW", code: "TCL Tri-thermal R290 16kW", capacity: "16 kW", refrigerant: "R-290 (Propan)",
        shortAdvantages: "Cea mai mare capacitate din gamă, agent ecologic R290.",
        fullDescription: "Pompă de căldură monobloc de mare capacitate din gama TCL Tri-thermal, cu agent frigorific ecologic R290. Ideală pentru clădiri cu necesar termic ridicat." },
    ],
  },
  {
    id: "motan-monobloc", name: "Motan Monobloc Aer-Apă R290", brand: "MOTAN", category: "pompe-caldura", categoryLabel: "Pompă de Căldură Monobloc", img: 3,
    variants: [
      { id: "6kw", label: "6 kW", code: "Motan Monobloc R290 6kW", capacity: "6 kW", refrigerant: "R-290",
        shortAdvantages: "Sistem all-in-one pentru încălzire, răcire și ACM. Clasă A+++, zgomot redus, compresor dublu rotativ.",
        fullDescription: "Pompa de căldură Motan, sistem aer-apă monobloc de 6 kW, este o soluție de ultimă generație pentru case, integrând încălzirea, răcirea și apa caldă menajeră într-un singur sistem. Clasă energetică A+++, funcționare silențioasă, compresor dublu rotativ și agent frigorific R290 asigură temperaturi ale agentului termic de până la 75°C — ideală și pentru locuințe cu calorifere." },
      { id: "8kw", label: "8 kW", code: "Motan Monobloc R290 8kW", capacity: "8 kW", refrigerant: "R-290",
        shortAdvantages: "Monobloc monofazat, agent natural R290, temperatură agent termic până la 75°C.",
        fullDescription: "Pompă de căldură Motan monobloc, aer-apă, 8 kW, monofazată, cu agent frigorific R290 și clasă energetică A+++. Compatibilă cu sisteme cu calorifere sau pardoseală." },
      { id: "10kw", label: "10 kW", code: "Motan Monobloc R290 10kW", capacity: "10 kW", refrigerant: "R-290",
        shortAdvantages: "Ideală pentru locuințe medii; agent ecologic R290; clasă A+++.",
        fullDescription: "Pompă de căldură Motan monobloc, aer-apă, 10 kW, monofazată, R290, clasă A+++. Soluție completă pentru încălzire, răcire și ACM." },
      { id: "12kw", label: "12 kW", code: "Motan Monobloc R290 12kW", capacity: "12 kW", refrigerant: "R-290",
        shortAdvantages: "Putere ridicată pentru case mari; compresor dublu rotativ; R290.",
        fullDescription: "Pompă de căldură Motan monobloc, aer-apă, 12 kW, monofazată, R290, clasă A+++. Recomandată pentru case cu necesar termic mediu-mare." },
      { id: "16kw", label: "16 kW", code: "Motan Monobloc R290 16kW", capacity: "16 kW", refrigerant: "R-290",
        shortAdvantages: "Cea mai mare capacitate din gamă; agent natural R290; clasă A+++.",
        fullDescription: "Pompă de căldură Motan monobloc, aer-apă, 16 kW, monofazată, R290, clasă A+++. Pentru clădiri cu necesar termic ridicat." },
    ],
  },
  {
    id: "samsung-ehs-mono-r290", name: "Samsung EHS Mono R290", brand: "SAMSUNG", category: "pompe-caldura", categoryLabel: "Pompă de Căldură Monobloc", img: 4,
    variants: [
      { id: "5kw", label: "5 kW", code: "Samsung EHS Mono R290 5kW", capacity: "5 kW", refrigerant: "R-290",
        shortAdvantages: "Agent R290 cu GWP=3, apă caldă până la 75°C, performanță 100% până la -10°C.",
        fullDescription: "Samsung EHS Mono R290 utilizează agentul frigorific R290 cu GWP foarte scăzut (doar 3). Oferă apă caldă până la 75°C, ideal pentru înlocuirea sistemelor vechi. Performanță de încălzire de 100% la temperaturi de până la -10°C." },
      { id: "8kw", label: "8 kW", code: "Samsung EHS Mono R290 8kW", capacity: "8 kW", refrigerant: "R-290",
        shortAdvantages: "Agent R290 ecologic, apă caldă până la 75°C, ideală pentru reabilitări.",
        fullDescription: "Samsung EHS Mono R290 de 8 kW cu agent frigorific R290 (GWP=3). Suprafață mare de transfer termic, apă caldă până la 75°C și performanță 100% până la -10°C." },
      { id: "12kw", label: "12 kW", code: "Samsung EHS Mono R290 12kW", capacity: "12 kW", refrigerant: "R-290",
        shortAdvantages: "Putere ridicată, agent R290, apă caldă până la 75°C.",
        fullDescription: "Samsung EHS Mono R290 de 12 kW. Agent R290 ecologic, apă caldă până la 75°C, performanță fiabilă și la temperaturi scăzute." },
      { id: "16kw", label: "16 kW", code: "Samsung EHS Mono R290 16kW", capacity: "16 kW", refrigerant: "R-290",
        shortAdvantages: "Cea mai mare capacitate din gamă, agent natural R290.",
        fullDescription: "Samsung EHS Mono R290 de 16 kW, pentru locuințe cu necesar termic ridicat. Agent R290, apă caldă până la 75°C și performanță 100% până la -10°C." },
    ],
  },
  {
    id: "yamato-optimum-r32", name: "Yamato Optimum R32", brand: "YAMATO", category: "aer-conditionat", categoryLabel: "Aer Condiționat Split", img: 5,
    variants: [
      { id: "default", label: "Standard", code: "Yamato Optimum R32", capacity: "Split Inverter", refrigerant: "R-32",
        shortAdvantages: "Tehnologia Golden Fin, WiFi Intelligent Control, ventilator cu 7 viteze, clasă A++/A+, garanție 3 ani.",
        fullDescription: "Aparat de aer condiționat Yamato Optimum R32, model optimizat dimensional și tehnologic, cu panou frontal elegant finisat cu bandă aurie și telecomandă intuitivă. Avantaje: Tehnologia Golden Fin, WiFi Intelligent Control, ventilator cu 7 viteze, clasă energetică A++/A+ și garanție 3 ani integral." },
    ],
  },
  {
    id: "gree-ac", name: "Aer Condiționat Gree", brand: "GREE", category: "aer-conditionat", categoryLabel: "Aer Condiționat Split", img: 6,
    variants: [
      { id: "default", label: "Standard", code: "Gree Split Inverter", capacity: "Split Inverter", refrigerant: "R-32",
        shortAdvantages: "Protecție aer rece, funcție Turbo, preîncălzire inteligentă, dezghețare inteligentă, dezumidificare.",
        fullDescription: "Aer condiționat Gree cu protecție împotriva curenților reci (jeturi de aer trimise cu întârziere în modul încălzire), funcție Turbo pentru atingerea rapidă a parametrilor doriți, preîncălzire inteligentă, dezghețare inteligentă (doar când este necesar, pentru economii de energie) și funcție de dezumidificare pentru prevenirea disconfortului și a mucegaiului." },
    ],
  },
  {
    id: "daikin-sensira", name: "Daikin Sensira Bluevolution", brand: "DAIKIN", category: "aer-conditionat", categoryLabel: "Aer Condiționat Split", img: 7,
    variants: [
      { id: "default", label: "Standard", code: "Daikin Sensira Bluevolution", capacity: "Split Inverter", refrigerant: "R-32",
        shortAdvantages: "Moduri Powerful, Dry și Auto-diagnoză. Control prin telecomandă IR sau smartphone (Daikin Residential Controller).",
        fullDescription: "Aparat de aer condiționat Daikin Sensira Bluevolution, proiectat pentru confort optim prin controlul temperaturii, calității și umidității aerului, cu consum redus de energie. Include funcțiile Powerful, Dry și Auto-diagnoză, telecomandă cu infraroșu și opțiunea Daikin Residential Controller pentru controlul de pe smartphone sau tabletă." },
    ],
  },
  {
    id: "daikin-ururu-sarara", name: "Daikin Ururu Sarara", brand: "DAIKIN", category: "aer-conditionat", categoryLabel: "Aer Condiționat Split Premium", img: 8,
    variants: [
      { id: "default", label: "Standard", code: "Daikin Ururu Sarara", capacity: "Split Inverter", refrigerant: "R-32",
        shortAdvantages: "Purificare, umidificare, dezumidificare și aport de aer proaspăt. Auto-curățare și control vocal Google/Alexa.",
        fullDescription: "Daikin Ururu Sarara oferă calitate perfectă a aerului: climatizare, purificare, umidificare, dezumidificare și aport de aer proaspăt din exterior. Filtru cu auto-curățare (perie integrată), trei setări de circulație inclusiv modul „Briză”, și control inteligent prin aplicația Onecta cu comenzi vocale Google Assistant și Amazon Alexa." },
    ],
  },
  {
    id: "daikin-emura-silver", name: "Daikin Emura Silver Bluevolution", brand: "DAIKIN", category: "aer-conditionat", categoryLabel: "Aer Condiționat Split Premium", img: 9,
    variants: [
      { id: "default", label: "Standard", code: "Daikin Emura Silver Bluevolution", capacity: "Split Inverter", refrigerant: "R-32",
        shortAdvantages: "Design premium argintiu, Ochi inteligent pe 2 zone, funcționare silențioasă, Online Controller.",
        fullDescription: "Aer condiționat split Daikin Emura Silver Bluevolution, recunoscut internațional pentru design. Confort optim prin Ochi inteligent pe 2 zone, funcționare silențioasă și Online Controller. Eficiență sezonieră ridicată cu tehnologie Inverter, agent R-32, programator săptămânal." },
    ],
  },
];

export const productImg = (id: string) => PRODUCTS.find((p) => p.id === id)?.img ?? 0;

/* ---------------- Portofoliul ---------------- */

export const PF_CATEGORIES = [
  "Toate",
  "Pompe de căldură",
  "Aer condiționat",
  "Centrale termice",
  "Pardoseală radiantă",
  "Panouri solare",
] as const;
export type PfCategory = (typeof PF_CATEGORIES)[number];

export type Sheet = "a" | "b";
export interface PfItem {
  id: string;
  sheet: Sheet;
  i: number;
  label: string;
  cat: Exclude<PfCategory, "Toate">;
  video?: boolean;
}

export const PORTFOLIO: PfItem[] = [
  { id: "p1", sheet: "b", i: 0, label: "Centrală termică — montaj complet", cat: "Centrale termice" },
  { id: "p2", sheet: "b", i: 2, label: "Pardoseală radiantă — distribuitor", cat: "Pardoseală radiantă" },
  { id: "p3", sheet: "b", i: 1, label: "Pardoseală radiantă — montaj complet", cat: "Pardoseală radiantă" },
  { id: "p4", sheet: "a", i: 1, label: "Pompă de căldură — vilă", cat: "Pompe de căldură" },
  { id: "p5", sheet: "b", i: 3, label: "Panouri solare — rezidențial", cat: "Panouri solare" },
  { id: "p6", sheet: "b", i: 4, label: "Pardoseală radiantă — montaj Purmo", cat: "Pardoseală radiantă" },
  { id: "p7", sheet: "a", i: 3, label: "Pompă de căldură Daikin — unitate interioară", cat: "Pompe de căldură" },
  { id: "p8", sheet: "a", i: 4, label: "Aer condiționat Daikin Comfora FTXTP-N", cat: "Aer condiționat" },
  { id: "p9", sheet: "a", i: 0, label: "Daikin Altherma 4 H EPSK-A — unitate exterioară", cat: "Pompe de căldură" },
  { id: "p10", sheet: "a", i: 2, label: "Pompă de căldură Daikin — unitate exterioară", cat: "Pompe de căldură" },
  { id: "v1", sheet: "a", i: 4, label: "Aer condiționat — montaj video", cat: "Aer condiționat", video: true },
  { id: "v2", sheet: "b", i: 1, label: "Pardoseală radiantă — montaj video", cat: "Pardoseală radiantă", video: true },
  { id: "v3", sheet: "a", i: 0, label: "Pompă de căldură — montaj video", cat: "Pompe de căldură", video: true },
];

/* ---------------- Contact (date de demo, nu cele reale) ---------------- */

export const DEMO_PHONE = "07xx xxx xxx";
export const DEMO_EMAIL = "oferte@exemplu.ro";

export const SERVICES = [
  "Pompe de căldură",
  "Aer condiționat",
  "Centrale termice",
  "Panouri solare",
  "Ventilație",
  "Service & Mentenanță",
] as const;
