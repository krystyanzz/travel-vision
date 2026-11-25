// Gera um único HTML autocontido do Travel Vision para publicar como artefato.
// Uso: node scripts/build-artifact.mjs <arquivo de saída>

import { build } from "esbuild";
import { writeFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const out = process.argv[2] ?? path.join(root, "artifact-dist", "travel-vision.html");

const result = await build({
  entryPoints: [path.join(root, "artifact", "entry.tsx")],
  bundle: true,
  write: false,
  minify: true,
  format: "iife",
  target: "es2020",
  jsx: "automatic",
  outdir: "out",
  alias: {
    "@": path.join(root, "src"),
    "next/link": path.join(root, "artifact", "shims", "link.tsx"),
    "next/navigation": path.join(root, "artifact", "shims", "navigation.ts"),
  },
  define: { "process.env.NODE_ENV": '"production"' },
  logLevel: "warning",
});

const js = result.outputFiles.find((f) => f.path.endsWith(".js")).text;
let css = result.outputFiles.find((f) => f.path.endsWith(".css")).text;

// No artefato o tema vem do visualizador: data-theme quando há escolha explícita,
// senão a preferência do sistema. O CSS do app é escuro por padrão e claro em
// [data-theme="light"]; aqui o mesmo bloco claro passa a valer também pela mídia.
const light = css.match(/:root\[data-theme=(?:"light"|light)\]\{[^}]*\}/);
if (!light) throw new Error("Bloco do tema claro não encontrado no CSS");
const lightBody = light[0].slice(light[0].indexOf("{"));
css += `@media (prefers-color-scheme: light){:root:not([data-theme="dark"])${lightBody}}`;
css += `:root{--font-sora:"Sora";--font-inter:"Inter"}`;
css += `.theme-toggle{display:none}`;
css += `.site-header{top:env(safe-area-inset-top,0px)}`;

const html = `<title>Travel Vision</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Sora:wght@400;600&display=swap">
<style>${css}</style>
<div id="tv-root"></div>
<script>${js.replace(/<\/script/gi, "<\\/script")}</script>
`;

writeFileSync(out, html);
console.log(`${out} · ${(html.length / 1024).toFixed(0)} KB`);
