"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import CustomerProfileDrawer from "@/components/customers/CustomerProfileDrawer";

type AccountCustomer = {
  id: string;
  externalId: string;
  accountCode: string;
  displayName: string | null;
  accountType: string | null;
  active: boolean;
  suspended: boolean;
  suspendedReason: string | null;
  companyName: string | null;
  contactName: string | null;
  telephone: string | null;
  email: string | null;
  lastSyncedAt: string;
};

type NormalCustomer = {
  key: string;
  name: string | null;
  telephoneNumber: string | null;
  email: string | null;
  totalBookings: number;
  lastBookingAt: string | null;
};

type CustomersResponse = {
  success: boolean;
  message?: string;
  summary?: {
    accountCustomers: number;
    normalCustomers: number;
    total: number;
  };
  accountCustomers?: AccountCustomer[];
  normalCustomers?: NormalCustomer[];
};

type Tab = "ACCOUNT" | "NORMAL";

function formatDate(value: string | null) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function CustomersDashboard() {
  const [tab, setTab] =
    useState<Tab>("ACCOUNT");
  const [search, setSearch] =
    useState("");
  const [loading, setLoading] =
    useState(true);
  const [syncing, setSyncing] =
    useState(false);
  const [error, setError] =
    useState<string | null>(null);
  const [message, setMessage] =
    useState<string | null>(null);

  const [accountCustomers, setAccountCustomers] =
    useState<AccountCustomer[]>([]);
  const [normalCustomers, setNormalCustomers] =
    useState<NormalCustomer[]>([]);
  const [
    selectedCustomerId,
    setSelectedCustomerId,
  ] = useState<string | null>(null);

  const loadCustomers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        "/api/dashboard/customers",
        {
          cache: "no-store",
        },
      );

      const payload =
        (await response.json()) as CustomersResponse;

      if (!response.ok || !payload.success) {
        throw new Error(
          payload.message ??
            "Customers could not be loaded.",
        );
      }

      setAccountCustomers(
        payload.accountCustomers ?? [],
      );
      setNormalCustomers(
        payload.normalCustomers ?? [],
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to load customers.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCustomers();
  }, [loadCustomers]);

  async function syncCustomers() {
    try {
      setSyncing(true);
      setError(null);
      setMessage(null);

      const response = await fetch(
        "/api/dashboard/integrations/autocab/accounts/sync",
        {
          method: "POST",
          cache: "no-store",
        },
      );

      const payload = await response.json();

      if (!response.ok || !payload.success || !payload.result) {
        throw new Error(
          payload.message ?? "Unable to synchronize customers.",
        );
      }

      setMessage(
        `Sync complete: ${payload.result.recordsCreated} created, ${payload.result.recordsUpdated} updated, ${payload.result.recordsDisabled} disabled, ${payload.result.recordsFailed} failed.`,
      );

      await loadCustomers();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to synchronize customers.",
      );
    } finally {
      setSyncing(false);
    }
  }

  const filteredAccountCustomers =
    useMemo(() => {
      const query =
        search.trim().toLowerCase();

      if (!query) {
        return accountCustomers;
      }

      return accountCustomers.filter(
        (customer) =>
          [
            customer.displayName,
            customer.accountCode,
            customer.contactName,
            customer.telephone,
            customer.email,
            customer.companyName,
            customer.externalId,
          ].some((value) =>
            value
              ?.toLowerCase()
              .includes(query),
          ),
      );
    }, [accountCustomers, search]);

  const filteredNormalCustomers =
    useMemo(() => {
      const query =
        search.trim().toLowerCase();

      if (!query) {
        return normalCustomers;
      }

      return normalCustomers.filter(
        (customer) =>
          [
            customer.name,
            customer.telephoneNumber,
            customer.email,
          ].some((value) =>
            value
              ?.toLowerCase()
              .includes(query),
          ),
      );
    }, [normalCustomers, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.25em] text-blue-400">
            Operations
          </p>

          <h1 className="mt-2 text-4xl font-bold text-white">
            Customers
          </h1>

          <p className="mt-3 max-w-3xl text-slate-400">
            Account customers imported from Autocab and
            normal customers identified from booking history.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void syncCustomers()}
            disabled={syncing || loading}
            className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {syncing ? "Synchronizing…" : "Sync Customers Now"}
          </button>

          <button
            type="button"
            onClick={() => void loadCustomers()}
            disabled={loading || syncing}
            className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-slate-600 hover:bg-slate-800 disabled:opacity-50"
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {message ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-300">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-950/20 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <Metric
          label="Account Customers"
          value={accountCustomers.length}
        />
        <Metric
          label="Normal Customers"
          value={normalCustomers.length}
        />
        <Metric
          label="Total Customers"
          value={
            accountCustomers.length +
            normalCustomers.length
          }
        />
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900">
        <div className="border-b border-slate-800 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex rounded-xl border border-slate-800 bg-slate-950 p-1">
              <TabButton
                active={tab === "ACCOUNT"}
                onClick={() =>
                  setTab("ACCOUNT")
                }
              >
                Account Customers
              </TabButton>

              <TabButton
                active={tab === "NORMAL"}
                onClick={() =>
                  setTab("NORMAL")
                }
              >
                Normal Customers
              </TabButton>
            </div>

            <input
              type="search"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search customers…"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-blue-500 sm:w-80"
            />
          </div>
        </div>

        {error ? (
          <div className="m-5 rounded-xl border border-red-500/30 bg-red-950/20 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Loading customers…
          </div>
        ) : tab === "ACCOUNT" ? (
          <AccountCustomersTable
            customers={
              filteredAccountCustomers
            }
          />
        ) : (
          <NormalCustomersTable
            customers={
              filteredNormalCustomers
            }
            onOpen={(customerId) =>
              setSelectedCustomerId(customerId)
            }
          />
        )}
      </div>

      {selectedCustomerId ? (
        <CustomerProfileDrawer
          customerId={selectedCustomerId}
          onClose={() =>
            setSelectedCustomerId(null)
          }
        />
      ) : null}
    </div>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-3xl font-bold text-white">
        {value.toLocaleString("en-GB")}
      </p>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-lg px-4 py-2 text-sm font-semibold transition",
        active
          ? "bg-blue-600 text-white"
          : "text-slate-400 hover:text-white",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function AccountCustomersTable({
  customers,
}: {
  customers: AccountCustomer[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-slate-800 bg-slate-950/40 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-5 py-3">
              Customer
            </th>
            <th className="px-5 py-3">
              Account Code
            </th>
            <th className="px-5 py-3">
              Contact
            </th>
            <th className="px-5 py-3">
              Telephone
            </th>
            <th className="px-5 py-3">
              Status
            </th>
            <th className="px-5 py-3">
              Last Sync
            </th>
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-800">
          {customers.map((customer) => (
            <tr
              key={customer.id}
              className="hover:bg-slate-800/30"
            >
              <td className="px-5 py-4">
                <p className="font-semibold text-white">
                  {customer.displayName ??
                    customer.accountCode}
                </p>

                {customer.companyName ? (
                  <p className="mt-1 text-xs text-slate-500">
                    {customer.companyName}
                  </p>
                ) : null}
              </td>

              <td className="px-5 py-4 text-slate-300">
                {customer.accountCode}
              </td>

              <td className="px-5 py-4">
                <p className="text-slate-300">
                  {customer.contactName ?? "—"}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {customer.email ?? ""}
                </p>
              </td>

              <td className="px-5 py-4 text-slate-300">
                {customer.telephone ?? "—"}
              </td>

              <td className="px-5 py-4">
                <span
                  className={[
                    "rounded-full border px-2.5 py-1 text-xs font-semibold",
                    customer.suspended
                      ? "border-red-500/30 bg-red-500/10 text-red-300"
                      : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
                  ].join(" ")}
                >
                  {customer.suspended
                    ? "Suspended"
                    : "Active"}
                </span>
              </td>

              <td className="px-5 py-4 text-slate-400">
                {formatDate(
                  customer.lastSyncedAt,
                )}
              </td>
            </tr>
          ))}

          {customers.length === 0 ? (
            <tr>
              <td
                colSpan={6}
                className="px-5 py-10 text-center text-slate-500"
              >
                No account customers found.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function NormalCustomersTable({
  customers,
  onOpen,
}: {
  customers: NormalCustomer[];
  onOpen: (customerId: string) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-slate-800 bg-slate-950/40 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-5 py-3">
              Customer
            </th>
            <th className="px-5 py-3">
              Telephone
            </th>
            <th className="px-5 py-3">
              Email
            </th>
            <th className="px-5 py-3">
              Bookings
            </th>
            <th className="px-5 py-3">
              Last Booking
            </th>
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-800">
          {customers.map((customer) => (
            <tr
              key={customer.key}
              className="hover:bg-slate-800/30"
            >
              <td className="px-5 py-4">
                <button
                  type="button"
                  onClick={() =>
                    onOpen(customer.key)
                  }
                  className="font-semibold text-white transition hover:text-blue-400"
                >
                  {customer.name ??
                    "Unknown customer"}
                </button>
                <p className="mt-1 text-xs text-slate-600">
                  Open intelligence profile
                </p>
              </td>

              <td className="px-5 py-4 text-slate-300">
                {customer.telephoneNumber ??
                  "—"}
              </td>

              <td className="px-5 py-4 text-slate-300">
                {customer.email ?? "—"}
              </td>

              <td className="px-5 py-4 text-slate-300">
                {customer.totalBookings.toLocaleString(
                  "en-GB",
                )}
              </td>

              <td className="px-5 py-4 text-slate-400">
                {formatDate(
                  customer.lastBookingAt,
                )}
              </td>
            </tr>
          ))}

          {customers.length === 0 ? (
            <tr>
              <td
                colSpan={5}
                className="px-5 py-10 text-center text-slate-500"
              >
                No normal customers found.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
