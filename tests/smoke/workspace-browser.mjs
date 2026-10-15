import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { encode } from "next-auth/jwt";
import { prisma } from "../../src/lib/prisma.ts";
const { chromium } = createRequire(import.meta.url)("playwright");
assert.equal(process.env.TAXICRM_SYNTHETIC_TESTS, "1");
assert.equal(
  process.env.DATABASE_URL,
  "postgresql://taxicrm@127.0.0.1:5432/taxicrm",
);
const origin = "http://127.0.0.1:3001";
const prefix = `workspace-synthetic-${randomUUID()}`;
const email = `${prefix}@example.test`;
const user = await prisma.user.create({
  data: {
    email,
    name: "Synthetic CRM Team",
    passwordHash: "synthetic-unusable-password",
    role: "ADMIN",
  },
});
const customer = await prisma.normalCustomer.create({
  data: {
    normalizedTelephone: "447700900042",
    telephoneNumber: "+447700900042",
    displayName: "Synthetic audience customer",
  },
});
let browser;
try {
  await prisma.booking.create({
    data: {
      externalId: prefix,
      normalCustomerId: customer.id,
      telephoneNumber: customer.telephoneNumber,
      customerName: customer.displayName,
      bookedAtTime: new Date(),
      rawPayload: { synthetic: true },
    },
  });
  await prisma.customerBehaviourTag.create({
    data: {
      normalCustomerId: customer.id,
      tagId: prefix,
      label: "Synthetic UI audience",
      category: "SYNTHETIC",
      confidence: "HIGH",
      evidenceCount: 1,
      eligibleCount: 1,
      percentage: 100,
      windowStartAt: new Date(Date.now() - 86400000),
      windowEndAt: new Date(),
      explanation: "Synthetic UI verification only",
    },
  });
  browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  await context.route("**/*", (route) =>
    new URL(route.request().url()).origin === origin
      ? route.continue()
      : route.abort(),
  );
  const token = await encode({
    token: {
      email,
      id: user.id,
      sub: user.id,
      role: "ADMIN",
      mustChangePassword: false,
    },
    secret: process.env.NEXTAUTH_SECRET,
  });
  await context.addCookies([
    { name: "next-auth.session-token", value: token, url: origin },
  ]);
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto(origin + "/dashboard/workspace");
  await page.getByRole("heading", { name: "Today", exact: true }).waitFor();
  const setup = page.getByRole("region", { name: "Today setup" });
  await setup.waitFor();
  await page.screenshot({
    path: "/workspace/taxicrm-local/today-wizard.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await setup.getByRole("button", { name: "Daily operations" }).click();
  await setup.getByRole("button", { name: "Continue" }).click();
  await setup.getByRole("checkbox", { name: "Pickups scheduled" }).check();
  await setup.getByRole("button", { name: "Continue" }).click();
  await setup.getByRole("button", { name: "Save my Today view" }).click();
  await page.reload();
  await page.getByRole("heading", { name: "Today", exact: true }).waitFor();
  await page
    .getByRole("region", { name: "Today's business figures" })
    .waitFor();
  assert.equal(
    await setup.count(),
    0,
    "Saved wizard should not reopen on reload",
  );
  assert.ok(
    await page
      .getByRole("region", { name: "Today's business figures" })
      .getByText("Pickups scheduled", { exact: true })
      .count(),
  );
  await page.getByRole("button", { name: "Customize Today" }).click();
  await setup.getByRole("button", { name: "Business overview" }).click();
  await setup.getByRole("button", { name: "Continue" }).click();
  await setup.getByRole("button", { name: "Continue" }).click();
  await setup.getByRole("button", { name: "Save my Today view" }).click();
  const figures = page.getByRole("region", {
    name: "Today's business figures",
  });
  await figures.getByText("Company profit", { exact: true }).waitFor();
  await figures.getByText("Cost data required", { exact: true }).waitFor();
  assert.equal(await figures.locator('[data-comparison="revenue"]').count(), 1);
  assert.ok((await figures.getByText(/Yesterday:/).count()) >= 3);
  const workspace = page.locator("[data-workspace]");
  assert.equal(await workspace.getAttribute("data-theme"), "light");
  assert.equal(
    await workspace.evaluate((el) => getComputedStyle(el).backgroundColor),
    "rgb(247, 246, 242)",
  );
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  assert.equal(await workspace.getAttribute("data-theme"), "dark");
  await page.reload();
  await page.getByRole("button", { name: "Switch to light theme" }).waitFor();
  await page.screenshot({
    path: "/workspace/taxicrm-local/premium-live-dark.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Switch to light theme" }).click();
  await page.screenshot({
    path: "/workspace/taxicrm-local/workspace-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Find a module" }).click();
  await page.getByRole("textbox", { name: "Search modules" }).fill("SMS");
  await page
    .getByRole("list", { name: "Matching modules" })
    .getByRole("link", { name: "SMS & freephone alerts" })
    .waitFor();
  await page.keyboard.press("Escape");
  assert.equal(
    await page.getByRole("textbox", { name: "Search modules" }).count(),
    0,
  );
  await page.keyboard.press("Control+k");
  await page.getByRole("textbox", { name: "Search modules" }).waitFor();
  await page.keyboard.press("Escape");
  await page.goto(origin + "/dashboard/marketing");
  await page
    .getByRole("heading", { name: "Your recorded audiences" })
    .waitFor();
  await page.getByRole("link", { name: /Synthetic UI audience/ }).waitFor();
  await page.screenshot({
    path: "/workspace/taxicrm-local/marketing-desktop.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: /Synthetic UI audience/ }).click();
  await page.getByRole("heading", { name: "Audience segments" }).waitFor();
  await page
    .getByRole("option", { name: /Synthetic UI audience/ })
    .waitFor({ state: "attached" });
  assert.equal(
    await page
      .getByRole("combobox", { name: "Filter customers by behaviour tag" })
      .inputValue(),
    prefix,
  );
  await page
    .getByText("Synthetic audience customer", { exact: true })
    .waitFor();
  await page.goto(origin + "/dashboard/configuration");
  await page
    .getByRole("heading", { name: "Configuration", exact: true })
    .waitFor();
  assert.equal(
    await page
      .locator('a[href="/dashboard/configuration/organizations"]')
      .count(),
    0,
  );
  assert.equal(
    await page
      .locator('a[href="/dashboard/configuration/integrations"]')
      .count(),
    0,
  );
  const operationsRequestTimes = [];
  await page.goto(origin + "/dashboard/integrations/overview");
  await page.getByRole("heading", { name: "Data connections", exact: true }).waitFor();
  await page.getByRole("textbox", { name: "Search connections" }).fill("NeedACabPlus");
  assert.equal(await page.locator(".integration-connection-card").count(), 1);
  await page.getByRole("textbox", { name: "Search connections" }).fill("not-a-synthetic-provider");
  await page.getByRole("heading", { name: "No matching connections" }).waitFor();
  await page.getByRole("button", { name: "Clear filters", exact: true }).click();
  await page.getByLabel("Connection category", { exact: true }).selectOption("Local data");
  assert.equal(await page.locator(".integration-connection-card").count(), 1);
  await page.getByLabel("Connection category", { exact: true }).selectOption("All sources");
  await page.screenshot({ path: "/workspace/taxicrm-local/integrations-enterprise-light.png", fullPage: true });
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await page.screenshot({ path: "/workspace/taxicrm-local/integrations-enterprise-dark.png", fullPage: true });
  await page.getByRole("button", { name: "Switch to light theme" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "/workspace/taxicrm-local/integrations-enterprise-mobile.png", fullPage: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("link", { name: "Open Autocab workspace", exact: true }).click();
  assert.equal(await page.getByRole("navigation", { name: "Autocab workspace" }).getByRole("link", { name: "Webhooks", exact: true }).count(), 0);
  for (const legacyPath of ["/dashboard/configuration/webhooks", "/dashboard/configuration/webhooks/add", "/dashboard/integrations/autocab/webhooks", "/dashboard/integrations/autocab/webhooks/new", "/dashboard/integrations/autocab/webhooks/synthetic-retired-id"]) {
    await page.goto(origin + legacyPath);
    await page.waitForURL(origin + "/dashboard/integrations/needacabplus");
    await page.getByRole("heading", { name: "Webhook administration", exact: true }).waitFor();
    assert.equal(await page.getByRole("button", { name: "Edit source", exact: true }).count(), 0);
    assert.equal(await page.getByRole("link", { name: "Open NeedACabPlus webhooks", exact: false }).getAttribute("href"), "https://admin.needacabplus.app/admin/configuration#webhooks");
  }
  await page.goto(origin + "/dashboard/integrations/autocab");
  if (process.env.BOOKING_WEBHOOK_WRITER === "NAC") {
    for (const [method, path] of [
      ["POST", "/api/dashboard/autocab/webhooks"],
      ["PATCH", "/api/dashboard/autocab/webhooks/synthetic-retired-id"],
      ["DELETE", "/api/dashboard/autocab/webhooks/synthetic-retired-id"],
      ["POST", "/api/dashboard/autocab/providers"],
      ["PATCH", "/api/dashboard/autocab/providers/synthetic-retired-id"],
      ["DELETE", "/api/dashboard/autocab/providers/synthetic-retired-id"],
    ]) {
      const response = await page.request.fetch(origin + path, { method, data: {} });
      assert.equal(response.status(), 403, `Retired administration must reject ${method} ${path}`);
    }
  }
  await page.getByRole("navigation", { name: "Autocab workspace" }).getByRole("link", { name: "API & Sync", exact: true }).click();
  await page.waitForURL(origin + "/dashboard/integrations/autocab/api");
  await page.goto(origin + "/dashboard/integrations/overview");
  await page.getByRole("link", { name: "Plan a new connection" }).click();
  await page.getByRole("heading", { name: "Connection setup", exact: true }).waitFor();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "Enter a company name." }).waitFor();
  await page.getByLabel("Company name").fill("Synthetic connection company");
  await page.getByLabel("Data source").selectOption("AUTOCAB");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel("Storage plan").selectOption("DEDICATED_DATABASE");
  await page.getByRole("button", { name: "Review plan", exact: true }).click();
  await page.getByText("Confirm exclusive booking ownership", { exact: false }).waitFor();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download draft plan" }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const plan = JSON.parse(Buffer.concat(chunks).toString());
  assert.equal(plan.status, "DRAFT");
  assert.equal(plan.preserveExistingConnection, true);
  assert.equal(plan.source, "AUTOCAB");
  assert.equal(plan.storage, "DEDICATED_DATABASE");
  const registryResponse = await page.request.get(origin + "/api/dashboard/integrations/connections");
  assert.equal(registryResponse.status(), 200);
  const registry = await registryResponse.json();
  if (registry.draftStorageEnabled === false) {
    assert.equal(await page.getByRole("button", { name: "Save draft in TaxiCRM", exact: true }).count(), 0);
    const blocked = await page.request.post(origin + "/api/dashboard/integrations/connections", { data: { companyName: "Synthetic blocked", source: "AUTOCAB", storage: "CURRENT_DATABASE", requestId: prefix } });
    assert.equal(blocked.status(), 409);
    assert.equal(await prisma.integrationConnection.count({ where: { createdById: user.id } }), 0);
  } else {
  await page.getByRole("button", { name: "Save draft in TaxiCRM", exact: true }).click();
  await page.getByText("Draft saved in TaxiCRM. The existing connection is unchanged.", { exact: true }).waitFor();
  assert.equal(await prisma.integrationConnection.count({ where: { createdById: user.id } }), 1);
  await page.reload();
  await page.getByRole("region", { name: "Saved connection drafts" }).getByText("Synthetic connection company", { exact: false }).waitFor();
  }
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/dashboard/live-operations")
      operationsRequestTimes.push(Date.now());
  });
  await page.addInitScript(() => {
    const NativeWebSocket = window.WebSocket;
    window.WebSocket = class extends NativeWebSocket {
      constructor(url, protocols) {
        super(url, protocols);
        if (new URL(url).pathname === "/ws/fleet" && !window.__syntheticFleetSocket)
          window.__syntheticFleetSocket = this;
      }
    };
  });
  let fleetMapRequests = 0;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/fleet/live")
      fleetMapRequests++;
  });
  const firstOperationsResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/dashboard/live-operations" &&
      response.status() === 200,
  );
  await page.goto(origin + "/dashboard/live");
  await page.getByText("Drivers on shift", { exact: true }).waitFor();
  await page.getByText("Drivers off shift", { exact: true }).waitFor();
  assert.equal(
    (await (await firstOperationsResponse).json()).refreshAfterSeconds,
    5,
  );
  await page.evaluate(() => {
    for (let i = 0; i < 100; i++)
      window.__syntheticFleetSocket.dispatchEvent(
        new MessageEvent("message", {
          data: JSON.stringify({ type: "fleet.vehicle.updated" }),
        }),
      );
  });
  await page.waitForTimeout(6000);
  assert.ok(
    operationsRequestTimes.length >= 2,
    "The dashboard must keep refreshing",
  );
  assert.ok(
    operationsRequestTimes.length <= 2,
    "GPS bursts must not create extra requests within the five-second window",
  );
  for (let i = 1; i < operationsRequestTimes.length; i++)
    assert.ok(
      operationsRequestTimes[i] - operationsRequestTimes[i - 1] >= 4800,
    );

  assert.equal(
    await page.getByText("Live Fleet Map", { exact: true }).count(),
    1,
  );
  await page.locator("#live-map .leaflet-container").waitFor();
  assert.equal(await page.locator("#live-map").count(), 1);
  assert.ok(fleetMapRequests > 0, "Live operations must load fleet positions for the map");
  await page.goto(origin + "/dashboard/operations");
  await page
    .getByRole("heading", { name: "Operations", exact: true })
    .waitFor();
  await page.goto(origin + "/dashboard/marketing/opportunities");
  await page.getByRole("heading", { name: "Customer opportunities" }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(origin + "/dashboard/workspace");
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("dialog", { name: "Workspace navigation" }).waitFor();
  await page.screenshot({
    path: "/workspace/taxicrm-local/workspace-mobile.png",
    fullPage: false,
  });
  await page.keyboard.press("Escape");
  assert.equal(
    await page.getByRole("dialog", { name: "Workspace navigation" }).count(),
    0,
  );
  assert.ok(
    await page
      .getByRole("button", { name: "Open navigation" })
      .evaluate((element) => element === document.activeElement),
  );
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  );
  await prisma.user.update({
    where: { id: user.id },
    data: { role: "OPERATOR" },
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(origin + "/dashboard/workspace");
  assert.equal(
    await page
      .getByRole("button", { name: "Configuration", exact: true })
      .count(),
    0,
  );
  await page.goto(origin + "/dashboard/configuration");
  await page.waitForURL(origin + "/dashboard");
  await page.goto(origin + "/dashboard/integrations/setup");
  await page.waitForURL(origin + "/dashboard");
  assert.equal((await page.request.get(origin + "/api/dashboard/integrations/connections")).status(), 403);
  assert.equal((await page.request.post(origin + "/api/dashboard/integrations/connections", { data: {} })).status(), 403);
  await context.clearCookies();
  await page.goto(origin + "/dashboard/marketing");
  await page.waitForURL(/\/login/);
  assert.deepEqual(pageErrors, []);
  console.log(
    "PASS: synthetic authenticated workspace, role-aware modules, working search, marketing tags/counts, segment filter, configuration links, opportunities, responsive drawer/focus, operator restriction and login redirect. No external calls or SMS.",
  );
} finally {
  await browser?.close();
  await prisma.booking.deleteMany({ where: { externalId: prefix } });
  await prisma.normalCustomer.delete({ where: { id: customer.id } });
  await prisma.user.delete({ where: { id: user.id } });
  await prisma.integrationConnection.deleteMany({ where: { createdById: user.id } });
  await prisma.$disconnect();
}
