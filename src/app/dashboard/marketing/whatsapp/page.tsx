import { workspaceGroup } from "@/lib/workspace/access";
import WhatsAppMarketing from "@/components/marketing/WhatsAppMarketing";
export const dynamic = "force-dynamic";
export default async function Page() {
  await workspaceGroup("marketing");
  return <WhatsAppMarketing />;
}
