import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runBookingPostCommitEffects } from "@/lib/autocab/process-booking-webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ClaimedEffect = {
  webhookEventId: string;
  attemptCount: number;
  leaseUntil: Date;
};

function authorised(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  const supplied = request.headers.get("x-cron-secret");
  if (!expected || !supplied) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(supplied);
  return a.length === b.length && timingSafeEqual(a, b);
}

function unavailable(error: unknown) {
  console.error("CRM post-commit worker failed:", error);
  return NextResponse.json({ error: "CRM_EFFECTS_UNAVAILABLE" }, { status: 503 });
}

export async function GET(request: NextRequest) {
  if (!authorised(request)) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  try {
    const [access] = await prisma.$queryRaw<Array<{ canRead: boolean; canUpdate: boolean }>>`
      SELECT has_table_privilege(current_user, 'public."BookingPostCommitEffect"', 'SELECT') AS "canRead",
        has_table_privilege(current_user, 'public."BookingPostCommitEffect"', 'UPDATE') AS "canUpdate"
    `;
    if (!access?.canRead) {
      return NextResponse.json({ enabled: process.env.CRM_POST_COMMIT_WORKER_ENABLED === "true", access, queue: null });
    }
    const [queue] = await prisma.$queryRaw<Array<{ pending: bigint; processing: bigint; done: bigint; due: bigint; oldestDueAt: Date | null }>>`
      SELECT count(*) FILTER (WHERE status='PENDING') AS pending,
        count(*) FILTER (WHERE status='PROCESSING') AS processing,
        count(*) FILTER (WHERE status='DONE') AS done,
        count(*) FILTER (WHERE status='PENDING' AND "nextAttemptAt"<=now()) AS due,
        min("nextAttemptAt") FILTER (WHERE status='PENDING' AND "nextAttemptAt"<=now()) AS "oldestDueAt"
      FROM public."BookingPostCommitEffect"
    `;
    return NextResponse.json({
      enabled: process.env.CRM_POST_COMMIT_WORKER_ENABLED === "true",
      access,
      queue: queue && {
        pending: Number(queue.pending), processing: Number(queue.processing),
        done: Number(queue.done), due: Number(queue.due), oldestDueAt: queue.oldestDueAt,
      },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return unavailable(error);
  }
}

export async function POST(request: NextRequest) {
  if (!authorised(request)) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (process.env.CRM_POST_COMMIT_WORKER_ENABLED !== "true") {
    return NextResponse.json({ enabled: false, claimed: 0, completed: 0, failed: 0 });
  }
  try {
    const claimed = await prisma.$queryRaw<ClaimedEffect[]>`
      UPDATE public."BookingPostCommitEffect" effect
      SET status='PROCESSING', "attemptCount"=effect."attemptCount"+1,
        "leaseUntil"=now()+interval '10 minutes', "updatedAt"=now()
      WHERE effect."webhookEventId" IN (
        SELECT "webhookEventId" FROM public."BookingPostCommitEffect"
        WHERE (status='PENDING' AND "nextAttemptAt"<=now())
          OR (status='PROCESSING' AND "leaseUntil"<now())
        ORDER BY "nextAttemptAt", "createdAt"
        LIMIT 5 FOR UPDATE SKIP LOCKED
      )
      RETURNING effect."webhookEventId", effect."attemptCount", effect."leaseUntil"
    `;
    let completed = 0;
    let failed = 0;
    for (const effect of claimed) {
      try {
        await runBookingPostCommitEffects(effect.webhookEventId);
        const updated = await prisma.$executeRaw`
          UPDATE public."BookingPostCommitEffect"
          SET status='DONE', "leaseUntil"=NULL, "processedAt"=now(),
            "lastError"=NULL, "updatedAt"=now()
          WHERE "webhookEventId"=${effect.webhookEventId}
            AND status='PROCESSING' AND "leaseUntil"=${effect.leaseUntil}
        `;
        if (updated !== 1) throw new Error("CRM effect lease changed before completion.");
        completed++;
      } catch (error) {
        const delayMinutes = Math.min(60, 2 ** Math.min(effect.attemptCount, 6));
        const message = error instanceof Error ? error.message : "Unknown CRM effect error";
        const updated = await prisma.$executeRaw`
          UPDATE public."BookingPostCommitEffect"
          SET status='PENDING', "leaseUntil"=NULL,
            "nextAttemptAt"=now()+(${delayMinutes} * interval '1 minute'),
            "lastError"=${message.slice(0, 500)}, "updatedAt"=now()
          WHERE "webhookEventId"=${effect.webhookEventId}
            AND status='PROCESSING' AND "leaseUntil"=${effect.leaseUntil}
        `;
        if (updated === 1) failed++;
        console.error(`CRM post-commit effect failed for ${effect.webhookEventId}:`, error);
      }
    }
    return NextResponse.json({ enabled: true, claimed: claimed.length, completed, failed },
      { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return unavailable(error);
  }
}
