import { test } from "node:test";
import assert from "node:assert/strict";

test("installation module ledger is durable, serialized, audited and fail-closed", { skip: !process.env.MODULE_ACTIVATION_QA_DATABASE_URL }, async () => {
  const u = new URL(process.env.MODULE_ACTIVATION_QA_DATABASE_URL!);
  assert.equal(u.hostname, "127.0.0.1"); assert.equal(u.pathname, "/workspace_qa"); assert.equal(u.username, "qa_workspace");
  process.env.DATABASE_URL = u.toString();
  const { prisma } = await import("@/lib/prisma");
  const { loadModuleState, changeModuleState } = await import("@/modules/core/activation/store");
  const { moduleApiBlock } = await import("@/modules/core/activation/access");
  const identity = { action: "INSTALLATION_MODULES_UPDATED", targetType: "TaxiCRMInstallationModules", targetId: "current" };
  const userId = "qa-module-admin";
  try {
    assert.equal(await prisma.administrationAuditEvent.count({ where: identity }), 0);
    await prisma.user.create({ data: { id: userId, name: "Synthetic Admin", email: "module-unit@example.test", role: "ADMIN", passwordHash: "synthetic-no-login" } });
    assert.equal((await loadModuleState()).revision, 0);
    const results = await Promise.allSettled([
      changeModuleState({ revision: 0, moduleId: "ai", enabled: false }, userId),
      changeModuleState({ revision: 0, moduleId: "reports", enabled: false }, userId),
    ]);
    assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
    assert.equal(results.filter(r => r.status === "rejected").length, 1);
    assert.match((results.find(r => r.status === "rejected") as PromiseRejectedResult).reason.message, /MODULE_VERSION_CONFLICT/);
    let state = await loadModuleState(); assert.equal(state.revision, 1);
    const disabled = !state.enabled.ai ? "ai" : "reports";
    const block = await moduleApiBlock(disabled); assert.equal(block?.status, 403); assert.equal((await block!.json()).error, "MODULE_DISABLED");
    assert.equal(await moduleApiBlock("automation"), null);
    await changeModuleState({ revision: 1, moduleId: disabled, enabled: false }, userId);
    assert.equal(await prisma.administrationAuditEvent.count({ where: identity }), 1);
    await assert.rejects(changeModuleState({ revision: 1, moduleId: "automation", enabled: false }, "missing-synthetic-actor"));
    assert.equal((await loadModuleState()).revision, 1); // Failed audit insertion rolls back the change.
    state = await changeModuleState({ revision: 1, moduleId: disabled, enabled: true }, userId);
    assert.equal(state.revision, 2); assert.equal(await moduleApiBlock(disabled), null);
    await prisma.$disconnect(); assert.equal((await loadModuleState()).revision, 2); // A new pool reads durable state.
    const events = await prisma.administrationAuditEvent.findMany({ where: identity, orderBy: { id: "asc" } });
    assert.equal(events.length, 2); assert.ok(events.every(e => e.actorUserId === userId));
    await prisma.administrationAuditEvent.update({ where: { id: events[0].id }, data: { occurredAt: new Date("2100-01-01T00:00:00Z") } });
    assert.equal((await loadModuleState()).revision, 2); // Clock/timestamp order cannot override the committed revision.
    await prisma.administrationAuditEvent.create({ data: { ...identity, id: "installation-modules:9999999999999999", actorUserId: userId, evidence: { corrupt: true } } });
    await assert.rejects(loadModuleState(), /MODULE_STATE_INVALID/);
    assert.equal((await moduleApiBlock("ai"))?.status, 503);
    await prisma.administrationAuditEvent.deleteMany({ where: { ...identity, id: "installation-modules:9999999999999999" } });
    await prisma.$executeRawUnsafe('ALTER TABLE "AdministrationAuditEvent" RENAME TO "SyntheticHiddenAudit"');
    try { assert.equal((await moduleApiBlock("ai"))?.status, 503); }
    finally { await prisma.$executeRawUnsafe('ALTER TABLE "SyntheticHiddenAudit" RENAME TO "AdministrationAuditEvent"'); }
  } finally {
    await prisma.administrationAuditEvent.deleteMany({ where: identity });
    await prisma.user.deleteMany({ where: { id: userId } }); await prisma.$disconnect();
  }
});
