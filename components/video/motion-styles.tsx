/**
 * Keyframes partajate pentru micro-motion-ul CSS al diviziei VIDEO
 * (FAZA 2). Se include O DATĂ per pagină, înaintea componentelor care
 * folosesc <WordReveal>. E CSS pur: nu așteaptă nicio librărie, deci
 * hero-ul nu plătește nimic la LCP.
 */
export function VideoMotionStyles() {
  return (
    <style>{`
@keyframes mv-word-in{from{transform:translateY(112%);opacity:0}to{transform:translateY(0);opacity:1}}
.mv-word{animation:mv-word-in 700ms cubic-bezier(0.22,1,0.36,1) both}
@media (prefers-reduced-motion:reduce){.mv-word{animation:none}}
`}</style>
  );
}
