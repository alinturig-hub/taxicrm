import { NextResponse } from "next/server";
import { notificationTick } from "@/lib/notifications/operations";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get("x-cron-secret") !== process.env.CRON_SECRET) return NextResponse.json({success: false}, {status: 401});
  try {return NextResponse.json(await notificationTick());}
  catch {return NextResponse.json({success: false, error: "NOTIFICATION_WORKER_FAILED"}, {status: 500});}
}
