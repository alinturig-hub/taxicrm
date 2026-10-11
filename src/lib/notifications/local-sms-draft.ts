import { readFile } from "node:fs/promises";
import { encryptSecret } from "@/lib/security/encryption";
import type { SmsGatewayDraft } from "./sms-gateway-preview";

export function encryptedOrionDraft(signedEndpoint: string) {
  const url = new URL(signedEndpoint);
  if (url.origin !== "https://orionconnect.co.uk" || url.pathname !== "/api/endpoint/webhook" || url.username || url.password || url.hash ||
    !/^\d+$/.test(url.searchParams.get("endpoint_id") ?? "") || !/^[a-f0-9]{64}$/i.test(url.searchParams.get("signature") ?? "")) {
    throw new Error("Invalid signed Orion endpoint.");
  }
  return {provider: "ORION", endpoint: `${url.origin}${url.pathname}`, format: "POST_JSON", phoneParameter: "customer_phone", messageParameter: "message", senderParameter: "sender", sender: "TaxiCRM",
    signedParametersEncrypted: encryptSecret(url.search), enabled: false, simulationOnly: true};
}

export async function publicLocalSmsDraft(): Promise<{configuration: SmsGatewayDraft; signedParametersSaved: boolean} | null> {
  const path = process.env.SMS_GATEWAY_DRAFT_FILE;
  if (!path) return null;
  const draft = JSON.parse(await readFile(path, "utf8"));
  if (draft.endpoint !== "https://orionconnect.co.uk/api/endpoint/webhook" || draft.enabled !== false || draft.simulationOnly !== true) throw new Error("Invalid local SMS preview configuration.");
  return {configuration: {endpoint: draft.endpoint, phoneParameter: "customer_phone", messageParameter: "message", senderParameter: "sender", sender: "TaxiCRM"}, signedParametersSaved: typeof draft.signedParametersEncrypted === "string"};
}
