export type SendEligibility = {
  enabled: boolean; consent: boolean; suppressed: boolean;
  approvedTemplate: boolean; lastInboundAt: Date | null; now: Date;
  kind: "MARKETING" | "SERVICE";
};
/** Re-evaluate immediately before dispatch, including queued recipients. */
export function sendEligibility(input: SendEligibility) {
  if (!input.enabled) return "CONNECTION_DISABLED";
  if (input.suppressed) return "CONTACT_SUPPRESSED";
  if (input.kind === "MARKETING" && !input.consent) return "CONSENT_REQUIRED";
  const age = input.lastInboundAt ? input.now.getTime() - input.lastInboundAt.getTime() : NaN;
  const openWindow = Number.isFinite(age) && age >= 0 && age < 24 * 60 * 60 * 1000;
  if (input.kind === "MARKETING" && !input.approvedTemplate) return "APPROVED_TEMPLATE_REQUIRED";
  if (!openWindow && !input.approvedTemplate) return "APPROVED_TEMPLATE_REQUIRED";
  return "ELIGIBLE";
}
