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
    "Communication",
  );
  assert.equal(
    activeNavigation("/dashboard/integrations/autocab/webhooks/new")?.item
      .label,
    "Autocab integration",
  );
  assert.equal(
    activeNavigation("/dashboard/configuration/webhooks/events")?.item.label,
    "Configuration hub",
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
  assert.equal(searchNavigation("Communication", custom).length, 0);
  assert.ok(
    searchNavigation(
      "Communication",
      visibleNavigation(["configuration.view"], "MANAGER"),
    ).length,
  );
});

test("WhatsApp flows use automation permission and their own navigation destination",()=>{
 assert.equal(activeNavigation('/dashboard/marketing/whatsapp/flows')?.item.label,'WhatsApp flows');
 assert.equal(searchNavigation('WhatsApp flows',visibleNavigation(['customers.view'],'OPERATOR')).length,0);
 assert.equal(searchNavigation('WhatsApp flows',visibleNavigation(['automation.view'],'OPERATOR')).length,1);
});

test("customer conversations are not offered in CRM navigation while marketing remains available",()=>{
 const groups=visibleNavigation(['customers.view','integrations.view','configuration.view'],'OPERATOR');
 assert.equal(searchNavigation('WhatsApp inbox',groups).length,0);
 assert.ok(searchNavigation('WhatsApp campaigns',groups).some(result=>result.href==='/dashboard/marketing/whatsapp'));
});

test('integration connections share one menu and operational areas remain separate',()=>{
 const groups=visibleNavigation(['integrations.view','configuration.view','bookings.view','drivers.view'],'MANAGER');
 const integrations=groups.find(group=>group.id==='integrations');
 assert.ok(integrations);
 for(const label of ['NeedACabPlus integration','Autocab integration','WhatsApp connection','Communication']) assert.ok(integrations.items.some(entry=>entry.label===label),label);
 assert.ok(groups.find(group=>group.id==='operations')?.items.some(entry=>entry.label==='Bookings'));
 assert.ok(groups.find(group=>group.id==='operations')?.items.some(entry=>entry.label==='Drivers'));
 assert.ok(!groups.find(group=>group.id==='configuration')?.items.some(entry=>entry.label==='Integration events'));
});
