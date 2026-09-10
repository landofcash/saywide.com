import { cp, rm } from "node:fs/promises";
import { relative } from "node:path";
import { URL, fileURLToPath } from "node:url";

const outputRoot = new URL("../dist/", import.meta.url);
const destination = new URL("skills/", outputRoot);
if (relative(fileURLToPath(outputRoot), fileURLToPath(destination)) !== "skills") {
  throw new Error("Invalid generated skill output directory");
}
// This directory contains only generated assets. Remove stale resources on rebuild.
await rm(destination, { recursive: true, force: true });
await cp(new URL("../skills/", import.meta.url), destination, { recursive: true });
