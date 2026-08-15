import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const ROOTS = ["src", "scripts", "test"];
const EXCLUDE = new Set(["dist", "node_modules", "balance-sim.html"]);

function collect(dir, acc) {
  for (const name of readdirSync(dir)) {
    if (EXCLUDE.has(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) collect(full, acc);
    else if (/\.(mjs|js)$/.test(name)) acc.push(full);
  }
  return acc;
}

const files = [];
for (const root of ROOTS) {
  if (statSync(root, { throwIfNoEntry: false })?.isDirectory()) collect(root, files);
}

let failed = 0;
for (const file of files) {
  const res = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (res.status !== 0) {
    failed++;
    process.stderr.write(`[FAIL] ${file}\n${res.stderr}\n`);
  }
}

if (failed) {
  process.stderr.write(`${failed} file(s) with syntax errors\n`);
  process.exit(1);
}
console.log(`OK - ${files.length} files with valid syntax`);
