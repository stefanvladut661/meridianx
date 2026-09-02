/**
 * Generează iconurile de brand din marca MERIDIAN.
 *
 * Sursa e aceeași geometrie ca `components/site/mark.tsx` — inel
 * întrerupt la 12 și la 6, plus chevronul „<" — desenată aici ca SVG
 * de sine stătător, ca fișierele să nu depindă de React.
 *
 * De ce fundal plin și nu transparent: un favicon transparent cu marcă
 * deschisă dispare pe barele de file albe. Fundalul e negrul comun al
 * celor două lumi, deci nu favorizează nicio divizie.
 *
 * Ieșiri (convențiile App Router — Next le leagă automat în <head>):
 *   app/favicon.ico      16 + 32 + 48, PNG în container ICO
 *   app/icon.png         512, pentru browsere moderne și Google
 *   app/apple-icon.png   180, pentru ecranul de start iOS
 *
 * Rulare: node scripts/brand-icons.mjs
 */

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const APP = join(ROOT, "app");

const BG = "#08080F"; // negrul comun al celor două lumi
const FG = "#F2F3F8"; // bone, nu alb pur

/** Marca, într-un pătrat de `size`, cu marginea de siguranță proprie. */
function markSvg(size, { rounded = 0 } = {}) {
  const r = 38;
  const c = 2 * Math.PI * r;
  const gap = 12;
  const dash = c / 2 - gap;
  const offset = dash + gap / 2 - c / 4;

  // La 16px liniile subțiri dispar; îngroșăm progresiv sub 64px.
  const boost = size < 64 ? 1.25 : 1;

  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="${rounded}" fill="${BG}"/>
  <g transform="translate(50 50) scale(0.82) translate(-50 -50)">
    <circle cx="50" cy="50" r="${r}" fill="none" stroke="${FG}" stroke-width="${(7.5 * boost).toFixed(2)}"
      stroke-dasharray="${dash} ${gap}" stroke-dashoffset="${offset}"/>
    <path d="M67 27 L33.5 50 L67 73" fill="none" stroke="${FG}" stroke-width="${(8.5 * boost).toFixed(2)}"
      stroke-linejoin="miter" stroke-linecap="butt"/>
  </g>
</svg>`);
}

const png = (size, opts) =>
  sharp(markSvg(size, opts), { density: 384 }).resize(size, size).png({ compressionLevel: 9 }).toBuffer();

/** Container ICO cu imagini PNG — acceptat de toate browserele actuale. */
function ico(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // rezervat
  header.writeUInt16LE(1, 2); // tip: icon
  header.writeUInt16LE(images.length, 4);

  const dir = Buffer.alloc(16 * images.length);
  let offset = header.length + dir.length;

  images.forEach((img, i) => {
    const at = i * 16;
    dir.writeUInt8(img.size >= 256 ? 0 : img.size, at); // 0 înseamnă 256
    dir.writeUInt8(img.size >= 256 ? 0 : img.size, at + 1);
    dir.writeUInt8(0, at + 2); // paletă
    dir.writeUInt8(0, at + 3); // rezervat
    dir.writeUInt16LE(1, at + 4); // planuri
    dir.writeUInt16LE(32, at + 6); // biți/pixel
    dir.writeUInt32LE(img.data.length, at + 8);
    dir.writeUInt32LE(offset, at + 12);
    offset += img.data.length;
  });

  return Buffer.concat([header, dir, ...images.map((i) => i.data)]);
}

const sizes = [16, 32, 48];
const icoImages = [];
for (const size of sizes) {
  icoImages.push({ size, data: await png(size) });
}
writeFileSync(join(APP, "favicon.ico"), ico(icoImages));
console.log(`favicon.ico   ${sizes.join(" + ")}px`);

writeFileSync(join(APP, "icon.png"), await png(512));
console.log("icon.png      512px");

// iOS pune singur colțurile rotunde peste apple-icon, deci rămâne pătrat plin.
writeFileSync(join(APP, "apple-icon.png"), await png(180));
console.log("apple-icon.png 180px");

// Pentru manifest: două mărimi maskable, cu marjă proprie.
writeFileSync(join(ROOT, "public", "brand", "icon-192.png"), await png(192, { rounded: 22 }));
writeFileSync(join(ROOT, "public", "brand", "icon-512.png"), await png(512, { rounded: 22 }));
console.log("brand/icon-192.png, brand/icon-512.png");
