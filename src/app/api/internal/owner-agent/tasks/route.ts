import { NextResponse } from "next/server";
import { AgentError, resolveAgentConfig, isWriteRequest } from "@/lib/ai/owner-agent/policy";
import { body, privateHeaders } from "@/lib/ai/owner-agent/http";
import { serviceAccess, readServiceTask, executeServiceTask } from "@/lib/ai/owner-agent/service";
import { parseRange } from "@/lib/analytics/explorer/model";
import { readMemory } from "@/lib/ai/owner-agent/memory";
import { readProvider, connectionFromProvider } from "@/lib/ai/owner-agent/provider-store";
import { planQuestion } from "@/lib/ai/owner-agent/planner";
import { readCompanyEvidence, reserveQuestion } from "@/lib/ai/owner-agent/runtime";
import { answerFromEvidence } from "@/lib/ai/owner-agent/evidence";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const json = (value: unknown, status = 200) => NextResponse.json(value, { status, headers: privateHeaders });
const failed = (e: unknown) => json({ error: e instanceof AgentError ? e.code : "AGENT_SERVICE_UNAVAILABLE" }, e instanceof AgentError ? e.status : 503);
export async function GET(request: Request) {
  try {
    const principal = serviceAccess(request), config = resolveAgentConfig(), params = new URL(request.url).searchParams;
    if (Array.from(params.keys()).some(k => k !== "requestId")) throw new AgentError("INVALID_TASK_REQUEST");
    const requestId = params.get("requestId");
    if (!requestId) return json({ company: config.name, principal: principal.principal, operations: principal.operations, bookingWrites: false, sourceCodeAccess: false, providerChanges: false });
    const task = await readServiceTask(config, requestId);
    return task ? json(task) : json({ error: "TASK_NOT_FOUND" }, 404);
  } catch (e) { return failed(e); }
}
export async function POST(request: Request) {
  try {
    serviceAccess(request); const config = resolveAgentConfig(), input = await body(request);
    if (Object.keys(input).some(k => !["requestId", "operation", "question", "preset", "payment", "from", "to"].includes(k)) || input.operation !== "ANALYSE" || typeof input.requestId !== "string" || typeof input.question !== "string" || !input.question.trim() || input.question.length > 1000) throw new AgentError("INVALID_TASK_REQUEST");
    if (isWriteRequest(input.question)) throw new AgentError("SERVICE_OPERATION_NOT_ALLOWED", 403);
    const parameters = new URLSearchParams();
    for (const key of ["preset", "payment", "from", "to"]) if (input[key] !== undefined) { if (typeof input[key] !== "string") throw new AgentError("INVALID_TASK_REQUEST"); parameters.set(key, input[key] as string); }
    let range; try { range = parseRange(parameters); } catch { throw new AgentError("INVALID_ANALYTICS_RANGE"); }
    if (range.calendarDays > 31) throw new AgentError("AGENT_RANGE_LIMIT_31_DAYS");
    const canonical: Record<string, string> = { operation: "ANALYSE", question: input.question.trim(), preset: parameters.get("preset") || "today", payment: parameters.get("payment") || "ALL" };
    if (range.preset === "custom") { canonical.from = parameters.get("from")!; canonical.to = parameters.get("to")!; }
    const task = await executeServiceTask(config, input.requestId, canonical, async () => {
      const release = reserveQuestion(config.tenant, "lyth-service");
      try {
        const memory = await readMemory(config), connection = connectionFromProvider(await readProvider(config));
        const plan = await planQuestion(canonical.question, memory.preferences, process.env, fetch, connection);
        if (plan.tool === "HELP") throw new AgentError("UNSUPPORTED_ANALYSIS");
        const data = await readCompanyEvidence(config, range);
        return { company: config.name, answer: answerFromEvidence(plan.tool, data, memory.preferences), memoryRevision: memory.revision, modelUsed: plan.modelUsed, bookingWrites: false };
      } finally { release(); }
    });
    return json(task, task.state === "RUNNING" ? 202 : task.state === "FAILED" ? 503 : 200);
  } catch (e) { return failed(e); }
}
