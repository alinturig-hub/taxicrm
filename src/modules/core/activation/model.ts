import { modules, type ModuleId } from "../registry";

// Only capabilities whose public entrypoints have been isolated may be switched.
// The rest remain available and have no misleading menu-only control.
export const switchableModules = ["ai", "reports", "automation"] as const;
export type SwitchableModule = typeof switchableModules[number];
export type ModuleState = {
  schemaVersion: 1;
  revision: number;
  enabled: Record<SwitchableModule, boolean>;
};
export const initialModuleState = (): ModuleState => ({
  schemaVersion: 1, revision: 0, enabled: { ai: true, reports: true, automation: true },
});
export function isSwitchable(id: string): id is SwitchableModule {
  return (switchableModules as readonly string[]).includes(id);
}
export function parseModuleState(value: unknown): ModuleState {
  const v = value as ModuleState;
  if (!v || typeof v !== "object" || Array.isArray(v) ||
      Object.keys(v).sort().join() !== "enabled,revision,schemaVersion" ||
      v.schemaVersion !== 1 || !Number.isSafeInteger(v.revision) || v.revision < 0 ||
      !v.enabled || typeof v.enabled !== "object" || Array.isArray(v.enabled) ||
      Object.keys(v.enabled).sort().join() !== [...switchableModules].sort().join() ||
      switchableModules.some(id => typeof v.enabled[id] !== "boolean")) {
    throw Error("MODULE_STATE_INVALID");
  }
  return { schemaVersion: 1, revision: v.revision, enabled: { ...v.enabled } };
}
export function enabledModuleIds(state: ModuleState): ModuleId[] {
  return (Object.keys(modules) as ModuleId[]).filter(id => !isSwitchable(id) || state.enabled[id]);
}
export function nextModuleState(state: ModuleState, moduleId: SwitchableModule, enabled: boolean): ModuleState {
  if (state.revision === Number.MAX_SAFE_INTEGER) throw Error("MODULE_REVISION_EXHAUSTED");
  return { schemaVersion: 1, revision: state.revision + 1, enabled: { ...state.enabled, [moduleId]: enabled } };
}
export const moduleImpact: Record<SwitchableModule, string> = {
  ai: "Blocks new Copilot questions and the Copilot page. Existing read-only requests may finish. Customer data, reporting and other modules remain available.",
  reports: "Blocks contribution, Hackney performance and refusal detail reports, including their APIs. Financial calculations, business overview and source ingestion continue.",
  automation: "Blocks rule review and new simulation runs. The separate domain jobs and shared WhatsApp transport continue. This does not enable or disable operational booking notifications.",
};
