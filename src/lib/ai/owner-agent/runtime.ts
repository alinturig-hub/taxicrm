import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { getAnalytics } from "@/lib/analytics/explorer/query";
import type { Range } from "@/lib/analytics/explorer/model";
import { AgentError, type AgentConfig } from "./policy";
let current: { url: string; client: PrismaClient } | null = null;
function client(config: AgentConfig) {
  if (!current) current = { url: config.databaseUrl, client: new PrismaClient({ adapter: new PrismaPg({ connectionString: config.databaseUrl, max: 2, idleTimeoutMillis: 1000, connectionTimeoutMillis: 3000, statement_timeout: 12000, query_timeout: 15000 }) }) };
  // Deployment bindings cannot switch tenant/database during the process lifetime.
  if (current.url !== config.databaseUrl) throw new AgentError("DATABASE_BINDING_CHANGED_RESTART_REQUIRED", 503);
  return current.client;
}
export async function readCompanyEvidence(config: AgentConfig, range: Range) {
  if (range.calendarDays > 31) throw new AgentError("AGENT_RANGE_LIMIT_31_DAYS");
  const database = client(config);
  const [identity] = await database.$queryRaw<{
    role: string; database: string; privileged: boolean; canWrite: boolean;
  }[]>`SELECT current_user role,current_database() database,
    (r.rolsuper OR r.rolcreaterole OR r.rolcreatedb OR r.rolreplication OR r.rolbypassrls) privileged,
    (EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname IN ('public','autocab_history') AND c.relkind IN ('r','p','v','m','f')
      AND has_table_privilege(current_user,c.oid,'INSERT,UPDATE,DELETE,TRUNCATE')) OR
     has_schema_privilege(current_user,'public','CREATE')) "canWrite"
    FROM pg_roles r WHERE r.rolname=current_user`;
  if (!identity || identity.role !== config.role || identity.database !== config.database || identity.privileged || identity.canWrite) throw new AgentError("AGENT_ROLE_MUST_BE_READ_ONLY", 503);
  return getAnalytics(range, false, database);
}
// Bounded process-local concurrency. Shared ingress rate limiting is required for replicas.
const active = new Set<string>(), last = new Map<string, number>();
export function reserveQuestion(tenant: string, user: string): () => void {
  const key = JSON.stringify([tenant, user]), now = Date.now();
  if (active.has(key) || active.size >= 4 || now - (last.get(key) || 0) < 3000) throw new AgentError("AGENT_BUSY_RETRY", 429);
  if (last.size >= 1000) last.delete(last.keys().next().value!);
  last.set(key, now); active.add(key);
  return () => { active.delete(key); };
}

export async function disconnectAgentReader() {
  await current?.client.$disconnect(); current = null;
}
