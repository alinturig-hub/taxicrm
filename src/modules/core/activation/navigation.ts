import { enabledModuleIds, initialModuleState } from "./model";
import { pageModuleState } from "./page";
export async function pageEnabledModules() {
  try { return enabledModuleIds(await pageModuleState()); }
  catch {
    // Fail closed for the switchable capabilities without hiding Core/settings.
    return enabledModuleIds({ ...initialModuleState(), enabled: { ai: false, reports: false, automation: false } });
  }
}
