import { NextResponse } from "next/server";
import { notificationTick } from "@/lib/notifications/operations";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get("x-cron-secret") !== process.env.CRON_SECRET) return NextResponse.json({success: false}, {status: 401});
  try {return NextResponse.json(await notificationTick());}
  catch (error) {
    const code = error && typeof error === "object" && "code" in error ? error.code : null;
    const meta = error && typeof error === "object" && "meta" in error ? error.meta : null;
    const sqlState = meta && typeof meta === "object" && "code" in meta ? meta.code : null;
    console.error("SMS notification worker failed", {
      code: typeof code === "string" && /^P\d{4}$/.test(code) ? code : null,
      sqlState: typeof sqlState === "string" && /^[0-9A-Z]{5}$/.test(sqlState) ? sqlState : null,
    });
    return NextResponse.json({success: false, error: "NOTIFICATION_WORKER_FAILED"}, {status: 500});
  }
}
