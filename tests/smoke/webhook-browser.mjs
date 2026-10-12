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
const prefix = `webhook-ui-synthetic-${randomUUID()}`;
const name = prefix + " Hospital Freephone";
const phone = "07700900046";
const email = prefix + "@example.test";
const user = await prisma.user.create({
  data: {
    email,
    name: "Synthetic Freephone Admin",
    passwordHash: "synthetic-unusable-password",
    role: "ADMIN",
  },
});
let browser;
try {
  const config = await prisma.autocabWebhookConfiguration.create({
    data: {
      displayName: name,
      eventType: prefix,
      endpointSlug: prefix,
      isEnabled: false,
    },
  });
  browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    permissions: ["clipboard-read", "clipboard-write"],
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
  const openedAt = Date.now();
  const direct = await page.goto(
    origin + `/dashboard/integrations/autocab/webhooks/${config.id}`,
  );
  assert.equal(direct.status(), 200);
  await page
    .getByRole("heading", { name: "Edit webhook", exact: true })
    .waitFor();
  console.log(
    `Synthetic direct webhook page loaded in ${Date.now() - openedAt}ms (local environment only).`,
  );
  await page
    .getByLabel(/^Description/)
    .fill("Synthetic direct editor description");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "Webhook configuration saved." })
    .waitFor();
  assert.equal(
    (
      await prisma.autocabWebhookConfiguration.findUniqueOrThrow({
        where: { id: config.id },
      })
    ).description,
    "Synthetic direct editor description",
  );
  await prisma.user.update({
    where: { id: user.id },
    data: { role: "MANAGER" },
  });
  await page.reload();
  await page
    .getByText(
      "Read-only: configuration.manage permission is required to edit.",
    )
    .waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Save changes", exact: true })
      .count(),
    0,
  );
  assert.equal(
    (
      await context.request.patch(
        origin + `/api/dashboard/autocab/webhooks/${config.id}`,
        { data: { displayName: name, description: "denied", isEnabled: true } },
      )
    ).status(),
    403,
  );
  await prisma.user.update({ where: { id: user.id }, data: { role: "ADMIN" } });
  const missing = await page.goto(
    origin + "/dashboard/integrations/autocab/webhooks/synthetic-missing-id",
  );
  // Next.js streaming can send 200 before the notFound boundary resolves.
  assert.ok([200, 404].includes(missing.status()));
  await page.getByText("This page could not be found.").waitFor();
  await page.goto(origin + "/dashboard/configuration/webhooks");
  await page.getByRole("heading", { name: "Webhook providers" }).waitFor();
  await page.getByLabel("Search webhook events").fill(name);
  assert.equal(await page.locator("article").count(), 1);
  assert.match(await page.locator("article").innerText(), /Disabled/);
  await page.getByRole("button", { name: `Copy ${name} URL` }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "Webhook URL copied" })
    .waitFor();
  assert.equal(
    await page.evaluate(() => navigator.clipboard.readText()),
    `https://taxicrm.plymhub.ai/api/webhooks/autocab/${prefix}`,
  );
  await page.getByLabel("Search webhook events").fill("unmatched-synthetic");
  await page.getByText("No events match your search.").waitFor();
  await page.getByLabel("Search webhook events").fill(name);
  await prisma.autocabWebhookConfiguration.update({
    where: { id: config.id },
    data: { isEnabled: true },
  });
  await page.getByRole("button", { name: "↻ Refresh", exact: true }).click();
  await page
    .locator("article")
    .getByText(/Enabled/)
    .waitFor();
  await page.waitForLoadState("networkidle");
  const anonymous = await browser.newContext();
  assert.equal(
    (
      await anonymous.request.patch(
        origin + `/api/dashboard/autocab/webhooks/${config.id}`,
        { data: { displayName: name, description: null, isEnabled: false } },
      )
    ).status(),
    403,
  );
  await anonymous.close();
  await page.getByRole("button", { name: `Edit ${name}`, exact: true }).click();
  await page
    .getByRole("heading", { name: "Edit event URL", exact: true })
    .waitFor();
  await page.getByLabel(/^Description/).fill("Synthetic edited description");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "Event URL saved." })
    .waitFor();
  assert.equal(
    (
      await prisma.autocabWebhookConfiguration.findUniqueOrThrow({
        where: { id: config.id },
      })
    ).description,
    "Synthetic edited description",
  );
  await prisma.webhookEvent.create({
    data: {
      idempotencyKey: prefix,
      payload: { synthetic: true },
      eventType: prefix,
      webhookConfigurationId: config.id,
    },
  });
  page.once("dialog", (dialog) => dialog.dismiss());
  await page
    .getByRole("button", { name: `Delete ${name}`, exact: true })
    .click();
  assert.ok(
    await prisma.autocabWebhookConfiguration.findUnique({
      where: { id: config.id },
    }),
  );
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: `Delete ${name}`, exact: true })
    .click();
  await page
    .getByRole("status")
    .filter({ hasText: "Event URL deleted." })
    .waitFor();
  assert.equal(
    (
      await prisma.webhookEvent.findUniqueOrThrow({
        where: { idempotencyKey: prefix },
      })
    ).webhookConfigurationId,
    null,
  );
  await page
    .getByRole("button", { name: "+ Add provider", exact: true })
    .click();
  await page.getByLabel("Provider name", { exact: true }).fill(prefix);
  await page
    .getByLabel("Source description", { exact: true })
    .fill("Synthetic provider");
  await page
    .getByLabel("API key header", { exact: true })
    .fill("x-synthetic-key");
  await page
    .locator("input[type=password]")
    .fill("synthetic-provider-secret-123456");
  await page.getByRole("button", { name: "Save source", exact: true }).click();
  const sourceButton = page
    .getByRole("button")
    .filter({ has: page.getByRole("heading", { name: prefix, exact: true }) });
  await sourceButton.waitFor();
  await sourceButton.click();
  const provider = await prisma.webhookProvider.findFirstOrThrow({
    where: { name: prefix },
  });
  assert.notEqual(provider.apiKeyEncrypted, "synthetic-provider-secret-123456");
  const catalogue = await context.request.get(
    origin + "/api/dashboard/autocab/providers",
  );
  const catalogueText = await catalogue.text();
  assert.equal(catalogue.status(), 200);
  assert.equal(catalogueText.includes(provider.apiKeyEncrypted), false);
  assert.equal(
    catalogueText.includes("synthetic-provider-secret-123456"),
    false,
  );
  const created = await context.request.post(
    origin + "/api/dashboard/autocab/webhooks",
    {
      data: {
        providerId: provider.id,
        displayName: name,
        eventType: prefix,
        endpointSlug: prefix,
        isEnabled: true,
      },
    },
  );
  assert.equal(created.status(), 201);
  const receiver = origin + `/api/webhooks/autocab/${prefix}`;
  assert.equal(
    (
      await context.request.post(receiver, {
        data: { EventType: "SyntheticUnknown", synthetic: true },
      })
    ).status(),
    503,
  );
  await page.getByRole("button", { name: "Edit source", exact: true }).click();
  assert.equal(
    await page.getByLabel("Provider name", { exact: true }).inputValue(),
    prefix,
  );
  await page.getByLabel("Enable source", { exact: true }).check();
  const savedSource = page.waitForResponse(
    (response) =>
      response.request().method() === "PATCH" &&
      response.url() ===
        origin + `/api/dashboard/autocab/providers/${provider.id}`,
  );
  await page.getByRole("button", { name: "Save source", exact: true }).click();
  const savedResponse = await savedSource;
  assert.equal(savedResponse.status(), 200);
  assert.equal((await savedResponse.json()).isEnabled, true);
  await page
    .getByRole("button", { name: "Save source", exact: true })
    .waitFor({ state: "hidden" });
  const rejected = await context.request.post(receiver, {
    data: { EventType: "SyntheticUnknown", synthetic: true },
  });
  assert.equal(rejected.status(), 401, await rejected.text());
  const received = await context.request.post(receiver, {
    headers: { "x-synthetic-key": "synthetic-provider-secret-123456" },
    data: { EventType: "SyntheticUnknown", synthetic: true },
  });
  assert.equal(received.status(), 202);
  const eventId = (await received.json()).webhook.id;
  const raw = await prisma.webhookEvent.findUniqueOrThrow({
    where: { id: eventId },
  });
  assert.equal(raw.headers["x-synthetic-key"], undefined);
  const preserved = await prisma.webhookProvider.findUniqueOrThrow({
    where: { id: provider.id },
  });
  assert.equal(preserved.apiKeyEncrypted, provider.apiKeyEncrypted);
  assert.equal(
    (
      await context.request.delete(
        origin + `/api/dashboard/autocab/providers/${provider.id}`,
      )
    ).status(),
    409,
  );
  await prisma.webhookEvent.delete({ where: { id: eventId } });
  await prisma.autocabWebhookConfiguration.deleteMany({
    where: { providerId: provider.id },
  });
  assert.equal(
    (
      await context.request.delete(
        origin + `/api/dashboard/autocab/providers/${provider.id}`,
      )
    ).status(),
    200,
  );
  assert.equal(
    (
      await context.request.delete(
        origin + "/api/dashboard/autocab/providers/autocab",
      )
    ).status(),
    409,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    true,
  );
  console.log(
    "Webhook browser passed: search, copy, refresh, event edit/delete preservation, provider create/edit/delete, encrypted keys, authentication, source disablement, header redaction and mobile overflow.",
  );
} finally {
  await browser?.close();
  await prisma.webhookEvent.deleteMany({ where: { idempotencyKey: prefix } });
  await prisma.autocabWebhookConfiguration.deleteMany({
    where: { endpointSlug: prefix },
  });
  await prisma.webhookProvider.deleteMany({ where: { name: prefix } });
  await prisma.user.delete({ where: { id: user.id } });
  await prisma.$disconnect();
}
