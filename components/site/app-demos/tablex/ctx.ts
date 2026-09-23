import { createContext, useContext } from "react";
import type { Client, Rez, StatusRez } from "./data";
import type { Toast } from "./ui";

/* Starea comună a demo-ului: rezervările zilei, ceasul, notificările.
   Un walk-in așezat pe hartă apare în listă; o cerere trimisă din
   pagina publică intră în panou — ca în aplicația reală, prin Realtime. */

export type Ecran = "harta" | "rezervari" | "acasa" | "widget" | "client" | "evenimente" | "retea";

export const ECRANE: Ecran[] = ["harta", "rezervari", "acasa", "widget", "client", "evenimente", "retea"];

export type Notificare = {
  id: number;
  text: string;
  desc: string;
  ecran: Ecran;
  rezId?: string;
  citita: boolean;
  cand: string;
};

export type DemoCtx = {
  mobil: boolean;
  reducedMotion: boolean;
  /** Ora demo-ului, zecimal. Avansează un minut la câteva secunde. */
  acum: number;
  rez: Rez[];
  setRez: (f: (r: Rez[]) => Rez[]) => void;
  adaugaRez: (r: Omit<Rez, "id">) => Rez;
  schimbaStatus: (id: string, s: StatusRez) => void;
  toast: (t: Omit<Toast, "id">) => void;
  notify: (mesaj: string) => void;
  go: (e: Ecran) => void;
  /** Deschide fișa unui client în CRM. */
  deschideClient: (clientId: string) => void;
  clientAles: string | null;
  /** Rezervarea de evidențiat în listă (venită din widget sau notificare). */
  rezEvidentiata: string | null;
  evidentiaza: (id: string | null) => void;
  notificari: Notificare[];
  citesteNotificari: () => void;
  credite: number;
  bilete: number;
  setBilete: (f: (n: number) => number) => void;
  popupEveniment: boolean;
  /** Etichetele și notele editate în CRM, peste datele generate. */
  editari: Record<string, Partial<Pick<Client, "taguri" | "note">>>;
  editeazaClient: (id: string, patch: Partial<Pick<Client, "taguri" | "note">>) => void;
  setPopupEveniment: (v: boolean) => void;
  /** Rădăcina demo-ului: dialogurile se montează aici, peste tot ecranul. */
  portal: HTMLElement | null;
};

export const Ctx = createContext<DemoCtx | null>(null);

export function useDemo(): DemoCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useDemo în afara demo-ului TableX");
  return c;
}
