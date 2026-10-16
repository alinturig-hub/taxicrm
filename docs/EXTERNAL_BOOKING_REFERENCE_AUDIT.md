# External booking reference audit

The explicitly approved investigation reads only `public.needacab_bookings` and canonical TaxiCRM booking references. The authenticated internal financial-audit GET endpoint accepts `external=probe|bounds|summary|duplicates|scan|local-duplicates`; no mutation operation exists. These modes are separate from the resident-only `compare` modes.

Source reads run in read-only transactions with 25-second statement limits, no parallel query workers and an 8 MB work-memory limit. Native source-ID keyset pagination limits batches to 1,000 rows. Capture an upper bound before scanning and verify source-ID uniqueness first. Each batch has its own snapshot; updates during a scan can affect results. No customer names, phone numbers or emails are selected.

A reference present once in each system is a normal replica. Multiple source rows sharing an Autocab reference require investigation. A possible double import is flagged only when an unpriced completed CRM row uses the source primary ID, another CRM row uses the distinct Autocab reference, and both stored pickup timestamps match the source. This is evidence for review, never authorization to merge, delete or copy amounts. Original-reference relationships may represent legitimate replacements. Timestamp equality compares stored values and does not establish the timezone contract of a naive source timestamp. Explicit zero amounts count as recorded values.

Diagnostics return financial evidence only to the existing internal audit authentication. Keep operational receipts outside the repository with restricted permissions. Running an audit must not invoke a revenue rebuild, backfill, provider API, SMS or schema migration.

Synthetic integration coverage: `tests/integration/external-booking-comparison.test.ts`, guarded by the exact local database URL and `TAXICRM_SYNTHETIC_TESTS=1`.
