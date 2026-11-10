export const KNOWLEDGE_VERSION = "taxicrm-owner-v1";
export const tools = ["OVERVIEW", "DEMAND", "MARGIN", "OUTCOMES", "AREAS", "HELP"] as const;
export type AgentTool = typeof tools[number];
export const priorities = ["BALANCED", "INCREASE_MARGIN", "REDUCE_NO_FARE", "IMPROVE_COMPLETION"] as const;
export type Preferences = { priority: typeof priorities[number]; style: "BRIEF" | "DETAILED" };
export const defaultPreferences: Preferences = { priority: "BALANCED", style: "BRIEF" };
export const knowledge = [
  "Only COMPLETED bookings contribute financial values.",
  "Price is gross company receipts; Cost is driver money; Price minus Cost is margin before rent, commissions and expenses, not net profit.",
  "Missing money is unknown, not zero. Preserve negative margins and source discounts. Never substitute a tariff, quote, Fare or maximum of Price/Cost.",
  "Business periods use Europe/London and pickup time. Booking counts include ongoing jobs; current outcomes are not historical cutoff reconstructions.",
  "Cancellation, rejection or no-fare counts alone do not establish driver fault, passenger behaviour or driver shortage.",
  "Confirmed preferences are presentation context, not permission to change finance or KPI rules.",
];
export class AgentError extends Error {
  constructor(public code: string, public status = 400) { super(code); }
}
export function parsePreferences(value: unknown): Preferences {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new AgentError("INVALID_PREFERENCES");
  const v = value as Record<string, unknown>;
  if (Object.keys(v).some(k => !["priority", "style"].includes(k)) || typeof v.priority !== "string" || !priorities.includes(v.priority as Preferences["priority"]) || typeof v.style !== "string" || !["BRIEF", "DETAILED"].includes(v.style)) throw new AgentError("INVALID_PREFERENCES");
  return { priority: v.priority as Preferences["priority"], style: v.style as Preferences["style"] };
}
export function isWriteRequest(question: string) {
  return /other compan|all compan|alte.*compani|toate compani|\b(delete|update|insert|drop|truncate|alter|deploy|shell|execute|password|token|credential|send sms|change price|change cost|forget rules)\b|șterge|sterge|modific|trimite sms|schimb[aă].*(pre[tț]|cost|regul)|parol/.test(question.toLowerCase());
}
export function deterministicTool(question: string): AgentTool {
  const q = question.toLowerCase();
  if (/area|zone|zon[eă]|unde|where/.test(q)) return "AREAS";
  if (/margin|profit|revenue|income|price|cost|marj|venit|încas|incas/.test(q)) return "MARGIN";
  if (/cancel|reject|no.?fare|lost|nefinal|anul|refuz/.test(q)) return "OUTCOMES";
  if (/demand|booking|cerere|rezerv|job|curs[eă]/.test(q)) return "DEMAND";
  if (/overview|business|summary|rezumat|afacere/.test(q)) return "OVERVIEW";
  return "HELP";
}
export function resolveAgentConfig(env: Readonly<Record<string, string | undefined>> = process.env) {
  if (env.TAXICRM_OWNER_AGENT_ENABLED !== "true") throw new AgentError("AGENT_NOT_ENABLED", 503);
  const tenant = env.TAXICRM_AGENT_TENANT_ID || "", name = env.TAXICRM_AGENT_COMPANY_NAME || "";
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(tenant) || !name.trim() || name.length > 100 || env.TAXICRM_AGENT_ISOLATION !== "DEDICATED_COMPANY_DATABASE") throw new AgentError("COMPANY_ISOLATION_NOT_CONFIGURED", 503);
  // A dispatch companyId is not a security tenant. Shared multi-company mode is not supported.
  const identity = (raw?: string) => {
    try {
      const u = new URL(raw || "");
      if (!["postgres:", "postgresql:"].includes(u.protocol) || !u.hostname || !u.pathname || u.pathname === "/") return null;
      return { host: u.hostname.toLowerCase(), port: u.port || "5432", database: u.pathname, schema: u.searchParams.get("schema") || "public", role: decodeURIComponent(u.username) };
    } catch { return null; }
  };
  const app = identity(env.DATABASE_URL), agent = identity(env.TAXICRM_AGENT_DATABASE_URL);
  if (!app || !agent || agent.role === app.role || !agent.role || agent.host !== app.host || agent.port !== app.port || agent.database !== app.database || agent.schema !== app.schema || agent.schema !== "public") throw new AgentError("READ_ONLY_DATABASE_BINDING_REQUIRED", 503);
  return { tenant, name: name.trim(), databaseUrl: env.TAXICRM_AGENT_DATABASE_URL!, role: agent.role, database: decodeURIComponent(agent.database.slice(1)), memoryDir: env.TAXICRM_AGENT_MEMORY_DIR || null };
}
export type AgentConfig = ReturnType<typeof resolveAgentConfig>;
