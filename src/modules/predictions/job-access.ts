import { NextResponse } from "next/server";
import { loadModuleState } from "@/modules/core/activation/store";
export function predictionJobSkipped() {
  return NextResponse.json({ success: true, status: "SKIPPED", reason: "MODULE_DISABLED", selected: 0, processed: 0, failed: 0, hasMore: false }, { headers: { "Cache-Control": "no-store" } });
}
export async function predictionJobBlock() {
  try { return (await loadModuleState()).enabled.predictions ? null : predictionJobSkipped(); }
  catch { return NextResponse.json({ success: false, error: "MODULE_STATE_UNAVAILABLE" }, { status: 503 }); }
}
