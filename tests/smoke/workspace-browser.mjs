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
  await prisma.$disconnect();
}
