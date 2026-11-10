import { test } from "node:test";
import assert from "node:assert/strict";
import { cards, workspaceRange } from "@/lib/workspace/home/config";
import { workspaceCardOwner } from "@/modules/core/registry";
import type { WorkspaceContext, WorkspaceCardId } from "@/modules/core/contracts/workspace";
test("module providers cover each current metric once and unrequested modules create no work", async () => {
    process.env.DATABASE_URL = "postgresql://synthetic_contract_only@127.0.0.1:1/no_connection";
    const { workspaceProviders } = await import("./providers");
    const now = new Date("2026-11-10T12:00:00Z"), base: WorkspaceContext = { ids: [], now, range: workspaceRange("TODAY", now), assign: () => assert.fail("Creating a task must not query or publish results") };
    const provided = workspaceProviders.flatMap(p => [...p.cardIds]);
    assert.equal(new Set(provided).size, provided.length);
    assert.deepEqual([...provided].sort(), Object.entries(cards).filter(([, value]) => value.unit !== "ACTION").map(([id]) => id).sort());
    for (const provider of workspaceProviders) {
        assert.equal(provider.createTask(base), null);
        for (const id of provider.cardIds)
            assert.equal(workspaceCardOwner[id], provider.moduleId);
    }
    for (const id of provided as WorkspaceCardId[]) {
        const tasks = workspaceProviders.flatMap(p => { const t = p.createTask({ ...base, ids: [id] }); return t ? [t] : []; });
        assert.equal(tasks.length, 1);
        assert.deepEqual(tasks[0].ids, [id]);
    }
});
