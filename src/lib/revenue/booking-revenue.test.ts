import assert from "node:assert/strict";
import { test } from "node:test";
import { accountRevenueRuleKey, loadAccountRevenueRuleMap } from "./booking-revenue";
import { prisma } from "../prisma";

test("rules use provider and account ID regardless of missing or changed account code", async () => {
  assert.equal(accountRevenueRuleKey({ accountId: "synthetic-1" }), accountRevenueRuleKey({ provider: "AUTOCAB", accountId: "synthetic-1" }));
  assert.notEqual(accountRevenueRuleKey({ provider: "OTHER", accountId: "synthetic-1" }), accountRevenueRuleKey({ accountId: "synthetic-1" }));
  assert.notEqual(accountRevenueRuleKey({ accountId: "synthetic-1" }), accountRevenueRuleKey({ accountId: "synthetic-2" }));
  assert.equal(accountRevenueRuleKey({ accountId: " " }), null);
  const original = prisma.accountRevenueRule.findMany;
  try {
    prisma.accountRevenueRule.findMany = (async (args: { where: { OR: unknown[] } }) => {
      assert.deepEqual(args.where.OR, [{provider: "AUTOCAB", accountId: "synthetic-1"}]);
      return [{provider: "AUTOCAB", accountId: "synthetic-1", accountCode: "OLD", waitingChargeable: false, waitingRatePerMinute: 0}];
    }) as unknown as typeof original;
    const rules = await loadAccountRevenueRuleMap([{accountId: "synthetic-1", accountCode: "NEW"}]);
    assert.equal(rules.get(accountRevenueRuleKey({accountId: "synthetic-1"})!)?.accountCode, "OLD");
  } finally { prisma.accountRevenueRule.findMany = original; }
});
