import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import AIAutomationWorkspace from "@/components/ai/AIAutomationWorkspace";
import {
  ADMINISTRATION_PERMISSIONS,
  requireAdministrationPermission,
} from "@/lib/administration-access";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AIAutomationPage() {
  const session =
    await getServerSession(authOptions);

  const access =
    await requireAdministrationPermission(
      session?.user?.email,
      ADMINISTRATION_PERMISSIONS
        .AUTOMATION_VIEW,
    );

  if (!access) {
    redirect("/dashboard");
  }

  return <AIAutomationWorkspace />;
}
