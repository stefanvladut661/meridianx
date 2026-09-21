import { isVaultConfigured } from "@/lib/vault/supabase";
import { VaultApp } from "./_components/vault-app";
import { Card } from "./_components/ui";

/**
 * /vault (feat/vault, faza 2).
 *
 * Pagina e o componentă de server doar ca să decidă un lucru: există
 * Supabase pe mediul ăsta? Fără el, un formular de deblocare ar fi un
 * drum înfundat cu un câmp de parolă — mai rău decât o explicație.
 * Restul e în browser: cheile nu ating serverul nici la randare.
 */
export default function VaultPage() {
  if (!isVaultConfigured()) return <SetupNotice />;
  return <VaultApp />;
}

function SetupNotice() {
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-5 py-16">
      <div aria-hidden className="techgrid pointer-events-none absolute inset-0" />
      <Card>
        <p className="eyebrow mt-8 !text-[11.5px]">Vault · nu e configurat</p>
        <h1 className="display mt-3 text-[2.125rem] text-bone">Lipsește Supabase</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-dim">
          Vault-ul vorbește direct cu Supabase din browser. Completează în
          <Code>.env.local</Code>
          variabilele
          <Code>NEXT_PUBLIC_SUPABASE_URL</Code>
          și
          <Code>NEXT_PUBLIC_SUPABASE_ANON_KEY</Code>
          , apoi repornește serverul. Apoi aplică migrarea 3 în SQL editor.
        </p>
      </Card>
    </main>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="mx-1 rounded-[4px] bg-glass px-1.5 py-0.5 font-md-mono text-[12px] text-bone">
      {children}
    </code>
  );
}
