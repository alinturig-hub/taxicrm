import Link from "next/link";
import { workspaceAccess } from "@/lib/workspace/access";
import { prisma } from "@/lib/prisma";
import { startOfLondonDay, addLondonDays } from "@/lib/time/london-calendar";
export const dynamic = "force-dynamic";
export default async function WorkspacePage() {
  const { access, groups } = await workspaceAccess();
  const can = (permission: string) =>
    access.isSuperAdmin ||
    access.permissions.includes(
      permission as (typeof access.permissions)[number],
    );
  const start = startOfLondonDay(new Date()),
    end = addLondonDays(start, 1);
  const [pickups, customers, drivers, failed] = await Promise.all([
    can("bookings.view")
      ? prisma.booking.count({
          where: { pickupDueTime: { gte: start, lt: end } },
        })
      : Promise.resolve(null),
    can("customers.view")
      ? prisma.normalCustomer.count()
      : Promise.resolve(null),
    can("drivers.view") ? prisma.driver.count() : Promise.resolve(null),
    can("integrations.view")
      ? prisma.webhookEvent.count({ where: { status: "FAILED" } })
      : Promise.resolve(null),
  ]);
  const cards = [
    {
      label: "Pickup records today",
      value: pickups,
      note: "Known pickup times · Europe/London",
      href: "/dashboard/bookings",
    },
    {
      label: "Customer profiles",
      value: customers,
      note: "All stored individual profiles",
      href: "/dashboard/customers",
    },
    {
      label: "Driver profiles",
      value: drivers,
      note: "Registered profiles, not live availability",
      href: "/dashboard/drivers",
    },
    {
      label: "Failed webhook events",
      value: failed,
      note: "Recorded failures · review event history",
      href: can("configuration.view")
        ? "/dashboard/configuration/webhooks/events"
        : "/dashboard/integrations/autocab/webhooks",
    },
  ].filter((card) => card.value !== null);
  const workspaces = groups.filter(
    (group) =>
      !["overview", "integrations", "configuration"].includes(group.id),
  );
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[.18em] text-app-muted">
            Your daily workspace
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-app-primary">
            Today
          </h1>
          <p className="mt-2 text-sm text-app-muted">
            Welcome, {access.user.name || "team"}. Review the operation and
            choose your next action.
          </p>
        </div>
        <span className="rounded-lg border border-app-border bg-surface px-3 py-2 text-xs text-app-muted">
          {new Intl.DateTimeFormat("en-GB", {
            dateStyle: "full",
            timeZone: "Europe/London",
          }).format(start)}{" "}
          · Europe/London
        </span>
      </header>
      <section
        aria-label="Recorded activity"
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        {cards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="rounded-xl border border-app-border bg-surface p-5 shadow-card hover:border-brand"
          >
            <p className="text-xs text-app-muted">{card.label}</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums text-app-primary">
              {card.value?.toLocaleString("en-GB")}
            </p>
            <p className="mt-2 text-xs text-app-muted">{card.note}</p>
          </Link>
        ))}
      </section>
      <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <section className="rounded-xl border border-app-border bg-surface">
          <header className="border-b border-app-border p-5">
            <h2 className="font-semibold text-app-primary">Your next step</h2>
            <p className="mt-1 text-xs text-app-muted">
              Open an existing workflow. No automatic changes are made here.
            </p>
          </header>
          <div className="divide-y divide-[var(--border)]">
            {workspaces.map((group) => (
              <Link
                key={group.id}
                href={
                  group.id === "operations" && can("bookings.view")
                    ? "/dashboard/live"
                    : group.items[0].href
                }
                className="flex items-start justify-between gap-4 p-5 hover:bg-surface-hover"
              >
                <div>
                  <h3 className="text-sm font-semibold text-app-primary">
                    {group.label}
                  </h3>
                  <p className="mt-1 text-xs text-app-muted">
                    {group.description}
                  </p>
                </div>
                <span aria-hidden="true" className="text-brand">
                  →
                </span>
              </Link>
            ))}
          </div>
        </section>
        <section className="rounded-xl border border-app-border bg-surface p-5">
          <h2 className="font-semibold text-app-primary">Data and context</h2>
          <p className="mt-3 text-sm leading-6 text-app-secondary">
            Today&apos;s pickup count uses recorded pickup times. Records without a
            pickup time are excluded. Customer and driver counts cover stored
            profiles, not today&apos;s activity.
          </p>
          {failed !== null && (
            <p className="mt-4 text-sm text-app-secondary">
              {failed > 0
                ? `${failed.toLocaleString("en-GB")} webhook events have a recorded failure. Review their processing history before retrying.`
                : "No webhook events currently have a recorded FAILED status. This does not confirm external connection health."}
            </p>
          )}
          <div className="mt-5 space-y-2 border-t border-app-border pt-4">
            {groups
              .filter((group) =>
                ["integrations", "configuration"].includes(group.id),
              )
              .map((group) => (
                <Link
                  key={group.id}
                  href={group.items[0].href}
                  className="block rounded-lg px-3 py-2 text-sm text-brand hover:bg-brand-soft"
                >
                  {group.label} →
                </Link>
              ))}
          </div>
        </section>
      </div>
    </div>
  );
}
