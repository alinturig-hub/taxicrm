import { redirect } from "next/navigation";
import { workspaceAccess } from "@/lib/workspace/access";
import FlowLibrary from "@/components/marketing/flows/FlowLibrary";
export const dynamic = "force-dynamic";
export default async function Page() {
  const { access } = await workspaceAccess();
  if (!access.permissions.includes("automation.view"))
    redirect("/dashboard/workspace");
  const workspace = process.env.WHATSAPP_WORKSPACE_ID || "needacabplus";
  return (
    <FlowLibrary
      storageScope={workspace + ":" + access.user.id}
      canEdit={access.permissions.includes("automation.manage")}
    />
  );
}
