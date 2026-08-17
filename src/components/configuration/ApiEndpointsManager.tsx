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
  responseType: string | null;
  recordKey: string | null;
  storeRecords: boolean;
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
  preview?: {
    statusCode: number;
    responseTimeMs: number;
    responseType: string;
    data: unknown;
  };
};

function extractParameterNames(url: string) {
  const names: string[] = [];
  const pattern = /\{([^}]+)\}/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(url)) !== null) {
    if (!names.includes(match[1])) {
      names.push(match[1]);
    }
  }

  return names;
}

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
  const [recordKey, setRecordKey] = useState("id");
  const [storeRecords, setStoreRecords] = useState(false);
  const [jsonSchema, setJsonSchema] = useState("");
  const [exampleResponse, setExampleResponse] = useState("");
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [testParameters, setTestParameters] =
    useState<Record<string, string>>({});
  const [testing, setTesting] = useState(false);
  const [preview, setPreview] =
    useState<ApiResponse["preview"] | null>(null);
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

  async function tryEndpoint() {
    try {
      setTesting(true);
      setError(null);
      setSuccess(null);
      setPreview(null);

      const response = await fetch(
        "/api/dashboard/configuration/api-endpoints",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            url: url.trim(),
            parameters: testParameters,
            previewOnly: true,
          }),
        },
      );

      const payload =
        (await response.json()) as ApiResponse;

      if (
        !response.ok ||
        !payload.success ||
        !payload.preview
      ) {
        throw new Error(
          payload.message ??
            "API endpoint test failed.",
        );
      }

      setPreview(payload.preview);
      setSuccess(
        `HTTP ${payload.preview.statusCode} in ${payload.preview.responseTimeMs} ms.`,
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to test API endpoint.",
      );
    } finally {
      setTesting(false);
    }
  }

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
            recordKey: recordKey.trim() || undefined,
            storeRecords,
            jsonSchema: jsonSchema.trim()
              ? JSON.parse(jsonSchema)
              : undefined,
            exampleResponse: exampleResponse.trim()
              ? JSON.parse(exampleResponse)
              : undefined,
            parameters: testParameters,
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
      setPreview(null);
      setRecordKey("id");
      setStoreRecords(false);
      setJsonSchema("");
      setExampleResponse("");
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

  async function deleteEndpoint(endpoint: ApiEndpoint) {
    if (
      !window.confirm(
        `Delete ${endpoint.name}? Stored generic records for this endpoint will also be deleted.`,
      )
    ) {
      return;
    }

    try {
      setError(null);
      setSuccess(null);

      const response = await fetch(
        `/api/dashboard/configuration/api-endpoints/${endpoint.id}`,
        {
          method: "DELETE",
        },
      );

      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(
          payload.message ?? "API endpoint could not be deleted.",
        );
      }

      setSuccess(`${endpoint.name} deleted.`);
      await loadEndpoints();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to delete API endpoint.",
      );
    }
  }

  async function syncEndpoint(endpoint: ApiEndpoint) {
    try {
      setSyncingId(endpoint.id);
      setError(null);
      setSuccess(null);

      const response = await fetch(
        `/api/dashboard/configuration/api-endpoints/${endpoint.id}/sync`,
        {
          method: "POST",
          cache: "no-store",
        },
      );

      const payload = await response.json();

      if (!response.ok || !payload.success || !payload.result) {
        throw new Error(
          payload.message ?? "API endpoint synchronization failed.",
        );
      }

      setSuccess(
        `${endpoint.name}: ${payload.result.created} created, ${payload.result.updated} updated, ${payload.result.disabled} disabled, ${payload.result.failed} failed.`,
      );

      await loadEndpoints();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to synchronize API endpoint.",
      );
    } finally {
      setSyncingId(null);
    }
  }

  const parameterNames =
    extractParameterNames(url);

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

        <div className="mt-4 space-y-4">
          <input
            type="url"
            value={url}
            onChange={(event) =>
              setUrl(event.target.value)
            }
            placeholder="https://autocab-api.azure-api.net/booking/v1/capabilities"
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-blue-500"
          />

          {parameterNames.length > 0 ? (
            <div className="rounded-xl border border-blue-500/20 bg-blue-950/10 p-4">
              <div className="mb-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-400">
                  Try API
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Enter test values for the parameters detected in the URL.
                </p>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                {parameterNames.map((parameterName) => (
                  <div key={parameterName}>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {parameterName}
                    </label>

                    <input
                      type="text"
                      value={
                        testParameters[parameterName] ?? ""
                      }
                      onChange={(event) =>
                        setTestParameters((current) => ({
                          ...current,
                          [parameterName]:
                            event.target.value,
                        }))
                      }
                      placeholder={`Enter ${parameterName}`}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-blue-500"
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Record Key
              </label>
              <input
                type="text"
                value={recordKey}
                onChange={(event) =>
                  setRecordKey(event.target.value)
                }
                placeholder="id"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-blue-500"
              />
            </div>

            <label className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3">
              <input
                type="checkbox"
                checked={storeRecords}
                onChange={(event) =>
                  setStoreRecords(event.target.checked)
                }
              />
              <span>
                <span className="block text-sm font-semibold text-white">
                  Store Records
                </span>
                <span className="block text-xs text-slate-500">
                  Save each item into the generic API record store.
                </span>
              </span>
            </label>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                JSON Schema
              </label>
              <textarea
                value={jsonSchema}
                onChange={(event) =>
                  setJsonSchema(event.target.value)
                }
                rows={12}
                placeholder='{"type":"array","items":{"type":"object"}}'
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 font-mono text-xs text-white outline-none placeholder:text-slate-600 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Example Response
              </label>
              <textarea
                value={exampleResponse}
                onChange={(event) =>
                  setExampleResponse(event.target.value)
                }
                rows={12}
                placeholder='[{"id":5,"name":"Account Priority"}]'
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 font-mono text-xs text-white outline-none placeholder:text-slate-600 focus:border-blue-500"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void tryEndpoint()}
              disabled={
                testing ||
                url.trim().length === 0
              }
              className="rounded-xl border border-blue-500/40 bg-blue-500/10 px-5 py-3 text-sm font-semibold text-blue-300 transition hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {testing ? "Testing…" : "Try API"}
            </button>

            <button
              type="button"
              onClick={() => void addEndpoint()}
              disabled={
                adding ||
                url.trim().length === 0 ||
                !preview
              }
              className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {adding ? "Saving…" : "Save API"}
            </button>
          </div>
        </div>

        <p className="mt-3 text-xs text-slate-500">
          GET and Autocab authentication are applied
          automatically.
        </p>

        {preview ? (
          <div className="mt-4 overflow-hidden rounded-xl border border-emerald-500/20 bg-slate-950">
            <div className="flex flex-wrap items-center gap-4 border-b border-slate-800 px-4 py-3 text-xs">
              <span className="font-semibold text-emerald-300">
                HTTP {preview.statusCode}
              </span>
              <span className="text-slate-400">
                {preview.responseTimeMs} ms
              </span>
              <span className="text-slate-400">
                {preview.responseType}
              </span>
            </div>

            <div className="p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-blue-400">
                Response JSON
              </p>

              <pre className="max-h-[520px] overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-900 p-4 font-mono text-xs leading-6 text-slate-200">
                {JSON.stringify(
                  preview.data,
                  null,
                  2,
                )}
              </pre>
            </div>
          </div>
        ) : null}

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
                  <th className="px-5 py-3">
                    Records
                  </th>
                  <th className="px-5 py-3">
                    Action
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

                      <td className="px-5 py-4 text-slate-300">
                        {endpoint.storeRecords
                          ? `Key: ${endpoint.recordKey ?? "—"}`
                          : "Raw only"}
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              void syncEndpoint(endpoint)
                            }
                            disabled={
                              !endpoint.storeRecords ||
                              !endpoint.recordKey ||
                              endpoint.url.includes("{") ||
                              endpoint.responseType !== "array" ||
                              syncingId === endpoint.id
                            }
                            className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {syncingId === endpoint.id
                              ? "Syncing…"
                              : "Sync Now"}
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              void deleteEndpoint(endpoint)
                            }
                            className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300 transition hover:bg-red-500/20"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ),
                )}

                {endpoints.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
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
