import type { PlanProblem } from "../plan-validate";

/**
 * Ce ajunge în browser din verificarea și crearea pe Meta. Fișier izomorf,
 * doar tipuri: niciun token, nimic din răspunsurile brute ale Meta în afara
 * câmpurilor alese aici.
 */

/** Un nume din plan și ce a găsit Meta pentru el. */
export interface ResolvedName {
  /** Calea din plan (`audience.locations.1`) — pentru „du-mă la câmp". */
  path: string;
  /** Ce scria în plan. */
  asked: string;
  /** Ce a găsit Meta, spus complet („Cluj-Napoca, Cluj County, Romania"). `null` = nimic. */
  found: string | null;
  /** Cheia/id-ul Meta care intră în targetare. */
  key: string | null;
  /** Id-ul sau cheia era deja scrisă în plan — n-a fost nevoie de căutare. */
  given: boolean;
}

export interface MetaAccountInfo {
  id: string;
  name: string;
  currency: string;
  /** Starea contului spusă în română („activ", „dezactivat"…). */
  state: string;
  usable: boolean;
}

export interface MetaVideoInfo {
  id: string;
  title: string | null;
  lengthSeconds: number | null;
  thumbnailUrl: string | null;
  ready: boolean;
}

export interface MetaCheck {
  /** Nicio eroare: se poate crea. */
  ok: boolean;
  /**
   * Amprenta a ce s-a verificat (plan + ce a găsit Meta). Crearea o
   * recalculează pe server și refuză dacă diferă: omul creează exact ce a văzut.
   */
  fingerprint: string;
  checkedAt: string;
  account: MetaAccountInfo | null;
  page: { id: string; name: string } | null;
  instagram: { id: string; username: string } | null;
  pixel: { id: string; name: string } | null;
  video: MetaVideoInfo | null;
  /**
   * Beneficiarul și plătitorul (DSA), cum vor apărea pe reclamă în UE.
   * `null` = publicul nu e în UE, deci nu se trimit.
   */
  dsa: { beneficiary: string | null; payor: string | null; source: "plan" | "cont" | "plan și cont" } | null;
  /** Domeniul conversiei (`conversion_domain`), pe campaniile cu pixel. */
  conversionDomain: string | null;
  locations: ResolvedName[];
  languages: ResolvedName[];
  interests: ResolvedName[];
  behaviors: ResolvedName[];
  errors: PlanProblem[];
  warnings: PlanProblem[];
}

export type MetaCheckResponse =
  | { ok: true; check: MetaCheck }
  | { ok: false; message: string; problems?: PlanProblem[] };

/** Un obiect creat în Meta, cu linkul lui. */
export interface CreatedObject {
  kind: "image" | "campaign" | "adset" | "creative" | "ad";
  id: string;
  name: string;
}

export type CreateResponse =
  | {
      ok: true;
      /** Rândul din `ads_campaigns`; null dacă salvarea în bază a eșuat. */
      recordId: string | null;
      adsManagerUrl: string;
      created: CreatedObject[];
      /** Campania există în Meta, dar n-a putut fi salvată în baza portalului. */
      storeWarning: string | null;
    }
  | {
      ok: false;
      message: string;
      problems?: PlanProblem[];
      /** Planul trebuie verificat din nou (s-a schimbat ceva de la verificare). */
      recheck?: boolean;
      /** Același plan a fost creat recent — cere confirmare explicită. */
      duplicate?: { createdAt: string; adsManagerUrl: string; recordId: string };
      /** Ce apucase să se creeze înainte de eroare — totul pe pauză. */
      partial?: { adsManagerUrl: string; created: CreatedObject[]; recordId: string | null };
    };

export interface LibraryVideo {
  id: string;
  title: string | null;
  lengthSeconds: number | null;
  createdAt: string | null;
  thumbnailUrl: string | null;
  ready: boolean;
}

export type LibraryResponse =
  | { ok: true; videos: LibraryVideo[]; truncated: boolean }
  | { ok: false; message: string };
