import { redirect } from "next/navigation";
import { workspaceAccess } from "@/lib/workspace/access";
import OwnerAgentWorkspace from "@/components/ai/OwnerAgentWorkspace";
import { modulePageBlock } from "@/modules/core/activation/page";
export const dynamic = "force-dynamic";
export default async function OwnerAgentPage() {
  const { access } = await workspaceAccess();
  if (!access.isSuperAdmin && !access.permissions.includes("intelligence.view")) redirect("/dashboard");
  const moduleBlock = await modulePageBlock("ai");
  if (moduleBlock) return moduleBlock;
  return <OwnerAgentWorkspace />;
}
