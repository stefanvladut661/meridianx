"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

/**
 * FIȘIER ÎNGHEȚAT după FAZA 0 — cereri de modificare în PLAN.md.
 *
 * Utilizare: învelește zona (de regulă layout-ul diviziei) în
 * <ToastProvider> și cheamă `toast({ title })` din useToast().
 * Regiunea e aria-live, deci cititoarele de ecran anunță mesajul —
 * folosit obligatoriu la confirmarea formularelor (CLAUDE.md §8).
 */

export interface ToastOptions {
  title: string;
  description?: string;
  variant?: "default" | "success" | "error";
  /** ms; default 5000. Erorile nu se închid singure. */
  duration?: number;
}

interface ToastItem extends ToastOptions {
  id: number;
}

const ToastContext = createContext<((options: ToastOptions) => void) | null>(
  null
);

export function useToast() {
  const toast = useContext(ToastContext);
  if (!toast) {
    throw new Error("useToast se folosește în interiorul <ToastProvider>.");
  }
  return toast;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (options: ToastOptions) => {
      const id = nextId.current++;
      setToasts((current) => [...current, { id, ...options }]);
      const duration =
        options.duration ?? (options.variant === "error" ? null : 5000);
      if (duration !== null) {
        setTimeout(() => dismiss(id), duration);
      }
    },
    [dismiss]
  );

  const value = useMemo(() => toast, [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        role="status"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-(--z-toast) flex flex-col items-center gap-2 sm:inset-x-auto sm:right-6 sm:items-end"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto w-full max-w-sm rounded-md border bg-surface p-4 text-fg shadow-raised",
              t.variant === "success" && "border-accent",
              t.variant === "error" && "border-red-400",
              (!t.variant || t.variant === "default") && "border-line"
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium">{t.title}</p>
                {t.description ? (
                  <p className="mt-1 text-sm text-muted">{t.description}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Închide notificarea"
                className="rounded-sm p-0.5 text-muted transition-colors hover:text-fg"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 16 16"
                  className="size-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path d="M3 3l10 10M13 3L3 13" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
