import type { CustomerNeedPropensity } from "@/lib/customers/customer-need-propensity";
export function disabledNeed(): CustomerNeedPropensity {
  return { status: "DISABLED", score: null, level: "DISABLED", confidence: 0, actionWindow: "NONE", recommendedAction: "NO_PERSONAL_ACTION", predictedStartAt: null, predictedDay: null, predictedWindow: null, components: { prediction: 0, schedule: 0, regularity: 0, returnPattern: 0 }, signals: [], explanation: ["Predictions are disabled or unavailable for this installation."] };
}
