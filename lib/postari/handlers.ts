import { instagramHandler } from "./instagram-handler";
import type { Platforma } from "./limite";
import { notConnected, type PlatformHandler } from "./platforme";

/**
 * Ce platformă face fiecare postare din coadă. TikTok se leagă în faza 6;
 * până atunci postările lui așteaptă, cu motivul scris.
 */
export const HANDLERS: Record<Platforma, PlatformHandler> = {
  instagram: instagramHandler,
  tiktok: notConnected("tiktok", "TikTok"),
};
