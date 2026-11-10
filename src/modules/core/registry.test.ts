import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { cards } from "@/lib/workspace/home/config";
import { modules, workspaceCardOwner } from "./registry";
import { moduleForRoute, routeOwnership } from "./ownership";
import { workerOwnership } from "./worker-ownership";
function walk(dir: string): string[] { return readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]); }
test("every existing app route has one explicit primary owner; legacy URLs stay mapped", () => {
    for (const file of walk("src/app").filter(f => /\/(page|route)\.tsx?$/.test(f))) {
        const route = file.replace(/^src\/app/, "").replace(/\/(page|route)\.tsx?$/, "") || "/";
        assert.ok(moduleForRoute(route), file);
    }
    assert.equal(new Set(routeOwnership.map(r => r.prefix)).size, routeOwnership.length);
    assert.equal(moduleForRoute("/dashboard/configuration/webhooks/events"), "integrations");
    assert.equal(moduleForRoute("/dashboard/integrations/autocab/webhooks"), "autocab");
    assert.equal(moduleForRoute("/api/dashboard/customers/predictions"), "predictions");
    assert.equal(moduleForRoute("/not-a-known-route"), null);
});
test("all current cards have module owners and every scheduled entrypoint has a lifecycle owner", () => {
    assert.deepEqual(Object.keys(workspaceCardOwner).sort(), Object.keys(cards).sort());
    for (const owner of Object.values(workspaceCardOwner))
        assert.ok(modules[owner]);
    const server = readFileSync("server.mjs", "utf8");
    for (const match of Array.from(server.matchAll(/(?:path:\s*"|http:\/\/127\.0\.0\.1:\$\{[^}]+\})(\/api\/[^"`]+)/g))) {
        assert.ok(workerOwnership.some(w => w.entrypoint === match[1]), match[1]);
    }
    assert.equal(moduleForRoute("/api/internal/whatsapp/v1/worker"), "communications");
});
