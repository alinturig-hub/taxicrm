import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import DashboardShell from "@/components/DashboardShell";
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

  const sessionUser =
    session.user as typeof session.user & {
      mustChangePassword?: boolean;
    };

  if (
    sessionUser.mustChangePassword
  ) {
    redirect("/change-password");
  }

  return (
    <DashboardShell userEmail={session.user.email}>
      {children}
    </DashboardShell>
  );
}
