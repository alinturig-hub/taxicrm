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
const prefix = `english-ui-synthetic-${randomUUID()}`;
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
  const page = await context.newPage();
  await page.goto(origin + "/login");
  await page.getByText("Sign in to access TaxiCRM.").waitFor();
  await page
    .getByLabel("Email", { exact: true })
    .fill(prefix + "-missing@example.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("synthetic-wrong-password");
  assert.equal(
    await page
      .getByLabel("Password", { exact: true })
      .getAttribute("placeholder"),
    "Enter your password",
  );
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByText("Incorrect email or password.").waitFor();
  assert.equal(await page.locator("html").getAttribute("lang"), "en");
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
  await page.goto(origin + "/dashboard/integrations/autocab/webhooks/new");
  await page.getByText("Copy this URL into the Autocab portal.").waitFor();
  for (const path of [
    "/dashboard/integrations/autocab/webhooks",
    "/dashboard/integrations/autocab",
    "/refusal-map/synthetic-missing-booking",
    "/refusal-map/driver/synthetic-missing-driver",
  ]) {
    await page.goto(origin + path);
    assert.equal(
      /[ăâîșțĂÂÎȘȚ]/.test(await page.locator("body").innerText()),
      false,
      path,
    );
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await context.clearCookies();
  await page.goto(origin + "/login");
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  console.log(
    "English UI browser passed: login labels, invalid credentials, Autocab/webhook pages, empty refusal pages and mobile login.",
  );
} finally {
  await browser?.close();
  await prisma.user.delete({ where: { id: user.id } });
  await prisma.$disconnect();
}
