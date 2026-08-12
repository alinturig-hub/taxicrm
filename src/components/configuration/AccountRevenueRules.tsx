"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

type AccountRule = {
  accountId: string;
  accountCode: string;
  displayName: string;
  waitingChargeable: boolean;
  waitingRatePerMinute: number;
  configured: boolean;
};

type ApiResponse = {
  success: boolean;
  accounts?: AccountRule[];
  message?: string;
};

function keyFor(account: AccountRule) {
  return `${account.accountId}::${account.accountCode}`;
}

export default function AccountRevenueRules() {
  const [accounts, setAccounts] =
    useState<AccountRule[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState<string | null>(null);

  const [message, setMessage] =
    useState<string | null>(null);

  const loadAccounts = useCallback(
    async () => {
      setLoading(true);
      setMessage(null);

      try {
        const response = await fetch(
          "/api/dashboard/configuration/accounts",
          {
            cache: "no-store",
          },
        );

        const data =
          (await response.json()) as ApiResponse;

        if (
          !response.ok ||
          !data.success
        ) {
          throw new Error(
            data.message ??
              "Could not load accounts.",
          );
        }

        setAccounts(
          data.accounts ?? [],
        );
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Could not load accounts.",
        );
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  function updateAccount(
    index: number,
    patch: Partial<AccountRule>,
  ) {
    setAccounts((current) =>
      current.map((account, position) =>
        position === index
          ? {
              ...account,
              ...patch,
            }
          : account,
      ),
    );
  }

  async function saveAccount(
    account: AccountRule,
  ) {
    const key = keyFor(account);

    setSaving(key);
    setMessage(null);

    try {
      const response = await fetch(
        "/api/dashboard/configuration/accounts",
        {
          method: "PUT",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            accountId:
              account.accountId,
            accountCode:
              account.accountCode,
            displayName:
              account.displayName,
            waitingChargeable:
              account.waitingChargeable,
            waitingRatePerMinute:
              account.waitingRatePerMinute,
          }),
        },
      );

      const data =
        (await response.json()) as {
          success: boolean;
          message?: string;
        };

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.message ??
            "Could not save account.",
        );
      }

      setAccounts((current) =>
        current.map((item) =>
          keyFor(item) === key
            ? {
                ...item,
                configured: true,
              }
            : item,
        ),
      );

      setMessage(
        `${account.accountCode} saved.`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not save account.",
      );
    } finally {
      setSaving(null);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-sm text-slate-400">
        Loading accounts...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {message ? (
        <div className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-300">
          {message}
        </div>
      ) : null}

      {accounts.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm text-slate-400">
            No Autocab accounts have been detected
            in bookings yet.
          </p>
        </div>
      ) : (
        accounts.map((account, index) => {
          const key = keyFor(account);
          const isSaving =
            saving === key;

          return (
            <section
              key={key}
              className="rounded-2xl border border-slate-800 bg-slate-900 p-5"
            >
              <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold text-white">
                      {account.accountCode}
                    </h2>

                    <span
                      className={[
                        "rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide",
                        account.configured
                          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                          : "border-slate-700 bg-slate-800 text-slate-400",
                      ].join(" ")}
                    >
                      {account.configured
                        ? "Configured"
                        : "Default"}
                    </span>
                  </div>

                  <p className="mt-1 text-sm text-slate-400">
                    {account.displayName}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    Account ID:{" "}
                    {account.accountId}
                  </p>
                </div>

                <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                  <label className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={
                        account.waitingChargeable
                      }
                      onChange={(event) =>
                        updateAccount(
                          index,
                          {
                            waitingChargeable:
                              event.target
                                .checked,
                          },
                        )
                      }
                      className="h-4 w-4 rounded border-slate-600 bg-slate-900"
                    />

                    <span>
                      <span className="block text-sm font-medium text-white">
                        Waiting chargeable
                      </span>

                      <span className="block text-xs text-slate-500">
                        No Fare only
                      </span>
                    </span>
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Rate £ / minute
                    </span>

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={
                        account.waitingRatePerMinute
                      }
                      disabled={
                        !account.waitingChargeable
                      }
                      onChange={(event) =>
                        updateAccount(
                          index,
                          {
                            waitingRatePerMinute:
                              Number(
                                event.target
                                  .value,
                              ),
                          },
                        )
                      }
                      className="w-32 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-40"
                    />
                  </label>

                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() =>
                      void saveAccount(
                        account,
                      )
                    }
                    className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSaving
                      ? "Saving..."
                      : "Save"}
                  </button>
                </div>
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
