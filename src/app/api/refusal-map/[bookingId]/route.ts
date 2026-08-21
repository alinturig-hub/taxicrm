import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getRefusalDetail } from "@/lib/refusals/refusal-map";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ bookingId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { bookingId } = await context.params;

  const detail = await getRefusalDetail(bookingId);

  if (!detail) {
    return NextResponse.json(
      { error: "Booking not found" },
      { status: 404 },
    );
  }

  return NextResponse.json(detail);
}
