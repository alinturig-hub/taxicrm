import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";

const navigation = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Bookings", href: "/dashboard/bookings" },
  { label: "Customers", href: "/dashboard/customers" },
  { label: "Drivers", href: "/dashboard/drivers" },
  { label: "Vehicles", href: "/dashboard/vehicles" },
  { label: "Autocab", href: "/dashboard/integrations/autocab" },
  { label: "Settings", href: "/dashboard/settings" },
];

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
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="flex min-h-screen">
        <aside className="hidden w-72 border-r border-slate-800 bg-slate-900 lg:block">
          <div className="border-b border-slate-800 px-6 py-6">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-400">
              Need A Cab
            </p>

            <h1 className="mt-2 text-2xl font-bold">
              TaxiCRM
            </h1>

            <p className="mt-2 truncate text-sm text-slate-400">
              {session.user.email}
            </p>
          </div>

          <nav className="space-y-2 p-4">
            {navigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded-lg px-4 py-3 text-sm font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="border-b border-slate-800 bg-slate-900 px-6 py-4 lg:px-8">
            <div className="mx-auto flex max-w-7xl items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-white">
                  TaxiCRM Control Center
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  Autocab integration and booking intelligence
                </p>
              </div>

              <Link
                href="/dashboard/integrations/autocab"
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
              >
                Autocab
              </Link>
            </div>
          </header>

          <div className="mx-auto max-w-7xl p-6 lg:p-8">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
