"use client";

import { VaultProvider, useVault } from "./vault-provider";
import { UnlockScreen } from "./unlock-screen";
import { OnboardingScreen } from "./onboarding-screen";
import { VaultShell } from "./vault-shell";

/**
 * Rădăcina client a vault-ului (feat/vault, faza 2): providerul + ce
 * ecran se vede în faza curentă.
 *
 * Până la deblocare, un singur obiect pe ecran — fișa — peste grila
 * tehnică și lumina celor două lumi (aceeași scenă ca login-ul de
 * admin: e tot o ușă a agenției). După deblocare, shell-ul cu antet.
 */
export function VaultApp() {
  return (
    <VaultProvider>
      <Screens />
    </VaultProvider>
  );
}

function Screens() {
  const { phase } = useVault();

  if (phase.kind === "unlocked") return <VaultShell />;

  const unlockScreen =
    phase.kind === "locked" || (phase.kind === "busy" && phase.from === "locked");

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-5 py-16">
      <div aria-hidden className="techgrid pointer-events-none absolute inset-0" />
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="aurora-drift absolute left-[-30%] top-[-20%] h-[30rem] w-[36rem] rounded-full bg-[radial-gradient(closest-side,rgb(47_91_255/0.4),rgb(47_91_255/0.1)_45%,transparent_72%)] sm:left-[-8%] sm:h-[40rem] sm:w-[52rem]" />
        <div className="aurora-drift-2 absolute bottom-[-25%] right-[-30%] h-[28rem] w-[34rem] rounded-full bg-[radial-gradient(closest-side,rgb(31_181_131/0.34),rgb(31_181_131/0.1)_45%,transparent_72%)] sm:right-[-6%] sm:h-[38rem] sm:w-[50rem]" />
      </div>

      {unlockScreen ? <UnlockScreen /> : <OnboardingScreen />}
    </main>
  );
}
