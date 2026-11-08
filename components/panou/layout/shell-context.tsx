"use client";

import { createContext, useContext, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Ce împarte cadrul cu ecranele de sub el.
 *
 * `pendingPath`: pagina spre care s-a apăsat și încă n-a venit de la server.
 * Meniul o arată deja activă, iar conținutul arată scheletul — clicul se vede
 * imediat, oricât durează citirea.
 *
 * `slots`: locurile din bara de sus în care un modul își pune selectoarele
 * (clientul și perioada la Reclame, platforma la Postări). Cadrul stă în
 * layout-ul comun, deci un modul nu-l mai poate primi ca prop: le trimite
 * printr-un portal (`TopbarSelectors`).
 */
interface ShellContextValue {
  pendingPath: string | null;
  slots: { wide: HTMLElement | null; narrow: HTMLElement | null };
}

const ShellContext = createContext<ShellContextValue>({ pendingPath: null, slots: { wide: null, narrow: null } });

export const ShellContextProvider = ShellContext.Provider;

/** Calea pe care meniul o arată activă: cea apăsată, până vine, altfel cea curentă. */
export function useShownPath(pathname: string): string {
  return useContext(ShellContext).pendingPath ?? pathname;
}

/** Selectoarele modulului, în bara de sus: pe rândul ei de la 1280 px, dedesubt sub 1280 px. */
export function TopbarSelectors({ children }: { children: ReactNode }) {
  const { slots } = useContext(ShellContext);
  return (
    <>
      {slots.wide ? createPortal(children, slots.wide) : null}
      {slots.narrow ? createPortal(<div className="pu-no-scrollbar overflow-x-auto">{children}</div>, slots.narrow) : null}
    </>
  );
}
