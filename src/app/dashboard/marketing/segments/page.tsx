import CustomersDashboard from "@/components/customers/CustomersDashboard";
import { workspaceAccess } from "@/lib/workspace/access";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function SegmentsPage({
  searchParams,
}: {
  searchParams: { tag?: string };
}) {
  const { access } = await workspaceAccess();
  if (!access.permissions.includes("customers.view")) redirect("/dashboard");
  const tag = typeof searchParams.tag === "string" ? searchParams.tag : "ALL";
  return (
    <CustomersDashboard
      key={tag}
      initialTab="NORMAL"
      initialTag={tag}
      audienceMode
    />
  );
}
