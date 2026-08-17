import { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import { getAutocabApiCredentials } from "@/lib/integrations/autocab/configuration";

type JsonRecord = Record<string, unknown>;

export type GenericApiSyncResult = {
  endpointId: string;
  endpointName: string;
  received: number;
  eligible: number;
  created: number;
  updated: number;
  disabled: number;
  failed: number;
};

function isRecord(value: unknown): value is JsonRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function getExternalId(
  record: JsonRecord,
  recordKey: string,
): string | null {
  const value = record[recordKey];

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "bigint"
  ) {
    return String(value);
  }

  return null;
}

function getSourceVersion(record: JsonRecord) {
  const value = record.rowVersion;

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "bigint"
  ) {
    return String(value);
  }

  return null;
}

export async function syncGenericApiEndpoint(
  endpointId: string,
): Promise<GenericApiSyncResult> {
  const endpoint =
    await prisma.apiEndpointConfiguration.findUnique({
      where: {
        id: endpointId,
      },
    });

  if (!endpoint) {
    throw new Error("API endpoint configuration not found.");
  }

  if (!endpoint.isEnabled) {
    throw new Error("API endpoint is disabled.");
  }

  if (!endpoint.storeRecords) {
    throw new Error(
      "Record storage is not enabled for this endpoint.",
    );
  }

  if (!endpoint.recordKey) {
    throw new Error(
      "No record key is configured for this endpoint.",
    );
  }

  const credentials =
    await getAutocabApiCredentials();

  const endpointUrl = new URL(endpoint.url);
  const configuredBaseUrl = new URL(
    credentials.baseUrl,
  );

  if (
    endpointUrl.hostname !==
    configuredBaseUrl.hostname
  ) {
    throw new Error(
      "Endpoint host does not match the configured Autocab host.",
    );
  }

  const response = await fetch(endpoint.url, {
    method: endpoint.method || "GET",
    headers: {
      "Ocp-Apim-Subscription-Key":
        credentials.apiKey,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      `Autocab returned HTTP ${response.status}.`,
    );
  }

  const payload: unknown = await response.json();

  if (!Array.isArray(payload)) {
    throw new Error(
      "Generic record sync currently requires an array response.",
    );
  }

  const records = payload.filter(isRecord);

  let created = 0;
  let updated = 0;
  let failed = 0;

  const activeExternalIds: string[] = [];

  for (const record of records) {
    const externalId = getExternalId(
      record,
      endpoint.recordKey,
    );

    if (!externalId) {
      failed += 1;
      continue;
    }

    activeExternalIds.push(externalId);

    try {
      const existing =
        await prisma.apiEndpointRecord.findUnique({
          where: {
            endpointId_externalId: {
              endpointId: endpoint.id,
              externalId,
            },
          },
          select: {
            id: true,
          },
        });

      await prisma.apiEndpointRecord.upsert({
        where: {
          endpointId_externalId: {
            endpointId: endpoint.id,
            externalId,
          },
        },
        create: {
          endpointId: endpoint.id,
          externalId,
          data: record as Prisma.InputJsonValue,
          isActive: true,
          sourceVersion:
            getSourceVersion(record),
          lastSyncedAt: new Date(),
        },
        update: {
          data: record as Prisma.InputJsonValue,
          isActive: true,
          sourceVersion:
            getSourceVersion(record),
          lastSyncedAt: new Date(),
        },
      });

      if (existing) {
        updated += 1;
      } else {
        created += 1;
      }
    } catch {
      failed += 1;
    }
  }

  const disabledResult =
    await prisma.apiEndpointRecord.updateMany({
      where: {
        endpointId: endpoint.id,
        isActive: true,
        externalId: {
          notIn: activeExternalIds,
        },
      },
      data: {
        isActive: false,
        lastSyncedAt: new Date(),
      },
    });

  return {
    endpointId: endpoint.id,
    endpointName: endpoint.name,
    received: payload.length,
    eligible: records.length,
    created,
    updated,
    disabled: disabledResult.count,
    failed,
  };
}
