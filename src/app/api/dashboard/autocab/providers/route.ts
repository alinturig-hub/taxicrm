import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { webhookAccess } from "@/lib/autocab/webhook-access";
import { providerInput, publicProvider } from "@/lib/autocab/webhook-providers";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  if (!(await webhookAccess(true)))
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  try {
    return NextResponse.json(
      publicProvider(
        await prisma.webhookProvider.create({
          data: providerInput(await request.json()),
        }),
      ),
      { status: 201 },
    );
  } catch {
    return NextResponse.json(
      {
        error: "INVALID_PROVIDER",
        message:
          "Check the HTTPS URL, header, name and key (16–512 characters).",
      },
      { status: 400 },
    );
  }
}

export async function GET() {
  if (!(await webhookAccess(false)))
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  return NextResponse.json(
    (
      await prisma.webhookProvider.findMany({ orderBy: { createdAt: "asc" } })
    ).map(publicProvider),
  );
}
