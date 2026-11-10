import { readFileSync, statSync } from "node:fs";
import { validateBookingWindows, type ValidationInput } from "../src/lib/customers/booking-window-validation";

// No database, networking, schema changes, model fitting or customer messaging.
try {
  const path = process.argv[2];
  if (!path || process.argv.length !== 3) throw new Error("Expected one input file");
  if (statSync(path).size > 20_000_000) throw new Error("Input too large");
  const raw = readFileSync(path, "utf8");
  const input = JSON.parse(raw) as ValidationInput;
  if (!Array.isArray(input.customers) || input.customers.length > 10_000) throw new Error("Invalid cohort");
  console.log(JSON.stringify(validateBookingWindows(input), null, 2));
} catch {
  // Never echo untrusted input, identifiers or file contents to logs.
  console.error("VALIDATION_FAILED: check input, explicit UTC offsets, verified coverage and evaluation limits. No partial report was emitted.");
  process.exitCode = 1;
}
