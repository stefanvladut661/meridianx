/**
 * Pregătește materialele de portofoliu pentru web.
 *
 * Sursa (`ideas/Meridian Portofoliu/`) e material de montaj: verticale 4K
 * la 15–42 Mbps și fotografii RAW-ish de 17MB. Nimic din ce e acolo nu
 * poate fi servit direct — 713MB de video pe o pagină nu e o pagină.
 *
 * Ce face scriptul:
 *   video  → H.264 1080×1920, CRF 24, faststart, audio AAC 128k stereo
 *   poster → un cadru de la 25% din durată, WebP 720×1280
 *   poze   → WebP responsive (640/1280/1920), fără upscale
 *
 * De ce merge cu `preload="none"` în player: pagina descarcă doar
 * posterele, iar videoul abia la apăsarea butonului. Așa „calitate maximă"
 * și „încărcare rapidă" nu se mai bat cap în cap — costul la încărcare e
 * un WebP de ~60KB, nu un fișier de 24MB.
 *
 * Rulare: node scripts/portfolio-build.mjs [--force]
 * Sare peste ce există deja, ca să poată fi reluat.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "ideas", "Meridian Portofoliu");
const OUT_V = join(ROOT, "public", "video", "portofoliu");
const OUT_P = join(OUT_V, "foto");
const FORCE = process.argv.includes("--force");

/* winget instalează ffmpeg fără să-l pună în PATH-ul shell-urilor deja
   pornite; îl căutăm întâi în PATH, apoi la locul știut. */
function findFfmpeg(name) {
  const local = join(
    process.env.LOCALAPPDATA ?? "",
    "Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0.1-full_build/bin",
    `${name}.exe`
  );
  if (existsSync(local)) return local;
  return name;
}
const FFMPEG = findFfmpeg("ffmpeg");
const FFPROBE = findFfmpeg("ffprobe");

const MB = (n) => `${(n / 1048576).toFixed(1)}MB`;

/* ---------------------------------------------------------------
   Catalogul. Scris de mână, nu dedus din numele fișierelor: numele
   sursă sunt „Copy of Copy of cbx_upscaled.mp4", care nu spune nimic
   nici unui vizitator, nici unui motor de căutare. Prefixul A din
   fișier înseamnă „material de prima pagină".
   --------------------------------------------------------------- */
const VIDEOS = [
  {
    file: "Video/Trattoria BonaMi/A1-Copy of sclipici_4K.mp4",
    slug: "bonami-sclipici",
    client: "Trattoria BonaMi",
    title: "Desert cu sclipici",
    kind: "HORECA",
    featured: 1,
  },
  {
    file: "Video/E45 Restobar/A2-Copy of Copy of SALATA CEASER.mp4",
    slug: "e45-salata-caesar",
    client: "E45 Restobar",
    title: "Salată Caesar",
    kind: "HORECA",
    featured: 2,
  },
  {
    file: "Video/Tua Club&Lounge/A3-vezi acum, (1).mp4",
    slug: "tua-vezi-acum",
    client: "Tua Club & Lounge",
    title: "Vezi acum",
    kind: "Club & lounge",
    featured: 3,
  },
  {
    file: "Video/Double Trouble party event/A5-Copy of Copy of cbx_upscaled.mp4",
    slug: "double-trouble-party",
    client: "Double Trouble",
    title: "Party event",
    kind: "Eveniment",
    featured: 4,
  },
  {
    file: "Video/Dr.Gupta/A6-WhatsApp Video 2026-08-19 at 15.18.32.mp4",
    slug: "dr-gupta",
    client: "Dr. Gupta",
    title: "Prezentare cabinet",
    kind: "Medical",
    featured: 5,
  },
  {
    file: "Video/Allto Passione gellato/Copy of 1h.mp4",
    slug: "allto-passione-gelato",
    client: "Allto Passione",
    title: "Gelato",
    kind: "HORECA",
    featured: 0,
  },
  {
    file: "Video/E45 Restobar/Copy of Copy of cappucino.mp4",
    slug: "e45-cappuccino",
    client: "E45 Restobar",
    title: "Cappuccino",
    kind: "HORECA",
    featured: 0,
  },
  {
    file: "Video/Trattoria BonaMi/Copy of mana_rotativa_4K_v2.mp4",
    slug: "bonami-mana-rotativa",
    client: "Trattoria BonaMi",
    title: "Plating în mișcare",
    kind: "HORECA",
    featured: 0,
  },
  {
    file: "Video/Trattoria BonaMi/Copy of pizza_bonami_4K.mp4",
    slug: "bonami-pizza",
    client: "Trattoria BonaMi",
    title: "Pizza",
    kind: "HORECA",
    featured: 0,
  },
  {
    file: "Video/Allto Passione gellato/Copy of video final ecran.mov",
    slug: "allto-ecran",
    client: "Allto Passione",
    title: "Ecranul din locație",
    kind: "HORECA",
    featured: 0,
  },
  {
    file: "Video/Allto Passione gellato/snaptik_7517672194101529878_v3.mp4",
    slug: "allto-tiktok-cornete",
    client: "Allto Passione",
    title: "Clip TikTok — cornete",
    kind: "HORECA",
    featured: 0,
  },
  {
    file: "Video/Allto Passione gellato/snaptik_7531703506747559191_hd.mp4",
    slug: "allto-tiktok-cafea",
    client: "Allto Passione",
    title: "Clip TikTok — colțul de cafea",
    kind: "HORECA",
    featured: 0,
  },
  {
    file: "Video/Allto Passione gellato/TRANZITIE V4.mp4",
    slug: "allto-rosso",
    client: "Allto Passione",
    title: "Cookie Rosso",
    kind: "HORECA",
    featured: 0,
  },
  {
    file: "Video/Dr TEO/a5 ref2.mp4",
    slug: "dr-teo-buze",
    client: "Dr. Teo",
    title: "Augmentarea buzelor, pe înțeles",
    kind: "Medical",
    featured: 0,
  },
  {
    file: "Video/Dr TEO/AI MAI REF C.mp4",
    slug: "dr-teo-tratament",
    client: "Dr. Teo",
    title: "Tratament în cabinet",
    kind: "Medical",
    featured: 0,
  },
  {
    file: "Video/remediu/S10 SHILAJIT.mp4",
    slug: "remediu-shilajit",
    client: "Remediu",
    title: "Shilajit",
    kind: "Retail",
    featured: 0,
  },
  {
    file: "Video/remediu/s8 .mp4",
    slug: "remediu-magneziu",
    client: "Remediu",
    title: "Magneziu glicinat",
    kind: "Retail",
    featured: 0,
  },
  {
    file: "Video/remediu/Ulei de ricin refacut (2).mp4",
    slug: "remediu-ulei-ricin",
    client: "Remediu",
    title: "Ulei de ricin",
    kind: "Retail",
    featured: 0,
  },
];

const PHOTOS = [
  /* Ordinea din listă e ordinea din galerie, iar galeria pune trei pe
     rând. De-aia grupurile sunt scrise în tripleți: preparatul rămâne
     lângă preparatul lui, iar cardul cu text — cel care spune ce e în
     farfurie — deschide fiecare grup. */

  // rândul 1 — coaste
  ["Poze/E45 Restobar/coaste/Scaricica de porc.png", "e45-coaste-3", "Card de meniu — scăricică de porc cu maioneză de casă", "E45 Restobar"],
  ["Poze/E45 Restobar/coaste/Scaricica de porc img 1 (1).png", "e45-coaste-1", "Card de meniu — cartofi proaspeți cu usturoi și parmezan", "E45 Restobar"],
  ["Poze/E45 Restobar/coaste/Scaricica de porc img 2.jpg", "e45-coaste-2", "Scăricică de porc cu cartofi, pe lemn", "E45 Restobar"],

  // rândul 2 — paste, plus papanașii ca al treilea
  ["Poze/E45 Restobar/fettuccine/Copy of Fettuccine.png", "e45-fettuccine-2", "Card de meniu — fettuccine cu creveți și sos roșu", "E45 Restobar"],
  ["Poze/E45 Restobar/fettuccine/Copy of DSCA-1-2.jpg", "e45-fettuccine-1", "Fettuccine cu parmezan și busuioc", "E45 Restobar"],
  ["Poze/E45 Restobar/R6__0202-Edit (3).png", "e45-meniu-papanasi", "Card de meniu — papanași cu smântână și dulceață", "E45 Restobar"],

  // rândul 3 — salata cu camembert, toate trei împreună
  ["Poze/E45 Restobar/salata camembert/Copy of R6__0242 (3).png", "e45-camembert-3", "Card de meniu — salată cu camembert în panko", "E45 Restobar"],
  ["Poze/E45 Restobar/salata camembert/Copy of Copy of R6__0225.jpg", "e45-camembert-1", "Salată cu camembert, prosciutto și pere", "E45 Restobar"],
  ["Poze/E45 Restobar/salata camembert/Copy of Copy of R6__0229.jpg", "e45-camembert-2", "Salată cu camembert, cadru apropiat", "E45 Restobar"],

  // rândul 4 — băuturile, una lângă alta
  ["Poze/E45 Restobar/bautura.png", "e45-indian-rose", "Cocktailul Indian Rose, în lumină caldă", "E45 Restobar"],
  ["Poze/E45 Restobar/negroni.png", "e45-negroni", "Cocktailul Negroni", "E45 Restobar"],
  ["Poze/E45 Restobar/New Project (95).png", "e45-meniu-salata", "Card de meniu — salată cu legume și vită", "E45 Restobar"],

  // rândul 5
  ["Poze/E45 Restobar/R6__0245-Edit (1).png", "e45-meniu-burger", "Card de meniu — burger de pui cu cartofi prăjiți", "E45 Restobar"],
  ["Poze/dr. TEO/INAINTE VS DUPA IULIA (1) (2) (1) (1) (1).png", "dr-teo-inainte-dupa-1", "Colaj înainte și după tratament", "Dr. Teo"],
  ["Poze/dr. TEO/INAINTE VS DUPA IULIA (1) (3) (1) (1).png", "dr-teo-inainte-dupa-2", "Colaj înainte și după tratament", "Dr. Teo"],
  ["Poze/dr. TEO/INAINTE VS DUPA IULIA (2).png", "dr-teo-inainte-dupa-3", "Colaj înainte și după tratament", "Dr. Teo"],
  ["Poze/dr. TEO/New Project (44) (1).png", "dr-teo-schema-buze", "Schema tehnicii de augmentare a buzelor", "Dr. Teo"],
  ["Poze/ice and roll/DSC00020 (1).png", "ice-roll-meniu", "Meniul de înghețată, la geamul de servire", "Ice and Roll"],
  ["Poze/ice and roll/DSC00025.png", "ice-roll-cornet-ciocolata", "Cornet cu ciocolată, primit la geam", "Ice and Roll"],
  ["Poze/ice and roll/DSC00027 (2).png", "ice-roll-cornet-vanilie", "Cornet de vanilie, la terasă", "Ice and Roll"],
];

function probe(file) {
  const out = execFileSync(
    FFPROBE,
    [
      "-v", "error",
      "-select_streams", "v:0",
      "-show_entries", "stream=width,height",
      "-show_entries", "format=duration",
      "-of", "json",
      file,
    ],
    { encoding: "utf8" }
  );
  const j = JSON.parse(out);
  const st = j.streams?.[0] ?? {};
  return {
    w: st.width ?? 0,
    h: st.height ?? 0,
    dur: Number(j.format?.duration ?? 0),
  };
}

function hasAudio(file) {
  const out = execFileSync(
    FFPROBE,
    ["-v", "error", "-select_streams", "a", "-show_entries", "stream=codec_name", "-of", "csv=p=0", file],
    { encoding: "utf8" }
  );
  return out.trim().length > 0;
}

mkdirSync(OUT_V, { recursive: true });
mkdirSync(OUT_P, { recursive: true });

const manifest = { videos: [], photos: [] };

/* ---------------- VIDEO ---------------- */
for (const v of VIDEOS) {
  const src = join(SRC, v.file);
  if (!existsSync(src)) {
    console.log(`LIPSA  ${v.file}`);
    continue;
  }
  const meta = probe(src);
  const audio = hasAudio(src);
  const mp4 = join(OUT_V, `${v.slug}.mp4`);
  const poster = join(OUT_V, `${v.slug}.webp`);

  // Nu urcăm rezoluția: A6 vine deja mic (478×850), un upscale ar
  // adăuga octeți fără să adauge detaliu.
  const targetH = Math.min(1920, meta.h);

  if (FORCE || !existsSync(mp4)) {
    const t0 = Date.now();
    execFileSync(FFMPEG, [
      "-y", "-v", "error",
      "-i", src,
      "-vf", `scale=-2:${targetH}:flags=lanczos`,
      "-c:v", "libx264",
      "-profile:v", "high",
      "-preset", "medium",
      "-crf", "24",
      "-maxrate", "5M",
      "-bufsize", "10M",
      "-pix_fmt", "yuv420p",
      ...(audio ? ["-c:a", "aac", "-b:a", "128k", "-ac", "2"] : ["-an"]),
      "-movflags", "+faststart",
      mp4,
    ]);
    const secs = ((Date.now() - t0) / 1000).toFixed(0);

    /* O sursă deja comprimată agresiv iese mai MARE după reencodare
       decât a intrat — și pierde și calitate pe drum, fiindcă e a doua
       trecere lossy peste una lossy. Când se întâmplă, originalul e
       strict mai bun: îl păstrăm și doar îi mutăm indexul în față, ca
       să poată porni înainte să se descarce tot. */
    if (statSync(mp4).size >= statSync(src).size) {
      execFileSync(FFMPEG, [
        "-y", "-v", "error",
        "-i", src,
        "-c", "copy",
        "-movflags", "+faststart",
        mp4,
      ]);
      console.log(
        `video  ${v.slug.padEnd(24)} ${MB(statSync(src).size).padStart(8)} -> ${MB(statSync(mp4).size).padStart(8)}  (original păstrat: reencodarea îl mărea)`
      );
    } else {
      console.log(
        `video  ${v.slug.padEnd(24)} ${MB(statSync(src).size).padStart(8)} -> ${MB(statSync(mp4).size).padStart(8)}  ${secs}s`
      );
    }
  }

  if (FORCE || !existsSync(poster)) {
    const at = Math.max(0.1, meta.dur * 0.25);
    execFileSync(FFMPEG, [
      "-y", "-v", "error",
      "-ss", String(at),
      "-i", src,
      "-frames:v", "1",
      "-vf", `scale=-2:${Math.min(1280, meta.h)}:flags=lanczos`,
      "-c:v", "libwebp",
      "-quality", "80",
      poster,
    ]);
  }

  const outMeta = probe(mp4);
  manifest.videos.push({
    slug: v.slug,
    client: v.client,
    title: v.title,
    kind: v.kind,
    featured: v.featured,
    src: `/video/portofoliu/${v.slug}.mp4`,
    poster: `/video/portofoliu/${v.slug}.webp`,
    w: outMeta.w,
    h: outMeta.h,
    seconds: Math.round(outMeta.dur),
    bytes: statSync(mp4).size,
    audio,
    /* Data la care materialul a intrat în site — o ia din fișierul
       livrat de client. Nu e data filmării; pe aia n-o știm. */
    published: statSync(src).mtime.toISOString(),
    /* A6 vine dintr-un fișier trecut prin WhatsApp: sub 720p pe
       înălțime. Marcat, ca pagina să nu-l așeze acolo unde s-ar vedea
       că e moale. */
    lowRes: outMeta.h < 1080,
  });
}

/* ---------------- POZE ---------------- */
const WIDTHS = [640, 1280, 1920];
for (const [file, slug, alt, client] of PHOTOS) {
  const src = join(SRC, file);
  if (!existsSync(src)) {
    console.log(`LIPSA  ${file}`);
    continue;
  }
  const img = sharp(src);
  const meta = await img.metadata();
  const widths = WIDTHS.filter((w) => w <= meta.width);
  if (widths.length === 0) widths.push(meta.width);

  for (const w of widths) {
    const out = join(OUT_P, `${slug}-${w}.webp`);
    if (!FORCE && existsSync(out)) continue;
    await sharp(src)
      .resize({ width: w, withoutEnlargement: true })
      .webp({ quality: 80, effort: 5 })
      .toFile(out);
  }
  const biggest = join(OUT_P, `${slug}-${widths[widths.length - 1]}.webp`);
  console.log(
    `foto   ${slug.padEnd(24)} ${MB(statSync(src).size).padStart(8)} -> ${MB(statSync(biggest).size).padStart(8)}  ${meta.width}x${meta.height}`
  );

  manifest.photos.push({
    slug,
    alt,
    client,
    published: statSync(src).mtime.toISOString(),
    widths,
    w: meta.width,
    h: meta.height,
    base: `/video/portofoliu/foto/${slug}`,
  });
}

writeFileSync(
  join(ROOT, "components", "site", "portfolio-manifest.json"),
  JSON.stringify(manifest, null, 2) + "\n",
  "utf8"
);

const vBytes = manifest.videos.reduce((s, v) => s + v.bytes, 0);
console.log(`\ngata: ${manifest.videos.length} video (${MB(vBytes)}), ${manifest.photos.length} poze`);
