import { NextResponse } from "next/server";
import { loadModuleState } from "./store";
import type { SwitchableModule } from "./model";

// Call after the endpoint's existing authentication/permission check, before work.
// Never use cached client navigation as an authorization decision.
export async function moduleApiBlock(moduleId: SwitchableModule) {
  try {
    const state = await loadModuleState();
    if (state.enabled[moduleId]) return null;
    return NextResponse.json({ error: "MODULE_DISABLED", moduleId, message: "This module is disabled for this installation." },
      { status: 403, headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "MODULE_STATE_UNAVAILABLE", message: "Module availability could not be verified. Try again shortly." },
      { status: 503, headers: { "Cache-Control": "private, no-store" } });
  }
}
