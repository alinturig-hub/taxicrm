import { activeWorkspaceCards } from "@/modules/my-workspace/availability";
import { redirect } from "next/navigation";
import { workspaceAccess } from "@/lib/workspace/access";
import { allowedCards, periods, type WorkspacePeriod } from "@/lib/workspace/home/config";
import { loadWorkspacePreference } from "@/lib/workspace/home/preferences";
import { workspaceSummary } from "@/lib/workspace/home/summary";
import MyWorkspace from "@/components/workspace/MyWorkspace";
export const dynamic = "force-dynamic";
export default async function WorkspacePage({ searchParams }: {
    searchParams: {
        period?: string;
    };
}) {
    const { access, groups, enabledModules } = await workspaceAccess();
    const can = (p: string) => access.isSuperAdmin || access.permissions.includes(p as typeof access.permissions[number]);
    if (!can("dashboard.view"))
        redirect("/dashboard");
    const initial = await loadWorkspacePreference(access.user.id, can);
    const allowed = activeWorkspaceCards(allowedCards(can), enabledModules);
    initial.config = { ...initial.config, widgets: initial.config.widgets.filter(id => allowed.includes(id)) };
    if (searchParams.period && periods.includes(searchParams.period as WorkspacePeriod))
        initial.config = { ...initial.config, period: searchParams.period as WorkspacePeriod };
    const summary = await workspaceSummary(initial.config.widgets, initial.config.period, can);
    const shortcuts = groups.filter(g => ["operations", "customers", "marketing", "intelligence", "integrations", "configuration"].includes(g.id)).flatMap(g => g.items.filter(i => i.href !== "/dashboard/ai/copilot").map(i => ({ label: i.label, href: i.href, technical: ["integrations", "configuration"].includes(g.id) })));
    return <MyWorkspace userId={access.user.id} name={access.user.name || "team"} allowed={allowed} initial={initial} initialSummary={summary} shortcuts={shortcuts} canUseAI={can("intelligence.view") && enabledModules.includes("ai")}/>;
}
