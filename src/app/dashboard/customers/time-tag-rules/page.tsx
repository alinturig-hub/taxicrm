import { redirect } from "next/navigation";
import { workspaceAccess } from "@/lib/workspace/access";
import LocationTagRuleSettings from "@/components/customers/LocationTagRuleSettings";
import TimeTagRuleSettings from "@/components/customers/TimeTagRuleSettings";
export const dynamic = "force-dynamic";
export default async function Page() { const { access } = await workspaceAccess(); if (!access.isSuperAdmin && !access.permissions.includes("customers.manage"))
    redirect("/dashboard"); return <><TimeTagRuleSettings /><LocationTagRuleSettings /></>; }
