"use client";

import Link from "next/link";
import {
  Fragment,
  useEffect,
  useMemo,
  useState,
} from "react";

type Endpoint = {
  id: string;
  name: string;
  url: string;
  recordKey: string | null;
  storeRecords: boolean;
  sampleResponse: unknown;
};

type RecordItem = {
  id: string;
  externalId: string;
  data: unknown;
  isActive: boolean;
  sourceVersion: string | null;
  lastSyncedAt: string;
};

type RecordsResponse = {
  success: boolean;
  message?: string;
  endpoint?: Endpoint;
  summary?: {
    total: number;
    active: number;
    inactive: number;
  };
  records?: RecordItem[];
  pagination?: {page: number; pageSize: number; pages: number};
};

function fields(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {value};
}

function displayValue(value: unknown) {
  if (
    value === null ||
    value === undefined
  ) {
    return "—";
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

export default function ApiEndpointRecordsViewer({
  endpointId,
}: {
  endpointId: string;
}) {
  const [payload, setPayload] =
    useState<RecordsResponse | null>(null);
  const [loading, setLoading] =
    useState(true);
  const [error, setError] =
    useState<string | null>(null);
  const [searchInput, setSearchInput] =
    useState("");
  const [search, setSearch] =
    useState("");
  const [expandedId, setExpandedId] =
    useState<string | null>(null);
  const [recordKey, setRecordKey] = useState("id");
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(
          `/api/dashboard/configuration/api-endpoints/${endpointId}/records?page=${page}`,
          {
            cache: "no-store",
          },
        );

        const result =
          (await response.json()) as RecordsResponse;

        if (
          !response.ok ||
          !result.success
        ) {
          throw new Error(
            result.message ??
              "Saved API data could not be loaded.",
          );
        }

        setPayload(result);
        setRecordKey(result.endpoint?.recordKey ?? "id");
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : "Unable to load saved API data.",
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [endpointId, reload, page]);

  const records = useMemo(() => payload?.records ?? [], [payload]);

  async function saveResponse() {
    setSaving(true); setSaveError(null);
    try {
      const response = await fetch(`/api/dashboard/configuration/api-endpoints/${endpointId}`, {
        method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({recordKey}),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message ?? "Could not save data.");
      setReload(value => value + 1);
    } catch (error) { setSaveError(error instanceof Error ? error.message : "Could not save data."); }
    finally { setSaving(false); }
  }

  const columns = useMemo(() => Array.from(new Set(records.flatMap(record => Object.keys(fields(record.data))))).slice(0, 8), [records]);

  const filteredRecords =
    useMemo(() => {
      const value =
        search.trim().toLowerCase();

      if (!value) {
        return records;
      }

      return records.filter((record) =>
        JSON.stringify(record)
          .toLowerCase()
          .includes(value),
      );
    }, [records, search]);

  if (loading) {
    return (
      <div className="p-8 text-slate-400">
        Loading saved API data…
      </div>
    );
  }

  if (error || !payload?.endpoint) {
    return (
      <div className="p-8 text-red-300">
        {error ?? "Endpoint not found."}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/configuration/api-endpoints"
          className="text-sm text-blue-400 hover:text-blue-300"
        >
          ← API Endpoints
        </Link>

        <h1 className="mt-3 text-3xl font-bold text-white">
          {payload.endpoint.name}
        </h1>

        <p className="mt-2 break-all text-sm text-slate-500">
          {payload.endpoint.url}
        </p>
      </div>

      <section className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3">
        <h2 className="font-semibold text-white">Original API response</h2>
        <details><summary className="cursor-pointer text-blue-400">View response before saving</summary>
          <pre className="max-h-96 overflow-auto whitespace-pre-wrap text-xs text-slate-300">{JSON.stringify(payload.endpoint.sampleResponse, null, 2)}</pre>
        </details>
        <label className="block text-sm text-slate-300">Record Key (blank saves the complete response)
          <input value={recordKey} onChange={event => setRecordKey(event.target.value)} className="ml-3 rounded border border-slate-700 bg-slate-950 p-2" />
        </label>
        <button onClick={() => void saveResponse()} disabled={saving} className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50">{saving ? "Saving…" : "Save Data in TaxiCRM"}</button>
        {saveError ? <p className="text-red-300">{saveError}</p> : null}
      </section>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs uppercase text-slate-500">
            Total
          </p>
          <p className="mt-2 text-2xl font-bold text-white">
            {payload.summary?.total ?? 0}
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs uppercase text-slate-500">
            Active
          </p>
          <p className="mt-2 text-2xl font-bold text-emerald-300">
            {payload.summary?.active ?? 0}
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs uppercase text-slate-500">
            Inactive
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-300">
            {payload.summary?.inactive ?? 0}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 text-sm text-slate-300">
        <button disabled={page <= 1} onClick={() => setPage(value => value - 1)} className="rounded border border-slate-700 p-2 disabled:opacity-40">Previous</button>
        <span>Page {page} of {payload.pagination?.pages ?? 1}</span>
        <button disabled={page >= (payload.pagination?.pages ?? 1)} onClick={() => setPage(value => value + 1)} className="rounded border border-slate-700 p-2 disabled:opacity-40">Next</button>
      </div>
      <div className="rounded-2xl border border-slate-800 bg-slate-900">
        <div className="border-b border-slate-800 p-4">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setSearch(searchInput.trim());
            }}
            className="flex flex-col gap-3 sm:flex-row"
          >
            <input
              value={searchInput}
              onChange={(event) =>
                setSearchInput(event.target.value)
              }
              placeholder="Search this page…"
              className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-blue-500"
            />

            <button
              type="submit"
              className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500"
            >
              Search
            </button>

            {(search || searchInput) ? (
              <button
                type="button"
                onClick={() => {
                  setSearchInput("");
                  setSearch("");
                }}
                className="rounded-xl border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-300 transition hover:bg-slate-800"
              >
                Clear
              </button>
            ) : null}
          </form>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-800 bg-slate-950/40 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Record ID</th>
                {columns.map(column => <th key={column} className="px-4 py-3">{column}</th>)}
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800">
              {filteredRecords.map((record) => (
                <Fragment key={record.id}>
                  <tr key={record.id}>
                    <td className="px-4 py-3 font-mono text-slate-300">{record.externalId}</td>
                    {columns.map(column => <td key={column} className="max-w-sm px-4 py-3 text-slate-300"><div className="max-h-24 overflow-auto">{displayValue(fields(record.data)[column])}</div></td>)}

                    <td className="px-4 py-3">
                      {record.isActive ? (
                        <span className="text-emerald-300">
                          Active
                        </span>
                      ) : (
                        <span className="text-slate-500">
                          Inactive
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedId(
                            expandedId === record.id
                              ? null
                              : record.id,
                          )
                        }
                        className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                      >
                        {expandedId === record.id
                          ? "Hide JSON"
                          : "View JSON"}
                      </button>
                    </td>
                  </tr>

                  {expandedId === record.id ? (
                    <tr key={`${record.id}-json`}>
                      <td
                        colSpan={columns.length + 3}
                        className="bg-slate-950 px-4 py-4"
                      >
                        <pre className="max-h-96 overflow-auto whitespace-pre-wrap font-mono text-xs leading-6 text-slate-300">
                          {JSON.stringify(
                            record.data,
                            null,
                            2,
                          )}
                        </pre>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
