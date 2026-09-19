"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { AuthError, SupabaseClient } from "@supabase/supabase-js";
import { normalizeEmail, ready, VaultCryptoError, wipe } from "@/lib/vault/crypto";
import { deriveMasterMaterialAsync } from "@/lib/vault/kdf";
import { getVaultClient } from "@/lib/vault/supabase";
import {
  fetchOwnMember,
  openKeys,
  registerKeys,
  VaultDataError,
  type KeyMaterial,
} from "@/lib/vault/members";

/**
 * Mașina de stări a vault-ului (feat/vault, faza 2).
 *
 * Tot ce e secret stă în ref-uri, nu în state: KEK-ul (cât e nevoie de
 * el), cheile membrului și DEK-ul (după deblocare). State-ul React
 * ține doar ÎN CE ECRAN suntem și ce mesaj are omul de citit. Nimic
 * din ref-uri nu ajunge în DOM, în URL sau în storage.
 *
 * Fazele, în ordinea în care le parcurge un cont:
 *
 *   locked ──unlock/activate──▶ busy ──▶ keys-missing ──registerKeys──▶ busy ─┬─▶ recovery-code ──▶ unlocked
 *                                  │                                          └─▶ pending ──recheck──▶ unlocked
 *                                  └─▶ pending / unlocked (cont care are deja chei)
 *
 * KEK-ul se șterge în clipa în care nu mai e nevoie de el: la deblocare
 * (cheile sunt deschise) și la blocare. Rămâne în memorie cât un membru
 * e „în așteptare" — după aprobare, cu el se desface cheia privată.
 *
 * Contract pentru fazele următoare: `useVault()` → `{ phase, member,
 * supabase, keys, lock }`. `keys.dek` e cheia intrărilor; `supabase` e
 * clientul cu sesiune. Ambele sunt non-null DOAR când `phase.kind ===
 * "unlocked"`.
 */

// ---------------------------------------------------------------------------
// Tipuri
// ---------------------------------------------------------------------------

export type BusyStep =
  | "deriving"
  | "signing-in"
  | "updating-password"
  | "opening"
  | "registering";

export type VaultPhase =
  | { kind: "locked" }
  /** `from`: ecranul din care a pornit — el rămâne montat și arată
      progresul, ca starea lui (modul, emailul tastat) să nu se piardă
      dacă pasul eșuează. */
  | { kind: "busy"; step: BusyStep; startedAt: number; from: "locked" | "onboarding" }
  /** Sesiune reală, fără chei în `vault_members` (sau chei vechi, în
      așteptare, împachetate cu o parolă care nu mai e — `replacing`). */
  | { kind: "keys-missing"; replacing: boolean }
  | { kind: "recovery-code"; code: string }
  | { kind: "pending" }
  | { kind: "unlocked" };

export interface VaultMemberIdentity {
  id: string;
  email: string;
}

export interface VaultContextValue {
  phase: VaultPhase;
  /** Ultima eroare, de afișat în ecranul curent. Se șterge la orice acțiune nouă. */
  error: string | null;
  /** Mesaj informativ, nu eroare (ex. motivul blocării). */
  notice: string | null;
  member: VaultMemberIdentity | null;
  supabase: SupabaseClient | null;
  keys: KeyMaterial | null;
  /** Cât a durat ultima derivare Argon2id, în ms — informație reală,
      afișată ca atare. */
  lastKdfMs: number | null;

  unlock: (email: string, masterPassword: string) => Promise<void>;
  activate: (email: string, temporaryPassword: string, masterPassword: string) => Promise<void>;
  registerKeys: () => Promise<void>;
  acknowledgeRecoveryCode: () => void;
  recheckPending: () => Promise<void>;
  lock: (notice?: string) => Promise<void>;
  /** Milisecunde până la auto-blocare, sau `null` când nu curge. */
  remainingUntilAutoLock: () => number | null;
}

/** 15 minute fără mouse sau tastatură → blocare. */
export const AUTO_LOCK_MS = 15 * 60 * 1000;

const VaultContext = createContext<VaultContextValue | null>(null);

// ---------------------------------------------------------------------------
// Erori de autentificare → mesaje
// ---------------------------------------------------------------------------

/** Același mesaj pentru cont inexistent și parolă greșită: formularul nu
    trebuie să fie un instrument de aflat ce conturi există. */
function describeAuthError(error: AuthError, context: "unlock" | "activate" | "update"): string {
  const code = error.code ?? "";
  // Fără răspuns HTTP (status 0 / `AuthRetryableFetchError`): rețeaua,
  // nu contul.
  if (!error.status || /fetch|network/i.test(error.message)) {
    return "Nu ne putem conecta la Supabase. Verifică rețeaua și încearcă din nou.";
  }
  if (code === "invalid_credentials" || error.status === 400) {
    return context === "activate"
      ? "Email sau parolă temporară greșite."
      : "Email sau parolă master greșite. Prima dată aici? Activează contul.";
  }
  if (code === "over_request_rate_limit" || error.status === 429) {
    return "Prea multe încercări. Așteaptă un minut și încearcă din nou.";
  }
  if (code === "email_not_confirmed") {
    return "Contul există, dar emailul nu e confirmat. Din Supabase → Authentication → Users, confirmă-l.";
  }
  if (context === "update") {
    return `Parola temporară nu s-a putut înlocui: ${error.message}`;
  }
  return `Autentificarea a eșuat: ${error.message}`;
}

/** Eroare de autentificare deja tradusă pentru om. */
class AuthFailure extends Error {}

function describeError(error: unknown): string {
  if (
    error instanceof VaultCryptoError ||
    error instanceof VaultDataError ||
    error instanceof AuthFailure
  ) {
    return error.message;
  }
  if (error instanceof Error && /fetch|network/i.test(error.message)) {
    return "Nu ne putem conecta la Supabase. Verifică rețeaua și încearcă din nou.";
  }
  return "Ceva a mers prost și nu știm exact ce. Reîncarcă pagina și încearcă din nou.";
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function VaultProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<VaultPhase>({ kind: "locked" });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [member, setMember] = useState<VaultMemberIdentity | null>(null);
  const [lastKdfMs, setLastKdfMs] = useState<number | null>(null);

  const kekRef = useRef<Uint8Array | null>(null);
  const keysRef = useRef<KeyMaterial | null>(null);
  const memberRef = useRef<VaultMemberIdentity | null>(null);
  const lastActivityRef = useRef<number>(0);
  const phaseRef = useRef<VaultPhase>(phase);
  phaseRef.current = phase;

  // Doar în browser: pe server nu există sesiune și nici nevoie de client.
  const supabase = useMemo(() => (typeof window === "undefined" ? null : getVaultClient()), []);

  const wipeSecrets = useCallback(() => {
    wipe(kekRef.current);
    kekRef.current = null;
    if (keysRef.current) {
      wipe(keysRef.current.dek, keysRef.current.privateKey, keysRef.current.publicKey);
      keysRef.current = null;
    }
  }, []);

  const lock = useCallback(
    async (reason?: string) => {
      wipeSecrets();
      memberRef.current = null;
      setMember(null);
      setPhase({ kind: "locked" });
      setError(null);
      setNotice(reason ?? null);
      // `local`: doar sesiunea din memoria acestei file. Un `global` ar
      // revoca toate sesiunile contului — inclusiv una de admin, dacă
      // cineva ar folosi (greșit) aceeași adresă.
      await supabase?.auth.signOut({ scope: "local" }).catch(() => undefined);
    },
    [supabase, wipeSecrets]
  );

  /** Eșec înainte de deblocare: nimic nu rămâne în urmă. */
  const failAndLock = useCallback(
    async (message: string) => {
      await lock();
      setError(message);
    },
    [lock]
  );

  /**
   * După o sesiune validă și un KEK în memorie: unde ajunge contul?
   * `replacing` = tocmai a activat contul cu o parolă nouă, deci un
   * eventual rând „în așteptare" are chei împachetate cu o parolă care
   * nu mai există și trebuie înlocuite.
   */
  const resolveMember = useCallback(
    async (identity: VaultMemberIdentity, replacing: boolean, from: "locked" | "onboarding") => {
      if (!supabase) return;
      setPhase({ kind: "busy", step: "opening", startedAt: Date.now(), from });

      const row = await fetchOwnMember(supabase, identity.id);

      if (!row) {
        setPhase({ kind: "keys-missing", replacing: false });
        return;
      }

      if (!row.wrappedDek) {
        setPhase(replacing ? { kind: "keys-missing", replacing: true } : { kind: "pending" });
        return;
      }

      const kek = kekRef.current;
      if (!kek) throw new VaultCryptoError("invalid_input", "Cheia de deblocare lipsește din memorie.");

      try {
        keysRef.current = openKeys(row, kek);
      } catch (cause) {
        if (cause instanceof VaultCryptoError && cause.code === "decrypt_failed") {
          throw new VaultCryptoError(
            "decrypt_failed",
            replacing
              ? "Cheile tale sunt împachetate cu parola master veche. Recuperarea cu codul vine într-o fază următoare — până atunci, un membru activ te poate elimina și reinvita."
              : "Sesiunea e validă, dar cheile nu s-au putut deschide cu parola asta. Rândul tău din vault pare alterat — spune-i echipei."
          );
        }
        throw cause;
      }

      wipe(kek);
      kekRef.current = null;
      setPhase({ kind: "unlocked" });
    },
    [supabase]
  );

  const unlock = useCallback(
    async (emailInput: string, masterPassword: string) => {
      if (!supabase) return;
      setError(null);
      setNotice(null);
      const email = normalizeEmail(emailInput);

      try {
        setPhase({ kind: "busy", step: "deriving", startedAt: Date.now(), from: "locked" });
        const t0 = performance.now();
        const material = await deriveMasterMaterialAsync(email, masterPassword);
        setLastKdfMs(Math.round(performance.now() - t0));
        kekRef.current = material.kek;

        setPhase({ kind: "busy", step: "signing-in", startedAt: Date.now(), from: "locked" });
        const { data, error: authError } = await supabase.auth.signInWithPassword({
          email,
          password: material.authHash,
        });
        if (authError || !data.user) {
          throw new AuthFailure(authError ? describeAuthError(authError, "unlock") : "Fără sesiune.");
        }

        await ready();
        const identity = { id: data.user.id, email: data.user.email ?? email };
        memberRef.current = identity;
        setMember(identity);
        await resolveMember(identity, false, "locked");
      } catch (cause) {
        await failAndLock(describeError(cause));
      }
    },
    [supabase, resolveMember, failAndLock]
  );

  const activate = useCallback(
    async (emailInput: string, temporaryPassword: string, masterPassword: string) => {
      if (!supabase) return;
      setError(null);
      setNotice(null);
      const email = normalizeEmail(emailInput);

      try {
        // Întâi sesiunea cu parola temporară — dacă e greșită, nu are
        // rost să ardem 3 secunde de Argon2id.
        setPhase({ kind: "busy", step: "signing-in", startedAt: Date.now(), from: "locked" });
        const { data, error: authError } = await supabase.auth.signInWithPassword({
          email,
          password: temporaryPassword,
        });
        if (authError || !data.user) {
          throw new AuthFailure(authError ? describeAuthError(authError, "activate") : "Fără sesiune.");
        }

        setPhase({ kind: "busy", step: "deriving", startedAt: Date.now(), from: "locked" });
        const t0 = performance.now();
        const material = await deriveMasterMaterialAsync(email, masterPassword);
        setLastKdfMs(Math.round(performance.now() - t0));
        kekRef.current = material.kek;

        // Din clipa asta, parola Supabase a contului e authHash-ul:
        // contul nu mai poate intra nicăieri cu o parolă tastată.
        setPhase({ kind: "busy", step: "updating-password", startedAt: Date.now(), from: "locked" });
        const { error: updateError } = await supabase.auth.updateUser({
          password: material.authHash,
        });
        if (updateError) throw new AuthFailure(describeAuthError(updateError, "update"));

        await ready();
        const identity = { id: data.user.id, email: data.user.email ?? email };
        memberRef.current = identity;
        setMember(identity);
        await resolveMember(identity, true, "locked");
      } catch (cause) {
        await failAndLock(describeError(cause));
      }
    },
    [supabase, resolveMember, failAndLock]
  );

  const registerKeysAction = useCallback(async () => {
    const identity = memberRef.current;
    const kek = kekRef.current;
    if (!supabase || !identity || !kek) return;
    setError(null);
    const previous = phaseRef.current;

    try {
      setPhase({ kind: "busy", step: "registering", startedAt: Date.now(), from: "onboarding" });
      const result = await registerKeys(supabase, identity.id, kek);
      if (result.outcome === "bootstrapped") {
        keysRef.current = result.keys;
        wipe(kek);
        kekRef.current = null;
        setPhase({ kind: "recovery-code", code: result.recoveryCode });
      } else {
        setPhase({ kind: "pending" });
      }
    } catch (cause) {
      setPhase(previous);
      setError(describeError(cause));
    }
  }, [supabase]);

  const acknowledgeRecoveryCode = useCallback(() => {
    if (phaseRef.current.kind !== "recovery-code" || !keysRef.current) return;
    setPhase({ kind: "unlocked" });
  }, []);

  const recheckPending = useCallback(async () => {
    const identity = memberRef.current;
    if (!supabase || !identity) return;
    setError(null);
    try {
      await resolveMember(identity, false, "onboarding");
    } catch (cause) {
      setPhase({ kind: "pending" });
      setError(describeError(cause));
    }
  }, [supabase, resolveMember]);

  // ---------------------------------------------------------------------
  // Auto-blocare: cât timp există ceva de protejat în memorie.
  // ---------------------------------------------------------------------

  const armed =
    phase.kind === "unlocked" ||
    phase.kind === "pending" ||
    phase.kind === "keys-missing" ||
    phase.kind === "recovery-code";

  useEffect(() => {
    if (!armed) return;
    lastActivityRef.current = Date.now();

    const touch = () => {
      lastActivityRef.current = Date.now();
    };
    const events: Array<keyof DocumentEventMap> = ["pointerdown", "keydown", "wheel", "touchstart"];
    for (const name of events) document.addEventListener(name, touch, { passive: true });

    const interval = window.setInterval(() => {
      if (Date.now() - lastActivityRef.current >= AUTO_LOCK_MS) {
        void lock("Vault-ul s-a blocat singur după 15 minute fără activitate.");
      }
    }, 1000);

    return () => {
      for (const name of events) document.removeEventListener(name, touch);
      window.clearInterval(interval);
    };
  }, [armed, lock]);

  const remainingUntilAutoLock = useCallback(() => {
    if (!armed) return null;
    return Math.max(0, AUTO_LOCK_MS - (Date.now() - lastActivityRef.current));
  }, [armed]);

  // La închiderea filei, memoria dispare oricum; ștergem explicit ca
  // buffer-ele să nu supraviețuiască în bfcache.
  useEffect(() => {
    const onPageHide = () => wipeSecrets();
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, [wipeSecrets]);

  const value = useMemo<VaultContextValue>(
    () => ({
      phase,
      error,
      notice,
      member,
      supabase: phase.kind === "unlocked" ? supabase : null,
      keys: phase.kind === "unlocked" ? keysRef.current : null,
      lastKdfMs,
      unlock,
      activate,
      registerKeys: registerKeysAction,
      acknowledgeRecoveryCode,
      recheckPending,
      lock,
      remainingUntilAutoLock,
    }),
    [
      phase,
      error,
      notice,
      member,
      supabase,
      lastKdfMs,
      unlock,
      activate,
      registerKeysAction,
      acknowledgeRecoveryCode,
      recheckPending,
      lock,
      remainingUntilAutoLock,
    ]
  );

  return <VaultContext.Provider value={value}>{children}</VaultContext.Provider>;
}

export function useVault(): VaultContextValue {
  const value = useContext(VaultContext);
  if (!value) throw new Error("useVault() se apelează doar sub <VaultProvider>.");
  return value;
}
