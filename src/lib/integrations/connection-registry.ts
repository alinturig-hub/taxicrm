import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { createConnectionPlan } from "./connection-plan";

export function parseDraftRequest(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid draft.");
  const input = value as Record<string, unknown>;
  const fields = ["companyName", "source", "storage", "requestId"];
  if (Object.keys(input).some(key => !fields.includes(key)) || fields.some(key => typeof input[key] !== "string"))
    throw new Error("Only company, source, storage and request ID are accepted.");
  if (!/^[a-z0-9-]{16,64}$/i.test(input.requestId as string)) throw new Error("Invalid request ID.");
  return {
    requestId: input.requestId as string,
    plan: createConnectionPlan(input as { companyName: string; source: string; storage: string }),
  };
}

// Safe DTO: never return a credential column, even when future adapters populate it.
export const publicConnectionSelect = {
  id: true, providerCode: true, displayName: true, companyLabel: true,
  status: true, plan: true, createdAt: true,
} as const;

export async function saveConnectionDraft(actorId: string, input: unknown) {
  const { requestId, plan } = parseDraftRequest(input);
  const draftKey = createHash("sha256").update(`${actorId}:${requestId}`).digest("hex");
  const existing = await prisma.integrationConnection.findUnique({ where: { draftKey }, select: publicConnectionSelect });
  function matching<T extends { plan: unknown }>(connection: T): T {
    const saved = connection.plan as Record<string, unknown>;
    if (saved.companyName !== plan.companyName || saved.source !== plan.source || saved.storage !== plan.storage)
      throw new Error("Request ID already belongs to another plan.");
    return connection;
  }
  if (existing) return matching(existing);
  try {
    const connection = await prisma.integrationConnection.create({
    data: {
      draftKey, providerCode: plan.source, displayName: `${plan.companyName} — ${plan.source}`,
      companyLabel: plan.companyName, status: "DRAFT", createdById: actorId,
      capabilities: [], ownershipPolicy: { preserveExistingConnection: true, activationAllowed: false },
      plan,
    },
    select: publicConnectionSelect,
    });
    return matching(connection);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      const winner = await prisma.integrationConnection.findUnique({ where: { draftKey }, select: publicConnectionSelect });
      if (winner) return matching(winner);
    }
    throw error;
  }
}
