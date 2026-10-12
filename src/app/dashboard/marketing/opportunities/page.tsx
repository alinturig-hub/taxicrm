import CustomerOpportunities from "@/components/marketing/CustomerOpportunities";
import { workspaceAccess } from "@/lib/workspace/access";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function OpportunitiesPage() {
  const { access } = await workspaceAccess();
  if (!access.permissions.includes("intelligence.view")) redirect("/dashboard");
  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-widest text-blue-400">
          Marketing / Opportunities
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-white">
          Customer opportunities
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
          Review the existing customer demand predictions and supporting
          evidence before planning outreach. Predictions do not send messages or
          prove marketing consent.
        </p>
      </header>
      <CustomerOpportunities />
    </div>
  );
}
