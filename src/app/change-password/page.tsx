import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import ChangePasswordForm from "@/components/administration/ChangePasswordForm";
import { authOptions } from "@/lib/auth";

export default async function ChangePasswordPage() {
  const session =
    await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <main data-auth="true" className="flex min-h-screen items-center justify-center bg-[#171C25] p-6">
      <ChangePasswordForm />
    </main>
  );
}
