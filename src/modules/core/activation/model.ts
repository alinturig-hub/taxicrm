import { modules, type ModuleId } from "../registry";

// Only capabilities whose public entrypoints have been isolated may be switched.
// The rest remain available and have no misleading menu-only control.
export const switchableModules = ["ai", "reports", "automation", "predictions"] as const;
export type SwitchableModule = typeof switchableModules[number];
export type ModuleState = {
  schemaVersion: 2;
  predictionEpoch: string | null;
  revision: number;
  enabled: Record<SwitchableModule, boolean>;
};
export const initialModuleState = (): ModuleState => ({
  schemaVersion: 2, predictionEpoch: null, revision: 0, enabled: { ai: true, reports: true, automation: true, predictions: true },
});
export function isSwitchable(id: string): id is SwitchableModule {
  return (switchableModules as readonly string[]).includes(id);
}
export function parseModuleState(value: unknown): ModuleState {
  const v = value as Record<string, unknown> | null;
  if (!v || typeof v !== "object" || Array.isArray(v) || !Number.isSafeInteger(v.revision) || (v.revision as number) < 0 || !v.enabled || typeof v.enabled !== "object" || Array.isArray(v.enabled)) throw Error("MODULE_STATE_INVALID");
  const enabled = v.enabled as Record<string, unknown>;
  const legacy = v.schemaVersion === 1;
  const keys = legacy ? ["ai", "reports", "automation"] : [...switchableModules];
  if ((!legacy && v.schemaVersion !== 2) || Object.keys(v).sort().join() !== (legacy ? "enabled,revision,schemaVersion" : "enabled,predictionEpoch,revision,schemaVersion") ||
      Object.keys(enabled).sort().join() !== keys.sort().join() || keys.some(id => typeof enabled[id] !== "boolean") ||
      (!legacy && v.predictionEpoch !== null && (typeof v.predictionEpoch !== "string" || !Number.isFinite(Date.parse(v.predictionEpoch)) || new Date(v.predictionEpoch).toISOString() !== v.predictionEpoch))) throw Error("MODULE_STATE_INVALID");
  return { schemaVersion: 2, revision: v.revision as number, predictionEpoch: legacy ? null : v.predictionEpoch as string | null,
    enabled: { ai: enabled.ai as boolean, reports: enabled.reports as boolean, automation: enabled.automation as boolean, predictions: legacy ? true : enabled.predictions as boolean } };
}
export function enabledModuleIds(state: ModuleState): ModuleId[] {
  return (Object.keys(modules) as ModuleId[]).filter(id => (!isSwitchable(id) || state.enabled[id]) && (id !== "insights" || state.enabled.predictions));
}
export function nextModuleState(state: ModuleState, moduleId: SwitchableModule, enabled: boolean): ModuleState {
  if (state.revision === Number.MAX_SAFE_INTEGER) throw Error("MODULE_REVISION_EXHAUSTED");
  return { ...state, schemaVersion: 2, revision: state.revision + 1, enabled: { ...state.enabled, [moduleId]: enabled } };
}
export const moduleImpact: Record<SwitchableModule, string> = {
  predictions: "Pauses new customer and demand forecasts, forecast evaluation and dependent forecast insights. Customer history, retention, tags, places and other CRM effects continue. Data is kept. Re-enabling starts a new forecast period; old pending work is not replayed.",
  ai: "Blocks new Copilot questions and the Copilot page. Existing read-only requests may finish. Customer data, reporting and other modules remain available.",
  reports: "Blocks contribution, Hackney performance and refusal detail reports, including their APIs. Financial calculations, business overview and source ingestion continue.",
  automation: "Blocks rule review and new simulation runs. The separate domain jobs and shared WhatsApp transport continue. This does not enable or disable operational booking notifications.",
};
