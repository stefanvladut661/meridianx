"use client";

import { useId, useState } from "react";
import {
  GENERATOR_DEFAULTS,
  GENERATOR_MAX,
  GENERATOR_MIN,
  entropyBits,
  generatePassword,
  type GeneratorOptions,
} from "@/lib/vault/generate";
import { BTN_SM, BTN_SM_LIGHT } from "./ui";

/**
 * Generatorul de parole, în editor (feat/vault, faza 4).
 *
 * Bloc inline sub câmpul secret, nu popover: n-are nevoie de
 * poziționare și rămâne în fluxul tastaturii. Lungimea, cifrele,
 * simbolurile — și sub previzualizare, ÎN MONO, entropia reală în biți:
 * cifra din care iese „e destul de tare?", nu o bară colorată.
 */
export function PasswordGenerator({
  onUse,
  onClose,
}: {
  onUse: (password: string) => void;
  onClose: () => void;
}) {
  const ids = { length: useId(), digits: useId(), symbols: useId() };
  const [options, setOptions] = useState<GeneratorOptions>(GENERATOR_DEFAULTS);
  const [password, setPassword] = useState(() => generatePassword(GENERATOR_DEFAULTS));

  function update(partial: Partial<GeneratorOptions>) {
    const next = { ...options, ...partial };
    setOptions(next);
    setPassword(generatePassword(next));
  }

  return (
    <div className="mt-3 rounded-panel-sm border border-hair-strong bg-char p-3">
      <p className="break-all font-md-mono text-[13.5px] leading-relaxed text-bone select-all">{password}</p>
      <p className="mt-1 font-md-mono text-[11px] tracking-[0.06em] text-dim tabular-nums">
        {options.length} caractere · {entropyBits(options)} biți de entropie
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-bone">
        <label htmlFor={ids.length} className="flex items-center gap-2">
          <span className="text-dim">lungime</span>
          <input
            id={ids.length}
            type="range"
            min={GENERATOR_MIN}
            max={GENERATOR_MAX}
            value={options.length}
            onChange={(event) => update({ length: Number(event.target.value) })}
            className="w-28 accent-[#edeef2]"
          />
          <span className="w-6 font-md-mono text-[12px] tabular-nums">{options.length}</span>
        </label>
        <label htmlFor={ids.digits} className="flex cursor-pointer items-center gap-2">
          <input
            id={ids.digits}
            type="checkbox"
            checked={options.digits}
            onChange={(event) => update({ digits: event.target.checked })}
            className="h-4 w-4 accent-[#edeef2]"
          />
          cifre
        </label>
        <label htmlFor={ids.symbols} className="flex cursor-pointer items-center gap-2">
          <input
            id={ids.symbols}
            type="checkbox"
            checked={options.symbols}
            onChange={(event) => update({ symbols: event.target.checked })}
            className="h-4 w-4 accent-[#edeef2]"
          />
          simboluri
        </label>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => onUse(password)} className={BTN_SM_LIGHT}>
          Folosește parola
        </button>
        <button type="button" onClick={() => setPassword(generatePassword(options))} className={BTN_SM}>
          Alta
        </button>
        <button type="button" onClick={onClose} className={BTN_SM}>
          Închide
        </button>
      </div>
    </div>
  );
}
