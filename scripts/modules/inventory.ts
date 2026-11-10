import { readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { moduleForRoute, sharedCoordinators } from "../../src/modules/core/ownership";
import { modules } from "../../src/modules/core/registry";
import { workerOwnership } from "../../src/modules/core/worker-ownership";
function walk(dir: string): string[] { return readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]); }
const files = walk("src/app").filter(f => /\/(page|route)\.tsx?$/.test(f));
const entries = files.map(file => { const path = file.replace(/^src\/app/, "").replace(/\/(page|route)\.tsx?$/, "") || "/"; return { file, path, kind: file.endsWith("route.ts") ? "api" : "page", moduleId: moduleForRoute(path) }; });
const missing = entries.filter(e => e.moduleId === null);
if (missing.length) {
    console.error(JSON.stringify({ unmapped: missing }, null, 2));
    process.exitCode = 1;
}
else {
    mkdirSync("docs/modules", { recursive: true });
    writeFileSync("docs/modules/inventory.json", JSON.stringify({ baseline: "f259b3a1a6c986f6b82fe22c795e7d44d7a97970", scope: "Ownership inventory; guarded activation for AI, Reports, Automation and Predictions is documented in ACTIVATION.md and PREDICTIONS_ACTIVATION.md", modules, entries, sharedCoordinators, workerOwnership }, null, 2) + "\n");
    console.log(`Mapped ${entries.length} routes/pages across ${Object.keys(modules).length} module boundaries.`);
}
