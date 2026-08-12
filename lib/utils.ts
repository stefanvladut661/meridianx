import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * FIȘIER ÎNGHEȚAT după FAZA 0 — cereri de modificare în PLAN.md.
 */

/** Compune clase Tailwind cu rezolvarea conflictelor (ultima câștigă). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
