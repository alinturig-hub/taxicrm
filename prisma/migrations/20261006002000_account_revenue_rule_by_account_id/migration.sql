DROP INDEX IF EXISTS "AccountRevenueRule_provider_accountCode_key";

CREATE UNIQUE INDEX "AccountRevenueRule_provider_accountId_key"
ON "AccountRevenueRule"("provider", "accountId");
