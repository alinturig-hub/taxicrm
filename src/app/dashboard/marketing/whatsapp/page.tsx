import { redirect } from "next/navigation";
import { workspaceAccess } from "@/lib/workspace/access";
import WhatsAppMarketing from "@/components/marketing/WhatsAppMarketing";
export const dynamic = "force-dynamic";
export default async function Page() {
  const { access } = await workspaceAccess();
  if (!access.permissions.includes("customers.view")) redirect("/dashboard/workspace");
  return <WhatsAppMarketing />;
}
