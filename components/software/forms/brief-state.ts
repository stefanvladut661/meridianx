"use client";

import { useCallback, useEffect, useState } from "react";
import type { ProjectTypeId } from "@/lib/estimator-config";

/**
 * Starea brief-ului multi-step (FAZA 5), persistată în sessionStorage.
 *
 * De ce persistăm: brief-ul are cinci pași și omul care compară trei
 * agenții închide tabul la mijloc. Când se întoarce, își găsește
 * răspunsurile — nu îl punem să o ia de la capăt ca pedeapsă.
 *
 * Restaurarea se face în `useEffect`, după montare: primul render e
 * identic pe server și pe client, deci zero erori de hidratare.
 */

const STORAGE_KEY = "meridian_brief_v1";

export interface BriefState {
  type: ProjectTypeId | null;
  screens: number | null;
  features: string[];
  integrations: string[];
  languages: number;
  maintenance: boolean;
  context: string;
  budget: string;
  timeline: string;
  isFunded: boolean;
  fundingLine: string;
  fundingDeadline: string;
  name: string;
  email: string;
  phone: string;
  company: string;
}

export const EMPTY_BRIEF: BriefState = {
  type: null,
  screens: null,
  features: [],
  integrations: [],
  languages: 1,
  maintenance: false,
  context: "",
  budget: "",
  timeline: "",
  isFunded: false,
  fundingLine: "",
  fundingDeadline: "",
  name: "",
  email: "",
  phone: "",
  company: "",
};

export interface UseBriefState {
  state: BriefState;
  /** true după ce am încercat să citim sessionStorage. */
  hydrated: boolean;
  /** true dacă am găsit un brief început într-o sesiune anterioară. */
  restored: boolean;
  set: <K extends keyof BriefState>(key: K, value: BriefState[K]) => void;
  toggleIn: (key: "features" | "integrations", id: string) => void;
  clear: () => void;
}

export function useBriefState(): UseBriefState {
  const [state, setState] = useState<BriefState>(EMPTY_BRIEF);
  const [hydrated, setHydrated] = useState(false);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<BriefState>;
        setState({ ...EMPTY_BRIEF, ...parsed });
        setRestored(true);
      }
    } catch {
      // sessionStorage indisponibil — brief-ul merge, doar nu se ține minte
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      // Un brief neatins nu se salvează, iar `clear()` chiar șterge:
      // altfel efectul ăsta ar rescrie imediat starea goală, iar la
      // vizita următoare am anunța „am găsit brief-ul început” peste
      // un formular gol.
      if (JSON.stringify(state) === JSON.stringify(EMPTY_BRIEF)) {
        sessionStorage.removeItem(STORAGE_KEY);
        return;
      }
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignorăm: persistarea e un confort, nu o condiție de funcționare
    }
  }, [state, hydrated]);

  const set = useCallback(
    <K extends keyof BriefState>(key: K, value: BriefState[K]) => {
      setState((current) => ({ ...current, [key]: value }));
    },
    []
  );

  const toggleIn = useCallback(
    (key: "features" | "integrations", id: string) => {
      setState((current) => {
        const list = current[key];
        return {
          ...current,
          [key]: list.includes(id)
            ? list.filter((item) => item !== id)
            : [...list, id],
        };
      });
    },
    []
  );

  const clear = useCallback(() => {
    setState(EMPTY_BRIEF);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // idem
    }
  }, []);

  return { state, hydrated, restored, set, toggleIn, clear };
}
