import Link from "next/link";

const configurationModules = [
  {
    title: "Integrations",
    description:
      "Configure and monitor external systems such as Autocab, payment providers and communication platforms.",
    href: "/dashboard/configuration/integrations",
    status: "Active",
  },
  {
    title: "Webhooks",
    description:
      "View incoming webhook endpoints, event processing status and delivery activity.",
    href: "/dashboard/configuration/webhooks",
    status: "Active",
  },
  {
    title: "API Keys",
    description:
      "Manage credentials used by approved external services and internal applications.",
    href: "/dashboard/configuration/api-keys",
    status: "Planned",
  },
  {
    title: "Organizations",
    description:
      "Manage TaxiCRM organizations, operational profiles and account-level configuration.",
    href: "/dashboard/configuration/organizations",
    status: "Planned",
  },
  {
    title: "Users & Roles",
    description:
      "Control user access, roles and permissions across the TaxiCRM platform.",
    href: "/dashboard/configuration/users-roles",
    status: "Planned",
  },
  {
    title: "Audit Logs",
    description:
      "Review administrative actions, configuration changes and security events.",
    href: "/dashboard/configuration/audit-logs",
    status: "Planned",
  },
  {
    title: "System Health",
    description:
      "Monitor application services, webhook processing and integration availability.",
    href: "/dashboard/configuration/system-health",
    status: "Planned",
  },
];

export default function ConfigurationPage() {
  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl shadow-black/10">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-400">
              Platform Administration
            </p>

            <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">
              Configuration
            </h1>

            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
              Manage integrations, webhook infrastructure, access control and
              operational settings from one central workspace.
            </p>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />

            <div>
              <p className="text-sm font-semibold text-emerald-300">
                Configuration online
              </p>

              <p className="text-xs text-emerald-400/70">
                Core services available
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {configurationModules.map((module) => {
          const active = module.status === "Active";

          return (
            <Link
              key={module.href}
              href={module.href}
              className="group rounded-2xl border border-slate-800 bg-slate-900 p-5 transition hover:-translate-y-0.5 hover:border-blue-500/40 hover:bg-slate-900/90 hover:shadow-xl hover:shadow-black/20"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-white transition group-hover:text-blue-300">
                    {module.title}
                  </h2>

                  <p className="mt-3 text-sm leading-6 text-slate-400">
                    {module.description}
                  </p>
                </div>

                <span
                  className={[
                    "shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide",
                    active
                      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                      : "border-slate-700 bg-slate-800 text-slate-400",
                  ].join(" ")}
                >
                  {module.status}
                </span>
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-slate-800 pt-4">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Open module
                </span>

                <span className="text-blue-400 transition group-hover:translate-x-1">
                  →
                </span>
              </div>
            </Link>
          );
        })}
      </section>
    </div>
  );
}
