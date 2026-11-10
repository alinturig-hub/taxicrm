import { retainDisabledCards } from "@/modules/my-workspace/availability";
import { NextRequest, NextResponse } from "next/server";
import { workspaceApiAccess } from "@/lib/workspace/home/api-access";
import { parseConfig } from "@/lib/workspace/home/config";
import { loadWorkspacePreference, saveWorkspacePreference } from "@/lib/workspace/home/preferences";
export const dynamic = "force-dynamic";
const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
export async function GET(request: NextRequest) { const ctx = await workspaceApiAccess(); if (!ctx)
    return json({ error: "FORBIDDEN" }, 403); if (request.nextUrl.search)
    return json({ error: "Invalid request" }, 400); try {
    const pref = await loadWorkspacePreference(ctx.access.user.id, ctx.can);
    return json({ ...pref, config: { ...pref.config, widgets: pref.config.widgets.filter(id => ctx.allowed.includes(id)) } });
}
catch {
    return json({ error: "Saved layout is temporarily unavailable. Try again." }, 503);
} }
export async function PUT(request: NextRequest) {
    const ctx = await workspaceApiAccess();
    if (!ctx)
        return json({ error: "FORBIDDEN" }, 403);
    if (request.headers.get("origin") !== new URL(process.env.NEXTAUTH_URL || request.url).origin)
        return json({ error: "SAME_ORIGIN_REQUIRED" }, 403);
    let revision: number;
    let config: ReturnType<typeof parseConfig>;
    try {
        const reader = request.body?.getReader();
        if(!reader)throw Error("Layout is empty.");
        const decoder=new TextDecoder();let size=0,text="";
        while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>4096){await reader.cancel();throw Error("Layout is too large.");}text+=decoder.decode(part.value,{stream:true});}
        text+=decoder.decode();
        const input = JSON.parse(text);
        if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).some(k => !["revision", "config"].includes(k)) || !Number.isInteger(input.revision) || input.revision < 0 || input.revision > 2147483646)
            throw Error("Invalid layout version.");
        revision = input.revision;
        config = parseConfig(input.config, ctx.allowed);
    }
    catch (e) {
        return json({ error: e instanceof Error ? e.message : "Invalid layout" }, 400);
    }
    try {
        const previous = await loadWorkspacePreference(ctx.access.user.id, ctx.can);
        const stored = { ...config, widgets: retainDisabledCards(previous.config.widgets, config.widgets, ctx.allowed) };
        const row = await saveWorkspacePreference(ctx.access.user.id, revision, stored);
        return json({ revision: row.revision, config });
    }
    catch (e) {
        if (e instanceof Error && e.message === "WORKSPACE_VERSION_CONFLICT")
            return json({ error: "Your layout changed in another session. Reload saved layout before saving." }, 409);
        return json({ error: "Could not save your layout. Your saved preferences have not been replaced." }, 503);
    }
}
