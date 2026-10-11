import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncCustomerBehaviourTags } from "@/lib/customers/sync-customer-behaviour-tags";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({success: false, error: "UNAUTHORIZED"}, {status: 401});
  const user = await prisma.user.findUnique({where: {email: session.user.email}, select: {role: true, isActive: true}});
  if (!user?.isActive || !["ADMIN", "MANAGER"].includes(user.role)) return NextResponse.json({success: false, error: "FORBIDDEN"}, {status: 403});
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body) ||
    (body.dryRun !== undefined && typeof body.dryRun !== "boolean") ||
    (body.afterId !== undefined && (typeof body.afterId !== "string" || !body.afterId.trim())) ||
    (body.now !== undefined && (typeof body.now !== "string" || !/(Z|[+-]\d{2}:\d{2})$/.test(body.now) || !Number.isFinite(Date.parse(body.now)))) ||
    (body.limit !== undefined && (!Number.isInteger(body.limit) || body.limit < 1 || body.limit > 200))) {
    return NextResponse.json({success: false, error: "INVALID_BATCH_OPTIONS"}, {status: 400});
  }
  try {
    const result = await syncCustomerBehaviourTags({scope: "all", customerLimit: body.limit ?? 50,
      afterId: body.afterId, now: body.now ? new Date(body.now) : undefined, dryRun: body.dryRun !== false});
    return NextResponse.json({success: result.failedCustomers === 0, ...result});
  } catch (error) {
    console.error("Customer tag recalculation batch failed", error);
    return NextResponse.json({success: false, error: "TAG_BATCH_FAILED"}, {status: 500});
  }
}
