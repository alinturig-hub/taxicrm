"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
export default function IntegrationWorkspaceNav({ canConfigure }: { canConfigure: boolean }) {
  const pathname = usePathname();
  const base = "/dashboard/integrations/autocab";
  const tabs = [["Overview", base], ["Connection", base + "/connection"], ...(canConfigure ? [["API & Sync", base + "/api"]] : []), ["Webhooks", base + "/webhooks"], ...(canConfigure ? [["Activity", base + "/activity"]] : [])];
  return <nav className="integration-tabs" aria-label="Autocab workspace">{tabs.map(([label, href]) => <Link key={href} href={href} aria-current={(pathname === href || (href !== base && pathname.startsWith(href + "/"))) ? "page" : undefined}>{label}</Link>)}</nav>;
}
