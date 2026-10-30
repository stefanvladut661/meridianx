"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastTone = "default" | "warn" | "error";

interface Toast {
  id: number;
  text: string;
  tone: ToastTone;
}

interface ToastApi {
  /** Arată o notificare scurtă, jos-dreapta; dispare singură după ~4 secunde. */
  notify: (text: string, tone?: ToastTone) => void;
}

const Ctx = createContext<ToastApi>({ notify: () => undefined });

export const useToast = (): ToastApi => useContext(Ctx);

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((toast) => toast.id !== id)), []);
  const notify = useCallback(
    (text: string, tone: ToastTone = "default") => {
      const id = nextId++;
      setToasts((list) => [...list, { id, text, tone }]);
      setTimeout(() => dismiss(id), 4200);
    },
    [dismiss]
  );
  const api = useMemo(() => ({ notify }), [notify]);

  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-3 bottom-20 z-[60] flex flex-col items-end gap-2 lg:inset-x-auto lg:bottom-5 lg:right-5" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              "pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-xl border px-3.5 py-3 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.9)] animate-rise",
              toast.tone === "error"
                ? "border-rose/25 bg-[#1A1013] text-[#FFC2CE]"
                : toast.tone === "warn"
                  ? "border-apricot/25 bg-[#191310] text-[#FFD0AC]"
                  : "border-mint/25 bg-[#0F1712] text-[#C4F5D8]"
            )}
          >
            {toast.tone === "error" || toast.tone === "warn" ? (
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            ) : (
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            )}
            <p className="flex-1 text-[12.5px] leading-snug">{toast.text}</p>
            <button type="button" onClick={() => dismiss(toast.id)} className="rounded p-0.5 opacity-60 hover:opacity-100" aria-label="Închide notificarea">
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
