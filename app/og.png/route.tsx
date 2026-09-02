import { ImageResponse } from "next/og";

/**
 * Imaginile de Open Graph, generate dinamic (FAZA 7).
 *
 * Două șabloane, unul per divizie — pentru că regula #1 din CLAUDE.md
 * se aplică și în feed-ul de Facebook: cele două lumi nu se amestecă.
 * Video primește arcul cald pe negru de platou; software primește
 * geodezica rece pe grilă de blueprint.
 *
 * De ce ruta se numește `og.png` și nu `og`: middleware-ul i18n
 * (ÎNGHEȚAT, F0) prinde orice cale fără punct și i-ar pune prefix de
 * limbă. Extensia o scoate din matcher, iar URL-ul arată oricum mai
 * bine ca imagine.
 *
 * /og.png?division=video&title=...&subtitle=...
 */

export const runtime = "edge";

const WORLDS = {
  video: {
    bg: "#08090C",
    fg: "#EDE8E0",
    accent: "#FF8C3B",
    accent2: "#43C9E0",
    label: "VIDEO",
    dim: "rgba(237,232,224,0.55)",
  },
  software: {
    bg: "#060A12",
    fg: "#DEE5F0",
    accent: "#4C7DFF",
    accent2: "#D9A441",
    label: "SOFTWARE",
    dim: "rgba(222,229,240,0.55)",
  },
  /* Poarta: singurul loc unde cele doua lumi se ating, deci fara accentul
     niciuneia. Aceeasi regula ca in globals.css — accentul e lumina, nu
     culoarea. Se cere cu ?division=gate. */
  gate: {
    bg: "#08080F",
    fg: "#F2F3F8",
    accent: "#F2F3F8",
    accent2: "rgba(242,243,248,0.6)",
    label: "VIDEO & SOFTWARE",
    dim: "rgba(242,243,248,0.55)",
  },
} as const;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const divisionParam = searchParams.get("division");
  const division: keyof typeof WORLDS =
    divisionParam === "video"
      ? "video"
      : divisionParam === "gate"
        ? "gate"
        : "software";
  const world = WORLDS[division];

  const title =
    searchParams.get("title")?.slice(0, 110) ??
    (division === "video"
      ? "Producție video care vinde"
      : division === "gate"
        ? "Video și software, sub același acoperiș"
        : "Web și aplicații la comandă");
  const subtitle = searchParams.get("subtitle")?.slice(0, 140) ?? "";

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: world.bg,
          padding: "72px",
          position: "relative",
        }}
      >
        {/* semnătura lumii: arc cald vs meridian rece cu gradații */}
        {division === "video" || division === "gate" ? (
          <div
            style={{
              position: "absolute",
              top: "-260px",
              right: "-160px",
              width: "820px",
              height: "820px",
              borderRadius: "999px",
              border: `2px solid ${world.accent}`,
              opacity: 0.55,
              display: "flex",
            }}
          />
        ) : (
          <div
            style={{
              position: "absolute",
              top: 0,
              right: "220px",
              bottom: 0,
              width: "2px",
              background: world.accent,
              opacity: 0.6,
              display: "flex",
            }}
          />
        )}
        {division === "software"
          ? [0, 1, 2, 3, 4, 5, 6].map((index) => (
              <div
                key={index}
                style={{
                  position: "absolute",
                  // gradațiile pornesc din linie spre stânga; cele lungi
                  // marchează „latitudinile” principale
                  right: "222px",
                  top: `${58 + index * 86}px`,
                  width: index % 2 === 0 ? "58px" : "30px",
                  height: "2px",
                  background: world.accent,
                  opacity: index % 2 === 0 ? 0.9 : 0.5,
                  display: "flex",
                }}
              />
            ))
          : null}

        <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
          <div
            style={{
              width: "14px",
              height: "14px",
              background: world.accent,
              display: "flex",
            }}
          />
          <div
            style={{
              color: world.fg,
              fontSize: "26px",
              letterSpacing: "10px",
              fontWeight: 700,
              display: "flex",
            }}
          >
            MERIDIAN
          </div>
          <div
            style={{
              color: world.accent2,
              fontSize: "22px",
              letterSpacing: "8px",
              display: "flex",
            }}
          >
            {world.label}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", maxWidth: "860px" }}>
          <div
            style={{
              color: world.fg,
              fontSize: title.length > 60 ? "62px" : "78px",
              lineHeight: 1.05,
              fontWeight: 700,
              letterSpacing: "-2px",
              display: "flex",
            }}
          >
            {title}
          </div>
          {subtitle ? (
            <div
              style={{
                marginTop: "26px",
                color: world.dim,
                fontSize: "30px",
                lineHeight: 1.3,
                display: "flex",
              }}
            >
              {subtitle}
            </div>
          ) : null}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              color: world.dim,
              fontSize: "22px",
              letterSpacing: "4px",
              display: "flex",
            }}
          >
            meridianagency.ro
          </div>
          <div
            style={{
              width: "180px",
              height: "3px",
              background: world.accent,
              display: "flex",
            }}
          />
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
