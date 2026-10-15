import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { test } from "node:test";
import {
  activeNavigation,
  navigationGroups,
  searchNavigation,
  visibleNavigation,
} from "./navigation";
test("every published navigation item resolves to a real page, with no duplicate destinations", () => {
  const links = navigationGroups.flatMap((g) => g.items);
  assert.equal(new Set(links.map((i) => i.href)).size, links.length);
  for (const item of links)
    assert.ok(
      existsSync(`src/app${item.href}/page.tsx`),
      `Missing page: ${item.href}`,
    );
});
test("nested pages select exactly the owning module and deepest destination", () => {
  assert.equal(
    activeNavigation("/dashboard/configuration/sms")?.item.label,
    "SMS & freephone alerts",
  );
  assert.equal(
    activeNavigation("/dashboard/integrations/autocab/webhooks/new")?.item
      .label,
    "Autocab integration",
  );
  assert.equal(
    activeNavigation("/dashboard/configuration/webhooks/events")?.item.label,
    "Integration events",
  );
  assert.equal(
    activeNavigation("/dashboard/marketing/segments")?.item.label,
    "Audience segments",
  );
  assert.equal(
    activeNavigation("/dashboard/drivers/synthetic")?.item.label,
    "Drivers",
  );
  assert.equal(
    activeNavigation("/dashboard/integrations/local/synthetic")?.item.label,
    "Local integration",
  );
  assert.equal(activeNavigation("/dashboard/unimplemented"), null);
});
test("module search and cards respect custom permission grants and existing SMS role restrictions", () => {
  const restricted = visibleNavigation(["customers.view"], "OPERATOR");
  assert.ok(searchNavigation("segments", restricted).length);
  assert.equal(searchNavigation("SMS", restricted).length, 0);
  assert.ok(!restricted.some((g) => g.id === "configuration"));
  const custom = visibleNavigation(["configuration.view"], "OPERATOR");
  assert.ok(custom.some((g) => g.id === "configuration"));
  assert.equal(searchNavigation("SMS", custom).length, 0);
  assert.ok(
    searchNavigation(
      "SMS",
      visibleNavigation(["configuration.view"], "MANAGER"),
    ).length,
  );
});
