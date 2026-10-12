import { prisma } from "@/lib/prisma";
import { normaliseFreephoneNumber } from "./phone-audit";
export function validateFreephoneEntries(value: unknown) {
  if (!Array.isArray(value) || !value.length || value.length > 25)
    throw new Error("Supply 1 to 25 freephone lines.");
  const phones = new Set<string>();
  return value.map((entry) => {
    if (
      !entry ||
      typeof entry.name !== "string" ||
      !entry.name.trim() ||
      entry.name.length > 120 ||
      typeof entry.phone !== "string"
    )
      throw new Error(
        "Supply a name and valid UK line number for each freephone.",
      );
    const phone = normaliseFreephoneNumber(entry.phone);
    if (phones.has(phone)) throw new Error("Supply each freephone line once.");
    phones.add(phone);
    return { name: entry.name.trim(), phone };
  });
}
/** Provision disabled drafts only. Existing workflows, recipients and activation are never overwritten. */
export async function importFreephoneDrafts(value: unknown) {
  const entries = validateFreephoneEntries(value);
  return prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended('freephone-draft-import',0))::text`;
      const existing = await tx.notificationJob.findMany({
        where: {
          sourceField: "telephoneNumber",
          sourceValue: { in: entries.map((e) => e.phone) },
        },
        select: {
          sourceValue: true,
          isEnabled: true,
          sourceConfirmed: true,
          defaultRecipient: true,
        },
      });
      const known = new Set(existing.map((e) => e.sourceValue));
      const created: string[] = [];
      const skipped: string[] = [];
      for (const entry of entries) {
        if (known.has(entry.phone)) {
          skipped.push(entry.phone);
          continue;
        }
        await tx.notificationJob.create({
          data: {
            name: entry.name,
            sourceField: "telephoneNumber",
            sourceValue: entry.phone,
            defaultRecipient: "",
            sourceConfirmed: false,
            isEnabled: false,
            nextRunAt: new Date(Date.now() + 12 * 3600000),
            rules: [
              {
                event: "NO_BOOKINGS",
                enabled: false,
                windowHours: 12,
                recipient: "",
                text: "Possible freephone issue: {freephone} has generated no bookings in {period}. Please check the line and booking feed.",
              },
            ],
          },
        });
        created.push(entry.phone);
      }
      return {
        created,
        skipped,
        createdDisabled: true,
        preserved: existing.map((job) => ({
          phone: job.sourceValue,
          isEnabled: job.isEnabled,
          sourceConfirmed: job.sourceConfirmed,
          recipientConfigured: Boolean(job.defaultRecipient),
        })),
      };
    },
    { timeout: 15000 },
  );
}
