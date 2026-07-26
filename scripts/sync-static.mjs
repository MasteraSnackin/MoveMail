import { cp, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const publicRoot = resolve(projectRoot, "public");

await mkdir(publicRoot, { recursive: true });
for (const resourcePath of ["css", "js", "assets", "tests"]) {
  await cp(resolve(projectRoot, resourcePath), resolve(publicRoot, resourcePath), {
    recursive: true,
    force: true,
  });
}
await cp(resolve(projectRoot, "index.html"), resolve(publicRoot, "index.html"), {
  force: true,
});

console.log("MoveMail static files are ready in public/.");
