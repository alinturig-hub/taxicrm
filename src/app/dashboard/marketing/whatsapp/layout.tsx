import Link from "next/link";
import { workspaceAccess } from "@/lib/workspace/access";
import WhatsAppTabs from "@/components/marketing/WhatsAppTabs";
export default async function Layout({ children }: { children: React.ReactNode }) {
  const { access } = await workspaceAccess();
  const has = (p: string) => access.permissions.some(value => value === p);
  const canConfigure = has("configuration.view") && has("integrations.view");
  const tabs = [
    ...(has("customers.view") ? [{ label: "Campaigns", href: "/dashboard/marketing/whatsapp" }] : []),
    ...(canConfigure ? [{ label: "Templates", href: "/dashboard/marketing/whatsapp/templates" }] : []),
    ...(has("automation.view") ? [{ label: "Flows", href: "/dashboard/marketing/whatsapp/flows" }] : []),
  ];
  return <div className="space-y-6"><div className="flex flex-wrap items-center justify-between gap-3"><WhatsAppTabs tabs={tabs} />{canConfigure && <Link className="text-sm text-app-muted underline" href="/dashboard/integrations/whatsapp">Meta connection</Link>}</div>{children}</div>;
}
