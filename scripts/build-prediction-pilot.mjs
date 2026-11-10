import { build } from "esbuild";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

await mkdir("docs/prediction-validation/release", { recursive: true });
const result = await build({
  entryPoints: ["scripts/prediction-historical-pilot.ts"], bundle: true,
  platform: "node", target: "node20", format: "cjs", legalComments: "none",
  outfile: "docs/prediction-validation/release/historical-evaluator.cjs", metafile: true,
});
const imports = Object.values(result.metafile.outputs).flatMap((output) => output.imports);
if (imports.some((item) => item.path !== "node:worker_threads")) {
  throw new Error("Unexpected dependency in standalone pilot");
}
const paths = [
  ["docs/prediction-validation/release/historical-evaluator.cjs", "evaluator.cjs"],
  ["scripts/prediction-historical-sample.sql", "sample.sql"],
];
const checksums = await Promise.all(paths.map(async ([path, filename]) =>
  `${createHash("sha256").update(await readFile(path)).digest("hex")}  ${filename}`,
));
await writeFile("docs/prediction-validation/release/checksums.sha256", checksums.join("\n") + "\n");
console.log("Built dependency-free historical evaluator");
