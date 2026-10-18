"use client";

import { Nav } from "./nav";
import { Hero } from "./hero";
import { Portfolio } from "./portfolio";
import { Problems } from "./sections/problems";
import { System } from "./sections/system";
import { Services } from "./sections/services";
import { Reviews } from "./sections/reviews";
import { Questions } from "./sections/faq";
import { Contact } from "./contact";
import { Footer } from "./footer";
import { hostGrotesk } from "./font";
import s from "./home2.module.css";

/* ============================================================
   /home-2 — redesign-ul paginii principale, după referințele din
   „redesign site”, pe o rută separată cât lucrăm la el.

   Conținutul e cel de pe /video (titlul, filmul de prezentare,
   portofoliul, secțiunile, formularul, subsolul), cu textele de acum;
   se schimbă doar așezarea și stilul. Meniul, formularul și subsolul
   sunt componente noi — cele de pe site rămân neatinse.

   Ordinea: hero → portofoliu → secțiunile, alternând graficul stânga-
   dreapta → contact → subsol.
   ============================================================ */

export function Home2Screen() {
  return (
    <div className={`md-root ${s.root} ${hostGrotesk.variable} min-h-dvh overflow-clip`}>
      <a href="#continut" className="skip-link">
        Sari la conținut
      </a>
      <Nav />
      <main id="continut">
        <Hero />
        <Portfolio />
        <Problems />
        <System />
        <Services />
        <Reviews />
        <Questions />
        <Contact />
      </main>
      <Footer />
    </div>
  );
}
