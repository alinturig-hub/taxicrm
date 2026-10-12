import ModuleHub from "@/components/workspace/ModuleHub";
import { workspaceGroup } from "@/lib/workspace/access";
export const dynamic = "force-dynamic";
export default async function OperationsPage() {
  return <ModuleHub group={await workspaceGroup("operations")} />;
}
