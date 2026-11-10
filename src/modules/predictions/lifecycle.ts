import { AsyncLocalStorage } from "node:async_hooks";
import { prisma } from "@/lib/prisma";
import { loadModuleState } from "@/modules/core/activation/store";
import type { Prisma } from "@/generated/prisma/client";
import type { ModuleState } from "@/modules/core/activation/model";

export class PredictionsDisabled extends Error { constructor() { super("PREDICTIONS_MODULE_DISABLED"); } }
const unit = new AsyncLocalStorage<{ state: ModuleState; tx: Prisma.TransactionClient }>();
// Reentrant within one async unit. Holding the shared lock means a disable cannot
// commit halfway through an accepted customer's/forecast's persistence work.
// Maintenance batches call this per unit, not around the whole customer batch.
export async function predictionUnit<T>(work: () => Promise<T>, options: { timeoutMs?: number } = {}): Promise<T> {
  if (unit.getStore()) return work();
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SET LOCAL lock_timeout='3s'`;
    await tx.$queryRaw`SELECT pg_advisory_xact_lock_shared(187438601, 1)::text`;
    const state = await loadModuleState(tx);
    if (!state.enabled.predictions) throw new PredictionsDisabled();
    await tx.$executeRaw`SET LOCAL statement_timeout='90s'`;
    return unit.run({ state, tx }, work);
  }, { maxWait: 5000, timeout: options.timeoutMs ?? 120000 });
}
export function predictionEpoch() { return unit.getStore()?.state.predictionEpoch ?? null; }
export function predictionEpochWhere(state?: ModuleState) {
  const epoch = state?.predictionEpoch ?? predictionEpoch();
  return epoch ? { issuedAt: { gte: new Date(epoch) } } : {};
}
export function predictionScopedKey(key: string) {
  const epoch = predictionEpoch(); return epoch ? `${key}:activation:${epoch}` : key;
}
export async function predictionAvailability() {
  try { const state = await loadModuleState(); return { status: state.enabled.predictions ? "ENABLED" as const : "DISABLED" as const, state }; }
  catch { return { status: "UNAVAILABLE" as const, state: null }; }
}

// Existing prediction service calls use this delegate so every read/write in the
// accepted unit uses the SAME transaction. A timeout cannot release the guard and
// leave an uncancelled callback writing through a separate global connection.
export const predictionPrisma = new Proxy(prisma, {
  get(target, property) {
    const context = unit.getStore();
    if (context && property === "$transaction") {
      return async (work: (tx: Prisma.TransactionClient) => Promise<unknown>) => work(context.tx);
    }
    const delegate = context?.tx ?? target;
    const value = Reflect.get(delegate, property);
    return typeof value === "function" ? value.bind(delegate) : value;
  },
});
