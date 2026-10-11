import { createHmac, timingSafeEqual } from "node:crypto";

export class ApiPreviewError extends Error {}

function digest(url: string, data: unknown, issuedAt: number) {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new ApiPreviewError("Preview signing is not configured.");
  return createHmac("sha256", secret).update(JSON.stringify([url, data, issuedAt])).digest("hex");
}
export function signApiPreview(url: string, data: unknown, now = Date.now()) {
  return `${now}.${digest(url, data, now)}`;
}
export function verifyApiPreview(url: string, data: unknown, token: string, now = Date.now()) {
  if (!/^\d+\.[a-f0-9]{64}$/.test(token)) throw new ApiPreviewError("Invalid preview token.");
  const [time, signature] = token.split(".");
  const issuedAt = Number(time);
  if (!Number.isFinite(issuedAt) || issuedAt > now || now - issuedAt > 15 * 60000 || !/^[a-f0-9]{64}$/.test(signature ?? "")) throw new ApiPreviewError("Preview expired or invalid. Try API again.");
  const expected = Buffer.from(digest(url, data, issuedAt), "hex");
  if (!timingSafeEqual(expected, Buffer.from(signature, "hex"))) throw new ApiPreviewError("Preview changed. Try API again.");
}
