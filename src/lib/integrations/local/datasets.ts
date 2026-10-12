import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import {
  apiRecords,
  storeApiResponse,
} from "@/lib/integrations/autocab/generic-api-sync/store";
import {
  signApiPreview,
  verifyApiPreview,
} from "@/lib/integrations/autocab/generic-api-sync/preview";
export function localDatasetInput(body: unknown) {
  if (!body || typeof body !== "object") throw new Error("Supply a dataset.");
  const value = body as Record<string, unknown>;
  const name = typeof value.name === "string" ? value.name.trim() : "";
  const recordKey =
    typeof value.recordKey === "string" ? value.recordKey.trim() : "";
  if (
    !name ||
    name.length > 200 ||
    recordKey.length > 100 ||
    value.payload === undefined
  )
    throw new Error("Supply a name and valid JSON.");
  const payload = value.payload;
  if (
    Buffer.byteLength(JSON.stringify(payload), "utf8") > 512 * 1024 ||
    (Array.isArray(payload) && payload.length > 500)
  )
    throw new Error("Use at most 500 records and 512 KB per import.");
  const records = apiRecords(payload, recordKey || null);
  return { name, recordKey, payload, records };
}
function scope(actor: string, name: string, recordKey: string) {
  return JSON.stringify(["LOCAL", actor, name, recordKey]);
}
export function previewLocalDataset(actor: string, body: unknown) {
  const input = localDatasetInput(body);
  return {
    records: input.records.length,
    preview: input.records.slice(0, 5),
    previewToken: signApiPreview(
      scope(actor, input.name, input.recordKey),
      input.payload,
    ),
  };
}
export async function saveLocalDataset(actor: string, body: unknown) {
  const input = localDatasetInput(body);
  const token = (body as Record<string, unknown>).previewToken;
  if (typeof token !== "string")
    throw new Error("Preview the data before saving.");
  verifyApiPreview(
    scope(actor, input.name, input.recordKey),
    input.payload,
    token,
  );
  const url = `local://taxicrm/${createHash("sha256").update(token).digest("hex")}`;
  return prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${url},0))::text`;
      const existing = await tx.apiEndpointConfiguration.findUnique({
        where: { url },
        select: { id: true },
      });
      if (existing)
        return {
          id: existing.id,
          alreadySaved: true,
          stored: { created: 0, updated: 0 },
        };
      const dataset = await tx.apiEndpointConfiguration.create({
        data: {
          provider: "LOCAL",
          name: input.name,
          url,
          method: "LOCAL_JSON",
          isEnabled: false,
          storeRecords: true,
          recordKey: input.recordKey || null,
        },
      });
      const stored = await storeApiResponse(
        dataset.id,
        input.payload,
        input.recordKey || null,
        tx,
      );
      await tx.administrationAuditEvent.create({
        data: {
          actorUserId: actor,
          action: "LOCAL_DATASET_IMPORTED",
          targetType: "ApiEndpointConfiguration",
          targetId: dataset.id,
          evidence: { name: input.name, records: stored.created },
        },
      });
      return { id: dataset.id, stored };
    },
    { timeout: 30000 },
  );
}
