"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

const CATEGORIES = [
  "PUBLIC_HOLIDAY",
  "SPORT",
  "UNIVERSITY",
  "TRANSPORT",
  "COMMUNITY",
  "CONCERT",
  "OTHER",
] as const;

const IMPACT_LEVELS = [
  "LOW",
  "MEDIUM",
  "HIGH",
] as const;

type ContextualEvent = {
  id: string;
  externalId: string | null;
  title: string;
  category: string;
  startsAt: string;
  endsAt: string;
  locationName: string | null;
  description: string | null;
  impactLevel: string;
  source: string;
  sourceUrl: string | null;
  active: boolean;
  updatedAt: string;
};

type ApiPayload = {
  success?: boolean;
  message?: string;
  events?: ContextualEvent[];
  errors?: Array<{
    row: number;
    message: string;
  }>;
};

type ManualForm = {
  externalId: string;
  title: string;
  category: string;
  startsAt: string;
  endsAt: string;
  locationName: string;
  description: string;
  impactLevel: string;
  sourceUrl: string;
};

const EMPTY_FORM: ManualForm = {
  externalId: "",
  title: "",
  category: "SPORT",
  startsAt: "",
  endsAt: "",
  locationName: "",
  description: "",
  impactLevel: "MEDIUM",
  sourceUrl: "",
};

function categoryLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map(
      (part) =>
        part.charAt(0).toUpperCase() +
        part.slice(1),
    )
    .join(" ");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function badgeTone(value: string) {
  if (value === "HIGH") {
    return "border-red-500/20 bg-red-500/10 text-red-300";
  }

  if (value === "MEDIUM") {
    return "border-amber-500/20 bg-amber-500/10 text-amber-300";
  }

  return "border-slate-700 bg-slate-800 text-slate-300";
}

export default function ContextualEventsManager() {
  const [events, setEvents] = useState<
    ContextualEvent[]
  >([]);
  const [form, setForm] =
    useState<ManualForm>(EMPTY_FORM);
  const [query, setQuery] = useState("");
  const [category, setCategory] =
    useState("ALL");
  const [activeFilter, setActiveFilter] =
    useState("ALL");
  const [file, setFile] =
    useState<File | null>(null);
  const [loading, setLoading] =
    useState(true);
  const [busy, setBusy] =
    useState<string | null>(null);
  const [message, setMessage] =
    useState<string | null>(null);
  const [error, setError] =
    useState<string | null>(null);
  const [rowErrors, setRowErrors] =
    useState<
      Array<{
        row: number;
        message: string;
      }>
    >([]);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const parameters = new URLSearchParams();

      if (query.trim()) {
        parameters.set("q", query.trim());
      }

      if (category !== "ALL") {
        parameters.set("category", category);
      }

      if (activeFilter !== "ALL") {
        parameters.set(
          "active",
          activeFilter === "ACTIVE"
            ? "true"
            : "false",
        );
      }

      const response = await fetch(
        `/api/dashboard/configuration/contextual-events?${parameters}`,
        {
          cache: "no-store",
        },
      );

      const payload =
        (await response.json()) as ApiPayload;

      if (
        !response.ok ||
        !payload.success ||
        !payload.events
      ) {
        throw new Error(
          payload.message ??
            "City events could not be loaded.",
        );
      }

      setEvents(payload.events);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "City events could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [activeFilter, category, query]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadEvents();
    }, 250);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [loadEvents]);

  const upcomingCount = useMemo(
    () =>
      events.filter(
        (event) =>
          event.active &&
          new Date(event.endsAt).getTime() >=
            Date.now(),
      ).length,
    [events],
  );

  const resetFeedback = () => {
    setMessage(null);
    setError(null);
    setRowErrors([]);
  };

  const saveManualEvent = async (
    submitEvent: FormEvent,
  ) => {
    submitEvent.preventDefault();
    resetFeedback();
    setBusy("manual");

    try {
      const response = await fetch(
        "/api/dashboard/configuration/contextual-events",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(form),
        },
      );

      const payload =
        (await response.json()) as ApiPayload;

      if (!response.ok || !payload.success) {
        throw new Error(
          payload.message ??
            "Event could not be saved.",
        );
      }

      setForm(EMPTY_FORM);
      setMessage(
        payload.message ??
          "Event saved successfully.",
      );
      await loadEvents();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Event could not be saved.",
      );
    } finally {
      setBusy(null);
    }
  };

  const importCsv = async () => {
    if (!file) {
      setError("Please select a CSV file.");
      return;
    }

    resetFeedback();
    setBusy("csv");

    try {
      const data = new FormData();
      data.set("file", file);

      const response = await fetch(
        "/api/dashboard/configuration/contextual-events",
        {
          method: "POST",
          body: data,
        },
      );

      const payload =
        (await response.json()) as ApiPayload;

      if (!response.ok || !payload.success) {
        setRowErrors(payload.errors ?? []);

        throw new Error(
          payload.message ??
            "CSV could not be imported.",
        );
      }

      setFile(null);

      const input = document.getElementById(
        "city-events-csv",
      ) as HTMLInputElement | null;

      if (input) {
        input.value = "";
      }

      setMessage(
        payload.message ??
          "CSV imported successfully.",
      );
      await loadEvents();
    } catch (importError) {
      setError(
        importError instanceof Error
          ? importError.message
          : "CSV could not be imported.",
      );
    } finally {
      setBusy(null);
    }
  };

  const syncBankHolidays = async () => {
    resetFeedback();
    setBusy("holidays");

    try {
      const response = await fetch(
        "/api/dashboard/configuration/contextual-events/bank-holidays",
        {
          method: "POST",
        },
      );

      const payload =
        (await response.json()) as ApiPayload;

      if (!response.ok || !payload.success) {
        throw new Error(
          payload.message ??
            "Bank holidays could not be synchronised.",
        );
      }

      setMessage(
        payload.message ??
          "Bank holidays synchronised.",
      );
      await loadEvents();
    } catch (syncError) {
      setError(
        syncError instanceof Error
          ? syncError.message
          : "Bank holidays could not be synchronised.",
      );
    } finally {
      setBusy(null);
    }
  };

  const toggleEvent = async (
    event: ContextualEvent,
  ) => {
    resetFeedback();
    setBusy(event.id);

    try {
      const response = await fetch(
        `/api/dashboard/configuration/contextual-events/${event.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            active: !event.active,
          }),
        },
      );

      const payload =
        (await response.json()) as ApiPayload;

      if (!response.ok || !payload.success) {
        throw new Error(
          payload.message ??
            "Event could not be updated.",
        );
      }

      setMessage(payload.message ?? null);
      await loadEvents();
    } catch (toggleError) {
      setError(
        toggleError instanceof Error
          ? toggleError.message
          : "Event could not be updated.",
      );
    } finally {
      setBusy(null);
    }
  };

  const deleteEvent = async (
    event: ContextualEvent,
  ) => {
    const confirmed = window.confirm(
      `Delete "${event.title}"? This action cannot be undone.`,
    );

    if (!confirmed) {
      return;
    }

    resetFeedback();
    setBusy(event.id);

    try {
      const response = await fetch(
        `/api/dashboard/configuration/contextual-events/${event.id}`,
        {
          method: "DELETE",
        },
      );

      const payload =
        (await response.json()) as ApiPayload;

      if (!response.ok || !payload.success) {
        throw new Error(
          payload.message ??
            "Event could not be deleted.",
        );
      }

      setMessage(payload.message ?? null);
      await loadEvents();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Event could not be deleted.",
      );
    } finally {
      setBusy(null);
    }
  };

  const downloadTemplate = () => {
    const csv = [
      [
        "externalId",
        "title",
        "category",
        "startsAt",
        "endsAt",
        "locationName",
        "description",
        "impactLevel",
        "sourceUrl",
        "active",
      ].join(","),
      [
        "argyle-home-2026-08-29",
        "Plymouth Argyle home match",
        "SPORT",
        "2026-08-29 15:00",
        "2026-08-29 18:00",
        '"Home Park, Plymouth"',
        '"Expected traffic around the stadium"',
        "HIGH",
        "https://example.com/event",
        "true",
      ].join(","),
    ].join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download =
      "taxicrm-city-events-template.csv";
    link.click();

    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-3">
        <Metric
          label="Events shown"
          value={events.length.toLocaleString(
            "en-GB",
          )}
        />
        <Metric
          label="Active upcoming"
          value={upcomingCount.toLocaleString(
            "en-GB",
          )}
        />
        <Metric
          label="Timezone"
          value="Europe/London"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <form
          onSubmit={(event) =>
            void saveManualEvent(event)
          }
          className="rounded-2xl border border-slate-800 bg-slate-900 p-6"
        >
          <h2 className="text-xl font-semibold text-white">
            Add Event Manually
          </h2>

          <p className="mt-2 text-sm text-slate-400">
            Add one match, concert, disruption or
            local activity.
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Field
              label="Event title"
              required
              className="sm:col-span-2"
            >
              <input
                required
                value={form.title}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                className={inputClass}
                placeholder="Plymouth Argyle home match"
              />
            </Field>

            <Field label="Category" required>
              <select
                value={form.category}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    category:
                      event.target.value,
                  }))
                }
                className={inputClass}
              >
                {CATEGORIES.map((value) => (
                  <option
                    key={value}
                    value={value}
                  >
                    {categoryLabel(value)}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Impact" required>
              <select
                value={form.impactLevel}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    impactLevel:
                      event.target.value,
                  }))
                }
                className={inputClass}
              >
                {IMPACT_LEVELS.map((value) => (
                  <option
                    key={value}
                    value={value}
                  >
                    {categoryLabel(value)}
                  </option>
                ))}
              </select>
            </Field>

            <Field
              label="Starts"
              required
            >
              <input
                required
                type="datetime-local"
                value={form.startsAt}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    startsAt:
                      event.target.value,
                  }))
                }
                className={inputClass}
              />
            </Field>

            <Field label="Ends" required>
              <input
                required
                type="datetime-local"
                value={form.endsAt}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    endsAt:
                      event.target.value,
                  }))
                }
                className={inputClass}
              />
            </Field>

            <Field
              label="Location"
              className="sm:col-span-2"
            >
              <input
                value={form.locationName}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    locationName:
                      event.target.value,
                  }))
                }
                className={inputClass}
                placeholder="Home Park, Plymouth"
              />
            </Field>

            <Field
              label="Description"
              className="sm:col-span-2"
            >
              <textarea
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    description:
                      event.target.value,
                  }))
                }
                className={`${inputClass} min-h-24 resize-y`}
                placeholder="Expected demand or traffic impact"
              />
            </Field>

            <Field
              label="Source URL"
              className="sm:col-span-2"
            >
              <input
                type="url"
                value={form.sourceUrl}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    sourceUrl:
                      event.target.value,
                  }))
                }
                className={inputClass}
                placeholder="https://..."
              />
            </Field>
          </div>

          <button
            type="submit"
            disabled={busy !== null}
            className="mt-6 w-full rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-50"
          >
            {busy === "manual"
              ? "Saving..."
              : "Save Event"}
          </button>
        </form>

        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-xl font-semibold text-white">
              Import Events from CSV
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-400">
              Import up to 5,000 events. Nothing is
              saved if the file contains invalid rows.
            </p>

            <button
              type="button"
              onClick={downloadTemplate}
              className="mt-4 text-sm font-semibold text-blue-400 hover:text-blue-300"
            >
              Download CSV template
            </button>

            <input
              id="city-events-csv"
              type="file"
              accept=".csv,text/csv"
              onChange={(event) =>
                setFile(
                  event.target.files?.[0] ??
                    null,
                )
              }
              className="mt-5 block w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-slate-300 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:font-semibold file:text-white"
            />

            <button
              type="button"
              disabled={
                !file || busy !== null
              }
              onClick={() => void importCsv()}
              className="mt-4 w-full rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-50"
            >
              {busy === "csv"
                ? "Importing..."
                : "Validate and Import CSV"}
            </button>
          </section>

          <section className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6">
            <h2 className="text-lg font-semibold text-white">
              Official Bank Holidays
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-400">
              Import and update official England and
              Wales bank holidays directly from GOV.UK.
            </p>

            <button
              type="button"
              disabled={busy !== null}
              onClick={() =>
                void syncBankHolidays()
              }
              className="mt-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-3 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-50"
            >
              {busy === "holidays"
                ? "Synchronising..."
                : "Sync GOV.UK Bank Holidays"}
            </button>
          </section>
        </div>
      </section>

      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      {message ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">
          {message}
        </div>
      ) : null}

      {rowErrors.length > 0 ? (
        <section className="rounded-xl border border-red-500/30 bg-red-950/20 p-5">
          <h3 className="font-semibold text-red-300">
            CSV errors
          </h3>

          <ul className="mt-3 space-y-2 text-sm text-red-200/80">
            {rowErrors.map((item) => (
              <li key={`${item.row}:${item.message}`}>
                Row {item.row}: {item.message}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
        <div className="grid gap-4 border-b border-slate-800 p-5 lg:grid-cols-[1fr_220px_180px_auto]">
          <input
            value={query}
            onChange={(event) =>
              setQuery(event.target.value)
            }
            className={inputClass}
            placeholder="Search events or locations..."
          />

          <select
            value={category}
            onChange={(event) =>
              setCategory(event.target.value)
            }
            className={inputClass}
          >
            <option value="ALL">
              All categories
            </option>
            {CATEGORIES.map((value) => (
              <option
                key={value}
                value={value}
              >
                {categoryLabel(value)}
              </option>
            ))}
          </select>

          <select
            value={activeFilter}
            onChange={(event) =>
              setActiveFilter(
                event.target.value,
              )
            }
            className={inputClass}
          >
            <option value="ALL">
              All states
            </option>
            <option value="ACTIVE">
              Active
            </option>
            <option value="INACTIVE">
              Inactive
            </option>
          </select>

          <button
            type="button"
            onClick={() => void loadEvents()}
            className="rounded-xl border border-slate-700 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400">
            Loading city events...
          </div>
        ) : events.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            No events match these filters.
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {events.map((event) => (
              <article
                key={event.id}
                className="grid gap-4 p-5 xl:grid-cols-[1fr_280px_170px_220px] xl:items-center"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-white">
                      {event.title}
                    </h3>

                    <span
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${badgeTone(event.impactLevel)}`}
                    >
                      {event.impactLevel}
                    </span>

                    {!event.active ? (
                      <span className="rounded-full border border-slate-700 bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-400">
                        INACTIVE
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-2 text-sm text-slate-400">
                    {categoryLabel(
                      event.category,
                    )}
                    {" · "}
                    {event.locationName ??
                      "Location not provided"}
                    {" · "}
                    {event.source}
                  </p>

                  {event.description ? (
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      {event.description}
                    </p>
                  ) : null}
                </div>

                <div className="text-sm text-slate-300">
                  <p>
                    <span className="text-slate-500">
                      Starts:
                    </span>{" "}
                    {formatDate(event.startsAt)}
                  </p>
                  <p className="mt-2">
                    <span className="text-slate-500">
                      Ends:
                    </span>{" "}
                    {formatDate(event.endsAt)}
                  </p>
                </div>

                <div className="text-sm text-slate-400">
                  {event.sourceUrl ? (
                    <a
                      href={event.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-blue-400 hover:text-blue-300"
                    >
                      Open source ↗
                    </a>
                  ) : (
                    "No source link"
                  )}
                </div>

                <div className="flex flex-wrap gap-2 xl:justify-end">
                  <button
                    type="button"
                    disabled={busy === event.id}
                    onClick={() =>
                      void toggleEvent(event)
                    }
                    className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-50"
                  >
                    {event.active
                      ? "Deactivate"
                      : "Activate"}
                  </button>

                  <button
                    type="button"
                    disabled={busy === event.id}
                    onClick={() =>
                      void deleteEvent(event)
                    }
                    className="rounded-lg border border-red-500/30 px-3 py-2 text-xs font-semibold text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

const inputClass =
  "w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-blue-500";

function Field({
  label,
  required = false,
  className = "",
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={className}>
      <span className="text-sm font-semibold text-slate-200">
        {label}
        {required ? (
          <span className="ml-1 text-red-400">
            *
          </span>
        ) : null}
      </span>

      <div className="mt-2">{children}</div>
    </label>
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
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
      <p className="mt-3 text-2xl font-bold text-white">
        {value}
      </p>
    </div>
  );
}
