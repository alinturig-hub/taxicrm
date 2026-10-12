import { encryptSecret } from "@/lib/security/encryption";
export function providerInput(body: unknown, existing = false) {
  if (!body || typeof body !== "object") throw new Error("Invalid provider.");
  const value = body as Record<string, unknown>;
  const name = typeof value.name === "string" ? value.name.trim() : "";
  const description =
    typeof value.description === "string" ? value.description.trim() : "";
  const apiKeyHeader =
    typeof value.apiKeyHeader === "string"
      ? value.apiKeyHeader.trim().toLowerCase()
      : "";
  if (
    !name ||
    name.length > 200 ||
    description.length > 2000 ||
    !/^[a-z][a-z0-9-]{0,99}$/.test(apiKeyHeader) ||
    [
      "authorization",
      "cookie",
      "host",
      "content-type",
      "content-length",
    ].includes(apiKeyHeader) ||
    typeof value.isEnabled !== "boolean"
  )
    throw new Error("Invalid name, header or enabled state.");
  const url = new URL(
    typeof value.baseUrl === "string" ? value.baseUrl.trim() : "",
  );
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error("Use an HTTPS URL without credentials or parameters.");
  const key = typeof value.apiKey === "string" ? value.apiKey.trim() : "";
  if (
    (!existing && key.length < 16) ||
    (key && (key.length < 16 || key.length > 512))
  )
    throw new Error("Supply a key of 16–512 characters.");
  return {
    name,
    description: description || null,
    baseUrl: url.toString().replace(/\/+$/, ""),
    apiKeyHeader,
    isEnabled: value.isEnabled,
    ...(key ? { apiKeyEncrypted: encryptSecret(key) } : {}),
  };
}
export function publicProvider(provider: {
  id: string;
  name: string;
  description: string | null;
  baseUrl: string;
  apiKeyHeader: string;
  isEnabled: boolean;
  apiKeyEncrypted: string | null;
}) {
  return {
    id: provider.id,
    name: provider.name,
    description: provider.description,
    baseUrl: provider.baseUrl,
    apiKeyHeader: provider.apiKeyHeader,
    isEnabled: provider.isEnabled,
    hasApiKey: Boolean(
      provider.apiKeyEncrypted ||
        (provider.id === "autocab" && process.env.AUTOCAB_WEBHOOK_API_KEY),
    ),
  };
}
