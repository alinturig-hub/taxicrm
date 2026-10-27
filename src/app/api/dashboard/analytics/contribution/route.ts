import { reserveContribution, ContributionBusyError } from "@/lib/analytics/contribution/limit";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getAdministrationAccess } from "@/lib/administration-access";
import { parseRange } from "@/lib/analytics/explorer/model";
import { getContribution } from "@/lib/analytics/contribution/query";
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
    !(["bookings.view", "reports.view", "revenue.view", "customers.view"] as const).every((p) =>
      access.permissions.includes(p),
    )
  )
    return NextResponse.json(
      { error: "Booking, customer, report and revenue access are required." },
      { status: 403 },
    );
  let range;
  try {
    range = parseRange(new URL(request.url).searchParams);
    if (range.calendarDays > 31) throw Error("Choose at most 31 London calendar days.");
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Invalid filters." },
      { status: 400 },
    );
  }
  let release: (() => void) | undefined;
  try {
    release = reserveContribution(access.user.id);
    return NextResponse.json(
      await getContribution(range),
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (error instanceof ContributionBusyError) return NextResponse.json({ error: "Report busy. Wait a few seconds and retry." }, { status: 429, headers: { "Cache-Control": "private, no-store" } });
    return NextResponse.json(
      {
        error:
          "This report could not finish. Try a shorter date range or refresh.",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  } finally { release?.(); }
}
