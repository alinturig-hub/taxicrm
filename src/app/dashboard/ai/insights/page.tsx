import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import AIInsightsWorkspace from "@/components/ai/AIInsightsWorkspace";
import {
  ADMINISTRATION_PERMISSIONS,
  requireAdministrationPermission,
} from "@/lib/administration-access";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AIInsightsPage() {
  const session =
    await getServerSession(authOptions);

  const access =
    await requireAdministrationPermission(
      session?.user?.email,
      ADMINISTRATION_PERMISSIONS
        .INTELLIGENCE_VIEW,
    );

  if (!access) {
    redirect("/dashboard");
  }

  return <AIInsightsWorkspace />;
}
