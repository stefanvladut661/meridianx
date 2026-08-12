/**
 * Loader lazy pentru GSAP + ScrollTrigger (divizia VIDEO, FAZA 2).
 *
 * Librăriile de animație NU intră în bundle-ul inițial: se importă
 * dinamic, o singură dată, după mount, doar din componente client
 * care au verificat deja prefers-reduced-motion.
 *
 * F3 poate refolosi același loader pentru coregrafiile lui.
 */

export type MotionBundle = {
  gsap: (typeof import("gsap"))["gsap"];
  ScrollTrigger: (typeof import("gsap/ScrollTrigger"))["ScrollTrigger"];
};

let bundle: Promise<MotionBundle> | null = null;

export function loadMotion(): Promise<MotionBundle> {
  if (!bundle) {
    bundle = Promise.all([import("gsap"), import("gsap/ScrollTrigger")]).then(
      ([gsapModule, scrollTriggerModule]) => {
        gsapModule.gsap.registerPlugin(scrollTriggerModule.ScrollTrigger);
        return {
          gsap: gsapModule.gsap,
          ScrollTrigger: scrollTriggerModule.ScrollTrigger,
        };
      }
    );
  }
  return bundle;
}
