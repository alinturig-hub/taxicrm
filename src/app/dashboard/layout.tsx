import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import DashboardShell from "@/components/DashboardShell";
import { getAdministrationAccess } from "@/lib/administration-access";
import { authOptions } from "@/lib/auth";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  const sessionUser = session.user as typeof session.user & {
    mustChangePassword?: boolean;
  };

  if (sessionUser.mustChangePassword) {
    redirect("/change-password");
  }

  const access = await getAdministrationAccess(session.user.email);
  if (!access) redirect("/login");

  return (
    <DashboardShell
      userEmail={session.user.email}
      permissions={access.permissions}
      role={access.user.legacyRole}
    >
      {children}
    </DashboardShell>
  );
}
