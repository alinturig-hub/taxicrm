import {NextResponse} from "next/server";
import {auditFreephoneNumbers} from "@/lib/notifications/phone-audit";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get("x-cron-secret") !== process.env.CRON_SECRET) return NextResponse.json({error: "UNAUTHORIZED"}, {status: 401});
  try {return NextResponse.json(await auditFreephoneNumbers((await request.json()).phones));}
  catch {return NextResponse.json({error: "FREEPHONE_AUDIT_FAILED"}, {status: 400});}
}
