# Business Review v1

Implemented on `codex/taxicrm`, starting from `3212ddfff21ed6a29e46f3a39186a0a1c28fe538`. This is an isolated implementation, not a production activation.

Open Company AI agent and choose **Give me a business overview**. Existing period/payment controls and read-only company binding apply. No additional query, provider request, scheduled job, schema or canonical write is introduced. The review also travels with OVERVIEW evidence returned through the scoped Lyth service. Existing service token permissions are unchanged.

## Evidence and decisions

- Situation cards retain COMPLETED-only financial semantics: Price = gross receipts; Cost = driver money; signed difference = margin before expenses. This is not net profit.
- Pareto ranks known pickup zones by booking demand. It reports the smallest number of zones reaching at least 80% of known-zone demand, and the actual share from the top ceil(20% × zone count). These are distinct calculations; no forced 80/20 claim. Ties use the stable zone key. Unknown-zone bookings are explicitly excluded and counted. Unreconciled area totals suppress the ranking. The ten largest zones are displayed; calculations include every returned known zone.
- SWOT is provisional, rule based and reproducible. Completion is a descriptive baseline, not proof of competitive strength. Outcome counts and negative recorded margin are observations. Capacity opportunities and concentration threats are hypotheses requiring owner/market context. No industry thresholds, fault attribution or forecasts are invented.
- Up to three proposed decisions prioritize evidence gaps, negative margin, unfulfilled outcomes and demand-zone review. They include a measurement criterion, but remain unassigned and unscheduled. No actions are executed or persisted as approved work.
- Review content participates in the evidence hash and inherits its exact UTC range, Europe/London business period display, payment scope, generation time and source link. The hash is not a signature or retained historical snapshot.

## Deliberate limits

Customer/account profitability Pareto, verified driver contribution, prior-period SWOT trends, owner-supplied external context, approval workflow and outcome tracking require further work. No claim is made that zone demand represents these other dimensions. Lyth remains a scoped analysis caller; this change does not add system control privileges or deploy the agent.

## Validation

Synthetic calculation tests cover balanced/skewed Pareto, unknown zones, reconciliation failure, empty selection, negative/unknown money, hypotheses, unassigned proposals and evidence hash sensitivity. Existing owner-agent/provider/service tests run alongside them. No live database or paid model calls are needed.
