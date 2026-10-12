import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { requireAdministrationPermission } from "@/lib/administration-access";
import {
  enabledIntegrationCounts,
  disableExistingIntegrations,
} from "@/lib/integrations/disable-configurations";
export const dynamic = "force-dynamic";
export async function GET() {
  const session = await getServerSession(authOptions);
  if (
    !(await requireAdministrationPermission(
      session?.user?.email,
      "configuration.view",
    ))
  )
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  return NextResponse.json(await enabledIntegrationCounts(), {
    headers: { "cache-control": "no-store" },
  });
}
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const access = await requireAdministrationPermission(
    session?.user?.email,
    "configuration.manage",
  );
  if (!access)
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  try {
    const body = await request.json();
    if (body?.confirmation !== "DISABLE_EXISTING_CONFIGURATIONS")
      return NextResponse.json(
        { error: "CONFIRMATION_REQUIRED" },
        { status: 400 },
      );
    return NextResponse.json({
      disabled: await disableExistingIntegrations(access.user.id),
    });
  } catch {
    return NextResponse.json(
      {
        error: "DISABLE_FAILED",
        message: "Configurations could not be disabled.",
      },
      { status: 500 },
    );
  }
}
