/** Provider-neutral interfaces only: no message delivery or provider is enabled here. */
export const MARKETING_CONTRACT_VERSION = 1 as const;
export type MarketingChannel = "whatsapp" | "sms" | "email";
export type ProviderKind = "meta" | "sendgrid" | "other";
export type DeliveryState = "accepted" | "delivered" | "read" | "failed" | "unknown";
export type MarketingConnection = { connectionId: string; channel: MarketingChannel; provider: ProviderKind; capabilities: { templates: boolean; media: boolean; buttons: boolean; deliveryReceipts: boolean } };
export type MarketingPermission = { channel: MarketingChannel; purpose: "marketing"; status: "granted" | "denied" | "unknown"; evidenceRef: string | null; recordedAt: string | null };
export type MarketingTemplate = { id: string; channel: MarketingChannel; name: string; language: string; status: "draft" | "pending" | "approved" | "rejected" | "unavailable"; providerTemplateId: string | null };
export type DeliveryReceipt = { connectionId: string; providerMessageId: string; state: DeliveryState; occurredAt: string };
/** Only a known affirmative permission can satisfy the marketing permission check. */
export function hasMarketingPermission(permission: MarketingPermission, channel: MarketingChannel): boolean {
  return permission.channel === channel && permission.purpose === "marketing" && permission.status === "granted";
}
