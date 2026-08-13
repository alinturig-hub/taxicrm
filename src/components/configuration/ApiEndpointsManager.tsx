"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

type ApiEndpoint = {
  id: string;
  provider: string;
  name: string;
  method: string;
  url: string;
  path: string | null;
  isEnabled: boolean;
  lastTestedAt: string | null;
  lastStatusCode: number | null;
  lastResponseTimeMs: number | null;
  lastError: string | null;
  sampleResponse: unknown;
};

type ApiResponse = {
  success: boolean;
  message?: string;
  endpoints?: ApiEndpoint[];
  endpoint?: ApiEndpoint;
};

function formatDate(value: string | null) {
  if (!value) {
    return "Never";
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function ApiEndpointsManager() {
  const [url, setUrl] = useState("");
  const [endpoints, setEndpoints] =
    useState<ApiEndpoint[]>([]);
  const [loading, setLoading] =
    useState(true);
  const [adding, setAdding] =
    useState(false);
  const [error, setError] =
    useState<string | null>(null);
  const [success, setSuccess] =
    useState<string | null>(null);

  const loadEndpoints =
    useCallback(async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(
          "/api/dashboard/configuration/api-endpoints",
          {
            cache: "no-store",
          },
        );

        const payload =
          (await response.json()) as ApiResponse;

        if (
          !response.ok ||
          !payload.success
        ) {
          throw new Error(
            payload.message ??
              "API endpoints could not be loaded.",
          );
        }

        setEndpoints(
          payload.endpoints ?? [],
        );
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : "Unable to load API endpoints.",
        );
      } finally {
        setLoading(false);
      }
    }, []);

  useEffect(() => {
    void loadEndpoints();
  }, [loadEndpoints]);

  async function addEndpoint() {
    try {
      setAdding(true);
      setError(null);
      setSuccess(null);

      const response = await fetch(
        "/api/dashboard/configuration/api-endpoints",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            url: url.trim(),
          }),
        },
      );

      const payload =
        (await response.json()) as ApiResponse;

      if (
        !response.ok ||
        !payload.success ||
        !payload.endpoint
      ) {
        throw new Error(
          payload.message ??
            "API endpoint could not be added.",
        );
      }

      setUrl("");
      setSuccess(
        `${payload.endpoint.name} connected successfully.`,
      );

      await loadEndpoints();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to add API endpoint.",
      );
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-[0.25em] text-blue-400">
          Configuration
        </p>

        <h1 className="mt-2 text-4xl font-bold text-white">
          API Endpoints
        </h1>

        <p className="mt-3 max-w-3xl text-slate-400">
          Add an Autocab API URL. TaxiCRM will
          automatically use the configured Autocab
          credentials, test the endpoint and save a
          sample response.
        </p>
      </div>

      <section className="rounded-2xl border border-blue-500/20 bg-slate-900 p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-400">
          Add API
        </p>

        <div className="mt-4 flex flex-col gap-3 lg:flex-row">
          <input
            type="url"
            value={url}
            onChange={(event) =>
              setUrl(event.target.value)
            }
            placeholder="https://autocab-api.azure-api.net/booking/v1/zones"
            className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-blue-500"
          />

          <button
            type="button"
            onClick={() =>
              void addEndpoint()
            }
            disabled={
              adding ||
              url.trim().length === 0
            }
            className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {adding
              ? "Testing API…"
              : "Add API"}
          </button>
        </div>

        <p className="mt-3 text-xs text-slate-500">
          GET and Autocab authentication are applied
          automatically.
        </p>

        {success ? (
          <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-300">
            {success}
          </div>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-950/20 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        ) : null}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
        <div className="border-b border-slate-800 px-5 py-4">
          <h2 className="font-semibold text-white">
            Configured APIs
          </h2>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Loading API endpoints…
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-800 bg-slate-950/40 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">
                    API
                  </th>
                  <th className="px-5 py-3">
                    Method
                  </th>
                  <th className="px-5 py-3">
                    Status
                  </th>
                  <th className="px-5 py-3">
                    Response
                  </th>
                  <th className="px-5 py-3">
                    Last Test
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-800">
                {endpoints.map(
                  (endpoint) => (
                    <tr
                      key={endpoint.id}
                      className="hover:bg-slate-800/30"
                    >
                      <td className="px-5 py-4">
                        <p className="font-semibold text-white">
                          {endpoint.name}
                        </p>
                        <p className="mt-1 max-w-xl truncate text-xs text-slate-500">
                          {endpoint.url}
                        </p>
                      </td>

                      <td className="px-5 py-4 text-slate-300">
                        {endpoint.method}
                      </td>

                      <td className="px-5 py-4">
                        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-300">
                          {endpoint.lastStatusCode
                            ? `HTTP ${endpoint.lastStatusCode}`
                            : "Configured"}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-slate-300">
                        {endpoint.lastResponseTimeMs !==
                        null
                          ? `${endpoint.lastResponseTimeMs} ms`
                          : "—"}
                      </td>

                      <td className="px-5 py-4 text-slate-400">
                        {formatDate(
                          endpoint.lastTestedAt,
                        )}
                      </td>
                    </tr>
                  ),
                )}

                {endpoints.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-5 py-10 text-center text-slate-500"
                    >
                      No API endpoints configured.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
