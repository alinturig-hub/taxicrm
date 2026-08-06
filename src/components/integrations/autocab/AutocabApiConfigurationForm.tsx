"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

type PublicAutocabConfiguration = {
  id: string | null;
  provider: string;
  baseUrl: string;
  isEnabled: boolean;
  hasApiKey: boolean;
  apiKeyLastFour: string | null;
  lastTestedAt: string | null;
  lastSuccessfulSyncAt: string | null;
  lastError: string | null;
  updatedAt: string | null;
};

type ConfigurationResponse = {
  success: boolean;
  configuration?: PublicAutocabConfiguration;
  message?: string;
};

type TestResult = {
  endpoint: string;
  responseTimeMs: number;
  totalDrivers: number;
  activeDrivers: number;
  suspendedDrivers: number;
};

type TestResponse = {
  success: boolean;
  message?: string;
  result?: TestResult;
  providerStatus?: number | null;
};

type DriverSyncResult = {
  jobId: string;
  status: "SUCCESS" | "PARTIAL" | "FAILED";
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  recordsReceived: number;
  recordsEligible: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsSkipped: number;
  recordsDisabled: number;
  recordsFailed: number;
  nextSyncAt: string;
};

type DriverSyncResponse = {
  success: boolean;
  message?: string;
  result?: DriverSyncResult;
};

const DEFAULT_BASE_URL =
  "https://autocab-api.azure-api.net";

function formatDate(value: string | null) {
  if (!value) {
    return "Never";
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function AutocabApiConfigurationForm() {
  const [baseUrl, setBaseUrl] =
    useState(DEFAULT_BASE_URL);
  const [apiKey, setApiKey] = useState("");
  const [isEnabled, setIsEnabled] =
    useState(false);

  const [configuration, setConfiguration] =
    useState<PublicAutocabConfiguration | null>(null);

  const [testResult, setTestResult] =
    useState<TestResult | null>(null);

  const [driverSyncResult, setDriverSyncResult] =
    useState<DriverSyncResult | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncingDrivers, setSyncingDrivers] =
    useState(false);

  const [successMessage, setSuccessMessage] =
    useState<string | null>(null);
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const loadConfiguration = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage(null);

      const response = await fetch(
        "/api/dashboard/integrations/autocab/configuration",
        {
          cache: "no-store",
        },
      );

      const payload =
        (await response.json()) as ConfigurationResponse;

      if (
        !response.ok ||
        !payload.success ||
        !payload.configuration
      ) {
        throw new Error(
          payload.message ??
            "Autocab configuration could not be loaded.",
        );
      }

      setConfiguration(payload.configuration);
      setBaseUrl(
        payload.configuration.baseUrl ||
          DEFAULT_BASE_URL,
      );
      setIsEnabled(
        payload.configuration.isEnabled,
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load Autocab configuration.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConfiguration();
  }, [loadConfiguration]);

  async function saveConfiguration() {
    try {
      setSaving(true);
      setSuccessMessage(null);
      setErrorMessage(null);

      const response = await fetch(
        "/api/dashboard/integrations/autocab/configuration",
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            baseUrl,
            apiKey: apiKey.trim() || undefined,
            isEnabled,
          }),
        },
      );

      const payload =
        (await response.json()) as ConfigurationResponse;

      if (
        !response.ok ||
        !payload.success ||
        !payload.configuration
      ) {
        throw new Error(
          payload.message ??
            "Autocab configuration could not be saved.",
        );
      }

      setConfiguration(payload.configuration);
      setApiKey("");
      setSuccessMessage(
        "Autocab REST configuration saved securely.",
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to save Autocab configuration.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function testConnection() {
    try {
      setTesting(true);
      setSuccessMessage(null);
      setErrorMessage(null);
      setTestResult(null);

      const response = await fetch(
        "/api/dashboard/integrations/autocab/test",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            baseUrl,
            apiKey: apiKey.trim() || undefined,
          }),
        },
      );

      const payload =
        (await response.json()) as TestResponse;

      if (
        !response.ok ||
        !payload.success ||
        !payload.result
      ) {
        throw new Error(
          payload.message ??
            "Autocab connection test failed.",
        );
      }

      setTestResult(payload.result);
      setSuccessMessage(
        `Connection successful. ${payload.result.totalDrivers.toLocaleString(
          "en-GB",
        )} drivers found.`,
      );

      if (!apiKey.trim()) {
        await loadConfiguration();
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to connect to Autocab.",
      );
    } finally {
      setTesting(false);
    }
  }

  async function syncDrivers() {
    try {
      setSyncingDrivers(true);
      setSuccessMessage(null);
      setErrorMessage(null);
      setDriverSyncResult(null);

      const response = await fetch(
        "/api/dashboard/integrations/autocab/drivers/sync",
        {
          method: "POST",
          cache: "no-store",
        },
      );

      const payload =
        (await response.json()) as DriverSyncResponse;

      if (
        !response.ok ||
        !payload.success ||
        !payload.result
      ) {
        throw new Error(
          payload.message ??
            "Autocab drivers could not be synchronized.",
        );
      }

      setDriverSyncResult(payload.result);
      setSuccessMessage(
        `Driver sync completed: ${payload.result.recordsCreated.toLocaleString(
          "en-GB",
        )} created, ${payload.result.recordsUpdated.toLocaleString(
          "en-GB",
        )} updated.`,
      );

      await loadConfiguration();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to synchronize Autocab drivers.",
      );
    } finally {
      setSyncingDrivers(false);
    }
  }

  if (loading) {
    return (
      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <p className="text-sm text-slate-400">
          Loading Autocab REST configuration…
        </p>
      </section>
    );
  }

  const hasStoredKey =
    configuration?.hasApiKey === true;

  return (
    <section className="overflow-hidden rounded-2xl border border-blue-500/20 bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950/20 shadow-xl shadow-black/10">
      <div className="border-b border-slate-800 px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-400">
              Autocab REST API
            </p>

            <h2 className="mt-2 text-xl font-bold text-white">
              Master data import
            </h2>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              REST is used only to import and reconcile
              drivers, vehicles and configuration data.
              Live operational state continues to come
              from Autocab webhooks.
            </p>
          </div>

          <span
            className={[
              "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold",
              isEnabled
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : "border-slate-700 bg-slate-950/50 text-slate-400",
            ].join(" ")}
          >
            <span
              className={[
                "h-2 w-2 rounded-full",
                isEnabled
                  ? "bg-emerald-400"
                  : "bg-slate-600",
              ].join(" ")}
            />

            {isEnabled ? "Enabled" : "Disabled"}
          </span>
        </div>
      </div>

      <div className="space-y-6 p-5 sm:p-6">
        {successMessage ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 px-4 py-3">
            <p className="text-sm font-medium text-emerald-300">
              {successMessage}
            </p>
          </div>
        ) : null}

        {errorMessage ? (
          <div className="rounded-xl border border-red-500/30 bg-red-950/20 px-4 py-3">
            <p className="text-sm font-medium text-red-300">
              {errorMessage}
            </p>
          </div>
        ) : null}

        <div>
          <label
            htmlFor="autocab-base-url"
            className="mb-2 block text-sm font-medium text-slate-300"
          >
            Base URL
          </label>

          <input
            id="autocab-base-url"
            type="url"
            value={baseUrl}
            onChange={(event) =>
              setBaseUrl(event.target.value)
            }
            placeholder={DEFAULT_BASE_URL}
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          />

          <p className="mt-2 text-xs text-slate-500">
            The driver import endpoint will be{" "}
            <code className="text-slate-400">
              /driver/v1/drivers
            </code>
          </p>
        </div>

        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <label
              htmlFor="autocab-api-key"
              className="text-sm font-medium text-slate-300"
            >
              API key
            </label>

            {hasStoredKey ? (
              <span className="text-xs text-emerald-400">
                Stored key ending in{" "}
                {configuration?.apiKeyLastFour ??
                  "••••"}
              </span>
            ) : (
              <span className="text-xs text-amber-400">
                No API key stored
              </span>
            )}
          </div>

          <input
            id="autocab-api-key"
            type="password"
            autoComplete="new-password"
            value={apiKey}
            onChange={(event) =>
              setApiKey(event.target.value)
            }
            placeholder={
              hasStoredKey
                ? "Leave blank to keep the saved key"
                : "Enter Autocab API key"
            }
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          />

          <p className="mt-2 text-xs leading-5 text-slate-500">
            The key is encrypted before being stored.
            It is never returned to the browser after
            saving.
          </p>
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/50 p-4">
          <input
            type="checkbox"
            checked={isEnabled}
            onChange={(event) =>
              setIsEnabled(event.target.checked)
            }
            className="mt-0.5 h-4 w-4 rounded border-slate-600 bg-slate-900 text-blue-500 focus:ring-blue-500"
          />

          <span>
            <span className="block text-sm font-medium text-white">
              Enable Autocab REST imports
            </span>

            <span className="mt-1 block text-xs leading-5 text-slate-500">
              This controls scheduled and manual
              master-data imports. Webhook processing is
              managed separately.
            </span>
          </span>
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={testConnection}
            disabled={
              testing ||
              saving ||
              baseUrl.trim().length === 0 ||
              (!hasStoredKey &&
                apiKey.trim().length === 0)
            }
            className="inline-flex items-center justify-center rounded-xl border border-blue-500/40 bg-blue-500/10 px-4 py-3 text-sm font-semibold text-blue-200 transition hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {testing
              ? "Testing connection…"
              : "Test connection"}
          </button>

          <button
            type="button"
            onClick={saveConfiguration}
            disabled={
              saving ||
              testing ||
              baseUrl.trim().length === 0 ||
              (!hasStoredKey &&
                apiKey.trim().length === 0)
            }
            className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving
              ? "Saving configuration…"
              : "Save configuration"}
          </button>
        </div>

        {testResult ? (
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/10 p-4 sm:p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-400">
                  Connection successful
                </p>

                <p className="mt-2 text-sm text-slate-400">
                  {testResult.endpoint}
                </p>
              </div>

              <p className="text-lg font-bold text-white">
                {testResult.responseTimeMs} ms
              </p>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3">
              <ResultMetric
                label="Drivers"
                value={testResult.totalDrivers}
              />
              <ResultMetric
                label="Active"
                value={testResult.activeDrivers}
              />
              <ResultMetric
                label="Suspended"
                value={testResult.suspendedDrivers}
              />
            </div>
          </div>
        ) : null}

        <div className="rounded-2xl border border-violet-500/20 bg-violet-950/10 p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-400">
                Driver Synchronization
              </p>

              <h3 className="mt-2 text-lg font-semibold text-white">
                Import active drivers
              </h3>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Imports Autocab driver master data into
                TaxiCRM. Login, logout and live driver
                status continue to be updated exclusively
                by webhooks.
              </p>
            </div>

            <button
              type="button"
              onClick={syncDrivers}
              disabled={
                syncingDrivers ||
                saving ||
                testing ||
                !hasStoredKey ||
                !configuration?.isEnabled
              }
              className="inline-flex min-w-40 items-center justify-center rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {syncingDrivers
                ? "Synchronizing…"
                : "Sync Drivers Now"}
            </button>
          </div>

          {!configuration?.isEnabled ? (
            <p className="mt-4 rounded-xl border border-amber-500/20 bg-amber-950/10 px-4 py-3 text-xs text-amber-300">
              Enable and save the Autocab REST integration
              before running a driver synchronization.
            </p>
          ) : null}

          {driverSyncResult ? (
            <div className="mt-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-emerald-300">
                    Synchronization {driverSyncResult.status.toLowerCase()}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    Job {driverSyncResult.jobId}
                  </p>
                </div>

                <span className="rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1 text-xs font-semibold text-slate-300">
                  {driverSyncResult.durationMs.toLocaleString(
                    "en-GB",
                  )}{" "}
                  ms
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
                <SyncMetric
                  label="Received"
                  value={driverSyncResult.recordsReceived}
                />

                <SyncMetric
                  label="Eligible"
                  value={driverSyncResult.recordsEligible}
                />

                <SyncMetric
                  label="Created"
                  value={driverSyncResult.recordsCreated}
                />

                <SyncMetric
                  label="Updated"
                  value={driverSyncResult.recordsUpdated}
                />

                <SyncMetric
                  label="Skipped"
                  value={driverSyncResult.recordsSkipped}
                />

                <SyncMetric
                  label="Disabled"
                  value={driverSyncResult.recordsDisabled}
                />

                <SyncMetric
                  label="Failed"
                  value={driverSyncResult.recordsFailed}
                />
              </div>

              <p className="mt-4 text-xs text-slate-500">
                Next scheduled sync:{" "}
                <span className="font-medium text-slate-300">
                  {formatDate(driverSyncResult.nextSyncAt)}
                </span>
              </p>
            </div>
          ) : null}
        </div>

        <div className="grid gap-3 border-t border-slate-800 pt-5 sm:grid-cols-3">
          <StatusMetric
            label="Key status"
            value={
              hasStoredKey
                ? `Saved ••••${configuration?.apiKeyLastFour ?? ""}`
                : "Not configured"
            }
          />

          <StatusMetric
            label="Last tested"
            value={formatDate(
              configuration?.lastTestedAt ?? null,
            )}
          />

          <StatusMetric
            label="Last successful sync"
            value={formatDate(
              configuration?.lastSuccessfulSyncAt ??
                null,
            )}
          />
        </div>

        {configuration?.lastError ? (
          <div className="rounded-xl border border-amber-500/20 bg-amber-950/10 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-400">
              Last integration error
            </p>

            <p className="mt-2 text-sm text-slate-300">
              {configuration.lastError}
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function ResultMetric({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-center">
      <p className="text-lg font-bold text-white">
        {value.toLocaleString("en-GB")}
      </p>

      <p className="mt-1 text-[10px] uppercase tracking-wide text-slate-500">
        {label}
      </p>
    </div>
  );
}

function SyncMetric({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-center">
      <p className="text-lg font-bold text-white">
        {value.toLocaleString("en-GB")}
      </p>

      <p className="mt-1 text-[9px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
    </div>
  );
}

function StatusMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-slate-500">
        {label}
      </p>

      <p className="mt-2 text-sm font-medium text-slate-200">
        {value}
      </p>
    </div>
  );
}
