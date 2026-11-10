import { evaluateHistoricalPilot, type PilotEnvelope } from "../src/lib/customers/prediction-historical-pilot";
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";

// A bundled, dependency-free stdin/stdout program: no DB client, environment
// secrets, filesystem writes, network calls, application bootstrap or workers.
async function main() {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of process.stdin) {
    const buffer = Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > 30_000_000) throw new Error("Source stream too large");
    chunks.push(buffer);
  }
  const data = JSON.parse(Buffer.concat(chunks).toString("utf8")) as PilotEnvelope;
  const result = await new Promise<ReturnType<typeof evaluateHistoricalPilot>>((resolve, reject) => {
    // Execute only the reviewed standalone bundle; no app bootstrap or env reads.
    const worker = new Worker(__filename, { workerData: data, env: {}, execArgv: [], resourceLimits: { maxOldGenerationSizeMb: 128 } });
    const timer = setTimeout(() => {
      void worker.terminate();
      reject(new Error("Pilot computation exceeded 45 seconds"));
    }, 45_000);
    worker.once("message", (report) => { clearTimeout(timer); resolve(report); });
    worker.once("error", () => { clearTimeout(timer); reject(new Error("Pilot worker failed")); });
    worker.once("exit", (code) => { if (code !== 0) { clearTimeout(timer); reject(new Error("Pilot worker exited")); } });
  });
  console.log(JSON.stringify(result, null, 2));
}
if (!isMainThread) {
  parentPort!.postMessage(evaluateHistoricalPilot(workerData as PilotEnvelope));
} else main().catch(() => {
  console.error("HISTORICAL_PILOT_FAILED: source, size, timestamps or quality checks failed; no partial report emitted.");
  process.exitCode = 1;
});
