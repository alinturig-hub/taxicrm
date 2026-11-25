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
const prefix = `freephone-ui-synthetic-${randomUUID()}`;
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
  await prisma.booking.create({
    data: {
      externalId: prefix,
      rawPayload: {
        BookedAtTime: new Date().toISOString(),
        TelephoneNumber: "+447700900046",
        synthetic: true,
      },
    },
  });
  await prisma.booking.create({
    data: {
      externalId: prefix + "-unassigned",
      bookedAtTime: new Date(),
      rawPayload: { synthetic: true },
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
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(origin + "/dashboard/operations/notifications");
  await page.getByLabel("Location Name", { exact: true }).fill(name);
  await page.getByLabel("Phone Number", { exact: true }).fill(phone);
  await page.getByRole("button", { name: "Add line", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Line added with notifications disabled" }).waitFor();
  let job = await prisma.notificationJob.findFirstOrThrow({ where: { name } });
  assert.equal(job.isEnabled, false);
  assert.equal(job.defaultRecipient, "");
  await page.reload();
  await page.getByText(name, { exact: false }).waitFor();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByRole("button", { name: "Preview current count" }).click();
  await page.getByText("Booking evidence ready", { exact: true }).waitFor();
  await page
    .getByText("Original payload timestamps used: 1", { exact: true })
    .waitFor();
  await page.getByText(/Feed warning: 1 other feed bookings/).waitFor();
  await page
    .getByLabel("General recipient", { exact: true })
    .fill("+447700900000");
  await page
    .locator("summary")
    .filter({ hasText: "Freephone inactivity alert" })
    .click();
  await page.getByLabel("Enable event", { exact: true }).check();
  await page
    .getByLabel("I verified that this field and value identify this freephone")
    .check();
  await page.getByLabel("Enable this workflow", { exact: true }).check();
  await page
    .getByRole("button", { name: "Save workflow", exact: true })
    .click();
  await page
    .getByRole("status")
    .filter({ hasText: "Workflow saved" })
    .waitFor();
  job = await prisma.notificationJob.findUniqueOrThrow({
    where: { id: job.id },
  });
  assert.equal(job.isEnabled, true);
  assert.equal(job.defaultRecipient, "+447700900000");
  assert.ok(
    job.nextRunAt.getTime() > Date.now() + 43100000 &&
      job.nextRunAt.getTime() < Date.now() + 43300000,
  );
  assert.equal(
    await prisma.notificationJobRun.count({ where: { jobId: job.id } }),
    0,
  );
  assert.equal(
    (await prisma.booking.findFirstOrThrow({ where: { externalId: prefix } }))
      .bookedAtTime,
    null,
  );
  const toggle = page.getByRole("checkbox", { name: `Notifications for ${name}` });
  await toggle.click();
  await page.getByRole("status").filter({ hasText: "Notifications disabled." }).waitFor();
  assert.equal(await toggle.isChecked(), false);
  await toggle.click();
  await page.getByRole("status").filter({ hasText: "Notifications enabled." }).waitFor();
  assert.equal((await prisma.notificationJob.findUniqueOrThrow({ where: { id: job.id } })).defaultRecipient, "+447700900000");
  assert.equal(await toggle.isChecked(), true);
  await page.getByLabel("Import CSV").setInputFiles({
    name: "freephone.csv", mimeType: "text/csv",
    buffer: Buffer.from(`Location Name,Phone Number
${prefix} Annex,07700900049
Repeat,+447700900046
Invalid,bad`),
  });
  const importPreview = page.getByRole("list", { name: "CSV import preview" });
  await importPreview.getByText(/Annex.*Ready/).waitFor();
  await importPreview.getByText(/Repeat.*Duplicate/).waitFor();
  await importPreview.getByText(/Invalid location or number/).waitFor();
  await page.getByRole("button", { name: "Import valid lines" }).click();
  await page.getByRole("status").filter({ hasText: "1 lines added" }).waitFor();
  assert.equal((await prisma.notificationJob.findFirstOrThrow({ where: { name: `${prefix} Annex` } })).isEnabled, false);
  await page.goto(origin + "/dashboard/ai/copilot");
  const chat = page.getByRole("textbox", { name: "Message TaxiCRM Agent" });
  await chat.fill(`How many bookings from ${prefix} Freephone did we have this week?`);
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await page.getByRole("button", { name, exact: true }).click();
  await page.getByRole("heading", { name: `1 booking from ${name}`, exact: true }).waitFor();
  await chat.fill("și câte no-show am avut azi?");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await page.getByRole("heading", { name: `0 no-shows from ${name}`, exact: true }).waitFor();
  await page.getByRole("button", { name: "Yesterday", exact: true }).click();
  await page.getByRole("heading", { name: `0 no-shows from ${name}`, exact: true }).nth(1).waitFor();
  assert.deepEqual(errors, []);
  console.log(
    "PASS: persisted disabled freephone draft, manual recipient, read-only canonical evidence preview, explicit source/event activation, 12-hour grace and unchanged booking data. No messages queued or external calls.",
  );
} finally {
  await browser?.close();
  const jobs = await prisma.notificationJob.findMany({
    where: { name: { startsWith: prefix } },
    select: { id: true },
  });
  const ids = jobs.map((j) => j.id);
  await prisma.notificationDelivery.deleteMany({
    where: { jobRun: { jobId: { in: ids } } },
  });
  await prisma.notificationJobRun.deleteMany({ where: { jobId: { in: ids } } });
  await prisma.notificationJob.deleteMany({ where: { id: { in: ids } } });
  await prisma.booking.deleteMany({
    where: { externalId: { startsWith: prefix } },
  });
  await prisma.user.delete({ where: { id: user.id } });
  await prisma.$disconnect();
}
