import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getAdministrationAccess } from "@/lib/administration-access";
import { visibleNavigation } from "./navigation";
export async function workspaceAccess() {
  const session = await getServerSession(authOptions);
  const access = await getAdministrationAccess(session?.user?.email);
  if (!access) redirect("/login");
  return {
    access,
    groups: visibleNavigation(access.permissions, access.user.legacyRole),
  };
}
export async function workspaceGroup(id: string) {
  const { groups } = await workspaceAccess();
  const group = groups.find((g) => g.id === id);
  if (!group) redirect("/dashboard");
  return group;
}
