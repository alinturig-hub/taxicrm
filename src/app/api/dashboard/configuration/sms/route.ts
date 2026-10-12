import { getServerSession } from "next-auth";
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  publicGateway,
  saveGateway,
  validateJob,
  readCounts,
  planEvents,
  inactivityHours,
} from "@/lib/notifications/operations";
import { smsGatewayPreview } from "@/lib/notifications/sms-gateway-preview";
import { bookingEvidenceReadiness } from "@/lib/notifications/readiness";
import { importFreephoneDrafts } from "@/lib/notifications/freephone-drafts";
import { auditFreephoneNumbers } from "@/lib/notifications/phone-audit";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function allowed() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return false;
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { role: true, isActive: true },
  });
  return user?.isActive && ["ADMIN", "MANAGER"].includes(user.role);
}
export async function GET() {
  if (!(await allowed()))
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const [gateway, jobs, runs] = await Promise.all([
    publicGateway(),
    prisma.notificationJob.findMany({
      where: { id: { not: "$gateway-test" } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.notificationJobRun.findMany({
      orderBy: { startedAt: "desc" },
      take: 30,
      include: {
        job: { select: { name: true } },
        deliveries: {
          select: {
            id: true,
            eventType: true,
            destination: true,
            message: true,
            status: true,
            attemptCount: true,
            lastError: true,
          },
        },
      },
    }),
  ]);
  return NextResponse.json({ gateway, jobs, runs });
}
export async function PUT(request: Request) {
  if (!(await allowed()))
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  try {
    await saveGateway(await request.json());
    return NextResponse.json({ success: true, gateway: await publicGateway() });
  } catch {
    return NextResponse.json(
      {
        error:
          "Invalid gateway settings. Supply the signed Orion URL on first save and valid sender/parameter names.",
      },
      { status: 400 },
    );
  }
}
export async function POST(request: Request) {
  if (!(await allowed()))
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  try {
    const body = await request.json();
    if (body.action === "import")
      return NextResponse.json(await importFreephoneDrafts(body.entries));
    if (body.action === "lookup")
      return NextResponse.json(await auditFreephoneNumbers(body.phones));
    if (body.action === "test") {
      if (!/^[a-f0-9-]{36}$/i.test(body.requestId ?? ""))
        throw new Error("Invalid test request ID.");
      const gateway = await prisma.smsGatewayConfiguration.findUnique({
        where: { id: "default" },
      });
      if (!gateway?.isEnabled)
        throw new Error(
          "Save and enable the gateway before sending a real test.",
        );
      if (
        typeof body.message !== "string" ||
        body.message.length > 1000 ||
        typeof body.destination !== "string"
      )
        throw new Error("Supply a destination and a test message.");
      const preview = smsGatewayPreview(
        gateway,
        body.destination,
        body.message,
      );
      const destination = String(preview.body[gateway.phoneParameter]);
      const requestHash = createHash("sha256")
        .update(JSON.stringify([destination, body.message]))
        .digest("hex");
      await prisma.$transaction(async (tx) => {
        const job = await tx.notificationJob.upsert({
          where: { id: "$gateway-test" },
          update: {},
          create: {
            id: "$gateway-test",
            name: "Manual gateway tests",
            sourceField: "bookingSource",
            sourceValue: "$gateway-test",
            defaultRecipient: "",
            rules: [],
            nextRunAt: new Date("2999-01-01T00:00:00Z"),
          },
        });
        await tx.$queryRaw`SELECT id FROM "NotificationJob" WHERE id = ${job.id} FOR UPDATE`;
        const existing = await tx.notificationJobRun.findUnique({
          where: { id: `test-${body.requestId}` },
        });
        if (
          existing &&
          (existing.result as { requestHash?: string } | null)?.requestHash !==
            requestHash
        )
          throw new Error(
            "Invalid test request ID reuse; use a new request for changed recipient/message.",
          );
        const latest = await tx.notificationJobRun.findFirst({
          where: { jobId: job.id },
          orderBy: { scheduledFor: "desc" },
          select: { scheduledFor: true },
        });
        const scheduledFor = new Date(
          Math.max(Date.now(), (latest?.scheduledFor.getTime() ?? 0) + 1),
        );
        const run =
          existing ??
          (await tx.notificationJobRun.create({
            data: {
              id: `test-${body.requestId}`,
              jobId: job.id,
              scheduledFor,
              status: "COMPLETED",
              result: { manualTest: true, requestHash },
              finishedAt: new Date(),
            },
          }));
        await tx.notificationDelivery.upsert({
          where: {
            jobRunId_eventType_destination: {
              jobRunId: run.id,
              eventType: "GATEWAY_TEST",
              destination,
            },
          },
          update: {},
          create: {
            jobRunId: run.id,
            eventType: "GATEWAY_TEST",
            destination,
            message: body.message,
          },
        });
      });
      return NextResponse.json({ success: true, queued: true });
    }
    const config = validateJob(body.workflow);
    if (body.action === "preview") {
      const counts = await readCounts(config, new Date());
      const previewHours =
        config.rules.find((r) => r.event === "NO_BOOKINGS")?.windowHours ?? 24;
      const inactivityCounts =
        previewHours === 24
          ? counts
          : await readCounts(config, new Date(), prisma, previewHours);
      return NextResponse.json({
        counts,
        inactivityCounts,
        readiness: bookingEvidenceReadiness(inactivityCounts),
        events: planEvents(config, counts, inactivityCounts),
      });
    }
    if (body.action !== "save") throw new Error("Unknown action.");
    if (config.isEnabled) {
      const counts = await readCounts(
        config,
        new Date(),
        prisma,
        inactivityHours(config),
      );
      if (
        config.rules.some((r) => r.event === "NO_BOOKINGS" && r.enabled) &&
        !bookingEvidenceReadiness(counts).ready
      )
        throw new Error(
          "Supply complete, non-future booking dates and source evidence before enabling inactivity alerts. Use Preview current count to inspect the blockers.",
        );
      if (!counts.known)
        throw new Error(
          "This source value has not been observed. Verify the Autocab field and value before enabling.",
        );
    }
    const data = { ...config, rules: JSON.parse(JSON.stringify(config.rules)) };
    const existing =
      typeof body.id === "string" && body.id !== "$gateway-test"
        ? await prisma.notificationJob.findUniqueOrThrow({
            where: { id: body.id },
          })
        : null;
    const resetSchedule =
      existing &&
      ((!existing.isEnabled && config.isEnabled) ||
        existing.sourceField !== config.sourceField ||
        existing.sourceValue !== config.sourceValue ||
        inactivityHours({
          ...existing,
          rules: existing.rules as typeof config.rules,
        }) !== inactivityHours(config));
    const job =
      typeof body.id === "string" && body.id !== "$gateway-test"
        ? await prisma.notificationJob.update({
            where: { id: body.id },
            data: {
              ...data,
              ...(resetSchedule
                ? {
                    nextRunAt: new Date(
                      Date.now() + inactivityHours(config) * 3600000,
                    ),
                  }
                : {}),
            },
          })
        : await prisma.notificationJob.create({
            data: {
              ...data,
              nextRunAt: new Date(
                Date.now() + inactivityHours(config) * 3600000,
              ),
            },
          });
    if (!job.isEnabled)
      await prisma.notificationDelivery.updateMany({
        where: {
          jobRun: { jobId: job.id },
          status: { in: ["PENDING", "RETRY"] },
        },
        data: {
          status: "CANCELLED",
          lastError: "Workflow disabled by administrator",
        },
      });
    return NextResponse.json({ success: true, id: job.id });
  } catch (error) {
    const message =
      error instanceof Error &&
      [
        "Supply",
        "Confirm",
        "This source",
        "Unknown action",
        "Invalid",
        "Save and",
        "Message",
        "Use",
        "Set a positive",
        "SMS text",
        "The threshold",
      ].some((prefix) => error.message.startsWith(prefix))
        ? error.message
        : "Notification configuration could not be saved.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
