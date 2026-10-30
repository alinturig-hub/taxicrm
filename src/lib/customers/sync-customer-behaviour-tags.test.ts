import test from "node:test";
import assert from "node:assert/strict";

test("behaviour recalculation expires its own tags and preserves historical app-user tags", async () => {
  process.env.DATABASE_URL ||= "postgresql://unused:unused@127.0.0.1:1/unused";
  const { syncCustomerBehaviourTags } = await import("./sync-customer-behaviour-tags");
  const { prisma } = await import("@/lib/prisma");
  const records = [
    { tagId: "MOBILE_APP_USER", source: "BOOKING_CHANNEL", active: true },
    { tagId: "FREQUENT_CUSTOMER", source: "AUTOMATIC", active: true },
  ];
  const tx = { customerBehaviourTag: {
    updateMany: async ({ where }: { where: { source?: string } }) => {
      const matching = records.filter(tag => !where.source || tag.source === where.source);
      for (const tag of matching) tag.active = false;
      return { count: matching.length };
    },
  } };
  const db = {
    normalCustomer: { findFirst: async () => null, findMany: async () => [{ id: "customer", bookings: [], behaviourTags: records.map(tag => ({ id: tag.tagId, tagId: tag.tagId })) }] },
    $transaction: async (callback: (client: typeof tx) => unknown) => callback(tx),
  } as unknown as typeof prisma;
  const result = await syncCustomerBehaviourTags({ customerLimit: 1, scope: "all" }, db);
  assert.equal(result.failedCustomers, 0);
  assert.equal(result.tagsDeactivated, 1);
  assert.equal(records[0].active, true);
  assert.equal(records[1].active, false);
});
