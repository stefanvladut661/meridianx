"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { CornerDownLeft, Search, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Modal } from "../ui/modal";
import { firmaModule, modules } from "./nav";

interface Entry {
  id: string;
  label: string;
  hint: string;
  to: string;
  icon: LucideIcon;
}

/** Fără diacritice și fără majuscule: „postari” găsește „Postări”. */
const fold = (value: string): string => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const ENTRIES: Entry[] = [...modules, firmaModule].flatMap((module) => [
  { id: module.to, label: module.label, hint: "Modul", to: module.to, icon: module.icon },
  ...module.items.filter((item) => item.to !== module.to).map((item) => ({ id: item.to, label: item.label, hint: module.label, to: item.to, icon: module.icon })),
]);

/** Căutarea de ecrane (Ctrl+K), ca în prototip: săgeți, Enter, Esc. */
export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setIndex(0);
    const timer = setTimeout(() => input.current?.focus(), 40);
    return () => clearTimeout(timer);
  }, [open]);

  const items = useMemo(() => {
    if (!query.trim()) return ENTRIES.slice(0, 14);
    const needle = fold(query);
    return ENTRIES.filter((entry) => fold(`${entry.label} ${entry.hint}`).includes(needle)).slice(0, 14);
  }, [query]);

  const go = (entry: Entry | undefined) => {
    if (!entry) return;
    onOpenChange(false);
    router.push(entry.to);
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} label="Caută sau rulează o comandă" className="mt-[14vh] max-w-xl overflow-hidden rounded-[20px] border-white/[0.1] bg-[#101014] p-0">
      <div className="flex items-center gap-2.5 border-b border-white/[0.07] px-4 py-3">
        <Search className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <input
          ref={input}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setIndex(0);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setIndex((current) => Math.min(current + 1, items.length - 1));
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              setIndex((current) => Math.max(current - 1, 0));
            }
            if (event.key === "Enter") {
              event.preventDefault();
              go(items[index]);
            }
          }}
          placeholder="Caută un ecran sau un modul…"
          aria-label="Caută"
          className="h-7 flex-1 bg-transparent text-[14px] outline-none placeholder:text-muted-foreground/70"
        />
        <kbd className="rounded border border-white/[0.1] px-1.5 py-0.5 text-[10px] text-muted-foreground">esc</kbd>
      </div>
      <ul role="listbox" aria-label="Rezultate" className="max-h-[52vh] overflow-y-auto p-2">
        {items.length === 0 ? (
          <li className="px-3 py-8 text-center text-[13px] text-muted-foreground">Nimic pentru „{query}”. Încearcă numele modulului sau al ecranului.</li>
        ) : (
          items.map((item, position) => (
            <li key={item.id} role="option" aria-selected={position === index}>
              <button
                type="button"
                onMouseEnter={() => setIndex(position)}
                onClick={() => go(item)}
                className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors", position === index ? "bg-white/[0.08]" : "hover:bg-white/[0.04]")}
              >
                <item.icon className="h-4 w-4 shrink-0 text-foreground/40" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-[13px]">{item.label}</span>
                <span className="shrink-0 text-[10.5px] uppercase tracking-[0.1em] text-muted-foreground">{item.hint}</span>
                {position === index ? <CornerDownLeft className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" /> : null}
              </button>
            </li>
          ))
        )}
      </ul>
      <div className="flex items-center gap-3 border-t border-white/[0.07] px-4 py-2 text-[10.5px] text-muted-foreground">
        <span>↑↓ alege</span>
        <span>↵ deschide</span>
        <span className="ml-auto">Ctrl+K oriunde</span>
      </div>
    </Modal>
  );
}
