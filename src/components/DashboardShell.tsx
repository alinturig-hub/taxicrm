"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import {
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";

type IconName =
  | "dashboard"
  | "live"
  | "bookings"
  | "drivers"
  | "fleet"
  | "customers"
  | "executive"
  | "performance"
  | "revenue"
  | "reports"
  | "copilot"
  | "insights"
  | "predictions"
  | "automation"
  | "autocab"
  | "webhooks"
  | "sync"
  | "keys"
  | "users"
  | "roles"
  | "company"
  | "system";

type NavigationItem = {
  label: string;
  href: string;
  icon: IconName;
  available: boolean;
};

type NavigationGroup = {
  id: string;
  label: string;
  items: NavigationItem[];
};

const navigationGroups: NavigationGroup[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    items: [
      {
        label: "Overview",
        href: "/dashboard",
        icon: "dashboard",
        available: true,
      },
      {
        label: "Live Operations",
        href: "/dashboard/live",
        icon: "live",
        available: true,
      },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    items: [
      {
        label: "Bookings",
        href: "/dashboard/bookings",
        icon: "bookings",
        available: true,
      },
      {
        label: "Drivers",
        href: "/dashboard/drivers",
        icon: "drivers",
        available: true,
      },
      {
        label: "Fleet",
        href: "/dashboard/fleet",
        icon: "fleet",
        available: true,
      },
      {
        label: "Customers",
        href: "/dashboard/customers",
        icon: "customers",
        available: true,
      },
      {
        label: "Zones",
        href: "/dashboard/zones",
        icon: "fleet",
        available: true,
      },
    ],
  },
  {
    id: "intelligence",
    label: "Intelligence",
    items: [
      {
        label: "Executive",
        href: "/dashboard/intelligence/executive",
        icon: "executive",
        available: false,
      },
      {
        label: "Performance",
        href: "/dashboard/intelligence/performance",
        icon: "performance",
        available: false,
      },
      {
        label: "Revenue",
        href: "/dashboard/intelligence/revenue",
        icon: "revenue",
        available: false,
      },
      {
        label: "Reports",
        href: "/dashboard/intelligence/reports",
        icon: "reports",
        available: false,
      },
    ],
  },
  {
    id: "ai-center",
    label: "AI Center",
    items: [
      {
        label: "Copilot",
        href: "/dashboard/ai/copilot",
        icon: "copilot",
        available: false,
      },
      {
        label: "Insights",
        href: "/dashboard/ai/insights",
        icon: "insights",
        available: true,
      },
      {
        label: "Predictions",
        href: "/dashboard/ai/predictions",
        icon: "predictions",
        available: true,
      },
      {
        label: "Automation",
        href: "/dashboard/ai/automation",
        icon: "automation",
        available: true,
      },
    ],
  },
  {
    id: "integrations",
    label: "Integrations",
    items: [
      {
        label: "Webhooks",
        href: "/dashboard/integrations/autocab/webhooks",
        icon: "webhooks",
        available: true,
      },
      {
        label: "Sync Jobs",
        href: "/dashboard/integrations/sync-jobs",
        icon: "sync",
        available: false,
      },
      {
        label: "API Keys",
        href: "/dashboard/integrations/api-keys",
        icon: "keys",
        available: false,
      },
    ],
  },
  {
    id: "administration",
    label: "Administration",
    items: [
      {
        label: "Configuration",
        href: "/dashboard/configuration",
        icon: "system",
        available: true,
      },
      {
        label: "Autocab",
        href: "/dashboard/integrations/autocab",
        icon: "autocab",
        available: true,
      },
      {
        label: "Users",
        href: "/dashboard/administration/users",
        icon: "users",
        available: true,
      },
      {
        label: "Roles",
        href: "/dashboard/administration/roles",
        icon: "roles",
        available: true,
      },
      {
        label: "Company",
        href: "/dashboard/administration/company",
        icon: "company",
        available: false,
      },
      {
        label: "System",
        href: "/dashboard/administration/system",
        icon: "system",
        available: false,
      },
    ],
  },
];

function isItemActive(
  pathname: string,
  item: NavigationItem,
) {
  if (item.href === "/dashboard") {
    return pathname === "/dashboard";
  }

  if (
    item.href ===
    "/dashboard/integrations/autocab"
  ) {
    return (
      pathname === item.href ||
      (pathname.startsWith(`${item.href}/`) &&
        !pathname.startsWith(
          "/dashboard/integrations/autocab/webhooks",
        ))
    );
  }

  return (
    pathname === item.href ||
    pathname.startsWith(`${item.href}/`)
  );
}

function getActiveGroup(pathname: string) {
  return (
    navigationGroups.find((group) =>
      group.items.some(
        (item) =>
          item.available &&
          isItemActive(pathname, item),
      ),
    )?.id ?? "dashboard"
  );
}

export default function DashboardShell({
  children,
  userEmail,
}: {
  children: ReactNode;
  userEmail?: string | null;
}) {
  const pathname = usePathname();

  const activeGroup = useMemo(
    () => getActiveGroup(pathname),
    [pathname],
  );

  const [openGroup, setOpenGroup] =
    useState(activeGroup);
  const [mobileOpen, setMobileOpen] =
    useState(false);

  useEffect(() => {
    setOpenGroup(activeGroup);
    setMobileOpen(false);
  }, [activeGroup, pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen
      ? "hidden"
      : "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const displayName =
    userEmail?.split("@")[0] ||
    "Account";

  const initials = displayName
    .split(/\s+/)
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen bg-[#020817] text-slate-100">
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-64 border-r border-slate-800/90 bg-[#07101f] lg:flex lg:flex-col">
        <SidebarContent
          pathname={pathname}
          openGroup={openGroup}
          setOpenGroup={setOpenGroup}
          displayName={displayName}
          email={userEmail ?? null}
          initials={initials}
        />
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-[70] lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />

          <aside className="absolute inset-y-0 left-0 flex w-[min(18rem,88vw)] flex-col border-r border-slate-800 bg-[#07101f] shadow-2xl">
            <SidebarContent
              pathname={pathname}
              openGroup={openGroup}
              setOpenGroup={setOpenGroup}
              displayName={displayName}
              email={userEmail ?? null}
              initials={initials}
              onNavigate={() =>
                setMobileOpen(false)
              }
              onClose={() =>
                setMobileOpen(false)
              }
            />
          </aside>
        </div>
      ) : null}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-40 flex h-16 items-center border-b border-slate-800/90 bg-[#020817]/90 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <button
            type="button"
            aria-label="Open navigation"
            onClick={() => setMobileOpen(true)}
            className="mr-3 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-slate-300 transition hover:border-slate-700 hover:text-white lg:hidden"
          >
            <MenuIcon />
          </button>

          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">
              Operations Control Center
            </p>

            <p className="hidden text-xs text-slate-500 sm:block">
              Live operations, intelligence and
              integrations
            </p>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <div className="hidden min-w-64 items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2.5 text-sm text-slate-500 xl:flex">
              <SearchIcon />

              <span>
                Search bookings, drivers...
              </span>

              <span className="ml-auto rounded-md border border-slate-700 bg-slate-950 px-1.5 py-0.5 text-[10px] text-slate-600">
                /
              </span>
            </div>

            <button
              type="button"
              className="inline-flex h-10 min-w-10 items-center justify-center rounded-xl border border-blue-500/30 bg-blue-500/10 px-3 text-sm font-semibold text-blue-300 transition hover:bg-blue-500/20"
            >
              AI
            </button>

            <button
              type="button"
              aria-label="Notifications"
              className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-slate-300 transition hover:border-slate-700 hover:text-white"
            >
              <BellIcon />

              <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-red-500" />
            </button>

            <div className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-800 bg-slate-900 text-sm font-bold text-white lg:hidden">
              {initials || "A"}
            </div>
          </div>
        </header>

        <main className="min-h-[calc(100vh-4rem)] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}

function SidebarContent({
  pathname,
  openGroup,
  setOpenGroup,
  displayName,
  email,
  initials,
  onNavigate,
  onClose,
}: {
  pathname: string;
  openGroup: string;
  setOpenGroup: (groupId: string) => void;
  displayName: string;
  email: string | null;
  initials: string;
  onNavigate?: () => void;
  onClose?: () => void;
}) {
  return (
    <>
      <div className="flex h-16 items-center border-b border-slate-800/90 px-5">
        <Link
          href="/dashboard"
          onClick={onNavigate}
          className="flex min-w-0 items-center gap-3"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 shadow-lg shadow-blue-950/40">
            <TaxiIcon />
          </div>

          <div className="min-w-0">
            <p className="truncate text-base font-bold tracking-tight text-white">
              TaxiCRM
            </p>

            <p className="truncate text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500">
              Operations Platform
            </p>
          </div>
        </Link>

        {onClose ? (
          <button
            type="button"
            aria-label="Close navigation"
            onClick={onClose}
            className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-800 text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            <CloseIcon />
          </button>
        ) : null}
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-2">
          {navigationGroups.map((group) => {
            const isOpen =
              openGroup === group.id;

            const groupIsActive =
              group.items.some(
                (item) =>
                  item.available &&
                  isItemActive(pathname, item),
              );

            return (
              <section key={group.id}>
                <button
                  type="button"
                  onClick={() =>
                    setOpenGroup(
                      isOpen ? "" : group.id,
                    )
                  }
                  aria-expanded={isOpen}
                  className={[
                    "flex w-full items-center rounded-xl px-3 py-2.5 text-left transition",
                    groupIsActive
                      ? "text-white"
                      : "text-slate-500 hover:bg-slate-900 hover:text-slate-300",
                  ].join(" ")}
                >
                  <span className="text-[11px] font-bold uppercase tracking-[0.18em]">
                    {group.label}
                  </span>

                  <span
                    className={[
                      "ml-auto transition-transform duration-200",
                      isOpen
                        ? "rotate-180"
                        : "rotate-0",
                    ].join(" ")}
                  >
                    <ChevronIcon />
                  </span>
                </button>

                <div
                  className={[
                    "grid overflow-hidden transition-all duration-300",
                    isOpen
                      ? "grid-rows-[1fr] opacity-100"
                      : "grid-rows-[0fr] opacity-0",
                  ].join(" ")}
                >
                  <div className="min-h-0">
                    <div className="space-y-1 pb-2 pt-1">
                      {group.items.map((item) => (
                        <SidebarItem
                          key={item.href}
                          item={item}
                          active={
                            item.available &&
                            isItemActive(
                              pathname,
                              item,
                            )
                          }
                          onNavigate={onNavigate}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      </nav>

      <div className="border-t border-slate-800/90 p-3">
        <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-800 text-sm font-bold text-white">
            {initials || "A"}
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">
              {displayName}
            </p>

            <p className="truncate text-xs text-slate-500">
              {email ?? "Administrator"}
            </p>
          </div>

          <button
            type="button"
            aria-label="Sign out"
            onClick={() =>
              signOut({
                callbackUrl: "/login",
              })
            }
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-800 hover:text-red-300"
          >
            <LogoutIcon />
          </button>
        </div>
      </div>
    </>
  );
}

function SidebarItem({
  item,
  active,
  onNavigate,
}: {
  item: NavigationItem;
  active: boolean;
  onNavigate?: () => void;
}) {
  const content = (
    <>
      <span
        className={[
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition",
          active
            ? "bg-blue-500/15 text-blue-300"
            : item.available
              ? "text-slate-500 group-hover:text-slate-300"
              : "text-slate-700",
        ].join(" ")}
      >
        <NavigationIcon name={item.icon} />
      </span>

      <span className="min-w-0 flex-1 truncate">
        {item.label}
      </span>

      {!item.available ? (
        <span className="rounded-md border border-slate-800 bg-slate-950 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-600">
          Soon
        </span>
      ) : null}

      {active ? (
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400 shadow-[0_0_10px_rgba(96,165,250,0.8)]" />
      ) : null}
    </>
  );

  const className = [
    "group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-medium transition",
    active
      ? "border border-blue-500/20 bg-blue-500/10 text-white"
      : item.available
        ? "border border-transparent text-slate-400 hover:bg-slate-900 hover:text-white"
        : "cursor-not-allowed border border-transparent text-slate-700",
  ].join(" ");

  if (!item.available) {
    return (
      <div
        aria-disabled="true"
        className={className}
      >
        {content}
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={className}
    >
      {content}
    </Link>
  );
}

function NavigationIcon({
  name,
}: {
  name: IconName;
}) {
  const paths: Record<IconName, ReactNode> = {
    dashboard: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </>
    ),
    live: (
      <>
        <path d="M4 12h3l2-5 4 10 2-5h5" />
        <circle cx="12" cy="12" r="9" />
      </>
    ),
    bookings: (
      <>
        <rect x="4" y="5" width="16" height="15" rx="2" />
        <path d="M8 3v4M16 3v4M4 10h16M8 14h3M8 17h6" />
      </>
    ),
    drivers: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M5 21a7 7 0 0 1 14 0" />
      </>
    ),
    fleet: (
      <>
        <path d="M3 15V9l2-4h12l4 7v3" />
        <path d="M5 15h14v4H5z" />
        <circle cx="7" cy="19" r="2" />
        <circle cx="17" cy="19" r="2" />
      </>
    ),
    customers: (
      <>
        <circle cx="9" cy="8" r="3" />
        <circle cx="17" cy="9" r="2.5" />
        <path d="M3 20a6 6 0 0 1 12 0M14 15a5 5 0 0 1 7 5" />
      </>
    ),
    executive: (
      <>
        <path d="M4 19V5M4 19h16" />
        <path d="m7 15 4-4 3 2 5-6" />
      </>
    ),
    performance: (
      <>
        <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
        <circle cx="12" cy="12" r="5" />
        <path d="m12 12 3-3" />
      </>
    ),
    revenue: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M16 8h-5a2 2 0 1 0 0 4h2a2 2 0 1 1 0 4H8M12 6v12" />
      </>
    ),
    reports: (
      <>
        <path d="M6 3h9l4 4v14H6z" />
        <path d="M14 3v5h5M9 13h6M9 17h6" />
      </>
    ),
    copilot: (
      <>
        <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
        <circle cx="12" cy="12" r="6" />
        <path d="M9 12h.01M15 12h.01M9.5 15h5" />
      </>
    ),
    insights: (
      <>
        <path d="M9 18h6M10 22h4" />
        <path d="M8 14a7 7 0 1 1 8 0c-1 .8-1 2-1 2H9s0-1.2-1-2Z" />
      </>
    ),
    predictions: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M8 15c1-4 3-6 8-7M8 8h.01M16 16h.01" />
      </>
    ),
    automation: (
      <>
        <path d="M4 7h11M15 7l-3-3M15 7l-3 3" />
        <path d="M20 17H9M9 17l3-3M9 17l3 3" />
      </>
    ),
    autocab: (
      <>
        <path d="M3 15V9l2-4h12l4 7v3" />
        <path d="M5 15h14v4H5z" />
        <path d="M8 9h8" />
      </>
    ),
    webhooks: (
      <>
        <circle cx="6" cy="7" r="3" />
        <circle cx="18" cy="7" r="3" />
        <circle cx="12" cy="18" r="3" />
        <path d="M8.5 9 10.5 15M15.5 9 13.5 15M9 7h6" />
      </>
    ),
    sync: (
      <>
        <path d="M20 7h-5V2" />
        <path d="M4 17h5v5" />
        <path d="M5.5 9a8 8 0 0 1 13-3l1.5 1M18.5 15a8 8 0 0 1-13 3L4 17" />
      </>
    ),
    keys: (
      <>
        <circle cx="8" cy="15" r="4" />
        <path d="m11 12 8-8M15 8l2 2M18 5l2 2" />
      </>
    ),
    users: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 20a6 6 0 0 1 12 0M18 8v6M15 11h6" />
      </>
    ),
    roles: (
      <>
        <path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    company: (
      <>
        <path d="M4 21V5h10v16M14 9h6v12M8 9h2M8 13h2M8 17h2M17 13h1M17 17h1" />
      </>
    ),
    system: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1A1.7 1.7 0 0 0 4.6 15 1.7 1.7 0 0 0 3 14H3v-4h.2a1.7 1.7 0 0 0 1.4-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6V3h4v.2a1.7 1.7 0 0 0 1 1.4 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
      </>
    ),
  };

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[18px] w-[18px]"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className="h-5 w-5"
    >
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className="h-5 w-5"
    >
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className="h-4 w-4"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[18px] w-[18px]"
    >
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M10 21h4" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[18px] w-[18px]"
    >
      <path d="M10 17l5-5-5-5M15 12H3" />
      <path d="M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5" />
    </svg>
  );
}

function TaxiIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5 text-white"
    >
      <path d="M4 15V9l2-4h12l2 4v6" />
      <path d="M5 15h14v4H5zM8 9h8" />
      <circle cx="7" cy="19" r="1.5" />
      <circle cx="17" cy="19" r="1.5" />
    </svg>
  );
}
