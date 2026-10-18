"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { useReducedMotion } from "@/components/site/motion";

export { useReducedMotion };

/**
 * Elementul e pe ecran acum? Spre deosebire de `<Reveal>`, răspunsul se
 * schimbă la fiecare intrare și ieșire: graficele se opresc când nu le
 * vede nimeni și pornesc la loc când revin.
 */
export function useInView<T extends Element>(
  ref: RefObject<T | null>,
  threshold = 0.2
): boolean {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => setInView(entries[0]?.isIntersecting ?? false),
      { threshold }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, threshold]);
  return inView;
}

/** O singură dată: a intrat elementul în ecran? Pentru intrările în scenă. */
export function useSeen<T extends Element>(ref: RefObject<T | null>): boolean {
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.05 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, seen]);
  return seen;
}

/** Fila e în față? Un grafic dintr-o filă ascunsă n-are de ce să meargă. */
function usePageVisible(): boolean {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const on = () => setVisible(!document.hidden);
    on();
    document.addEventListener("visibilitychange", on);
    return () => document.removeEventListener("visibilitychange", on);
  }, []);
  return visible;
}

export type Showcase = {
  /** Pasul desenat acum. */
  step: number;
  /** Alegerea omului: arată pasul cerut și oprește rotația automată. */
  select: (i: number) => void;
  /** Butonul „următorul”: avansează fără să schimbe modul. */
  next: () => void;
  /** Butonul de pauză. */
  toggle: () => void;
  /** Rotația automată merge (pentru eticheta butonului). */
  running: boolean;
  /** Animațiile CSS stau pe loc: pauză cerută sau grafic ieșit din ecran. */
  frozen: boolean;
  /** Mouse-ul sau focusul țin pasul pe loc (pista de progres stă și ea). */
  holding: boolean;
  reduced: boolean;
  /** Pe zona asta (grafic + text) hover-ul și focusul opresc avansul. */
  zoneRef: RefObject<HTMLDivElement | null>;
};

/**
 * Motorul unui grafic cu pași: probleme, pașii sistemului, servicii.
 *
 * Pașii avansează singuri doar cât graficul e pe ecran, fila e în față,
 * omul nu ține mouse-ul sau focusul pe zonă și n-a apăsat pauză. Timpul
 * rămas dintr-un pas se păstrează peste o pauză — animația CSS a pasului
 * stă și ea pe loc, deci pornesc din nou împreună.
 *
 * Sub prefers-reduced-motion nu avansează nimic: rămâne primul pas, în
 * starea lui finală, iar omul îl schimbă din listă sau din „următorul”.
 */
export function useShowcase(count: number, ms: number): Showcase {
  const reduced = useReducedMotion();
  const zoneRef = useRef<HTMLDivElement | null>(null);
  const inView = useInView(zoneRef, 0.25);
  const pageVisible = usePageVisible();
  const [step, setStep] = useState(0);
  const [auto, setAuto] = useState(true);
  const [held, setHeld] = useState(false);
  const [userPaused, setUserPaused] = useState(false);

  const left = useRef(ms);
  const token = useRef(0);

  const goto = useCallback(
    (i: number) => {
      token.current += 1;
      left.current = ms;
      setStep(((i % count) + count) % count);
    },
    [count, ms]
  );

  const active = auto && !userPaused && inView && pageVisible && !held && !reduced;

  useEffect(() => {
    if (!active || count < 2) return;
    const mine = token.current;
    const t0 = performance.now();
    const id = window.setTimeout(() => goto(step + 1), Math.max(0, left.current));
    return () => {
      window.clearTimeout(id);
      // Oprit la jumătatea pasului: ținem minte cât mai avea.
      if (token.current === mine) left.current -= performance.now() - t0;
    };
  }, [active, step, count, goto]);

  /* Hover și focus pe zonă: cine citește lista nu vrea ca rândul activ
     să-i fugă de sub ochi. */
  useEffect(() => {
    const el = zoneRef.current;
    if (!el) return;
    let hover = false;
    let focus = false;
    const sync = () => setHeld(hover || focus);
    const enter = (e: PointerEvent) => {
      if (e.pointerType === "mouse") {
        hover = true;
        sync();
      }
    };
    const leave = () => {
      hover = false;
      sync();
    };
    const fin = () => {
      focus = el.matches(":focus-within");
      sync();
    };
    // Focusul care trece de la un rând la altul nu e o ieșire din zonă:
    // verificăm abia după ce s-a așezat pe noul element.
    const fout = () => requestAnimationFrame(fin);
    el.addEventListener("pointerenter", enter);
    el.addEventListener("pointerleave", leave);
    el.addEventListener("focusin", fin);
    el.addEventListener("focusout", fout);
    return () => {
      el.removeEventListener("pointerenter", enter);
      el.removeEventListener("pointerleave", leave);
      el.removeEventListener("focusin", fin);
      el.removeEventListener("focusout", fout);
    };
  }, []);

  const select = useCallback(
    (i: number) => {
      setAuto(false);
      setUserPaused(false);
      goto(i);
    },
    [goto]
  );

  const next = useCallback(() => goto(step + 1), [goto, step]);

  const running = auto && !userPaused && !reduced;

  const toggle = useCallback(() => {
    if (running) {
      setUserPaused(true);
    } else {
      setUserPaused(false);
      setAuto(true);
    }
  }, [running]);

  return {
    step,
    select,
    next,
    toggle,
    running,
    frozen: userPaused || !inView || !pageVisible,
    holding: held,
    reduced,
    zoneRef,
  };
}
