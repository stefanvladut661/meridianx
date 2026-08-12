import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { VideoSegment } from "@/content/types";

/**
 * Segmentele deservite, ca listă de scene dintr-un call sheet (FAZA 2).
 * Fiecare rând poartă temperatura la care se filmează segmentul —
 * 3200K (emoție) sau 5600K (precizie) — și promisiunea scrisă pentru
 * clientul ăla, nu o listă de bife. Rândurile duc în portofoliul
 * filtrat pe segment.
 */

type Scene = {
  segment: VideoSegment;
  code: string;
  temp: "3200K" | "5600K";
  name: string;
  promise: string;
  detail: string;
};

// i18n: copy hardcodat RO — F7 extrage
const SCENES: Scene[] = [
  {
    segment: "imobiliare",
    code: "SC.01",
    temp: "5600K",
    name: "Imobiliare",
    promise: "Apartamentul se vinde înainte de vizionare.",
    detail:
      "Tururi cinematice, dronă la răsărit, ritm care ține un cumpărător plictisit de slideshow-uri până la numărul tău de telefon.",
  },
  {
    segment: "corporate",
    code: "SC.02",
    temp: "5600K",
    name: "Corporate",
    promise: "Compania ta, văzută cum o vezi tu în zilele bune.",
    detail:
      "Filme de prezentare, recrutare și employer branding în care oamenii tăi sună a oameni, nu a comunicat de presă.",
  },
  {
    segment: "evenimente",
    code: "SC.03",
    temp: "3200K",
    name: "Evenimente",
    promise: "Aftermovie-ul care umple ediția următoare.",
    detail:
      "Livrat în 72 de ore, cât încă arde entuziasmul. Sold-out-ul de la anul se filmează acum.",
  },
  {
    segment: "personal-brand",
    code: "SC.04",
    temp: "3200K",
    name: "Personal brand",
    promise: "Tu, în forma în care vrei să te găsească internetul.",
    detail:
      "O zi de filmare pe lună, un calendar întreg de conținut. Expertiza o ai — noi o facem imposibil de ignorat.",
  },
  {
    segment: "industrial",
    code: "SC.05",
    temp: "5600K",
    name: "Industrial",
    promise: "Hala ta, filmată ca un film SF — nu ca la inventar.",
    detail:
      "CNC, HVAC, linii de producție: macro pe scule, mișcare prin hală, aerian peste tot ce ai construit. Clientul B2B vede capabilitățile înainte de audit.",
  },
];

export function SegmentScenes() {
  return (
    <ul className="border-t border-line">
      {SCENES.map((scene) => {
        const warm = scene.temp === "3200K";
        return (
          <li key={scene.segment} className="border-b border-line">
            <Link
              href={{
                pathname: "/video/portofoliu",
                query: { segment: scene.segment },
              }}
              className="group -mx-3 grid gap-3 rounded-sm px-3 py-7 transition-colors hover:bg-surface/70 sm:grid-cols-[8.5rem_1fr_auto] sm:items-baseline sm:py-9"
            >
              <span className="font-mono text-xs tracking-[0.2em]">
                <span className="text-muted">{scene.code}</span>{" "}
                <span className={warm ? "text-v-tungsten" : "text-v-daylight"}>
                  {scene.temp}
                </span>
              </span>
              <span className="block">
                <span
                  className={cn(
                    "block font-display text-3xl tracking-tight transition-colors sm:text-4xl",
                    warm
                      ? "group-hover:text-v-tungsten group-focus-visible:text-v-tungsten"
                      : "group-hover:text-v-daylight group-focus-visible:text-v-daylight"
                  )}
                >
                  {scene.name}
                </span>
                <span className="mt-2 block text-lg text-fg/85">
                  {scene.promise}
                </span>
                <span className="mt-2 block max-w-2xl text-sm text-fg/60 sm:opacity-0 sm:transition-opacity sm:duration-300 sm:group-hover:opacity-100 sm:group-focus-visible:opacity-100">
                  {scene.detail}
                </span>
              </span>
              <span
                aria-hidden="true"
                className="hidden font-mono text-muted transition-transform group-hover:translate-x-1 sm:block"
              >
                →
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
