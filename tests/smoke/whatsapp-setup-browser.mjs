import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { encode } from "next-auth/jwt";
import { prisma } from "../../src/lib/prisma.ts";

const { chromium } = createRequire(import.meta.url)("playwright");
assert.equal(process.env.DATABASE_URL, "postgresql://analytics_test@127.0.0.1:55438/analytics_synthetic");
assert.equal(process.env.TAXICRM_SYNTHETIC_TESTS, "1");

const origin = "http://127.0.0.1:3001";
const prefix = `whatsapp-setup-${randomUUID()}`;
const users = [];
let browser;

async function token(user) {
  return encode({
    secret: process.env.NEXTAUTH_SECRET,
    token: { id: user.id, sub: user.id, email: user.email, name: user.name, role: user.role, mustChangePassword: false },
    maxAge: 3600,
  });
}

try {
  for (const role of ["ADMIN", "OPERATOR"]) {
    users.push(await prisma.user.create({
      data: {
        email: `${prefix}-${role.toLowerCase()}@example.test`,
        name: `Synthetic WhatsApp ${role}`,
        role,
        passwordHash: "synthetic-unusable",
      },
    }));
  }

  const admin = await token(users[0]);
  const operator = await token(users[1]);
  const endpoint = `${origin}/api/dashboard/configuration/whatsapp`;
  assert.equal((await fetch(endpoint)).status, 401);
  assert.equal((await fetch(endpoint, { headers: { cookie: `next-auth.session-token=${operator}` } })).status, 403);

  browser = await chromium.launch({ executablePath: "/usr/bin/chromium", headless: true, args: ["--no-sandbox"] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "en-GB" });
  await context.addCookies([{ name: "next-auth.session-token", value: admin, url: origin }]);
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.route("**/*", route => route.request().url().startsWith(origin) ? route.continue() : route.abort());

  await page.goto(`${origin}/dashboard/configuration/whatsapp`);
  await page.getByRole("heading", { name: "Meta WhatsApp templates", exact: true }).waitFor();
  await page.getByText("Configured securely · hidden", { exact: true }).waitFor();
  assert.equal(await page.getByText(process.env.META_WHATSAPP_ACCESS_TOKEN, { exact: false }).count(), 0);
  assert.equal(await page.getByRole("button", { name: "List templates from Meta" }).isDisabled(), false);

  await page.getByLabel("Template name").fill("booking_confirmation");
  await page.getByLabel("Message body").fill("Hello {{1}}, your booking {{2}} is confirmed.");
  await page.getByLabel("Variable samples · one per line").fill("Synthetic customer\nSYNTHETIC-123");
  await page.getByRole("button", { name: "Validate & preview locally" }).click();
  await page.getByRole("heading", { name: "Local preview", exact: true }).waitFor();
  await page.getByText("Hello Synthetic customer, your booking SYNTHETIC-123 is confirmed.", { exact: true }).waitFor();
  await page.getByText("Nothing has been saved or submitted to Meta.", { exact: false }).waitFor();

  await page.getByLabel("Message body").fill("Hello {{2}}.");
  await page.getByRole("button", { name: "Validate & preview locally" }).click();
  await page.locator("p[role=alert]").getByText("Use consecutive variables", { exact: false }).waitFor();
  assert.equal(await page.getByRole("heading", { name: "Local preview", exact: true }).count(), 0);

  await page.getByLabel("Message body").fill("Synthetic body without variables.");
  await page.getByLabel("Variable samples · one per line").fill("");
  await page.getByRole("button", { name: "Validate & preview locally" }).click();
  await page.getByText("Synthetic body without variables.", { exact: true }).waitFor();
  await page.screenshot({ path: "/workspace/taxicrm-local/whatsapp-setup-desktop.png", fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "/workspace/taxicrm-local/whatsapp-setup-mobile.png", fullPage: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "WhatsApp setup overflows on mobile");
  assert.deepEqual(pageErrors, []);

  console.log("PASS: WhatsApp setup permissions, redacted server token, local validation/preview, invalid-variable handling and responsive UI.");
} finally {
  await browser?.close();
  await prisma.user.deleteMany({ where: { id: { in: users.map(user => user.id) } } });
  await prisma.$disconnect();
}
