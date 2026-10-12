import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import {
  backfillOriginalFares,
  backfillCachedPlaces,
} from "@/lib/revenue/fare-backfill";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const expected = process.env.CRON_SECRET;
  const supplied = request.headers.get("x-cron-secret");
  if (
    !expected ||
    !supplied ||
    Buffer.byteLength(expected) !== Buffer.byteLength(supplied) ||
    !timingSafeEqual(Buffer.from(expected), Buffer.from(supplied))
  ) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  if (
    !body ||
    Array.isArray(body) ||
    typeof body !== "object" ||
    (body.action !== undefined &&
      !["fare", "places-cache"].includes(body.action)) ||
    (body.limit !== undefined &&
      (!Number.isInteger(body.limit) || body.limit < 1 || body.limit > 1000)) ||
    (body.afterId !== undefined &&
      (typeof body.afterId !== "string" || !body.afterId.trim())) ||
    (body.dryRun !== undefined && typeof body.dryRun !== "boolean")
  ) {
    return NextResponse.json(
      { error: "INVALID_BATCH_OPTIONS" },
      { status: 400 },
    );
  }
  try {
    return NextResponse.json({
      success: true,
      ...(await (
        body.action === "places-cache"
          ? backfillCachedPlaces
          : backfillOriginalFares
      )({
        limit: body.limit ?? 200,
        afterId: body.afterId,
        dryRun: body.dryRun !== false,
      })),
    });
  } catch (error) {
    console.error("Original fare backfill failed", error);
    return NextResponse.json(
      { error: "FARE_BACKFILL_FAILED" },
      { status: 500 },
    );
  }
}
