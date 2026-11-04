import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdministrationAccess } from "@/lib/administration-access";
import { WhatsAppError } from "./settings";
export const privateHeaders = { "Cache-Control": "private, no-store" };
export async function whatsappAccess(manage = false) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new WhatsAppError("SIGN_IN_REQUIRED", 401);
  const access = await getAdministrationAccess(session.user.email);
  if (!access || !["configuration.view", "integrations.view", ...(manage ? ["integrations.manage"] : [])].every(p => access.permissions.includes(p as typeof access.permissions[number]))) throw new WhatsAppError("WHATSAPP_PERMISSION_REQUIRED", 403);
  return access;
}
export function whatsappOrigin(request: Request) {
  if (request.headers.get("origin") !== new URL(process.env.NEXTAUTH_URL || request.url).origin) throw new WhatsAppError("SAME_ORIGIN_REQUIRED", 403);
}
export async function whatsappBody(request: Request) {
  const reader = request.body?.getReader(); if (!reader) throw new WhatsAppError("INVALID_REQUEST");
  let size = 0, text = ""; const decoder = new TextDecoder();
  while (true) {
    const part = await reader.read(); if (part.done) break;
    size += part.value.byteLength;
    if (size > 65536) { await reader.cancel(); throw new WhatsAppError("REQUEST_TOO_LARGE", 413); }
    text += decoder.decode(part.value, { stream: true });
  }
  try { const body = JSON.parse(text + decoder.decode()); if (!body || typeof body !== "object" || Array.isArray(body)) throw Error(); return body as Record<string, unknown>; }
  catch { throw new WhatsAppError("INVALID_REQUEST"); }
}
