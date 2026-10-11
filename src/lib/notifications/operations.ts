import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { decryptSecret } from "@/lib/security/encryption";
import { encryptedOrionDraft } from "./local-sms-draft";
import { previewFreephoneWorkflow, freephoneEvents, type FreephoneRule } from "./freephone-workflow-preview";
import { smsGatewayPreview } from "./sms-gateway-preview";

export const sourceFields = ["bookingSource", "bookedBy", "ourReference"] as const;
export type JobInput = {name: string; sourceField: typeof sourceFields[number]; sourceValue: string; defaultRecipient: string; rules: FreephoneRule[]; sourceConfirmed: boolean; isEnabled: boolean};
const day = 86400000;

export function validateJob(value: unknown): JobInput {
  if (!value || typeof value !== "object") throw new Error("Invalid workflow.");
  const d = value as JobInput;
  if (typeof d.name !== "string" || !d.name.trim() || d.name.length > 120 || !sourceFields.includes(d.sourceField) || typeof d.sourceValue !== "string" || !d.sourceValue.trim() || d.sourceValue.length > 200 || typeof d.defaultRecipient !== "string" || !Array.isArray(d.rules) || d.rules.length > 3 || typeof d.sourceConfirmed !== "boolean" || typeof d.isEnabled !== "boolean") throw new Error("Supply a name, explicit Autocab source field and value, recipients and rules.");
  const seen = new Set<string>();
  for (const r of d.rules) {
    if (!r || !freephoneEvents.includes(r.event) || seen.has(r.event) || typeof r.enabled !== "boolean" || typeof r.text !== "string" || r.text.length > 1000 || typeof r.recipient !== "string") throw new Error("Invalid event rule.");
    seen.add(r.event);
  }
  previewFreephoneWorkflow({name: d.name, defaultRecipient: d.defaultRecipient, rules: d.rules}, 0);
  if (d.isEnabled && (!d.sourceConfirmed || !d.rules.some(r => r.enabled))) throw new Error("Confirm the source mapping and enable at least one event before activation.");
  return {...d, name: d.name.trim(), sourceValue: d.sourceValue.trim()};
}

export async function readCounts(job: Pick<JobInput, "sourceField" | "sourceValue">, through: Date, db: Prisma.TransactionClient = prisma) {
  if (!sourceFields.includes(job.sourceField)) throw new Error("Invalid source field.");
  const field = Prisma.raw(`"${job.sourceField}"`); // Only the fixed allowlist above.
  const from = new Date(through.getTime() - day);
  const rows = await db.$queryRaw<{count: bigint; known: bigint; missingDate: bigint; missingSource: bigint}[]>(Prisma.sql`
    SELECT count(*) FILTER (WHERE ${field} = ${job.sourceValue} AND "bookedAtTime" > ${from} AND "bookedAtTime" <= ${through}) AS count,
      count(*) FILTER (WHERE ${field} = ${job.sourceValue}) AS known,
      count(*) FILTER (WHERE ${field} = ${job.sourceValue} AND "bookedAtTime" IS NULL) AS "missingDate",
      count(*) FILTER (WHERE (${field} IS NULL OR btrim(${field}) = '') AND "bookedAtTime" > ${from} AND "bookedAtTime" <= ${through}) AS "missingSource"
    FROM "Booking" WHERE provider = 'AUTOCAB'`);
  const r = rows[0];
  return {count: Number(r.count), known: Number(r.known), missingDate: Number(r.missingDate), missingSource: Number(r.missingSource), from: from.toISOString(), through: through.toISOString()};
}

export function planEvents(job: JobInput, counts: Awaited<ReturnType<typeof readCounts>>) {
  const complete = counts.known > 0 && counts.missingDate === 0 && counts.missingSource === 0;
  return previewFreephoneWorkflow({name: job.name, defaultRecipient: job.defaultRecipient, rules: job.rules}, counts.count)
    .filter(e => e.triggered && (complete || e.event === "DAILY_REPORT"))
    .map(e => ({...e, text: complete ? e.text : `${e.text}\nData incomplete: missing source/date or source not observed; counts may be understated.`}));
}

export async function saveGateway(value: Record<string, unknown>) {
  if (typeof value.endpoint !== "string" || typeof value.isEnabled !== "boolean") throw new Error("Invalid gateway settings.");
  const existing = await prisma.smsGatewayConfiguration.findUnique({where: {id: "default"}});
  const url = new URL(value.endpoint);
  let secret: string;
  if (url.search) secret = encryptedOrionDraft(value.endpoint).signedParametersEncrypted;
  else {
    if (value.endpoint !== "https://orionconnect.co.uk/api/endpoint/webhook" || existing?.endpoint !== value.endpoint) throw new Error("Paste the complete signed Orion URL before saving.");
    secret = existing.signedParametersEncrypted;
  }
  const config = {endpoint: "https://orionconnect.co.uk/api/endpoint/webhook", phoneParameter: String(value.phoneParameter ?? "customer_phone"), messageParameter: String(value.messageParameter ?? "message"), senderParameter: String(value.senderParameter ?? "sender"), sender: String(value.sender ?? "TaxiCRM")};
  smsGatewayPreview(config, "+447700900000", "Validation only");
  await prisma.smsGatewayConfiguration.upsert({where: {id: "default"}, create: {...config, signedParametersEncrypted: secret, isEnabled: value.isEnabled}, update: {...config, signedParametersEncrypted: secret, isEnabled: value.isEnabled}});
}

export async function publicGateway() {
  const d = await prisma.smsGatewayConfiguration.findUnique({where: {id: "default"}});
  if (!d) return null;
  return {endpoint: d.endpoint, phoneParameter: d.phoneParameter, messageParameter: d.messageParameter, senderParameter: d.senderParameter, sender: d.sender, isEnabled: d.isEnabled, signedParametersSaved: Boolean(d.signedParametersEncrypted)};
}

export type SendOutcome = {status: "ACCEPTED" | "FAILED" | "RETRY" | "UNCERTAIN"; error: string | null; delaySeconds?: number};
export async function sendOrion(gateway: NonNullable<Awaited<ReturnType<typeof prisma.smsGatewayConfiguration.findUnique>>>, destination: string, message: string, transport: typeof fetch = fetch): Promise<SendOutcome> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const query = decryptSecret(gateway.signedParametersEncrypted);
    // Validates the decrypted URL and exact provider origin; never logs it.
    const signed = gateway.endpoint + query;
    encryptedOrionDraft(signed);
    const preview = smsGatewayPreview(gateway, destination, message);
    const response = await transport(signed, {method: "POST", headers: {"content-type": "application/json"}, body: JSON.stringify(preview.body), redirect: "error", signal: controller.signal});
    if (response.status === 429) return {status: "RETRY", error: "Provider rate limited", delaySeconds: Math.min(3600, Math.max(60, Number(response.headers.get("retry-after")) || 60))};
    if (response.status >= 500) return {status: "UNCERTAIN", error: `Provider HTTP ${response.status}; acceptance unknown`};
    if (!response.ok) return {status: "FAILED", error: `Provider rejected request: HTTP ${response.status}`};
    const reader = response.body?.getReader();
    let bytes = 0, text = "";
    if (reader) {
      const decoder = new TextDecoder();
      for (;;) {
        const part = await reader.read();
        if (part.done) break;
        bytes += part.value.byteLength;
        if (bytes > 16384) {await reader.cancel(); return {status: "UNCERTAIN", error: "Provider acknowledgement too large"};}
        text += decoder.decode(part.value, {stream: true});
      }
    }
    let body: {success?: boolean; error?: unknown} = {};
    try {body = JSON.parse(text);} catch { /* Some gateways acknowledge with plain text or an empty body. */ }
    if (body?.success === false || body?.error) return {status: "FAILED", error: "Provider declined request"};
    return {status: "ACCEPTED", error: null}; // Provider accepted, not proof of handset delivery.
  } catch {return {status: "UNCERTAIN", error: "Provider connection interrupted; acceptance unknown"};}
  finally {clearTimeout(timer);}
}

export async function notificationTick(now = new Date(), transport: typeof fetch = fetch) {
  const gateway = await prisma.smsGatewayConfiguration.findUnique({where: {id: "default"}});
  if (!gateway?.isEnabled) return {success: true, planned: 0, processed: 0, disabled: true};
  let planned = 0, processed = 0;
  for (let i = 0; i < 5; i++) {
    const didPlan = await prisma.$transaction(async tx => {
      await tx.$executeRaw`SET LOCAL statement_timeout = '10s'`;
      const jobs = await tx.$queryRaw<{id: string}[]>`SELECT id FROM "NotificationJob" WHERE "isEnabled" = true AND "nextRunAt" <= ${now} ORDER BY "nextRunAt" LIMIT 1 FOR UPDATE SKIP LOCKED`;
      if (!jobs.length) return false;
      const job = await tx.notificationJob.findUniqueOrThrow({where: {id: jobs[0].id}});
      const config = validateJob({...job, rules: job.rules});
      const nextRunAt = new Date(job.nextRunAt.getTime() + (Math.floor((now.getTime() - job.nextRunAt.getTime()) / day) + 1) * day);
      const counts = await readCounts(config, now, tx);
      const events = planEvents(config, counts);
      const run = await tx.notificationJobRun.create({data: {jobId: job.id, scheduledFor: job.nextRunAt, status: "COMPLETED", result: {...counts, planned: events.length}, finishedAt: now}});
      for (const event of events) await tx.notificationDelivery.create({data: {jobRunId: run.id, eventType: event.event, destination: event.recipient, message: event.text, nextAttemptAt: now}});
      await tx.notificationJob.update({where: {id: job.id}, data: {nextRunAt}});
      return true;
    }, {timeout: 15000});
    if (!didPlan) break;
    planned++;
  }
  // A crashed sender may have handed the request to Orion. Never blindly resend it.
  await prisma.notificationDelivery.updateMany({where: {status: "SENDING", leaseUntil: {lte: now}}, data: {status: "UNCERTAIN", lastError: "Sending lease expired; provider acceptance unknown", leaseUntil: null}});
  for (let i = 0; i < 10; i++) {
    const delivery = await prisma.$transaction(async tx => {
      const rows = await tx.$queryRaw<{id: string}[]>`SELECT d.id FROM "NotificationDelivery" d JOIN "NotificationJobRun" r ON r.id=d."jobRunId" JOIN "NotificationJob" j ON j.id=r."jobId" WHERE d.status IN ('PENDING','RETRY') AND d."nextAttemptAt" <= ${now} AND (j."isEnabled"=true OR d."eventType"='GATEWAY_TEST') ORDER BY d."nextAttemptAt" LIMIT 1 FOR UPDATE OF d SKIP LOCKED`;
      if (!rows.length) return null;
      return tx.notificationDelivery.update({where: {id: rows[0].id}, data: {status: "SENDING", attemptCount: {increment: 1}, leaseUntil: new Date(Math.max(now.getTime(), Date.now()) + 60000)}});
    });
    if (!delivery) break;
    const enabled = await prisma.smsGatewayConfiguration.findUnique({where: {id: "default"}});
    if (!enabled?.isEnabled) {
      await prisma.notificationDelivery.update({where: {id: delivery.id}, data: {status: "PENDING", leaseUntil: null, attemptCount: {decrement: 1}}});
      break;
    }
    const outcome = await sendOrion(enabled, delivery.destination, delivery.message, transport);
    const status = outcome.status === "RETRY" && delivery.attemptCount >= 5 ? "FAILED" : outcome.status;
    await prisma.notificationDelivery.update({where: {id: delivery.id}, data: {status, lastError: outcome.error, leaseUntil: null, nextAttemptAt: new Date(now.getTime() + (outcome.delaySeconds ?? 60) * 1000), sentAt: status === "ACCEPTED" ? new Date() : null}});
    processed++;
  }
  return {success: true, planned, processed, disabled: false};
}
