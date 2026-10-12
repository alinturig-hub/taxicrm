import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { webhookAccess } from "@/lib/autocab/webhook-access";
export const dynamic = "force-dynamic";
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  if (!(await webhookAccess(true)))
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }
  if (
    !body ||
    typeof body.displayName !== "string" ||
    !body.displayName.trim() ||
    body.displayName.length > 200 ||
    typeof body.isEnabled !== "boolean" ||
    (body.description !== null && typeof body.description !== "string") ||
    (typeof body.description === "string" && body.description.length > 2000)
  )
    return NextResponse.json(
      { error: "INVALID_CONFIGURATION" },
      { status: 400 },
    );
  const result = await prisma.autocabWebhookConfiguration.updateMany({
    where: { id: params.id },
    data: {
      displayName: body.displayName.trim(),
      description: body.description?.trim() || null,
      isEnabled: body.isEnabled,
    },
  });
  return result.count
    ? NextResponse.json({ saved: true })
    : NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
}
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  if (!(await webhookAccess(true)))
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  // Existing onDelete:SetNull preserves received events and their original payloads.
  const result = await prisma.autocabWebhookConfiguration.deleteMany({
    where: { id: params.id },
  });
  return result.count
    ? NextResponse.json({ deleted: true })
    : NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
}
