import { instagramHandler } from "./instagram-handler";
import type { Platforma } from "./limite";
import type { PlatformHandler } from "./platforme";
import { tiktokHandler } from "./tiktok-handler";

/** Ce platformă face fiecare postare din coadă. */
export const HANDLERS: Record<Platforma, PlatformHandler> = {
  instagram: instagramHandler,
  tiktok: tiktokHandler,
};
