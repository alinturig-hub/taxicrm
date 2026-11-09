import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { ADMINISTRATION_PERMISSIONS, requireAdministrationPermission } from "@/lib/administration-access";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 25;
const statuses = ["CANCELLED", "NO_FARE"];

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const access = await requireAdministrationPermission(session?.user?.email, ADMINISTRATION_PERMISSIONS.CUSTOMERS_VIEW);
  if (!access) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const cursor = new URL(request.url).searchParams.get("cursor");
  if (!params.id || params.id.length > 128 || (cursor !== null && (!cursor || cursor.length > 128))) {
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }
  try {
    const customer = await prisma.normalCustomer.findUnique({ where: { id: params.id }, select: { id: true } });
    if (!customer) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    const where = { normalCustomerId: customer.id, status: { in: statuses } };
    if (cursor) {
      const found = await prisma.booking.findFirst({ where: { ...where, id: cursor }, select: { id: true } });
      if (!found) return NextResponse.json({ error: "INVALID_CURSOR" }, { status: 400 });
    }
    const rows = await prisma.booking.findMany({
      where,
      orderBy: [{ bookedAtTime: { sort: "desc", nulls: "last" } }, { id: "desc" }],
      take: PAGE_SIZE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: { id: true, externalId: true, status: true, bookedAtTime: true, cancelledAt: true, noFareAt: true },
    });
    const page = rows.slice(0, PAGE_SIZE);
    return NextResponse.json({
      items: page.map(row => ({ id: row.id, reference: row.externalId, status: row.status, bookedAt: row.bookedAtTime, eventAt: row.status === "CANCELLED" ? row.cancelledAt : row.noFareAt })),
      nextCursor: rows.length > PAGE_SIZE ? page[page.length - 1].id : null,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "HISTORY_UNAVAILABLE" }, { status: 500 });
  }
}
