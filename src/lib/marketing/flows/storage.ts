import { randomUUID } from "node:crypto";
import { parseDraft, type FlowDraft } from "./model";

export type FlowRow = {
  id: string;
  workspace: string;
  name: string;
  version: number;
  archived: boolean;
  draft: FlowDraft;
  author_id: string;
  head_version: number;
  head_archived: boolean;
  created_at: Date;
};
export interface Query {
  query(sql: string, params?: unknown[]): Promise<{ rows: FlowRow[] }>;
}
export type FlowCommand = {
  action: "create" | "save" | "archive" | "restore";
  id?: string;
  expectedVersion?: number;
  draft?: FlowDraft;
};
export class FlowError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function flowId(value: unknown): string {
  if (typeof value !== "string" || !uuid.test(value))
    throw new FlowError(400, "Invalid flow ID.");
  return value;
}
export function revisionNumber(value: unknown): number {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 1 || n > 2147483646)
    throw new FlowError(400, "Invalid revision.");
  return n;
}
export function parseCommand(input: unknown): FlowCommand {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new FlowError(400, "Invalid command.");
  const x = input as Record<string, unknown>;
  if (
    Object.keys(x).some(
      (k) => !["action", "id", "expectedVersion", "draft"].includes(k),
    )
  )
    throw new FlowError(400, "Unknown field.");
  if (!["create", "save", "archive", "restore"].includes(String(x.action)))
    throw new FlowError(400, "Invalid action.");
  const action = x.action as FlowCommand["action"];
  if (
    action === "create" &&
    (x.id !== undefined || x.expectedVersion !== undefined)
  )
    throw new FlowError(400, "New flows have no existing revision.");
  const id = action === "create" ? undefined : flowId(x.id);
  if (action !== "create" && typeof x.expectedVersion !== "number")
    throw new FlowError(400, "Expected version must be a number.");
  const expectedVersion =
    action === "create" ? undefined : revisionNumber(x.expectedVersion);
  let draft: FlowDraft | undefined;
  if (action === "create" || action === "save") {
    try {
      draft = parseDraft(JSON.stringify(x.draft));
    } catch {
      throw new FlowError(400, "Invalid draft.");
    }
    if (!draft.name.trim()) throw new FlowError(400, "Enter a flow name.");
  } else if (x.draft !== undefined)
    throw new FlowError(400, "Archive commands cannot replace content.");
  return { action, id, expectedVersion, draft };
}
/** Caller supplies a transaction; revision insertion and head change must commit together. */
export async function writeFlow(
  db: Query,
  workspace: string,
  author: string,
  command: FlowCommand,
) {
  const { action, draft, expectedVersion } = command;
  const id = command.id || randomUUID();
  let row: FlowRow;
  if (action === "create") {
    row = (
      await db.query(
        `INSERT INTO public.whatsapp_flow_drafts(id,workspace,name,version,created_by,updated_by) VALUES($1,$2,$3,1,$4,$4) RETURNING *`,
        [id, workspace, draft!.name, author],
      )
    ).rows[0];
  } else {
    // CAS under row lock also serializes concurrent save/archive operations.
    const old = (
      await db.query(
        `SELECT f.*, r.draft FROM public.whatsapp_flow_drafts f JOIN public.whatsapp_flow_revisions r ON r.flow_id=f.id AND r.version=f.version WHERE f.id=$1 AND f.workspace=$2 FOR UPDATE OF f`,
        [id, workspace],
      )
    ).rows[0];
    if (!old) throw new FlowError(404, "Flow not found.");
    if (old.version !== expectedVersion)
      throw new FlowError(409, "This flow changed. Reload it before saving.");
    if (action === "save" && old.archived)
      throw new FlowError(409, "Restore the archived flow before editing.");
    if (
      (action === "archive" && old.archived) ||
      (action === "restore" && !old.archived)
    )
      throw new FlowError(409, "Flow state already changed.");
    row = (
      await db.query(
        `UPDATE public.whatsapp_flow_drafts SET name=$3,version=version+1,archived=$4,updated_by=$5,updated_at=now() WHERE id=$1 AND workspace=$2 RETURNING *`,
        [
          id,
          workspace,
          draft?.name || old.name,
          action === "archive"
            ? true
            : action === "restore"
              ? false
              : old.archived,
          author,
        ],
      )
    ).rows[0];
    if (!command.draft) command = { ...command, draft: old.draft };
  }
  await db.query(
    `INSERT INTO public.whatsapp_flow_revisions(flow_id,version,draft,archived,author_id) VALUES($1,$2,$3::jsonb,$4,$5)`,
    [id, row.version, JSON.stringify(command.draft), row.archived, author],
  );
  return row;
}
export async function readFlow(
  db: Query,
  workspace: string,
  id: string,
  version?: number,
) {
  const row = (
    await db.query(
      `SELECT f.id, f.name, f.version AS head_version, f.archived AS head_archived, r.version, r.draft, r.archived, r.author_id, r.created_at FROM public.whatsapp_flow_drafts f JOIN public.whatsapp_flow_revisions r ON r.flow_id=f.id AND r.version=COALESCE($3::integer,f.version) WHERE f.id=$1 AND f.workspace=$2`,
      [id, workspace, version ?? null],
    )
  ).rows[0];
  if (!row) throw new FlowError(404, "Revision not found.");
  return row;
}
