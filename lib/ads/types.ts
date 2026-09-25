import type { Platform } from "./constants";
import type { PlanProblem } from "./plan-validate";

/**
 * Ce ajunge în browser din verificarea și crearea pe platformă (Meta sau
 * TikTok). Fișier izomorf, doar tipuri: niciun token, nimic din răspunsurile
 * brute ale platformei în afara
 * câmpurilor alese aici.
 */

/** Un nume din plan și ce a găsit platforma pentru el. */
export interface ResolvedName {
  /** Calea din plan (`audience.locations.1`) — pentru „du-mă la câmp". */
  path: string;
  /** Ce scria în plan. */
  asked: string;
  /** Ce a găsit platforma, spus complet („Cluj-Napoca, Cluj County, Romania"). `null` = nimic. */
  found: string | null;
  /** Cheia/id-ul platformei care intră în targetare. */
  key: string | null;
  /** Id-ul sau cheia era deja scrisă în plan — n-a fost nevoie de căutare. */
  given: boolean;
}

export interface AdAccountInfo {
  id: string;
  name: string;
  currency: string;
  /** Starea contului spusă în română („activ", „dezactivat"…). */
  state: string;
  usable: boolean;
}

export interface VideoInfo {
  id: string;
  title: string | null;
  lengthSeconds: number | null;
  thumbnailUrl: string | null;
  ready: boolean;
}

export interface PlatformCheck {
  platform: Platform;
  /** Nicio eroare: se poate crea. */
  ok: boolean;
  /**
   * Amprenta a ce s-a verificat (plan + ce a găsit platforma). Crearea o
   * recalculează pe server și refuză dacă diferă: omul creează exact ce a văzut.
   */
  fingerprint: string;
  checkedAt: string;
  account: AdAccountInfo | null;
  /** În numele cui apare reclama: pagina de Facebook (Meta) sau identitatea TikTok. */
  identity: { id: string; name: string } | null;
  instagram: { id: string; username: string } | null;
  pixel: { id: string; name: string } | null;
  video: VideoInfo | null;
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

export type CheckResponse =
  | { ok: true; check: PlatformCheck }
  | { ok: false; message: string; problems?: PlanProblem[] };

/** Un obiect creat pe platformă, cu linkul lui. */
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
      /** Campania există pe platformă, dar n-a putut fi salvată în baza portalului. */
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

/** Starea unui video nou pe platformă, după ce i-am dat linkul spre fișier. */
export interface UploadStatus {
  state: "copying" | "processing" | "ready" | "error";
  /** Procentul procesării, când platforma îl dă. */
  progress: number | null;
  /** Motivul, la `error`. */
  message: string | null;
}

type Failure = { ok: false; message: string };

/** Acțiunile urcării, legate de spațiul curent de editor. */
export interface UploadActions {
  prepare: (file: { name: string; size: number; type: string }) => Promise<
    { ok: true; uploadUrl: string; name: string } | Failure
  >;
  send: (input: { stagingName: string; fileName: string }) => Promise<{ ok: true; videoId: string } | Failure>;
  status: (input: { videoId: string; stagingName: string }) => Promise<{ ok: true; status: UploadStatus } | Failure>;
}

export type LibraryResponse =
  | { ok: true; videos: LibraryVideo[]; truncated: boolean }
  | { ok: false; message: string };
