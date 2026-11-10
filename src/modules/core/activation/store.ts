import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { initialModuleState, nextModuleState, parseModuleState, type SwitchableModule } from "./model";

// Existing append-only administration journal is the durable state authority.
// These events MUST be retained; they are configuration, not disposable telemetry.
const identity = { action: "INSTALLATION_MODULES_UPDATED", targetType: "TaxiCRMInstallationModules", targetId: "current" };
type Reader = Pick<Prisma.TransactionClient, "administrationAuditEvent">;
export async function loadModuleState(db: Reader = prisma) {
  // IDs encode the revision. Transaction start times are not commit order;
  // ordering solely by occurredAt would lose concurrent edits after lock waits.
  const row = await db.administrationAuditEvent.findFirst({
    where: identity, orderBy: { id: "desc" }, select: { id: true, evidence: true },
  });
  if (!row) return initialModuleState();
  const evidence = row.evidence as { configuration?: unknown } | null;
  const state = parseModuleState(evidence?.configuration);
  if (row.id !== eventId(state.revision) || state.revision === 0) throw Error("MODULE_STATE_INVALID");
  return state;
}
function eventId(revision: number) { return `installation-modules:${String(revision).padStart(16, "0")}`; }
export async function changeModuleState(input: { revision: number; moduleId: SwitchableModule; enabled: boolean }, actorUserId: string) {
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SET LOCAL statement_timeout='8s'`;
    await tx.$executeRaw`SET LOCAL lock_timeout='3s'`;
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(187438601, 1)::text`;
    const previous = await loadModuleState(tx);
    if (previous.revision !== input.revision) throw Error("MODULE_VERSION_CONFLICT");
    if (previous.enabled[input.moduleId] === input.enabled) return previous;
    const configuration = nextModuleState(previous, input.moduleId, input.enabled);
    if (input.moduleId === "predictions" && input.enabled) {
      const [clock] = await tx.$queryRaw<Array<{ at: Date }>>`SELECT clock_timestamp() AS at`;
      configuration.predictionEpoch = clock.at.toISOString();
    }
    await tx.administrationAuditEvent.create({ data: {
      ...identity, id: eventId(configuration.revision), actorUserId,
      evidence: { previousRevision: previous.revision, changedModule: input.moduleId,
        previousEnabled: previous.enabled[input.moduleId], enabled: input.enabled, configuration },
    } });
    return configuration;
  }, { timeout: 12000 });
}
