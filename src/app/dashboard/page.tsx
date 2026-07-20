import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-slate-950 p-8 text-white">
      <div className="mx-auto max-w-6xl">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-blue-400">
          Need A Cab
        </p>

        <h1 className="mt-3 text-3xl font-bold">
          TaxiCRM Dashboard
        </h1>

        <p className="mt-4 text-slate-400">
          Autentificat ca {session.user.email}
        </p>
      </div>
    </main>
  );
}
