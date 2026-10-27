// Process-local bounds for on-demand reporting. Deployments with replicas need shared ingress limits.
const active = new Set<string>(), last = new Map<string, number>();
export class ContributionBusyError extends Error {}
export function reserveContribution(user: string, now = Date.now()): () => void {
  if (active.has(user) || active.size >= 4 || now - (last.get(user) ?? -Infinity) < 3000) throw new ContributionBusyError("Report busy");
  if (last.size >= 1000) last.delete(last.keys().next().value!);
  last.set(user, now); active.add(user);
  return () => { active.delete(user); };
}
