import { workspaceGroup } from "@/lib/workspace/access";
import VoucherWorkspace from "@/components/marketing/VoucherWorkspace";
export const dynamic = "force-dynamic";
export default async function Page(){await workspaceGroup("marketing");return <VoucherWorkspace/>;}
