import { cache } from "react";
import ModuleUnavailable from "@/components/modules/ModuleUnavailable";
import { loadModuleState } from "./store";
import type { SwitchableModule } from "./model";
// React server-render cache only; no cross-request or TTL availability cache.
export const pageModuleState = cache(loadModuleState);
export async function modulePageBlock(moduleId: SwitchableModule) {
  try { return (await pageModuleState()).enabled[moduleId] ? null : <ModuleUnavailable />; }
  catch { return <ModuleUnavailable unavailable />; }
}
