const SHUTTER_KEY = "mv-shutter-seen";

/**
 * Obturatorul de page-load al diviziei VIDEO (FAZA 2).
 * DOAR pe /video (home), o dată per sesiune.
 *
 * Implementare LCP-safe, fără librării:
 * - CSS pur (keyframes inline), deci nu așteaptă niciun JS ca să se
 *   deschidă; un div opac nu e candidat LCP, textul de sub el da.
 * - Scriptul inline (rulează la parsare, înaintea hidratării) citește
 *   sessionStorage și sare peste secvență la a doua vizită punând
 *   data-skip pe overlay. suppressHydrationWarning acoperă atributul.
 * - Sub prefers-reduced-motion overlay-ul e display:none din CSS.
 * - pointer-events:none — nu blochează niciodată interacțiunea.
 */
export function ShutterIntro() {
  const inlineScript =
    "try{var s=document.currentScript,e=s&&s.previousElementSibling;" +
    `if(e){if(sessionStorage.getItem("${SHUTTER_KEY}")){e.setAttribute("data-skip","")}` +
    `else{sessionStorage.setItem("${SHUTTER_KEY}","1")}}}catch(err){}`;

  return (
    <>
      <div
        aria-hidden="true"
        suppressHydrationWarning
        className="mv-shutter pointer-events-none fixed inset-0 z-[100] data-[skip]:hidden"
      >
        <div className="mv-blade-top absolute inset-x-0 top-0 h-1/2 bg-[#050608]">
          <span className="absolute inset-x-0 bottom-0 h-px bg-v-tungsten/70" />
        </div>
        <div className="mv-blade-bottom absolute inset-x-0 bottom-0 h-1/2 bg-[#050608]">
          <span className="absolute inset-x-0 top-0 h-px bg-v-daylight/70" />
        </div>
        <div className="mv-slate absolute inset-0 flex flex-col items-center justify-center gap-3">
          <span className="font-display text-lg tracking-[0.35em] text-v-bone">
            MERIDIAN VIDEO
          </span>
          <span className="font-mono text-[11px] tracking-[0.3em] text-v-dim">
            EXP 1/50 · ISO 800 · WB 3200K→5600K
          </span>
        </div>
      </div>
      <script dangerouslySetInnerHTML={{ __html: inlineScript }} />
      <style>{`
@keyframes mv-blade-up{to{transform:translateY(-101%)}}
@keyframes mv-blade-down{to{transform:translateY(101%)}}
@keyframes mv-slate-in{0%{opacity:0}18%{opacity:1}72%{opacity:1}100%{opacity:0}}
@keyframes mv-shutter-off{to{visibility:hidden}}
.mv-shutter{animation:mv-shutter-off 1ms linear 1750ms forwards}
.mv-blade-top{animation:mv-blade-up 750ms cubic-bezier(0.76,0,0.24,1) 950ms forwards}
.mv-blade-bottom{animation:mv-blade-down 750ms cubic-bezier(0.76,0,0.24,1) 950ms forwards}
.mv-slate{animation:mv-slate-in 950ms ease forwards}
@media (prefers-reduced-motion:reduce){.mv-shutter{display:none}}
`}</style>
    </>
  );
}
