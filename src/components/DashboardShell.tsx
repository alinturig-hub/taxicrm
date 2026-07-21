"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

type DashboardShellProps = {
  children: React.ReactNode;
  userEmail?: string | null;
};

type NavigationItem = {
  label: string;
  href: string;
};

const bookingNavigation: NavigationItem[] = [
  { label: "All Bookings", href: "/dashboard/bookings" },
  { label: "Created", href: "/dashboard/bookings/created" },
  { label: "On Hold", href: "/dashboard/bookings/on-hold" },
  { label: "Dispatched", href: "/dashboard/bookings/dispatched" },
  { label: "Accepted", href: "/dashboard/bookings/accepted" },
  { label: "Arrived", href: "/dashboard/bookings/arrived" },
  {
    label: "Passenger On Board",
    href: "/dashboard/bookings/passenger-on-board",
  },
  { label: "Completed", href: "/dashboard/bookings/completed" },
  { label: "Cancelled", href: "/dashboard/bookings/cancelled" },
  { label: "Rejected", href: "/dashboard/bookings/rejected" },
  { label: "No Show", href: "/dashboard/bookings/no-show" },
];

const operationsNavigation: NavigationItem[] = [
  { label: "Customers", href: "/dashboard/customers" },
  { label: "Drivers", href: "/dashboard/drivers" },
  { label: "Vehicles", href: "/dashboard/vehicles" },
  { label: "Dispatch", href: "/dashboard/dispatch" },
  { label: "Corporate", href: "/dashboard/corporate" },
];

const intelligenceNavigation: NavigationItem[] = [
  { label: "AI Dashboard", href: "/dashboard/ai-intelligence" },
  { label: "KPIs", href: "/dashboard/kpis" },
  { label: "Goals & Targets", href: "/dashboard/goals" },
  { label: "AI Finance", href: "/dashboard/ai-finance" },
  { label: "Predictions", href: "/dashboard/predictions" },
  { label: "Reports", href: "/dashboard/reports" },
];

const administrationNavigation: NavigationItem[] = [
  { label: "Integrations", href: "/dashboard/integrations" },
  { label: "Users", href: "/dashboard/users" },
  { label: "Roles", href: "/dashboard/roles" },
  { label: "Settings", href: "/dashboard/settings" },
];

function isRouteActive(pathname: string, href: string) {
  if (href === "/dashboard") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function DashboardShell({
  children,
  userEmail,
}: DashboardShellProps) {
  const pathname = usePathname();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [bookingsOpen, setBookingsOpen] = useState(
    pathname.startsWith("/dashboard/bookings"),
  );

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  const navigationLinkClass = (href: string) => {
    const active = isRouteActive(pathname, href);

    return [
      "flex items-center rounded-xl px-3 py-2.5 text-sm font-medium transition",
      active
        ? "bg-blue-600 text-white shadow-sm shadow-blue-950/40"
        : "text-slate-300 hover:bg-slate-800 hover:text-white",
    ].join(" ");
  };

  const sectionTitleClass =
    "mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500";

  const renderNavigationItems = (items: NavigationItem[]) =>
    items.map((item) => (
      <Link
        key={item.href}
        href={item.href}
        onClick={closeMobileMenu}
        className={navigationLinkClass(item.href)}
      >
        {item.label}
      </Link>
    ));

  const sidebar = (
    <div className="flex h-full flex-col bg-slate-950">
      <div className="border-b border-slate-800 px-5 py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-400">
              Need A Cab
            </p>

            <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">
              TaxiCRM
            </h1>

            <p className="mt-2 truncate text-sm text-slate-500">
              {userEmail || "Administrator"}
            </p>
          </div>

          <button
            type="button"
            onClick={closeMobileMenu}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white lg:hidden"
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-4 py-5">
        <section>
          <p className={sectionTitleClass}>Dashboard</p>

          <div className="space-y-1">
            <Link
              href="/dashboard"
              onClick={closeMobileMenu}
              className={navigationLinkClass("/dashboard")}
            >
              Overview
            </Link>
          </div>
        </section>

        <section className="mt-6">
          <p className={sectionTitleClass}>Operations</p>

          <div className="space-y-1">
            <div>
              <button
                type="button"
                onClick={() => setBookingsOpen((current) => !current)}
                className={[
                  "flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-medium transition",
                  pathname.startsWith("/dashboard/bookings")
                    ? "bg-slate-800 text-white"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white",
                ].join(" ")}
                aria-expanded={bookingsOpen}
              >
                <span>Bookings</span>

                <span
                  className={[
                    "text-[10px] transition-transform duration-200",
                    bookingsOpen ? "rotate-180" : "",
                  ].join(" ")}
                >
                  ▼
                </span>
              </button>

              {bookingsOpen && (
                <div className="ml-3 mt-2 space-y-1 border-l border-slate-800 pl-3">
                  {bookingNavigation.map((item) => {
                    const active =
                      item.href === "/dashboard/bookings"
                        ? pathname === item.href
                        : isRouteActive(pathname, item.href);

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={closeMobileMenu}
                        className={[
                          "block rounded-lg px-3 py-2 text-sm transition",
                          active
                            ? "bg-blue-500/10 font-semibold text-blue-300"
                            : "text-slate-500 hover:bg-slate-800 hover:text-white",
                        ].join(" ")}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {renderNavigationItems(operationsNavigation)}
          </div>
        </section>

        <section className="mt-6">
          <p className={sectionTitleClass}>Intelligence</p>

          <div className="space-y-1">
            {renderNavigationItems(intelligenceNavigation)}
          </div>
        </section>

        <section className="mt-6">
          <p className={sectionTitleClass}>Administration</p>

          <div className="space-y-1">
            {renderNavigationItems(administrationNavigation)}
          </div>
        </section>
      </nav>

      <div className="border-t border-slate-800 p-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />

            <p className="text-xs font-semibold text-emerald-400">
              System online
            </p>
          </div>

          <p className="mt-1.5 text-xs text-slate-500">
            Live booking intelligence
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 border-r border-slate-800 lg:block">
        {sidebar}
      </aside>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close menu overlay"
            onClick={closeMobileMenu}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />

          <aside className="absolute inset-y-0 left-0 w-[88%] max-w-80 border-r border-slate-800 shadow-2xl">
            {sidebar}
          </aside>
        </div>
      )}

      <div className="min-w-0 lg:pl-72">
        <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/90 backdrop-blur-xl">
          <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-lg text-white transition hover:bg-slate-800 lg:hidden"
                aria-label="Open menu"
              >
                ☰
              </button>

              <div className="min-w-0">
                <p className="truncate text-base font-semibold tracking-tight text-white sm:text-lg">
                  TaxiCRM
                </p>

                <p className="hidden truncate text-xs text-slate-500 sm:block">
                  Operations Control Center
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                className="hidden min-w-44 rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-left text-sm text-slate-500 transition hover:border-slate-700 hover:text-slate-300 md:block"
                aria-label="Global search"
              >
                Search bookings, drivers...
              </button>

              <Link
                href="/dashboard/ai-intelligence"
                className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-sm font-semibold text-blue-300 transition hover:bg-blue-500/20"
                aria-label="AI Intelligence"
              >
                AI
              </Link>

              <button
                type="button"
                className="relative rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-800 hover:text-white"
                aria-label="Notifications"
              >
                🔔
                <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-slate-950 bg-red-500" />
              </button>

              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-800 bg-slate-900 text-sm font-bold text-white transition hover:bg-slate-800"
                aria-label="User profile"
              >
                {userEmail?.charAt(0).toUpperCase() || "A"}
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1600px] p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
