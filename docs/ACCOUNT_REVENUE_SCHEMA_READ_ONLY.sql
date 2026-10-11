-- Run only against the approved TaxiCRM database.
-- Metadata and aggregate counts only; no customer data or rule values.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '10s';

SELECT migration_name, finished_at, rolled_back_at
FROM public."_prisma_migrations"
WHERE migration_name = '20261006002000_account_revenue_rule_by_account_id';

SELECT indexname, indexdef
FROM pg_catalog.pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'AccountRevenueRule'
ORDER BY indexname;

SELECT count(*) AS duplicate_provider_account_id_groups
FROM (
  SELECT 1
  FROM public."AccountRevenueRule"
  GROUP BY "provider", "accountId"
  HAVING count(*) > 1
) AS duplicate_groups;

ROLLBACK;
