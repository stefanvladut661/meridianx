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
  openDekWithRecoveryCode,
  openKeys,
  registerKeys,
  rekeySelf,
  rewrapSelf,
  VaultDataError,
  type KeyMaterial,
} from "@/lib/vault/members";

/**
 * Mașina de stări a vault-ului (feat/vault, fazele 2 și 7).
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
 *                                  ├─▶ pending / unlocked (cont care are deja chei)
 *                                  └─▶ recovery ──recoverWithCode──▶ unlocked   (chei împachetate cu parola veche)
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
  | "registering"
  | "recovering"
  | "rekeying";

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
  /** Membru activ care tocmai și-a schimbat parola Supabase (activare cu
      parolă temporară): cheile lui sunt împachetate cu parola master
      veche. Codul de recuperare deschide DEK-ul și refă cheile. */
  | { kind: "recovery" }
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
  /** Faza 7: din `recovery`, cu codul de pe hârtie → chei noi → deblocat. */
  recoverWithCode: (code: string) => Promise<void>;
  /** Faza 7: membru deblocat, parola actuală + cea nouă. Aruncă la eșec
      (mesaj pentru om). `onStep` primește pașii, pentru progres. */
  changeMasterPassword: (
    currentPassword: string,
    nextPassword: string,
    onStep?: (step: BusyStep) => void
  ) => Promise<void>;
  lock: (notice?: string) => Promise<void>;
  dismissNotice: () => void;
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
          if (replacing) {
            // Parola Supabase e cea nouă (tocmai am pus-o), cheile sunt cu
            // cea veche: singura cale e codul de recuperare. KEK-ul rămâne
            // în memorie — cu el se împachetează cheile noi.
            setPhase({ kind: "recovery" });
            return;
          }
          throw new VaultCryptoError(
            "decrypt_failed",
            "Sesiunea e validă, dar cheile nu s-au putut deschide cu parola asta. Rândul tău din vault pare alterat — spune-i echipei."
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

  const recoverWithCode = useCallback(
    async (code: string) => {
      const identity = memberRef.current;
      const kek = kekRef.current;
      if (!supabase || !identity || !kek) return;
      setError(null);
      try {
        setPhase({ kind: "busy", step: "recovering", startedAt: Date.now(), from: "onboarding" });
        const dek = await openDekWithRecoveryCode(supabase, code);
        setPhase({ kind: "busy", step: "rekeying", startedAt: Date.now(), from: "onboarding" });
        keysRef.current = await rekeySelf(supabase, identity.id, kek, dek);
        wipe(kek);
        kekRef.current = null;
        setNotice(
          "Acces recuperat: cheile tale au fost refăcute cu parola master de acum. Codul de recuperare rămâne valabil — dacă l-a văzut cineva, regenerează-l din Membri."
        );
        setPhase({ kind: "unlocked" });
      } catch (cause) {
        setPhase({ kind: "recovery" });
        setError(describeError(cause));
      }
    },
    [supabase]
  );

  /**
   * Parola master nouă = KEK nou + authHash nou. Cheile membrului se refac
   * (perechea nouă, împachetată cu KEK-ul nou, DEK-ul re-sigilat), apoi se
   * schimbă parola Supabase. Dacă al doilea pas pică, primul se întoarce
   * din drum cu cheile vechi sub KEK-ul vechi — altfel contul ar rămâne cu
   * chei pe care parola lui nu le mai deschide. DEK-ul și codul de
   * recuperare nu se schimbă.
   */
  const changeMasterPassword = useCallback(
    async (currentPassword: string, nextPassword: string, onStep?: (step: BusyStep) => void) => {
      const identity = memberRef.current;
      const keys = keysRef.current;
      if (!supabase || !identity || !keys || phaseRef.current.kind !== "unlocked") {
        throw new VaultCryptoError("invalid_input", "Vault-ul nu e deblocat.");
      }

      onStep?.("deriving");
      const current = await deriveMasterMaterialAsync(identity.email, currentPassword);
      try {
        onStep?.("signing-in");
        const check = await supabase.auth.signInWithPassword({
          email: identity.email,
          password: current.authHash,
        });
        if (check.error) {
          throw new AuthFailure(
            check.error.status === 400 || check.error.code === "invalid_credentials"
              ? "Parola master actuală e greșită."
              : describeAuthError(check.error, "unlock")
          );
        }

        onStep?.("deriving");
        const next = await deriveMasterMaterialAsync(identity.email, nextPassword);
        try {
          onStep?.("rekeying");
          const fresh = await rekeySelf(supabase, identity.id, next.kek, keys.dek);

          onStep?.("updating-password");
          const { error: updateError } = await supabase.auth.updateUser({ password: next.authHash });
          if (updateError) {
            // Întoarcerea din drum: cheile vechi, sub KEK-ul vechi.
            wipe(fresh.privateKey);
            try {
              await rewrapSelf(supabase, identity.id, current.kek, keys);
            } catch {
              throw new AuthFailure(
                "Parola Supabase nu s-a putut schimba, iar cheile n-au putut fi întoarse la loc. Nu închide fila: cere unei colege să-ți seteze o parolă temporară din Supabase, apoi activează contul din nou, cu codul de recuperare."
              );
            }
            throw new AuthFailure(describeAuthError(updateError, "update"));
          }

          wipe(keys.privateKey);
          keysRef.current = fresh;
        } finally {
          wipe(next.kek);
        }
      } finally {
        wipe(current.kek);
      }
    },
    [supabase]
  );

  // ---------------------------------------------------------------------
  // Auto-blocare: cât timp există ceva de protejat în memorie.
  // ---------------------------------------------------------------------

  const armed =
    phase.kind === "unlocked" ||
    phase.kind === "pending" ||
    phase.kind === "keys-missing" ||
    phase.kind === "recovery-code" ||
    phase.kind === "recovery";

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
      recoverWithCode,
      changeMasterPassword,
      lock,
      dismissNotice: () => setNotice(null),
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
      recoverWithCode,
      changeMasterPassword,
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
