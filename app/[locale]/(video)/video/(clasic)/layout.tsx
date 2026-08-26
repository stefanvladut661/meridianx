import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { VideoHeader } from "@/components/shell/video-header";
import { CameraHud } from "@/components/shell/camera-hud";
import { Footer } from "@/components/shell/footer";

/**
 * Scope-ul lumii VIDEO (FAZA 0 a creat fișierul; FAZA 1 îl deține
 * pentru integrarea shell-ului — header video, HUD, footer).
 *
 * data-world="video" remapează tokens-ii semantici (--bg, --accent,
 * --font-display...) la paleta tungsten/daylight. Tot ce se randează
 * înăuntru — inclusiv primitivele din components/ui/ — preia automat
 * lumea video. Nu seta culori brute --s-* aici.
 *
 * Notă pentru F2/F3: header-ul video e FIX și transparent peste
 * conținut (se condensează la scroll) — hero-urile se proiectează
 * sub el, fără padding compensatoriu. HUD-ul de cameră e montat aici,
 * o singură dată — nu-l reconstruiți în pagini.
 */
export default async function VideoWorldLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("common");

  return (
    <div data-world="video" className="min-h-dvh bg-bg text-fg">
      <a href="#continut" className="skip-link">
        {t("skipToContent")}
      </a>
      <VideoHeader />
      <CameraHud />
      <main id="continut">{children}</main>
      <Footer division="video" />
    </div>
  );
}
