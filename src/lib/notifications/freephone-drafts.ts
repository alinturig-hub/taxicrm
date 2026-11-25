import { prisma } from "@/lib/prisma";
import { normaliseFreephoneNumber } from "./phone-audit";
import { parseFreephoneCsv } from "./freephone-csv";

function configuredPhone(sourceValue: string) {
  try { return normaliseFreephoneNumber(sourceValue); } catch { return ""; }
}

export async function previewFreephoneCsv(csv: string) {
  const entries = parseFreephoneCsv(csv);
  const existing = await prisma.notificationJob.findMany({
    where: { sourceField: "telephoneNumber" },
    select: { sourceValue: true },
  });
  const known = new Set(existing.map(({ sourceValue }) => configuredPhone(sourceValue)));
  const seen = new Set<string>();
  return entries.map(({ name, phone, malformed }) => {
    try {
      if (malformed) throw new Error("Use two columns.");
      const [entry] = validateFreephoneEntries([{ name, phone }]);
      const status = known.has(entry.phone) || seen.has(entry.phone) ? "Duplicate" : "Ready";
      seen.add(entry.phone);
      return { ...entry, status };
    } catch {
      return { name, phone, status: "Invalid location or number" };
    }
  });
}

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
        },
        select: {
          sourceValue: true,
          isEnabled: true,
          sourceConfirmed: true,
          defaultRecipient: true,
        },
      });
      const requested = new Set(entries.map(({ phone }) => phone));
      const preserved = existing.filter(({ sourceValue }) => requested.has(configuredPhone(sourceValue)));
      const known = new Set(preserved.map(({ sourceValue }) => configuredPhone(sourceValue)));
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
        preserved: preserved.map((job) => ({
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
