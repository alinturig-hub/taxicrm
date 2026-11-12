import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { requireAdministrationPermission } from "@/lib/administration-access";
import { sessionDurationSeconds } from "@/lib/drivers/session-duration";
import { prisma } from "@/lib/prisma";
import { addLondonDays, startOfLondonDay } from "@/lib/time/london-calendar";
export const dynamic = "force-dynamic";
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const access = await requireAdministrationPermission((await getServerSession(authOptions))?.user?.email, "drivers.view");
  if (!access) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const input = new URL(request.url).searchParams.get("date");
  const now = new Date(); let day = now;
  if (input) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) return NextResponse.json({ error: "Invalid date" }, { status: 400 });
    day = new Date(`${input}T12:00:00Z`);
    if (!Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10) !== input) return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }
  const from = startOfLondonDay(day), to = addLondonDays(from, 1);
  try {
    const driver = await prisma.driver.findUnique({ where: { id: params.id }, select: { id: true } });
    if (!driver) return NextResponse.json({ error: "Driver not found" }, { status: 404 });
    const sessions = from.getTime() >= now.getTime() ? [] : await prisma.driverShift.findMany({ where: { driverId: driver.id, startedAt: { lt: new Date(Math.min(to.getTime(), now.getTime())) }, OR: [{ endedAt: null }, { endedAt: { gt: from } }] }, orderBy: { startedAt: "asc" }, take: 200, select: { id: true, startedAt: true, endedAt: true } });
    return NextResponse.json({ from, to, sessions, recordedSeconds: sessions.length === 200 || sessions.some(s => !s.endedAt) ? null : sessionDurationSeconds(sessions, from, to, now), hasOpenSession: sessions.some(s => !s.endedAt), truncated: sessions.length === 200 }, { headers: { "Cache-Control": "private, no-store" } });
  } catch { return NextResponse.json({ error: "Sessions unavailable" }, { status: 503 }); }
}
