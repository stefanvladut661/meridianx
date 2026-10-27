import type { Db } from "./db";
import type { Platforma } from "./limite";
import type { PostRow } from "./postari";
import type { Setari } from "./setari";

/**
 * Ce face o platformă (Instagram, TikTok) pentru coadă: câte un pas din
 * publicare, curățenia de după și întreținerea contului (tokenul). Coada
 * (`lib/postari/coada.ts`) ia rândul, cheamă pasul, apoi scrie rezultatul —
 * doar dacă rândul e tot al ei.
 *
 * Un pas face o singură treabă care se poate relua (copiază, creează
 * containerul, verifică procesarea, publică, urcă o parte) și întoarce ce s-a
 * schimbat. Tot ce trebuie ca o rulare întreruptă să știe unde a rămas se
 * scrie în rând înainte de pasul următor.
 */

/** Coloanele de scris în rând (nume din bază). */
export type Patch = Record<string, unknown>;

export interface StepContext {
  runId: string;
  /** Momentul (ms) până la care trebuie să se termine rularea. */
  deadline: number;
  settings: Setari;
  admin: Db;
  /**
   * Scrie în rând în mijlocul unui pas (ex. momentul cererii de publicare,
   * înainte de cerere). `null` = rândul nu mai e al rulării: pasul se oprește.
   */
  save: (post: PostRow, patch: Patch) => Promise<PostRow | null>;
}

export type StepOutcome =
  /** A făcut un pas; mai e de lucru, chiar acum dacă e timp. */
  | { kind: "progress"; pas: string; patch?: Patch }
  /** Așteaptă platforma (procesare): verifică din nou peste `ms`. Nu e o încercare ratată. */
  | { kind: "wait"; pas?: string; patch?: Patch; ms: number }
  /** Publicată (Instagram, sau TikTok publicat din aplicație). */
  | { kind: "published"; patch?: Patch }
  /** Trimisă în ciornele TikTok. */
  | { kind: "drafted"; patch?: Patch }
  /** A eșuat pasul. `permanent`: nu are rost să reîncerce (ex. clipul refuzat de platformă). */
  | { kind: "error"; message: string; code: string; permanent: boolean; patch?: Patch }
  /** Nu se poate lucra acum din cauza contului (neconectat, token expirat); nu se numără ca încercare. */
  | { kind: "blocked"; message: string; code: string; ms: number; stopQueue: boolean; patch?: Patch };

export interface MaintainOutcome {
  /** Tokenul nu se mai poate reînnoi: coada se oprește, cu motivul ăsta. */
  stopQueue?: { message: string; code: string };
  notes: string[];
}

export interface PlatformHandler {
  platform: Platforma;
  step(post: PostRow, ctx: StepContext): Promise<StepOutcome>;
  /** După o postare terminată (publicată, eșuată, scoasă): șterge ce a rămas (copia temporară). Întoarce coloanele de golit. */
  cleanup?(post: PostRow, ctx: StepContext): Promise<Patch | null>;
  /** La fiecare rulare, înainte de postări: reînnoiește tokenul când e cazul. */
  maintain?(ctx: StepContext): Promise<MaintainOutcome>;
}
