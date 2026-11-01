import { test } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@/lib/prisma";
import { parseRange } from "@/lib/analytics/explorer/model";
import { getContribution } from "@/lib/analytics/contribution/query";
assert.equal(process.env.DATABASE_URL, "postgresql://analytics_test@127.0.0.1:55438/analytics_synthetic");
test("SQL contribution separates providers/accounts/contacts, preserves money, applies London/payment scope without writes", async () => {
  const customer = await prisma.normalCustomer.create({ data: { displayName: "Synthetic contribution contact", normalizedTelephone: "SYNTHETIC-CONTRIBUTION", telephoneNumber: "SYNTHETIC-CONTRIBUTION" } });
  const providers = ["SYNTHETIC_CONTRIBUTION_A", "SYNTHETIC_CONTRIBUTION_B"];
  try {
    const make = (externalId: string, data: Record<string, unknown> = {}) => prisma.booking.create({ data: { provider: providers[0], externalId, status: "COMPLETED", price: 50, cost: 45, normalCustomerId: customer.id, paymentType: "Cash", pickupDueTime: new Date("2059-10-26T12:00:00Z"), rawPayload: { synthetic: true }, ...data } });
    await make("account", { accountId: "SAME", accountName: "Synthetic account name", paymentType: "Account" });
    await make("other-account", { provider: providers[1], accountId: "SAME", accountName: "Synthetic account name", paymentType: "Account" });
    await make("customer", { price: 17.1, cost: 19 });
    await make("cancelled", { status: "CANCELLED", price: 999 });
    await make("missing", { price: null, cost: 2, paymentType: "Card" });
    await make("unknown", { normalCustomerId: null, price: 0, cost: 0 });
    await make("outside", { pickupDueTime: new Date("2059-10-28T12:00:00Z") });
    const before = await prisma.booking.findMany({ where: { provider: { in: providers } }, orderBy: { id: "asc" } });
    const range = parseRange(new URLSearchParams({ preset: "custom", from: "2059-10-26", to: "2059-10-26" }));
    const report = await getContribution(range);
    assert.equal(report.coverage.completed, 5); assert.equal(report.coverage.unattributed, 1); assert.equal(report.coverage.missingPrice, 1);
    const accounts = report.groups.find(g => g.kind === "ACCOUNT" && g.metric === "grossPence")!;
    assert.equal(accounts.rows[0].label, "Synthetic account name"); assert.equal(accounts.entities, 2); assert.equal(accounts.total, 10000);
    const contacts = report.groups.find(g => g.kind === "CUSTOMER" && g.metric === "marginPence")!;
    assert.equal(contacts.rows[0].marginPence, null); assert.equal(contacts.available, false);
    const cash = await getContribution({ ...range, payment: "CASH" });
    const margin = cash.groups.find(g => g.kind === "CUSTOMER" && g.metric === "marginPence")!;
    assert.equal(margin.total, -190); assert.equal(margin.negativePence, -190); assert.equal(cash.coverage.completed, 2);
    assert.deepEqual(await prisma.booking.findMany({ where: { provider: { in: providers } }, orderBy: { id: "asc" } }), before);
    await assert.rejects(getContribution({ ...range, calendarDays: 32 }), /31 London/);
  } finally {
    await prisma.booking.deleteMany({ where: { provider: { in: providers } } });
    await prisma.normalCustomer.delete({ where: { id: customer.id } });
    await prisma.$disconnect();
  }
});
