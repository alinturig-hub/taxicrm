import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { importFreephoneDrafts } from "@/lib/notifications/freephone-drafts";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const expected = Buffer.from(process.env.CRON_SECRET ?? "");
  const received = Buffer.from(request.headers.get("x-cron-secret") ?? "");
  if (
    !expected.length ||
    expected.length !== received.length ||
    !timingSafeEqual(expected, received)
  )
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  try {
    return NextResponse.json(
      await importFreephoneDrafts((await request.json()).entries),
    );
  } catch {
    return NextResponse.json(
      { error: "FREEPHONE_SETUP_FAILED" },
      { status: 400 },
    );
  }
}
