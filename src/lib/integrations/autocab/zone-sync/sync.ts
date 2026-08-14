import { prisma } from "@/lib/prisma";
import { getAutocabApiCredentials } from "@/lib/integrations/autocab/configuration";

type AutocabZone = {
  id?: number | string;
  name?: string | null;
  active?: boolean | null;
  companyId?: number | null;
  mdtZoneId?: number | null;
  descriptor?: string | null;
  centre?: {
    latitude?: number | null;
    longitude?: number | null;
  } | null;
};

export async function syncAutocabZones() {
  const credentials =
    await getAutocabApiCredentials();

  const url = new URL(
    "/booking/v1/zones",
    credentials.baseUrl,
  );

  const response = await fetch(
    url.toString(),
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Cache-Control": "no-cache",
        "Ocp-Apim-Subscription-Key":
          credentials.apiKey,
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(
      `Autocab zones API returned HTTP ${response.status}.`,
    );
  }

  const payload =
    (await response.json()) as AutocabZone[];

  if (!Array.isArray(payload)) {
    throw new Error(
      "Autocab zones API did not return an array.",
    );
  }

  const eligible = payload.filter(
    (zone) =>
      zone.active === true &&
      zone.companyId === 1 &&
      zone.id !== undefined &&
      zone.id !== null &&
      typeof zone.name === "string" &&
      zone.name.trim().length > 0,
  );

  let created = 0;
  let updated = 0;
  let failed = 0;

  const syncedIds: string[] = [];

  for (const zone of eligible) {
    try {
      const externalId = String(zone.id);
      syncedIds.push(externalId);

      const existing =
        await prisma.zone.findUnique({
          where: {
            provider_externalId: {
              provider: "AUTOCAB",
              externalId,
            },
          },
          select: {
            id: true,
          },
        });

      await prisma.zone.upsert({
        where: {
          provider_externalId: {
            provider: "AUTOCAB",
            externalId,
          },
        },
        create: {
          provider: "AUTOCAB",
          externalId,
          companyId: 1,
          mdtZoneId:
            zone.mdtZoneId ?? null,
          name: zone.name!.trim(),
          descriptor:
            zone.descriptor?.trim() ||
            null,
          latitude:
            zone.centre?.latitude ??
            null,
          longitude:
            zone.centre?.longitude ??
            null,
          active: true,
          rawPayload: zone as object,
          lastSyncedAt: new Date(),
        },
        update: {
          companyId: 1,
          mdtZoneId:
            zone.mdtZoneId ?? null,
          name: zone.name!.trim(),
          descriptor:
            zone.descriptor?.trim() ||
            null,
          latitude:
            zone.centre?.latitude ??
            null,
          longitude:
            zone.centre?.longitude ??
            null,
          active: true,
          rawPayload: zone as object,
          lastSyncedAt: new Date(),
        },
      });

      if (existing) {
        updated += 1;
      } else {
        created += 1;
      }
    } catch (error) {
      failed += 1;
      console.error(
        "Failed to sync Autocab zone:",
        zone,
        error,
      );
    }
  }

  const disabled =
    await prisma.zone.updateMany({
      where: {
        provider: "AUTOCAB",
        companyId: 1,
        active: true,
        externalId: {
          notIn:
            syncedIds.length > 0
              ? syncedIds
              : ["__none__"],
        },
      },
      data: {
        active: false,
      },
    });

  return {
    received: payload.length,
    eligible: eligible.length,
    created,
    updated,
    disabled: disabled.count,
    failed,
  };
}
