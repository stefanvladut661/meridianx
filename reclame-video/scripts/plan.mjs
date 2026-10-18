// Compilează scripts/plan.ts cu esbuild (JSX, importuri JSON) și îl rulează.
// Remotion e înlocuit cu un modul gol: planul are nevoie doar de funcțiile
// de timp, nu de componente.

import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "out/.plan.cjs");

await build({
  entryPoints: [join(root, "scripts/plan.ts")],
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile: out,
  jsx: "automatic",
  loader: { ".json": "json" },
  logLevel: "error",
  external: ["@remotion/google-fonts/*"],
  plugins: [
    {
      name: "stub-browser",
      setup(b) {
        b.onResolve({ filter: /^@remotion\/google-fonts\// }, (a) => ({ path: a.path, namespace: "stub" }));
        b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({ contents: "export const loadFont = () => ({ fontFamily: 'x' });", loader: "js" }));
      },
    },
  ],
});
const r = spawnSync(process.execPath, [out, join(root, "out")], { stdio: "inherit" });
process.exit(r.status ?? 1);
