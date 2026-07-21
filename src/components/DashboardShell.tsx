"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

type DashboardShellProps = {
  children: React.ReactNode;
  userEmail?: string | null;
};

const bookingNavigation = [
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

const mainNavigation = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Customers", href: "/dashboard/customers" },
  { label: "Drivers", href: "/dashboard/drivers" },
  { label: "Vehicles", href: "/dashboard/vehicles" },
  { label: "AI Intelligence", href: "/dashboard/ai-intelligence" },
  { label: "Reports", href: "/dashboard/reports" },
];

const administrationNavigation = [
  { label: "Autocab", href: "/dashboard/integrations/autocab" },
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
      "flex items-center rounded-xl px-4 py-3 text-sm font-medium transition",
      active
        ? "bg-blue-600 text-white shadow-lg shadow-blue-950/30"
        : "text-slate-300 hover:bg-slate-800 hover:text-white",
    ].join(" ");
  };

  const sidebar = (
    <div className="flex h-full flex-col bg-slate-900">
      <div className="border-b border-slate-800 px-5 py-5">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-400">
              Need A Cab
            </p>

            <h1 className="mt-2 text-2xl font-bold text-white">
              TaxiCRM
            </h1>

            <p className="mt-2 truncate text-sm text-slate-400">
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
        <div className="space-y-2">
          <Link
            href="/dashboard"
            onClick={closeMobileMenu}
            className={navigationLinkClass("/dashboard")}
          >
            Dashboard
          </Link>

          <div>
            <button
              type="button"
              onClick={() => setBookingsOpen((current) => !current)}
              className={[
                "flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-sm font-medium transition",
                pathname.startsWith("/dashboard/bookings")
                  ? "bg-slate-800 text-white"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white",
              ].join(" ")}
              aria-expanded={bookingsOpen}
            >
              <span>Bookings</span>
              <span
                className={[
                  "text-xs transition-transform duration-200",
                  bookingsOpen ? "rotate-180" : "",
                ].join(" ")}
              >
                ▼
              </span>
            </button>

            {bookingsOpen && (
              <div className="mt-2 space-y-1 border-l border-slate-700 pl-3">
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
                        "block rounded-lg px-4 py-2.5 text-sm transition",
                        active
                          ? "bg-blue-600/15 font-semibold text-blue-300"
                          : "text-slate-400 hover:bg-slate-800 hover:text-white",
                      ].join(" ")}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {mainNavigation.slice(1).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={closeMobileMenu}
              className={navigationLinkClass(item.href)}
            >
              {item.label}
            </Link>
          ))}
        </div>

        <div className="my-5 border-t border-slate-800" />

        <p className="mb-2 px-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Administration
        </p>

        <div className="space-y-2">
          {administrationNavigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={closeMobileMenu}
              className={navigationLinkClass(item.href)}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </nav>

      <div className="border-t border-slate-800 p-4">
        <div className="rounded-xl bg-slate-950 px-4 py-3">
          <p className="text-xs font-semibold text-emerald-400">
            System online
          </p>
          <p className="mt-1 text-xs text-slate-500">
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
        <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-900/95 backdrop-blur">
          <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-lg text-white transition hover:bg-slate-700 lg:hidden"
                aria-label="Open menu"
              >
                ☰
              </button>

              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white sm:text-base">
                  TaxiCRM Control Center
                </p>
                <p className="hidden truncate text-xs text-slate-400 sm:block">
                  Autocab integration and booking intelligence
                </p>
              </div>
            </div>

            <Link
              href="/dashboard/integrations/autocab"
              className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-500 sm:px-4 sm:text-sm"
            >
              Autocab
            </Link>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1600px] p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
