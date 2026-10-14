import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { runBookingPostCommitEffects } from "@/lib/autocab/process-booking-webhook";

export const runtime = "nodejs";

function authorised(request: NextRequest): boolean {
  const expected = process.env.BOOKING_EFFECTS_SHARED_SECRET;
  const provided = request.headers.get("x-booking-effects-secret");
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  if (!authorised(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }
  const id =
    body && typeof body === "object" && "webhookEventId" in body
      ? (body as Record<string, unknown>).webhookEventId
      : null;
  if (typeof id !== "string" || !/^[a-z0-9_-]{10,128}$/i.test(id)) {
    return NextResponse.json({ error: "INVALID_EVENT_ID" }, { status: 400 });
  }
  try {
    await runBookingPostCommitEffects(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`Booking post-commit effects failed for ${id}:`, error);
    return NextResponse.json({ error: "EFFECTS_FAILED" }, { status: 503 });
  }
}
