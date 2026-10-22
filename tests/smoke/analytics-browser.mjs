import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { encode } from "next-auth/jwt";
import { prisma } from "../../src/lib/prisma.ts";
import { dayKey, cardLabels } from "../../src/lib/analytics/explorer/model.ts";
import {
  addLondonDays,
  startOfLondonDay,
} from "../../src/lib/time/london-calendar.ts";
const { chromium } = createRequire(import.meta.url)("playwright");
assert.equal(
  process.env.DATABASE_URL,
  "postgresql://analytics_test@127.0.0.1:55438/analytics_synthetic",
);
assert.equal(process.env.TAXICRM_SYNTHETIC_TESTS, "1");
const origin = "http://127.0.0.1:3001",
  prefix = "analytics-ui-" + randomUUID(),
  provider = prefix;
let browser;
const users = [];
async function cookie(user) {
  return encode({
    secret: process.env.NEXTAUTH_SECRET,
    token: {
      id: user.id,
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      mustChangePassword: false,
    },
    maxAge: 3600,
  });
}
try {
  const admin = await prisma.user.create({
    data: {
      email: prefix + "@example.test",
      name: "Synthetic Analytics Owner",
      role: "ADMIN",
      passwordHash: "synthetic-unusable",
    },
  });
  users.push(admin);
  const operator = await prisma.user.create({
    data: {
      email: prefix + "-operator@example.test",
      name: "Synthetic Operator",
      role: "OPERATOR",
      passwordHash: "synthetic-unusable",
    },
  });
  users.push(operator);
  await prisma.zone.create({
    data: {
      provider,
      externalId: "WEST",
      companyId: 1,
      name: "Synthetic West",
      latitude: 50.38,
      longitude: -4.14,
    },
  });
  await prisma.zone.create({
    data: {
      provider,
      externalId: "EAST",
      companyId: 1,
      name: "Synthetic East",
      latitude: 50.39,
      longitude: -4.1,
    },
  });
  const driver = await prisma.driver.create({
    data: { provider, externalId: "DX", badgeNumber: "TEST-42" },
  });
  const now = Date.now();
  for (const [i, status, paymentType, price, cost, ago] of [
    [0, "COMPLETED", "Cash", 17.1, 19, 30],
    [1, "COMPLETED", "Account", 50, 45, 30],
    [2, "COMPLETED", "Card", 10, 9, 30],
    [3, "CANCELLED", "Cash", 300, 200, 30],
    [4, "NO_FARE", "Account", 100, 90, 30],
    [5, "COMPLETED", "Cash", 2, 1, 120],
  ]) {
    const at = new Date(now - ago * 60000);
    await prisma.booking.create({
      data: {
        provider,
        externalId: String(i),
        status,
        paymentType,
        price,
        cost,
        driverId: driver.id,
        pickupDueTime: at,
        bookedAtTime: new Date(at.getTime() - 8 * 3600000),
        rawPayload: { synthetic: true },
        locations: {
          create: {
            type: "PICKUP",
            zoneId: i === 4 ? "EAST" : "WEST",
            address: "Synthetic address",
          },
        },
      },
    });
  }
  await prisma.driverRentConfiguration.create({
    data: { key: "GLOBAL", rentPercentage: 20, weeklyCap: 160 },
  });
  const before = await prisma.booking.findMany({
    where: { provider },
    orderBy: { externalId: "asc" },
  });
  assert.equal((await fetch(origin + "/api/dashboard/analytics")).status, 401);
  const opToken = await cookie(operator);
  assert.equal(
    (
      await fetch(origin + "/api/dashboard/analytics", {
        headers: { cookie: "next-auth.session-token=" + opToken },
      })
    ).status,
    403,
  );
  const token = await cookie(admin);
  assert.equal(
    (
      await fetch(
        origin +
          "/api/dashboard/analytics?preset=custom&from=2026-02-30&to=2026-03-01",
        { headers: { cookie: "next-auth.session-token=" + token } },
      )
    ).status,
    400,
  );
  browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    locale: "en-GB",
    timezoneId: "Europe/London",
  });
  await context.addCookies([
    { name: "next-auth.session-token", value: token, url: origin },
  ]);
  await context.route("**/*", (route) =>
    new URL(route.request().url()).hostname === "127.0.0.1"
      ? route.continue()
      : route.abort(),
  );
  const page = await context.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.stack || e.message));
  await page.goto(origin + "/dashboard/analytics?preset=last-6-hours", {
    waitUntil: "networkidle",
  });
  await page
    .getByRole("article", { name: "Total bookings", exact: true })
    .getByText("6", { exact: true })
    .waitFor();
  assert.match(
    await page
      .getByRole("article", { name: "Total income · gross", exact: true })
      .innerText(),
    /£79\.10/,
  );
  assert.match(
    await page
      .getByRole("article", {
        name: "Company margin · Price − Cost",
        exact: true,
      })
      .innerText(),
    /£5\.10/,
  );
  await page
    .getByRole("button", { name: "Customize cards", exact: true })
    .click();
  await page
    .getByRole("checkbox", { name: "Most cash area", exact: true })
    .check();
  await page
    .getByRole("article", { name: "Most cash area", exact: true })
    .getByText("Synthetic West", { exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Move Most cash area up", exact: true })
    .click();
  await page
    .getByRole("checkbox", { name: "Completed bookings", exact: true })
    .uncheck();
  const savedCards = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)).cards,
    "taxicrm-analytics-v1:" + admin.id,
  );
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(
    await page
      .getByRole("article", { name: "Completed bookings", exact: true })
      .count(),
    0,
  );
  await page
    .getByRole("article", { name: "Total bookings", exact: true })
    .getByText("6", { exact: true })
    .waitFor();
  assert.deepEqual(
    await page
      .getByRole("article")
      .evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute("aria-label")),
      ),
    savedCards.map((key) => cardLabels[key]),
  );
  await page.getByLabel("Payment filter").selectOption("CASH");
  await page
    .getByRole("article", { name: "Total bookings", exact: true })
    .getByText("3", { exact: true })
    .waitFor();
  assert.match(
    await page
      .getByRole("article", { name: "Total income · gross", exact: true })
      .innerText(),
    /£19\.10/,
  );
  await page.getByRole("button", { name: "Last hour", exact: true }).click();
  await page
    .getByRole("article", { name: "Total bookings", exact: true })
    .getByText("2", { exact: true })
    .waitFor();
  await page.getByLabel("Payment filter").selectOption("ALL");
  await page
    .getByRole("article", { name: "Total bookings", exact: true })
    .getByText("5", { exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Custom dates", exact: true }).click();
  const day = dayKey(new Date()),
    start = dayKey(addLondonDays(startOfLondonDay(new Date()), -6));
  await page.getByLabel("From date").fill(start);
  await page.getByLabel("To date").fill(day);
  await page
    .getByRole("img", { name: "Bookings by weekday", exact: true })
    .waitFor();
  await page
    .getByRole("article", { name: "Total bookings", exact: true })
    .getByText("6", { exact: true })
    .waitFor();
  await page.getByRole("region", { name: "Executive overview", exact: true }).waitFor();
  const quality = page.locator("details").filter({ has: page.getByText("Data quality & definitions", { exact: true }) });
  assert.equal(await quality.getAttribute("open"), null);
  await quality.locator("summary").click();
  await page.getByRole("region", { name: "Data confidence", exact: true }).waitFor();
  await quality.locator("summary").click();
  await page.getByRole("region", { name: "Business focus", exact: true }).waitFor();
  await page.getByLabel("Rank areas by").selectOption("noFare");
  await page.getByRole("region", { name: "Area performance scorecard", exact: true }).waitFor();
  await page.screenshot({
    path: "/workspace/taxicrm-local/analytics-desktop.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Switch to dark theme", exact: true })
    .click();
  await page.screenshot({
    path: "/workspace/taxicrm-local/analytics-dark.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "/workspace/taxicrm-local/analytics-mobile.png",
    fullPage: true,
  });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 2,
    ),
    "mobile page overflows viewport",
  );
  await page.route("**/api/dashboard/analytics?**", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Synthetic report unavailable" }),
    }),
  );
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await page
    .getByRole("alert")
    .filter({ hasText: "Synthetic report unavailable" })
    .waitFor();
  assert.equal(
    await page
      .getByRole("article", { name: "Total bookings", exact: true })
      .count(),
    0,
    "stale cards must not appear under new filters/error",
  );
  await page.unroute("**/api/dashboard/analytics?**");
  await page.getByLabel("From date").fill("2050-01-01");
  await page.getByLabel("To date").fill("2050-01-02");
  await page
    .getByText("No bookings match this selection.", { exact: true })
    .waitFor();
  assert.equal(errors.length, 0, errors.join("\n"));
  assert.deepEqual(
    await prisma.booking.findMany({
      where: { provider },
      orderBy: { externalId: "asc" },
    }),
    before,
  );
  console.log(
    "Analytics browser: filters, amounts, rankings, preferences, 7-day chart, mobile, empty/error states and access checks passed.",
  );
} finally {
  if (browser) await browser.close();
  await prisma.webhookEvent.deleteMany({ where: { provider } });
  await prisma.booking.deleteMany({ where: { provider } });
  await prisma.driver.deleteMany({ where: { provider } });
  await prisma.zone.deleteMany({ where: { provider } });
  await prisma.driverRentConfiguration.deleteMany({ where: { key: "GLOBAL" } });
  await prisma.user.deleteMany({
    where: { id: { in: users.map((u) => u.id) } },
  });
  await prisma.$disconnect();
}
