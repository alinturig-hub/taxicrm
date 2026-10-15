import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getAdministrationAccess } from "@/lib/administration-access";
import { prisma } from "@/lib/prisma";
import { parseDraftRequest, publicConnectionSelect, saveConnectionDraft } from "@/lib/integrations/connection-registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function permitted() {
  const session = await getServerSession(authOptions);
  const access = await getAdministrationAccess(session?.user?.email);
  return access && (access.isSuperAdmin || access.permissions.includes("integrations.manage")) ? access : null;
}
const headers = { "Cache-Control": "private, no-store" };
export async function GET() {
  if (!await permitted()) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403, headers });
  try {
    const connections = await prisma.integrationConnection.findMany({ select: publicConnectionSelect, orderBy: { createdAt: "desc" }, take: 50 });
    return NextResponse.json({ connections }, { headers });
  } catch { return NextResponse.json({ error: "CONNECTION_REGISTRY_UNAVAILABLE" }, { status: 503, headers }); }
}
export async function POST(request: Request) {
  const access = await permitted();
  if (!access) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403, headers });
  const text = await request.text();
  if (text.length > 8192) return NextResponse.json({ error: "DRAFT_TOO_LARGE" }, { status: 413, headers });
  let input: unknown;
  try { input = JSON.parse(text); parseDraftRequest(input); }
  catch { return NextResponse.json({ error: "INVALID_DRAFT" }, { status: 400, headers }); }
  try {
    const connection = await saveConnectionDraft(access.user.id, input);
    return NextResponse.json({ connection }, { status: 201, headers });
  } catch (error) {
    if (error instanceof Error && error.message === "Request ID already belongs to another plan.")
      return NextResponse.json({ error: "DRAFT_REQUEST_CONFLICT" }, { status: 409, headers });
    return NextResponse.json({ error: "CONNECTION_REGISTRY_UNAVAILABLE" }, { status: 503, headers });
  }
}
