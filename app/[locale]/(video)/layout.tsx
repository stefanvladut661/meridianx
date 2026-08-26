import { setRequestLocale } from "next-intl/server";

/**
 * Scope-ul diviziei VIDEO.
 *
 * După redesign, layout-ul e gol intenționat: landing-ul `/video`
 * își poartă singur shell-ul (bară, subsol, tokens `data-scope`),
 * pentru că e o pagină cu propriul temperament, nu o pagină dintr-un
 * șablon. Vechiul shell — header cu HUD, cursor de focus, Lenis —
 * a coborât în `video/(clasic)/layout.tsx`, unde deservește
 * sub-paginile care încă nu au fost migrate pe noul sistem.
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
  return <>{children}</>;
}
