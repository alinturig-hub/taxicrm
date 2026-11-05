import { redirect } from "next/navigation";
import { workspaceAccess } from "@/lib/workspace/access";
import FlowBuilder from "@/components/marketing/flows/FlowBuilder";
export const dynamic = "force-dynamic";
export default async function Page() {
  const { access } = await workspaceAccess();
  if (!access.permissions.includes("automation.view"))
    redirect("/dashboard/workspace");
  const workspace = process.env.WHATSAPP_WORKSPACE_ID || "needacabplus";
  return (
    <FlowBuilder
      storageScope={workspace + ":" + access.user.id}
      canEdit={access.permissions.includes("automation.manage")}
    />
  );
}
