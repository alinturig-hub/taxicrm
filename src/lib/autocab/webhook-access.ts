import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasAdministrationPermission } from "@/lib/administration-access";
export async function webhookAccess(write: boolean) {
  const session = await getServerSession(authOptions);
  return hasAdministrationPermission(
    session?.user?.email,
    write ? "configuration.manage" : "configuration.view",
  );
}
