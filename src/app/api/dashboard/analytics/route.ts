import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getAdministrationAccess } from "@/lib/administration-access";
import { parseRange } from "@/lib/analytics/explorer/model";
import { getAnalytics } from "@/lib/analytics/explorer/query";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json(
      { error: "Sign in to view analytics." },
      { status: 401 },
    );
  const access = await getAdministrationAccess(session.user.email);
  if (
    !access ||
    !(["bookings.view", "reports.view", "revenue.view"] as const).every((p) =>
      access.permissions.includes(p),
    )
  )
    return NextResponse.json(
      { error: "Booking, report and revenue access are required." },
      { status: 403 },
    );
  let range;
  try {
    range = parseRange(new URL(request.url).searchParams);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Invalid filters." },
      { status: 400 },
    );
  }
  try {
    return NextResponse.json(
      await getAnalytics(range, access.permissions.includes("drivers.view")),
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json(
      {
        error:
          "This report could not finish. Try a shorter date range or refresh.",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
