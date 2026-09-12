"use client";

import { useEffect, useState } from "react";

/**
 * Adresa de email, scrisă în pagină în bucăți.
 *
 * Roboții care culeg adrese pentru spam citesc HTML-ul brut: caută
 * `ceva@ceva.ro` în text și `mailto:` în atribute. Aici nu găsesc
 * niciuna dintre ele:
 *
 * - textul e rupt în mai multe `<span>`-uri, cu o momeală ascunsă
 *   strecurată înaintea lui `@`;
 * - `mailto:` nu apare deloc în HTML-ul venit de la server. Se scrie
 *   în `href` abia după montare, într-un `useEffect`, deci prima
 *   randare din client e identică cu cea de pe server și nu apare
 *   eroare de hidratare.
 *
 * Până atunci e tot un link adevărat, nu un `#` mort: duce la
 * secțiunea de contact a paginii, se prinde de la tastatură și
 * primește inelul de focus global din `globals.css`. Numele accesibil
 * rămâne adresa însăși, fiindcă momeala e scoasă și din arborele de
 * accesibilitate, nu doar de pe ecran.
 */

interface ObfuscatedEmailProps {
  /** Adresa completă, exact cum trebuie citită de om. */
  address: string;
  /**
   * Unde duce link-ul cât timp JavaScript-ul nu a pornit (sau e oprit).
   * O ancoră reală din aceeași pagină — formularul sau blocul de
   * contact. Nu `#`, nu un link mort.
   */
  fallbackHref: string;
  /**
   * Ce aude, în starea aceea, cine folosește un cititor de ecran.
   * Dispare după montare, când link-ul chiar deschide clientul de mail.
   */
  fallbackLabel?: string;
  /** Clasele locului de apel — componenta nu aduce stil propriu. */
  className?: string;
  /**
   * Textul-momeală, ascuns și de ochi, și de cititoarele de ecran.
   * Conține un `@` propriu, ca adresa culeasă de robot să se termine
   * pe un domeniu care nu există: `.invalid` e rezervat prin RFC 2606
   * și nu se rezolvă niciodată în DNS. Orice tipar de recoltare se
   * oprește la primul `@`, deci robotul pleacă cu
   * `contact@nu-scrie-aici.invalid`, o adresă care nu poate fi livrată
   * nicăieri — nici la noi, nici la altcineva.
   *
   * O momeală pe domeniul nostru ar fi fost o greșeală: cu catch-all
   * activ, spam-ul recoltat s-ar fi întors fix în căsuța reală.
   */
  decoy?: string;
}

export function ObfuscatedEmail({
  address,
  fallbackHref,
  fallbackLabel = " — deschide secțiunea de contact",
  className,
  decoy = "@nu-scrie-aici.invalid",
}: ObfuscatedEmailProps) {
  // `useState(false)` plus efect: serverul și prima randare din client
  // dau exact același HTML. Abia a doua randare pune `mailto:`.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const at = address.lastIndexOf("@");
  const user = at > 0 ? address.slice(0, at) : address;
  const domain = at > 0 ? address.slice(at + 1) : null;

  // Adresă fără „@" înseamnă date stricate în `contact.ts`. Atunci nu
  // are ce ascunde și rămâne, cinstit, un link către contact.
  if (!domain) {
    return (
      <a href={fallbackHref} className={className}>
        {address}
      </a>
    );
  }

  return (
    <a
      href={mounted ? `mailto:${user}@${domain}` : fallbackHref}
      className={className}
    >
      <span>{user}</span>
      {/* `hidden` ȘI stil inline, intenționat dublat: atributul e ascuns
          de foaia de stil a browserului, deci ține și dacă un CSP taie
          stilurile inline; stilul inline ține dacă foaia de stil
          întârzie. Dacă ar cădea amândouă, omul ar citi în subsol o
          adresă greșită. */}
      <span hidden aria-hidden="true" style={{ display: "none" }}>
        {decoy}
      </span>
      <span>@</span>
      <span>{domain}</span>
      {!mounted && <span className="sr-only">{fallbackLabel}</span>}
    </a>
  );
}
