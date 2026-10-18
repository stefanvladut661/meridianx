import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Home2Screen } from "@/components/home2/screen";

/* ============================================================
   /home-2 — PAGINĂ DE LUCRU pentru redesign-ul paginii principale.

   Nu apare în meniu, nu e în sitemap (lista din app/sitemap.ts e
   explicită) și are `noindex`. Paginile de acum rămân exact cum sunt;
   când redesign-ul e aprobat, conținutul de aici trece în locul lor și
   ruta asta dispare.
   ============================================================ */

export const metadata: Metadata = {
  title: "Social Media Marketing & Conținut Video care vinde (versiune nouă)",
  description:
    "Video, reclame și campanii pe Meta, TikTok și Google, plus site-uri și aplicații la comandă.",
  // Cât lucrăm la ea: în afara indexului.
  robots: { index: false, follow: false },
};

export default async function Home2Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <Home2Screen />;
}
