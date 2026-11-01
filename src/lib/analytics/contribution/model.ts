export type ContributionRow = {
  kind: "ACCOUNT" | "CUSTOMER" | "UNATTRIBUTED"; provider: string; id: string; label?: string | null;
  completed: number; missingPrice: number; missingCost: number;
  grossPence: number; costPence: number; marginPence: number | null;
};
export function contributionReport(rows: ContributionRow[]) {
  const attributable = rows.filter(r => r.kind !== "UNATTRIBUTED");
  const rank = (kind: "ACCOUNT" | "CUSTOMER", metric: "completed" | "grossPence" | "marginPence") => {
    const cohort = attributable.filter(r => r.kind === kind);
    // An incomplete financial denominator cannot produce a defensible financial Pareto.
    const incomplete = metric === "grossPence" ? cohort.some(r => r.missingPrice) : metric === "marginPence" ? cohort.some(r => r.missingPrice || r.missingCost || r.marginPence === null) : false;
    const negative = metric !== "completed" && cohort.some(r => Number(r[metric]) < 0);
    const total = cohort.reduce((n, r) => n + Number(r[metric] ?? 0), 0);
    const available = !incomplete && !negative && total > 0;
    let cumulative = 0;
    const ranked = [...cohort].sort((a, b) => Number(b[metric] ?? 0) - Number(a[metric] ?? 0) || JSON.stringify([a.provider, a.id]).localeCompare(JSON.stringify([b.provider, b.id])))
      .map(r => { const value = r[metric]; cumulative += Number(value ?? 0); return { ...r, value, cumulative, share: available ? Number(value) / total * 100 : null }; });
    const targetCount = available ? ranked.findIndex(r => r.cumulative >= total * .8) + 1 : null;
    const topCount = Math.ceil(cohort.length * .2);
    return { kind, metric, entities: cohort.length, total, available, reason: incomplete ? "Missing financial data" : negative ? "Signed contributions require separate review" : total <= 0 ? "No positive denominator" : null,
      targetCount, topCount, topShare: available ? ranked.slice(0, topCount).reduce((n, r) => n + Number(r.value), 0) / total * 100 : null,
      negativeCount: cohort.filter(r => Number(r[metric]) < 0).length,
      negativePence: metric === "completed" ? null : cohort.reduce((n, r) => n + Math.min(0, Number(r[metric] ?? 0)), 0),
      rows: ranked.slice(0, 20) };
  };
  return { groups: (["ACCOUNT", "CUSTOMER"] as const).flatMap(kind => (["completed", "grossPence", "marginPence"] as const).map(metric => rank(kind, metric))),
    coverage: { completed: rows.reduce((n, r) => n + r.completed, 0), unattributed: rows.filter(r => r.kind === "UNATTRIBUTED").reduce((n, r) => n + r.completed, 0), missingPrice: rows.reduce((n, r) => n + r.missingPrice, 0), missingCost: rows.reduce((n, r) => n + r.missingCost, 0) },
    limits: ["COMPLETED pickup-period cohort only. Account identity is provider + accountId; customer identity is the existing CRM relation, never a name or telephone match.", "Accounts take precedence over linked customers for financial attribution. Customer rows are non-account booking contacts, not verified payer identities.", "Missing identities are excluded from rankings and counted separately. Shared contact identities may represent multiple passengers.", "Margin is Price − Cost before expenses; discounts and negative amounts remain signed. No inferred commissions, net profit or calibrated booking probabilities.", "Top 20 contributors are displayed; percentages use the full eligible cohort. Account and customer percentages have separate denominators."] };
}
