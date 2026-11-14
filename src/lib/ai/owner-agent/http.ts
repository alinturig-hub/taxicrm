import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdministrationAccess } from "@/lib/administration-access";
import { AgentError } from "./policy";
export async function agentAccess(manage = false) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new AgentError("SIGN_IN_REQUIRED", 401);
  const access = await getAdministrationAccess(session.user.email);
  const required = ["intelligence.view", ...(manage ? ["configuration.manage"] : [])];
  if (!access || (!access.isSuperAdmin && !required.every(p => access.permissions.includes(p as typeof access.permissions[number])))) throw new AgentError("AGENT_PERMISSION_REQUIRED", 403);
  return access;
}
export function sameOrigin(request: Request) {
  if (request.headers.get("origin") !== new URL(process.env.NEXTAUTH_URL || request.url).origin) throw new AgentError("SAME_ORIGIN_REQUIRED", 403);
}
export async function body(request: Request) {
  const reader = request.body?.getReader(); if (!reader) throw new AgentError("INVALID_REQUEST");
  let size = 0, text = ""; const decoder = new TextDecoder();
  while (true) {
    const part = await reader.read(); if (part.done) break;
    size += part.value.byteLength;
    if (size > 4096) { await reader.cancel(); throw new AgentError("REQUEST_TOO_LARGE", 413); }
    text += decoder.decode(part.value, { stream: true });
  }
  try {
    const value = JSON.parse(text + decoder.decode());
    if (!value || typeof value !== "object" || Array.isArray(value)) throw Error();
    return value as Record<string, unknown>;
  } catch { throw new AgentError("INVALID_REQUEST"); }
}
export const privateHeaders = { "Cache-Control": "private, no-store" };
