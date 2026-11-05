import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { Pool } from "pg";
import { authOptions } from "@/lib/auth";
import { getAdministrationAccess } from "@/lib/administration-access";
import {
  FlowError,
  flowId,
  parseCommand,
  readFlow,
  revisionNumber,
  writeFlow,
} from "@/lib/marketing/flows/storage";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 3,
  connectionTimeoutMillis: 8000,
  statement_timeout: 10000,
});
async function access(write = false) {
  const session = await getServerSession(authOptions);
  const user = await getAdministrationAccess(session?.user?.email);
  if (!user) throw new FlowError(401, "Sign in required.");
  if (
    !user.permissions.includes("automation.view") ||
    (write && !user.permissions.includes("automation.manage"))
  )
    throw new FlowError(403, "Permission denied.");
  return user;
}
function failure(e: unknown) {
  return NextResponse.json(
    {
      error:
        e instanceof FlowError
          ? e.message
          : "Flow storage unavailable. No change was confirmed.",
    },
    { status: e instanceof FlowError ? e.status : 503, headers },
  );
}
const workspace = () => process.env.WHATSAPP_WORKSPACE_ID || "needacabplus";
export async function GET(request: Request) {
  try {
    await access();
    const q = new URL(request.url).searchParams;
    if (q.has("id")) {
      const id = flowId(q.get("id"));
      if (q.get("history") === "true")
        return NextResponse.json(
          {
            revisions: (
              await pool.query(
                `SELECT r.version,r.archived,r.author_id,r.created_at FROM public.whatsapp_flow_revisions r JOIN public.whatsapp_flow_drafts f ON f.id=r.flow_id WHERE f.workspace=$1 AND f.id=$2 ORDER BY r.version DESC LIMIT 100`,
                [workspace(), id],
              )
            ).rows,
          },
          { headers },
        );
      return NextResponse.json(
        {
          flow: await readFlow(
            pool,
            workspace(),
            id,
            q.has("version") ? revisionNumber(q.get("version")) : undefined,
          ),
        },
        { headers },
      );
    }
    return NextResponse.json(
      {
        flows: (
          await pool.query(
            `SELECT id,name,version,archived,created_by,updated_by,updated_at FROM public.whatsapp_flow_drafts WHERE workspace=$1 ORDER BY updated_at DESC,id LIMIT 200`,
            [workspace()],
          )
        ).rows,
        limit: 200,
      },
      { headers },
    );
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    const user = await access(true);
    if (request.headers.get("origin") !== new URL(request.url).origin)
      throw new FlowError(403, "Same-origin request required.");
    if (!request.headers.get("content-type")?.startsWith("application/json"))
      throw new FlowError(415, "JSON required.");
    const reader = request.body?.getReader();
    if (!reader) throw new FlowError(400, "Body required.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.length;
      if (size > 70000) {
        await reader.cancel();
        throw new FlowError(413, "Draft too large.");
      }
      chunks.push(part.value);
    }
    let input: unknown;
    try {
      input = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      throw new FlowError(400, "Invalid JSON.");
    }
    const command = parseCommand(input);
    const db = await pool.connect();
    try {
      await db.query("BEGIN");
      await db.query("SET LOCAL lock_timeout='3s'");
      const flow = await writeFlow(db, workspace(), user.user.id, command);
      await db.query("COMMIT");
      return NextResponse.json(
        { flow },
        { status: command.action === "create" ? 201 : 200, headers },
      );
    } catch (e) {
      await db.query("ROLLBACK");
      throw e;
    } finally {
      db.release();
    }
  } catch (e) {
    return failure(e);
  }
}
