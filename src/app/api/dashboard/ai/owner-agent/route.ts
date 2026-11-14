import { NextResponse } from "next/server";
import { moduleApiBlock } from "@/modules/core/activation/access";
import { parseRange } from "@/lib/analytics/explorer/model";
import { AgentError, resolveAgentConfig, isWriteRequest, KNOWLEDGE_VERSION } from "@/lib/ai/owner-agent/policy";
import { agentAccess, sameOrigin, body, privateHeaders } from "@/lib/ai/owner-agent/http";
import { readMemory, confirmMemory } from "@/lib/ai/owner-agent/memory";
import { planQuestion } from "@/lib/ai/owner-agent/planner";
import { readCompanyEvidence, reserveQuestion } from "@/lib/ai/owner-agent/runtime";
import { answerFromEvidence } from "@/lib/ai/owner-agent/evidence";
import { readProvider, connectionFromProvider } from "@/lib/ai/owner-agent/provider-store";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: privateHeaders });
function failed(error: unknown) {
  return json({ error: error instanceof AgentError ? error.code : "AGENT_UNAVAILABLE" }, error instanceof AgentError ? error.status : 503);
}
function canAnalyse(access: Awaited<ReturnType<typeof agentAccess>>) {
  return access.isSuperAdmin || ["bookings.view", "reports.view", "revenue.view"].every(p => access.permissions.includes(p as typeof access.permissions[number]));
}
export async function GET() {
  try {
    const access = await agentAccess();
    const moduleBlock = await moduleApiBlock("ai"); if (moduleBlock) return moduleBlock;
    const config = resolveAgentConfig(), memory = await readMemory(config);
    const provider = await readProvider(config), connection = connectionFromProvider(provider);
    return json({
      company: config.name, agentId: `owner-agent:${config.tenant}`, knowledgeVersion: KNOWLEDGE_VERSION,
      memory: { revision: memory.revision, preferences: memory.preferences, persistent: !!config.memoryDir },
      canManageMemory: canAnalyse(access), canManageProvider: access.isSuperAdmin || access.permissions.includes("configuration.manage"), canAnalyse: canAnalyse(access), modelConfigured: connection === undefined ? !!(process.env.TAXICRM_AGENT_MODEL && process.env.TAXICRM_AGENT_MODEL_BASE_URL) : !!connection, writeActionsEnabled: false
    });
  } catch (e) { return failed(e); }
}
export async function POST(request: Request) {
  let release: (() => void) | undefined;
  try {
    const access = await agentAccess(); sameOrigin(request);
    const moduleBlock = await moduleApiBlock("ai"); if (moduleBlock) return moduleBlock;
    const config = resolveAgentConfig(), input = await body(request);
    if (Object.keys(input).some(k => !["question", "preset", "payment", "from", "to"].includes(k)) || typeof input.question !== "string" || !input.question.trim() || input.question.length > 1000) throw new AgentError("INVALID_REQUEST");
    if (isWriteRequest(input.question)) return json({ restricted: true, message: "This agent can analyse recorded data and remember confirmed presentation preferences. It cannot change bookings, financial rules, schema, software or contact customers." });
    if (!canAnalyse(access)) throw new AgentError("BOOKING_REPORT_REVENUE_ACCESS_REQUIRED", 403);
    const params = new URLSearchParams();
    for (const k of ["preset", "payment", "from", "to"]) if (input[k] !== undefined) { if (typeof input[k] !== "string") throw new AgentError("INVALID_REQUEST"); params.set(k, input[k] as string); }
    let range; try { range = parseRange(params); } catch { throw new AgentError("INVALID_ANALYTICS_RANGE"); }
    if (range.calendarDays > 31) throw new AgentError("AGENT_RANGE_LIMIT_31_DAYS");
    release = reserveQuestion(config.tenant, access.user.id);
    const memory = await readMemory(config), connection = connectionFromProvider(await readProvider(config));
    const plan = await planQuestion(input.question.trim(), memory.preferences, process.env, fetch, connection);
    if (plan.tool === "HELP") return json({ restricted: true, message: "Ask about booking demand, completed Price/Cost margin, cancellations, rejected/no-fare bookings or pickup areas. Use the period controls: dates mentioned in chat do not override the selected window. Forecasts and write actions are not enabled." });
    const data = await readCompanyEvidence(config, range);
    return json({
      company: config.name, answer: answerFromEvidence(plan.tool, data, memory.preferences), memoryRevision: memory.revision,
      safeguards: { modelUsed: plan.modelUsed, method: plan.modelUsed ? "ALLOWLIST_MODEL_PLAN_DETERMINISTIC_EVIDENCE" : "DETERMINISTIC_EVIDENCE", questionStored: false, writeActionsEnabled: false, databasePersonalDataSentToModel: false, questionMayBeSentToConfiguredModel: connection === undefined ? !!(process.env.TAXICRM_AGENT_MODEL && process.env.TAXICRM_AGENT_MODEL_BASE_URL) : !!connection }
    });
  } catch (e) { return failed(e); } finally { release?.(); }
}
export async function PUT(request: Request) {
  try {
    const access = await agentAccess(); sameOrigin(request);
    const moduleBlock = await moduleApiBlock("ai"); if (moduleBlock) return moduleBlock;
    if (!canAnalyse(access)) throw new AgentError("BOOKING_REPORT_REVENUE_ACCESS_REQUIRED", 403);
    const config = resolveAgentConfig(), input = await body(request);
    if (Object.keys(input).some(k => !["expectedRevision", "preferences", "confirm"].includes(k)) || input.confirm !== true || typeof input.expectedRevision !== "number") throw new AgentError("EXPLICIT_CONFIRMATION_REQUIRED");
    const memory = await confirmMemory(config, access.user.id, input.expectedRevision, input.preferences);
    return json({ revision: memory.revision, preferences: memory.preferences, persistent: true });
  } catch (e) { return failed(e); }
}
