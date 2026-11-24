// Builds the arcade pass, the one script every machine loads, to public/pass.js, and its font to public/pass/.
// Usage: node scripts/pass.ts [--watch]. `npm run build` and `npm run dev` run it first.
import { build } from "vite";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

// The machines, in hall order, from the one source of game facts. A regex rather than an import:
// games.ts imports images, which only Astro can resolve.
const src = readFileSync("src/data/games.ts", "utf8");
const field = (k: string) => [...src.matchAll(new RegExp(`^ {4}${k}: "([^"]+)",$`, "gm"))].map((m) => m[1]);
const [slugs, names, grounds, brights] = ["slug", "name", "ground", "bright"].map(field);
if (![names, grounds, brights].every((a) => a.length === slugs.length)) throw new Error("games.ts: could not read every machine");
const list = slugs.map((slug, i) => ({ slug, name: names[i], ground: grounds[i], bright: brights[i] }));
writeFileSync("src/pass/machines.gen.ts", `// Written by scripts/pass.ts from src/data/games.ts. Do not edit.\nexport const list = ${JSON.stringify(list, null, 2)};\n`);

mkdirSync("public/pass", { recursive: true });
copyFileSync("src/fonts/bricolage-grotesque.woff2", "public/pass/bricolage.woff2");

await build({
  configFile: false,
  logLevel: "warn",
  publicDir: false,
  build: {
    lib: { entry: "src/pass/main.ts", formats: ["iife"], name: "arcadePassBundle", fileName: () => "pass.js" },
    outDir: "public",
    emptyOutDir: false,
    minify: true,
    target: "es2022",
    watch: process.argv.includes("--watch") ? {} : null,
  },
});
