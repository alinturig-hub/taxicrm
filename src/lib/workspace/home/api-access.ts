import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdministrationAccess } from "@/lib/administration-access";
export async function workspaceApiAccess() { const access = await getAdministrationAccess((await getServerSession(authOptions))?.user?.email); if (!access || (!access.isSuperAdmin && !access.permissions.includes("dashboard.view")))
    return null; const can = (permission: string) => access.isSuperAdmin || access.permissions.includes(permission as typeof access.permissions[number]); return { access, can }; }
