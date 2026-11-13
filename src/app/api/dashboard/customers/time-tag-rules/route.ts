import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdministrationPermission, ADMINISTRATION_PERMISSIONS } from "@/lib/administration-access";
import { prisma } from "@/lib/prisma";
import { loadTimeTagRules } from "@/lib/customers/time-tag-store";
import { parseTimeTagRules } from "@/lib/customers/time-tag-rules";
export const dynamic = "force-dynamic";
async function access() { return requireAdministrationPermission((await getServerSession(authOptions))?.user?.email, ADMINISTRATION_PERMISSIONS.CUSTOMERS_MANAGE); }
export async function GET() { if (!await access())
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 }); return NextResponse.json(await loadTimeTagRules()); }
export async function PUT(request: NextRequest) {
    const user = await access();
    if (!user)
        return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    if (request.headers.get("origin") !== new URL(process.env.NEXTAUTH_URL || request.url).origin)
        return NextResponse.json({ error: "ORIGIN_REQUIRED" }, { status: 403 });
    if (Number(request.headers.get("content-length") || 0) > 20000)
        return NextResponse.json({ error: "BODY_TOO_LARGE" }, { status: 413 });
    let body: {
        revision: number;
        rules: unknown;
    };
    let rules: ReturnType<typeof parseTimeTagRules>;
    try {
        const text = await request.text();
        if (text.length > 20000)
            throw Error("Rules are too large.");
        body = JSON.parse(text);
        if (!body || Object.keys(body).some(k => !["revision", "rules"].includes(k)) || !Number.isInteger(body.revision) || body.revision < 0)
            throw Error("Invalid version.");
        rules = parseTimeTagRules(body.rules);
    }
    catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : "Invalid rules" }, { status: 400 });
    }
    try {
        const result = await prisma.$transaction(async (tx) => {
            // Lock the row before inspecting its revision, so a running tag refresh cannot
            // reactivate obsolete values after this edit commits.
            await tx.$queryRaw`SELECT pg_advisory_xact_lock(187438602, 1)::text`;
            await tx.$queryRaw `SELECT id FROM "CustomerTimeTagConfiguration" WHERE id='default' FOR UPDATE`;
            const previous = await tx.customerTimeTagConfiguration.findUnique({ where: { id: "default" } });
            if ((previous?.revision ?? 0) !== body.revision)
                throw Error("VERSION_CONFLICT");
            const row = previous ? await tx.customerTimeTagConfiguration.update({ where: { id: "default" }, data: { rules, revision: { increment: 1 }, updatedById: user.user.id } }) : await tx.customerTimeTagConfiguration.create({ data: { id: "default", rules, updatedById: user.user.id } });
            const oldRules = previous ? parseTimeTagRules(previous.rules) : [{ id: "EARLY_MORNING_USER" }, { id: "LATE_EVENING_USER" }];
            const affected = Array.from(new Set([...oldRules.map(r => r.id), ...rules.map(r => r.id)]));
            await tx.customerBehaviourTag.updateMany({ where: { tagId: { in: affected }, active: true }, data: { active: false } });
            await tx.administrationAuditEvent.create({ data: { actorUserId: user.user.id, action: "CUSTOMER_TIME_TAG_RULES_UPDATED", targetType: "CustomerTimeTagConfiguration", targetId: "default", evidence: { previousRevision: body.revision, revision: row.revision, rules } } });
            return { revision: row.revision, rules };
        });
        return NextResponse.json(result);
    }
    catch (e) {
        if (e instanceof Error && (e.message === "VERSION_CONFLICT" || ("code" in e && e.code === "P2002")))
            return NextResponse.json({ error: "Rules changed in another session. Reload before saving." }, { status: 409 });
        throw e;
    }
}
