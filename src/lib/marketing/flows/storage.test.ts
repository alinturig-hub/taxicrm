import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import {
  parseCommand,
  writeFlow,
  readFlow,
  FlowError,
  type Query,
  type FlowRow,
} from "./storage";
import { starterDraft, simulateDraft, syntheticContext } from "./model";
const sql = readFileSync(
  "prisma/migrations/20261105160000_whatsapp_flow_versions/migration.sql",
  "utf8",
);
async function fixture() {
  const db = new PGlite();
  await db.exec(sql);
  const query: Query = {
    query: async (s, p) => ({ rows: (await db.query(s, p)).rows as FlowRow[] }),
  };
  return { db, query };
}
async function write(q: Query, w: string, a: string, x: unknown) {
  await q.query("BEGIN");
  try {
    const r = await writeFlow(q, w, a, parseCommand(x));
    await q.query("COMMIT");
    return r;
  } catch (e) {
    await q.query("ROLLBACK");
    throw e;
  }
}
test("immutable snapshots, authors, rename and stale editor protection", async () => {
  const { db, query: q } = await fixture();
  try {
    const d = starterDraft();
    const first = await write(q, "one", "alice", {
      action: "create",
      draft: d,
    });
    d.name = "Renamed";
    await write(q, "one", "bob", {
      action: "save",
      id: first.id,
      expectedVersion: 1,
      draft: d,
    });
    const old = await readFlow(q, "one", first.id, 1),
      latest = await readFlow(q, "one", first.id);
    assert.equal(old.draft.name, "Welcome and route");
    assert.equal(old.author_id, "alice");
    assert.equal(latest.version, 2);
    assert.equal(latest.author_id, "bob");
    assert.equal(latest.draft.name, "Renamed");
    await assert.rejects(
      write(q, "one", "alice", {
        action: "save",
        id: first.id,
        expectedVersion: 1,
        draft: d,
      }),
      (e: unknown) => e instanceof FlowError && e.status === 409,
    );
    assert.equal(
      (await q.query("SELECT * FROM whatsapp_flow_revisions")).rows.length,
      2,
    );
  } finally {
    await db.close();
  }
});
test("workspace isolation, archive/restore, duplicate and exact snapshot simulation", async () => {
  const { db, query: q } = await fixture();
  try {
    const d = starterDraft();
    const first = await write(q, "one", "alice", {
      action: "create",
      draft: d,
    });
    await assert.rejects(readFlow(q, "two", first.id));
    await assert.rejects(
      write(q, "two", "bob", {
        action: "archive",
        id: first.id,
        expectedVersion: 1,
      }),
    );
    await write(q, "one", "bob", {
      action: "archive",
      id: first.id,
      expectedVersion: 1,
    });
    await assert.rejects(
      write(q, "one", "bob", {
        action: "save",
        id: first.id,
        expectedVersion: 2,
        draft: d,
      }),
    );
    await write(q, "one", "alice", {
      action: "restore",
      id: first.id,
      expectedVersion: 2,
    });
    const old = await readFlow(q, "one", first.id, 1);
    const copy = await write(q, "one", "alice", {
      action: "create",
      draft: old.draft,
    });
    assert.notEqual(first.id, copy.id);
    assert.deepEqual(
      simulateDraft(old.draft, syntheticContext()),
      simulateDraft(d, syntheticContext()),
    );
    assert.equal((await readFlow(q, "one", first.id)).head_version, 3);
  } finally {
    await db.close();
  }
});
test("revision insert failure rolls back head and prevents partial save", async () => {
  const { db, query: q } = await fixture();
  try {
    const d = starterDraft();
    const f = await write(q, "one", "alice", { action: "create", draft: d });
    const broken: Query = {
      query: async (s, p) => {
        if (s.startsWith("INSERT INTO public.whatsapp_flow_revisions"))
          throw Error("synthetic failure");
        return q.query(s, p);
      },
    };
    await assert.rejects(
      write(broken, "one", "bob", {
        action: "save",
        id: f.id,
        expectedVersion: 1,
        draft: { ...d, name: "Failed" },
      }),
    );
    assert.equal((await readFlow(q, "one", f.id)).head_version, 1);
  } finally {
    await db.close();
  }
});
test("rejects executable fields, invalid identifiers, and malformed drafts", () => {
  for (const x of [
    { action: "create", draft: starterDraft(), enabled: true },
    { action: "save", id: "bad", expectedVersion: 1, draft: starterDraft() },
    {
      action: "create",
      draft: { ...starterDraft(), webhook: "https://example.com" },
    },
    {
      action: "archive",
      id: "00000000-0000-0000-0000-000000000000",
      expectedVersion: 1,
      draft: starterDraft(),
    },
  ])
    assert.throws(() => parseCommand(x));
});

test("reviewed installer narrows default grants on new tables only", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `CREATE ROLE taxicrm_shared_app; CREATE ROLE cabby_ro; ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO taxicrm_shared_app; ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO cabby_ro;`,
    );
    await db.exec(
      readFileSync(
        "docs/integrations/conversation-editor/release/install-flow-drafts.sql",
        "utf8",
      ),
    );
    const result = await db.query<{
      draft_delete: boolean;
      revision_update: boolean;
      revision_delete: boolean;
      head_update: boolean;
      workspace_update: boolean;
      revision_insert: boolean;
      readonly_select: boolean;
    }>(
      `SELECT has_table_privilege('taxicrm_shared_app','whatsapp_flow_drafts','DELETE') AS draft_delete, has_table_privilege('taxicrm_shared_app','whatsapp_flow_revisions','UPDATE') AS revision_update,has_table_privilege('taxicrm_shared_app','whatsapp_flow_revisions','DELETE') AS revision_delete,has_column_privilege('taxicrm_shared_app','whatsapp_flow_drafts','name','UPDATE') AS head_update,has_column_privilege('taxicrm_shared_app','whatsapp_flow_drafts','workspace','UPDATE') AS workspace_update,has_table_privilege('taxicrm_shared_app','whatsapp_flow_revisions','INSERT') AS revision_insert,has_table_privilege('cabby_ro','whatsapp_flow_revisions','SELECT') AS readonly_select`,
    );
    assert.deepEqual(result.rows[0], {
      draft_delete: false,
      revision_update: false,
      revision_delete: false,
      head_update: true,
      workspace_update: false,
      revision_insert: true,
      readonly_select: true,
    });
  } finally {
    await db.close();
  }
});
