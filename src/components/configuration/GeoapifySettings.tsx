"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useState,
} from "react";

import GeoapifyEnrichmentPanel from "@/components/configuration/GeoapifyEnrichmentPanel";

type Configuration = {
  id: string | null;
  provider: string;
  baseUrl: string;
  isEnabled: boolean;
  hasApiKey: boolean;
  apiKeyLastFour: string | null;
  dailyLimit: number;
  dailyUsed: number;
  usageDate: string | null;
  lastTestedAt: string | null;
  lastSuccessfulLookupAt: string | null;
  lastError: string | null;
  updatedAt: string | null;
};

type ApiResponse = {
  success: boolean;
  message?: string;
  configuration?: Configuration;
};

function formatDate(value: string | null) {
  if (!value) {
    return "Never";
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/London",
  }).format(new Date(value));
}

export default function GeoapifySettings() {
  const [
    configuration,
    setConfiguration,
  ] = useState<Configuration | null>(null);
  const [baseUrl, setBaseUrl] = useState(
    "https://api.geoapify.com",
  );
  const [apiKey, setApiKey] = useState("");
  const [isEnabled, setIsEnabled] =
    useState(false);
  const [dailyLimit, setDailyLimit] =
    useState(3000);
  const [loading, setLoading] =
    useState(true);
  const [saving, setSaving] =
    useState(false);
  const [testing, setTesting] =
    useState(false);
  const [message, setMessage] =
    useState<string | null>(null);
  const [error, setError] =
    useState<string | null>(null);

  const applyConfiguration = useCallback(
    (value: Configuration) => {
      setConfiguration(value);
      setBaseUrl(value.baseUrl);
      setIsEnabled(value.isEnabled);
      setDailyLimit(value.dailyLimit);
    },
    [],
  );

  const loadConfiguration =
    useCallback(async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          "/api/dashboard/integrations/geoapify/configuration",
          {
            cache: "no-store",
          },
        );

        const payload =
          (await response.json()) as ApiResponse;

        if (
          !response.ok ||
          !payload.success ||
          !payload.configuration
        ) {
          throw new Error(
            payload.message ??
              "Geoapify configuration could not be loaded.",
          );
        }

        applyConfiguration(
          payload.configuration,
        );
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Geoapify configuration could not be loaded.",
        );
      } finally {
        setLoading(false);
      }
    }, [applyConfiguration]);

  useEffect(() => {
    void loadConfiguration();
  }, [loadConfiguration]);

  async function save(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(
        "/api/dashboard/integrations/geoapify/configuration",
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            baseUrl,
            apiKey:
              apiKey.trim().length > 0
                ? apiKey.trim()
                : undefined,
            isEnabled,
            dailyLimit,
          }),
        },
      );

      const payload =
        (await response.json()) as ApiResponse;

      if (
        !response.ok ||
        !payload.success ||
        !payload.configuration
      ) {
        throw new Error(
          payload.message ??
            "Geoapify configuration could not be saved.",
        );
      }

      applyConfiguration(
        payload.configuration,
      );
      setApiKey("");
      setMessage(
        "Geoapify configuration saved securely.",
      );
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Geoapify configuration could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function testConnection() {
    setTesting(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(
        "/api/dashboard/integrations/geoapify/configuration",
        {
          method: "POST",
        },
      );

      const payload =
        (await response.json()) as ApiResponse;

      if (!response.ok || !payload.success) {
        throw new Error(
          payload.message ??
            "Geoapify connection test failed.",
        );
      }

      if (payload.configuration) {
        applyConfiguration(
          payload.configuration,
        );
      }

      setMessage(
        "Connection successful. Geoapify identified the Plymouth test location.",
      );
    } catch (testError) {
      setError(
        testError instanceof Error
          ? testError.message
          : "Geoapify connection test failed.",
      );
    } finally {
      setTesting(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-slate-400">
        Loading Geoapify configuration…
      </div>
    );
  }

  const remaining = Math.max(
    dailyLimit -
      (configuration?.dailyUsed ?? 0),
    0,
  );

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-400">
          Places Intelligence
        </p>

        <h1 className="mt-3 text-3xl font-bold text-white">
          Geoapify Configuration
        </h1>

        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
          Securely identify real-world pickup and destination
          places. Results are cached permanently so the same
          location does not consume another API credit.
        </p>
      </section>

      {message ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-950/30 p-4 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Metric
          label="API key"
          value={
            configuration?.hasApiKey
              ? `Saved ••••${configuration.apiKeyLastFour ?? ""}`
              : "Not configured"
          }
        />
        <Metric
          label="Credits used today"
          value={`${configuration?.dailyUsed ?? 0} / ${dailyLimit}`}
        />
        <Metric
          label="Credits remaining"
          value={remaining.toLocaleString("en-GB")}
        />
      </div>

      <form
        onSubmit={save}
        className="space-y-6 rounded-2xl border border-slate-800 bg-slate-900 p-6"
      >
        <div>
          <label
            htmlFor="geoapify-base-url"
            className="text-sm font-semibold text-white"
          >
            Geoapify base URL
          </label>
          <input
            id="geoapify-base-url"
            value={baseUrl}
            onChange={(event) =>
              setBaseUrl(event.target.value)
            }
            className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-blue-500"
            required
          />
        </div>

        <div>
          <label
            htmlFor="geoapify-api-key"
            className="text-sm font-semibold text-white"
          >
            API key
          </label>
          <input
            id="geoapify-api-key"
            type="password"
            value={apiKey}
            onChange={(event) =>
              setApiKey(event.target.value)
            }
            autoComplete="new-password"
            placeholder={
              configuration?.hasApiKey
                ? "Leave blank to keep the saved key"
                : "Paste your Geoapify key here"
            }
            className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-blue-500"
          />
          <p className="mt-2 text-xs leading-5 text-slate-500">
            The key is encrypted before storage and is never
            returned to the browser after saving.
          </p>
        </div>

        <div>
          <label
            htmlFor="geoapify-limit"
            className="text-sm font-semibold text-white"
          >
            Maximum requests per day
          </label>
          <input
            id="geoapify-limit"
            type="number"
            min={1}
            max={3000}
            step={1}
            value={dailyLimit}
            onChange={(event) =>
              setDailyLimit(
                Number(event.target.value),
              )
            }
            className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-blue-500"
            required
          />
          <p className="mt-2 text-xs text-slate-500">
            The free Geoapify allowance is protected with a
            hard maximum of 3,000 requests per day.
          </p>
        </div>

        <label className="flex items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
          <span>
            <span className="block font-semibold text-white">
              Enable Geoapify
            </span>
            <span className="mt-1 block text-xs text-slate-500">
              Place lookups only run while this switch is enabled.
            </span>
          </span>
          <input
            type="checkbox"
            checked={isEnabled}
            onChange={(event) =>
              setIsEnabled(event.target.checked)
            }
            className="h-5 w-5 accent-blue-600"
          />
        </label>

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-500 disabled:opacity-50"
          >
            {saving
              ? "Saving…"
              : "Save configuration"}
          </button>

          <button
            type="button"
            onClick={() =>
              void testConnection()
            }
            disabled={
              testing ||
              !configuration?.hasApiKey
            }
            className="rounded-xl border border-slate-700 bg-slate-950 px-5 py-3 font-semibold text-white transition hover:border-blue-500 disabled:opacity-40"
          >
            {testing
              ? "Testing…"
              : "Test connection"}
          </button>
        </div>
      </form>

      <GeoapifyEnrichmentPanel />

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <h2 className="font-semibold text-white">
          Integration status
        </h2>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
          <Status
            label="Last tested"
            value={formatDate(
              configuration?.lastTestedAt ?? null,
            )}
          />
          <Status
            label="Last successful lookup"
            value={formatDate(
              configuration?.lastSuccessfulLookupAt ??
                null,
            )}
          />
          <Status
            label="Last error"
            value={
              configuration?.lastError ??
              "No errors recorded"
            }
          />
          <Status
            label="Cache policy"
            value="Permanent — one credit per distinct location"
          />
        </dl>

        <p className="mt-6 border-t border-slate-800 pt-4 text-xs text-slate-500">
          Place data powered by{" "}
          <a
            href="https://www.geoapify.com/"
            target="_blank"
            rel="noreferrer"
            className="text-blue-400 hover:text-blue-300"
          >
            Geoapify
          </a>
          .
        </p>
      </section>
    </div>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <p className="mt-3 text-xl font-bold text-white">
        {value}
      </p>
    </div>
  );
}

function Status({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <dt className="text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 break-words text-slate-200">
        {value}
      </dd>
    </div>
  );
}
