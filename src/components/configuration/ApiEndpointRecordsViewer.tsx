"use client";

import Link from "next/link";
import {
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
};

type RecordItem = {
  id: string;
  externalId: string;
  data: Record<string, unknown>;
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
};

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

  useEffect(() => {
    void (async () => {
      try {
        setLoading(true);

        const response = await fetch(
          `/api/dashboard/configuration/api-endpoints/${endpointId}/records`,
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
  }, [endpointId]);

  const records =
    payload?.records ?? [];

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
              placeholder="Search saved data…"
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
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Enabled</th>
                <th className="px-4 py-3">Short Code</th>
                <th className="px-4 py-3">Requirement</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800">
              {filteredRecords.map((record) => (
                <>
                  <tr key={record.id}>
                    <td className="px-4 py-3 font-semibold text-white">
                      {displayValue(record.data.name)}
                    </td>

                    <td className="px-4 py-3 font-mono text-slate-300">
                      {record.externalId}
                    </td>

                    <td className="px-4 py-3">
                      {record.data.enabled === true ? (
                        <span className="text-emerald-300">Yes</span>
                      ) : (
                        <span className="text-slate-500">No</span>
                      )}
                    </td>

                    <td className="px-4 py-3 font-mono text-slate-300">
                      {displayValue(record.data.shortCode)}
                    </td>

                    <td className="px-4 py-3 text-slate-300">
                      {displayValue(record.data.requirement)}
                    </td>

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
                        colSpan={7}
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
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
