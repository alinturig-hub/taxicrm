import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getDriverRefusals } from "@/lib/refusals/refusal-map";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ callsign: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { callsign } = await context.params;

  const refusals = await getDriverRefusals(callsign);

  return NextResponse.json({
    callsign,
    count: refusals.length,
    refusals,
  });
}
