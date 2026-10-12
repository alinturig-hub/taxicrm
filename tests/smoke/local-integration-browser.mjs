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
const prefix = `local-ui-synthetic-${randomUUID()}`;
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
  await page.goto(origin + "/dashboard/integrations/overview");
  await page
    .getByRole("link", { name: /Local integration.*Local data imports/ })
    .click();
  await page
    .getByRole("heading", { name: "Local integration", exact: true })
    .waitFor();
  await page.getByLabel("Dataset name", { exact: true }).fill(prefix);
  const payload = [
    { id: "synthetic-1", place: "Synthetic North" },
    { id: "synthetic-2", place: "Synthetic South" },
  ];
  await page
    .getByLabel("JSON file", { exact: true })
    .setInputFiles({
      name: "synthetic.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(payload)),
    });
  await page
    .getByRole("button", { name: "Preview local data", exact: true })
    .click();
  await page.getByText("2 records ready to save. First 5 shown.").waitFor();
  assert.equal(
    await prisma.apiEndpointConfiguration.count({
      where: { provider: "LOCAL", name: prefix },
    }),
    0,
  );
  await page
    .getByRole("button", { name: "Save local data", exact: true })
    .click();
  await page
    .getByRole("status")
    .filter({ hasText: "2 local records saved." })
    .waitFor();
  const dataset = await prisma.apiEndpointConfiguration.findFirstOrThrow({
    where: { provider: "LOCAL", name: prefix },
  });
  await page.getByRole("link").filter({ hasText: prefix }).click();
  await page.getByRole("heading", { name: prefix, exact: true }).waitFor();
  assert.match(
    await page.locator("pre").first().innerText(),
    /Synthetic North/,
  );
  const list = await context.request.get(
    origin + "/api/dashboard/configuration/api-endpoints",
  );
  assert.equal(list.status(), 200);
  assert.equal(
    (await list.json()).endpoints.some(
      (endpoint) => endpoint.id === dataset.id,
    ),
    false,
  );
  await prisma.user.update({
    where: { id: user.id },
    data: { role: "MANAGER" },
  });
  await page.goto(origin + "/dashboard/integrations/local");
  await page
    .getByRole("heading", { name: "Local integration", exact: true })
    .waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Preview local data", exact: true })
      .count(),
    0,
  );
  assert.equal(
    (
      await context.request.post(origin + "/api/dashboard/integrations/local", {
        data: { action: "preview", name: prefix, recordKey: "id", payload },
      })
    ).status(),
    403,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    true,
  );
  console.log(
    "Local integration browser passed: hub, file preview, save, inspect, provider separation, restricted writes and mobile.",
  );
} finally {
  await browser?.close();
  await prisma.apiEndpointConfiguration.deleteMany({
    where: { provider: "LOCAL", name: prefix },
  });
  await prisma.administrationAuditEvent.deleteMany({
    where: { actorUserId: user.id },
  });
  await prisma.user.delete({ where: { id: user.id } });
  await prisma.$disconnect();
}
