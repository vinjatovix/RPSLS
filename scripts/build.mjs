import { build } from "esbuild";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const dist = join(root, "dist");

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

await build({
  entryPoints: [join(root, "src", "index.js")],
  outfile: join(dist, "index.js"),
  bundle: true,
  minify: true,
  format: "esm",
  target: ["es2022"],
  logLevel: "info"
});

cpSync(join(root, "style.css"), join(dist, "style.css"));
writeFileSync(join(dist, ".nojekyll"), "");

const html = readFileSync(join(root, "index.html"), "utf8").replace(
  'src="src/index.js"',
  'src="./index.js"'
);
writeFileSync(join(dist, "index.html"), html);

console.log(`build OK -> ${dist}`);
