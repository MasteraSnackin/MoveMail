import { readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const roots = ["js", "scripts", "tests"];
const rootFiles = ["server.mjs"];
const failures = [];
let checked = 0;

async function checkDirectory(relativeDirectory) {
  const directory = resolve(projectRoot, relativeDirectory);
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const relativePath = `${relativeDirectory}/${entry.name}`;
    if (entry.isDirectory()) {
      if (relativePath !== "js/vendor") {
        await checkDirectory(relativePath);
      }
      continue;
    }
    if (!/\.(?:js|mjs)$/.test(entry.name)) {
      continue;
    }

    checked += 1;
    const result = spawnSync(process.execPath, ["--check", relativePath], {
      cwd: projectRoot,
      encoding: "utf8",
    });
    if (result.status !== 0) {
      failures.push(`${relativePath}\n${result.stderr || result.stdout}`);
    }
  }
}

for (const root of roots) {
  await checkDirectory(root);
}

for (const relativePath of rootFiles) {
  checked += 1;
  const result = spawnSync(process.execPath, ["--check", relativePath], {
    cwd: projectRoot,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    failures.push(`${relativePath}\n${result.stderr || result.stdout}`);
  }
}

if (failures.length) {
  throw new Error(`Syntax checks failed:\n\n${failures.join("\n\n")}`);
}

console.log(`Syntax checked ${checked} JavaScript files.`);
