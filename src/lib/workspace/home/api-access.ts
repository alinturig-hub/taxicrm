import { allowedCards } from "./config";
import { activeWorkspaceCards } from "@/modules/my-workspace/availability";
import { enabledModuleIds, initialModuleState } from "@/modules/core/activation/model";
import { loadModuleState } from "@/modules/core/activation/store";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdministrationAccess } from "@/lib/administration-access";
export async function workspaceApiAccess() { const access = await getAdministrationAccess((await getServerSession(authOptions))?.user?.email); if (!access || (!access.isSuperAdmin && !access.permissions.includes("dashboard.view")))
    return null; const can = (permission: string) => access.isSuperAdmin || access.permissions.includes(permission as typeof access.permissions[number]); const state = await loadModuleState().catch(() => ({ ...initialModuleState(), enabled: { ai: false, reports: false, automation: false, predictions: false } })); return { access, can, allowed: activeWorkspaceCards(allowedCards(can), enabledModuleIds(state)) }; }
