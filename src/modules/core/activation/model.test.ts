import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { moduleForRoute } from "../ownership";
import { modules } from "../registry";
import { workerOwnership } from "../worker-ownership";
import { visibleNavigation, searchNavigation } from "@/lib/workspace/navigation";
import { initialModuleState, parseModuleState, enabledModuleIds, nextModuleState, switchableModules } from "./model";

test("defaults preserve current features and a module change never changes unrelated capabilities", () => {
  const state = initialModuleState();
  assert.deepEqual(enabledModuleIds(state).sort(), Object.keys(modules).sort());
  for (const id of switchableModules) {
    const disabled = nextModuleState(state, id, false);
    assert.equal(disabled.revision, 1); assert.equal(state.enabled[id], true);
    assert.deepEqual(enabledModuleIds(disabled).sort(), Object.keys(modules).filter(m => m !== id).sort());
    assert.equal(nextModuleState(disabled, id, true).enabled[id], true);
  }
});
test("strict persisted configuration rejects corrupt, partial, unknown and non-boolean state", () => {
  for (const value of [null, [], {}, { ...initialModuleState(), schemaVersion: 2 }, { ...initialModuleState(), revision: -1 }, { ...initialModuleState(), revision: 1.2 }, { ...initialModuleState(), enabled: { ai: true } }, { ...initialModuleState(), enabled: { ai: "false", reports: true, automation: true } }, { ...initialModuleState(), extra: true }]) {
    assert.throws(() => parseModuleState(value), /MODULE_STATE_INVALID/);
  }
  assert.deepEqual(parseModuleState(initialModuleState()), initialModuleState());
});
test("disabled module disappears from navigation and search without adding user permissions", () => {
  const state = nextModuleState(nextModuleState(initialModuleState(), "ai", false), "automation", false);
  const allowed = enabledModuleIds(state);
  const groups = visibleNavigation(["dashboard.view", "intelligence.view", "automation.view", "configuration.manage"], "ADMIN", allowed);
  assert.equal(searchNavigation("copilot", groups).length, 0);
  assert.equal(groups.flatMap(g => g.items).some(i => i.href === "/dashboard/ai/automation"), false);
  assert.equal(groups.flatMap(g => g.items).some(i => i.href === "/dashboard/configuration/modules"), true);
  assert.equal(visibleNavigation([], "ADMIN", enabledModuleIds(initialModuleState())).length, 0);
  assert.equal(moduleForRoute("/api/dashboard/driver-company-overview"), "businessOverview");
});
function walk(dir: string): string[] { return readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]); }
test("every switchable page/API has a server guard and no switchable module owns a scheduled worker", () => {
  for (const worker of workerOwnership) {
    assert.equal((switchableModules as readonly string[]).includes(worker.owner), false);
    assert.ok(worker.participants.every(id => !(switchableModules as readonly string[]).includes(id)));
  }
  for (const file of walk("src/app").filter(f => /\/(page|route)\.tsx?$/.test(f))) {
    const route = file.replace(/^src\/app/, "").replace(/\/(page|route)\.tsx?$/, "") || "/";
    const owner = moduleForRoute(route);
    if (switchableModules.includes(owner as typeof switchableModules[number])) {
      const guard = file.endsWith("route.ts") ? "moduleApiBlock" : "modulePageBlock";
      assert.ok(readFileSync(file, "utf8").includes(`${guard}("${owner}")`), file);
    }
  }
});
