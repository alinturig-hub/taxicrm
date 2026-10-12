import { timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const expected = Buffer.from(process.env.CRON_SECRET || "");
  const supplied = Buffer.from(request.headers.get("x-cron-secret") || "");
  if (
    !expected.length ||
    expected.length !== supplied.length ||
    !timingSafeEqual(expected, supplied)
  )
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id || !/^[a-zA-Z0-9_-]{1,100}$/.test(id))
    return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });
  try {
    const manifest = JSON.parse(
      await readFile(
        `${process.cwd()}/.next/server/app-paths-manifest.json`,
        "utf8",
      ),
    );
    const result = await prisma.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
        const migration = await tx.$queryRaw<
          { finished_at: Date | null }[]
        >`SELECT finished_at FROM "_prisma_migrations" WHERE migration_name='20261012100000_webhook_providers' AND rolled_back_at IS NULL`;
        const configuration = await tx.autocabWebhookConfiguration.findUnique({
          where: { id },
          select: { id: true, webhookProvider: { select: { id: true } } },
        });
        return {
          migrationApplied:
            migration.length === 1 && Boolean(migration[0].finished_at),
          configurationExists: Boolean(configuration),
          providerLinked: Boolean(configuration?.webhookProvider),
        };
      },
      { timeout: 10000 },
    );
    return NextResponse.json(
      {
        ...result,
        editorRouteRegistered: Boolean(
          manifest["/dashboard/integrations/autocab/webhooks/[id]/page"],
        ),
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "READINESS_CHECK_FAILED" },
      { status: 503 },
    );
  }
}
