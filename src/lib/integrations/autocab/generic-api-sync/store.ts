import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export class ApiRecordError extends Error {}

export function apiRecords(payload: unknown, recordKey: string | null) {
  if (!Array.isArray(payload) || !recordKey) return [{ externalId: "$response", data: payload }];
  const seen = new Set<string>();
  return payload.map((data, index) => {
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new ApiRecordError(`Record ${index + 1} is not an object. Clear Record Key to save the complete response.`);
    const value = (data as Record<string, unknown>)[recordKey];
    if ((typeof value !== "string" && typeof value !== "number") ||
      (typeof value === "number" && !Number.isFinite(value)) || String(value).trim() === "") {
      throw new ApiRecordError(`Record ${index + 1} has no valid ${recordKey}.`);
    }
    const externalId = String(value);
    if (seen.has(externalId)) throw new ApiRecordError(`Duplicate record key: ${externalId}.`);
    seen.add(externalId);
    return {externalId, data};
  });
}

export async function storeApiResponse(endpointId: string, payload: unknown, recordKey: string | null, tx?: Prisma.TransactionClient) {
  const records = apiRecords(payload, recordKey);
  const save = async (db: Prisma.TransactionClient) => {
    let created = 0, updated = 0;
    await db.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`api-records:${endpointId}`}, 0))::text`;
    for (const record of records) {
      const where = {endpointId_externalId: {endpointId, externalId: record.externalId}};
      const existing = await db.apiEndpointRecord.findUnique({where, select: {id: true}});
      const data = record.data === null ? Prisma.JsonNull : record.data as Prisma.InputJsonValue;
      const source = record.data && typeof record.data === "object" && !Array.isArray(record.data)
        ? (record.data as Record<string, unknown>).rowVersion : null;
      const values = {data, isActive: true, lastSyncedAt: new Date(),
        sourceVersion: typeof source === "string" || typeof source === "number" ? String(source) : null};
      await db.apiEndpointRecord.upsert({where, create: {endpointId, externalId: record.externalId, ...values}, update: values});
      if (existing) updated++; else created++;
    }
    await db.apiEndpointConfiguration.update({where: {id: endpointId}, data: {storeRecords: true, recordKey,
      sampleResponse: payload === null ? Prisma.JsonNull : payload as Prisma.InputJsonValue}});
    return {received: Array.isArray(payload) ? payload.length : 1, eligible: records.length, created, updated, disabled: 0, failed: 0};
  };
  return tx ? save(tx) : prisma.$transaction(save, {timeout: 60000});
}
