import type { Platforma } from "./limite";
import { notConnected, type PlatformHandler } from "./platforme";

/**
 * Ce platformă face fiecare postare din coadă. Instagram se leagă în faza 5,
 * TikTok în faza 6; până atunci postările așteaptă, cu motivul scris.
 */
export const HANDLERS: Record<Platforma, PlatformHandler> = {
  instagram: notConnected("instagram", "Instagram"),
  tiktok: notConnected("tiktok", "TikTok"),
};
