import { NextResponse } from "next/server";
import { agentAccess, sameOrigin, body, privateHeaders } from "@/lib/ai/owner-agent/http";
import { resolveAgentConfig, AgentError, defaultPreferences } from "@/lib/ai/owner-agent/policy";
import { readProvider, publicProvider, providerStorageReady, saveProvider, connectionFromProvider } from "@/lib/ai/owner-agent/provider-store";
import { planQuestion } from "@/lib/ai/owner-agent/planner";
import { reserveQuestion } from "@/lib/ai/owner-agent/runtime";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const json = (value: unknown, status = 200) => NextResponse.json(value, { status, headers: privateHeaders });
const failed = (error: unknown) => json({ error: error instanceof AgentError ? error.code : "PROVIDER_SETTINGS_UNAVAILABLE" }, error instanceof AgentError ? error.status : 503);
export async function GET() {
  try {
    await agentAccess(true); const config = resolveAgentConfig();
    const saved = await readProvider(config);
    return json({ ...publicProvider(saved), usesDeploymentDefault: !saved && !!(process.env.TAXICRM_AGENT_MODEL && process.env.TAXICRM_AGENT_MODEL_BASE_URL), storageReady: providerStorageReady(config) });
  } catch (e) { return failed(e); }
}
export async function PUT(request: Request) {
  try {
    const access = await agentAccess(true); sameOrigin(request);
    const config = resolveAgentConfig(), input = await body(request);
    if (Object.keys(input).some(k => !["confirm", "expectedRevision", "settings"].includes(k)) || input.confirm !== true || typeof input.expectedRevision !== "number") throw new AgentError("EXPLICIT_CONFIRMATION_REQUIRED");
    const saved = await saveProvider(config, access.user.id, input.expectedRevision, input.settings);
    return json({ ...saved, usesDeploymentDefault: false, storageReady: providerStorageReady(config) });
  } catch (e) { return failed(e); }
}
export async function POST(request: Request) {
  let release: (() => void) | undefined;
  try {
    const access = await agentAccess(true); sameOrigin(request);
    const config = resolveAgentConfig(), input = await body(request);
    if (Object.keys(input).some(k => !["confirm", "expectedRevision"].includes(k)) || input.confirm !== true || typeof input.expectedRevision !== "number") throw new AgentError("EXPLICIT_TEST_CONFIRMATION_REQUIRED");
    const saved = await readProvider(config);
    if (!saved || saved.revision !== input.expectedRevision) throw new AgentError("PROVIDER_REVISION_CONFLICT", 409);
    const connection = connectionFromProvider(saved);
    if (!connection) throw new AgentError("PROVIDER_NOT_ENABLED");
    release = reserveQuestion(config.tenant, access.user.id);
    const result = await planQuestion("Help: which analyses are supported?", defaultPreferences, process.env, fetch, connection);
    if (!result.modelUsed) throw new AgentError("MODEL_TEST_FAILED", 502);
    return json({ reachable: true, provider: saved.provider, model: saved.model, testedAt: new Date().toISOString(), companyDataSent: false });
  } catch (e) { return failed(e); } finally { release?.(); }
}
