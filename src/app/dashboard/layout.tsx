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

  return (
    <DashboardShell userEmail={session.user.email}>
      {children}
    </DashboardShell>
  );
}
