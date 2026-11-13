import { NextRequest, NextResponse } from "next/server";
import { runOsmOfflineBatch } from "@/lib/places/osm-offline-batch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!process.env.CRON_SECRET || request.headers.get("x-cron-secret") !== process.env.CRON_SECRET) {
    return NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 401 });
  }
  try {
    const result = await runOsmOfflineBatch();
    return NextResponse.json({ success: true, ...result });
  } catch {
    console.error("Offline OSM place classification unavailable.");
    return NextResponse.json({ success: false, error: "OSM_CLASSIFICATION_UNAVAILABLE" }, { status: 503 });
  }
}
