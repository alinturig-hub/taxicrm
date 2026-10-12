import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { webhookAccess } from "@/lib/autocab/webhook-access";
import { providerInput, publicProvider } from "@/lib/autocab/webhook-providers";
export const dynamic = "force-dynamic";
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  if (!(await webhookAccess(true)))
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const existing = await prisma.webhookProvider.findUnique({
    where: { id: params.id },
  });
  if (!existing)
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  try {
    return NextResponse.json(
      publicProvider(
        await prisma.webhookProvider.update({
          where: { id: params.id },
          data: providerInput(
            await request.json(),
            Boolean(existing.apiKeyEncrypted || existing.id === "autocab"),
          ),
        }),
      ),
    );
  } catch {
    return NextResponse.json(
      {
        error: "INVALID_PROVIDER",
        message:
          "Check provider settings. Blank key preserves the current key.",
      },
      { status: 400 },
    );
  }
}
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  if (!(await webhookAccess(true)))
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  if (params.id === "autocab")
    return NextResponse.json(
      { error: "DEFAULT_PROVIDER_PROTECTED" },
      { status: 409 },
    );
  try {
    const result = await prisma.webhookProvider.deleteMany({
      where: { id: params.id },
    });
    return NextResponse.json({ deleted: Boolean(result.count) });
  } catch {
    return NextResponse.json(
      {
        error: "PROVIDER_HAS_EVENTS",
        message:
          "Remove its event URL configurations first. Received events remain preserved.",
      },
      { status: 409 },
    );
  }
}
