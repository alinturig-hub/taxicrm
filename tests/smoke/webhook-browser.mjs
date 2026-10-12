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
    .getByLabel("Description", { exact: true })
    .fill("Synthetic edited description");
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
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    true,
  );
  console.log(
    "Webhook browser passed: search, disabled state, URL copy, refresh and mobile overflow.",
  );
} finally {
  await browser?.close();
  await prisma.webhookEvent.deleteMany({ where: { idempotencyKey: prefix } });
  await prisma.autocabWebhookConfiguration.deleteMany({
    where: { endpointSlug: prefix },
  });
  await prisma.user.delete({ where: { id: user.id } });
  await prisma.$disconnect();
}
