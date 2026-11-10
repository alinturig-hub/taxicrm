import { NextRequest, NextResponse } from "next/server";
import { workspaceApiAccess } from "@/lib/workspace/home/api-access";
import { periods, type WorkspacePeriod } from "@/lib/workspace/home/config";
import { loadWorkspacePreference } from "@/lib/workspace/home/preferences";
import { workspaceSummary } from "@/lib/workspace/home/summary";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) { const ctx = await workspaceApiAccess(); if (!ctx)
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 }); if (Array.from(request.nextUrl.searchParams.keys()).some(k => k !== "period"))
    return NextResponse.json({ error: "Invalid filter" }, { status: 400 }); const period = request.nextUrl.searchParams.get("period"); if (period && !periods.includes(period as WorkspacePeriod))
    return NextResponse.json({ error: "Invalid period" }, { status: 400 }); try {
    const pref = await loadWorkspacePreference(ctx.access.user.id, ctx.can);
    return NextResponse.json(await workspaceSummary(pref.config.widgets, (period || pref.config.period) as WorkspacePeriod, ctx.can), { headers: { "Cache-Control": "private, no-store" } });
}
catch {
    return NextResponse.json({ error: "Workspace figures could not be loaded." }, { status: 503 });
} }
