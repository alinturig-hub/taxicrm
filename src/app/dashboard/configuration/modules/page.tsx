import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { requireAdministrationPermission } from "@/lib/administration-access";
import ModuleAdministration from "@/components/modules/ModuleAdministration";
import { loadModuleState } from "@/modules/core/activation/store";
export const dynamic = "force-dynamic";
export default async function ModulesPage() {
  const access = await requireAdministrationPermission((await getServerSession(authOptions))?.user?.email, "configuration.manage");
  if (!access) redirect("/dashboard/workspace");
  const state = await loadModuleState().catch(() => null);
  return <ModuleAdministration initial={state} />;
}
