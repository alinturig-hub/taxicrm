"use client";

import {
  type FormEvent,
  useCallback,
  useEffect,
  useState,
} from "react";

type Place = {
  id: string;
  name: string | null;
  address: string | null;
  status: string;
  source: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  sensitive: boolean;
  linkedLocations: number;
  updatedAt: string;
  canEdit: boolean;
};

type Statistics = {
  totalAmenities: number;
  nonSensitiveAmenities: number;
  sensitiveAmenities: number;
  pendingAmenities: number;
  noMatchAmenities: number;
};

type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type CategoryOption = {
  slug: string;
  label: string;
  sensitive: boolean;
  custom: boolean;
};

type ApiResponse = {
  success: boolean;
  statistics?: Statistics;
  pagination?: Pagination;
  categories?: CategoryOption[];
  places?: Place[];
  error?: string;
  message?: string;
};

const CATEGORY_OPTIONS = [
  "accommodation.hotel",
  "airport",
  "catering.cafe",
  "catering.fast_food",
  "catering.pub",
  "catering.restaurant",
  "childcare",
  "commercial.department_store",
  "commercial.shopping_mall",
  "commercial.supermarket",
  "education.school",
  "entertainment",
  "healthcare",
  "industrial",
  "leisure",
  "office.company",
  "parking",
  "public_transport.bus",
  "public_transport.ferry",
  "public_transport.train",
  "service.beauty.hairdresser",
  "service.financial.bank",
  "service.post",
  "service.vehicle",
  "tourism",
  "other",
];

function formatNumber(
  value: number,
) {
  return value.toLocaleString(
    "en-GB",
  );
}

export default function AmenityReview() {
  const [places, setPlaces] =
    useState<Place[]>([]);
  const [
    categories,
    setCategories,
  ] = useState<CategoryOption[]>(
    CATEGORY_OPTIONS.map(
      (slug) => ({
        slug,
        label:
          slug
            .split(/[._-]+/)
            .map(
              (word) =>
                word
                  .charAt(0)
                  .toUpperCase() +
                word.slice(1),
            )
            .join(" "),
        sensitive:
          false,
        custom:
          false,
      }),
    ),
  );
  const [statistics, setStatistics] =
    useState<Statistics | null>(
      null,
    );
  const [pagination, setPagination] =
    useState<Pagination>({
      page: 1,
      pageSize: 50,
      total: 0,
      totalPages: 1,
    });
  const [search, setSearch] =
    useState("");
  const [
    appliedSearch,
    setAppliedSearch,
  ] = useState("");
  const [status, setStatus] =
    useState("ALL");
  const [
    includeSensitive,
    setIncludeSensitive,
  ] = useState(false);
  const [
    applyToMatchingPlace,
    setApplyToMatchingPlace,
  ] = useState(true);
  const [
    categoryById,
    setCategoryById,
  ] = useState<
    Record<string, string>
  >({});
  const [
    sensitiveById,
    setSensitiveById,
  ] = useState<
    Record<string, boolean>
  >({});
  const [loading, setLoading] =
    useState(true);
  const [savingId, setSavingId] =
    useState<string | null>(null);
  const [
    refreshingTags,
    setRefreshingTags,
  ] = useState(false);
  const [
    showCategoryForm,
    setShowCategoryForm,
  ] = useState(false);
  const [
    newCategoryLabel,
    setNewCategoryLabel,
  ] = useState("");
  const [
    newCategorySensitive,
    setNewCategorySensitive,
  ] = useState(false);
  const [
    creatingCategory,
    setCreatingCategory,
  ] = useState(false);
  const [message, setMessage] =
    useState<string | null>(null);
  const [error, setError] =
    useState<string | null>(null);

  const loadPlaces =
    useCallback(
      async () => {
        setLoading(true);
        setError(null);

        try {
          const params =
            new URLSearchParams({
              page:
                String(
                  pagination.page,
                ),
              pageSize:
                String(
                  pagination.pageSize,
                ),
              status,
              includeSensitive:
                String(
                  includeSensitive,
                ),
            });

          if (appliedSearch) {
            params.set(
              "search",
              appliedSearch,
            );
          }

          const response =
            await fetch(
              `/api/dashboard/administration/place-review?${params.toString()}`,
              {
                cache:
                  "no-store",
              },
            );
          const payload =
            await response.json() as
              ApiResponse;

          if (
            !response.ok ||
            !payload.success
          ) {
            throw new Error(
              payload.message ??
                payload.error ??
                "Amenity locations could not be loaded.",
            );
          }

          setPlaces(
            payload.places ?? [],
          );

          if (payload.categories) {
            setCategories(
              payload.categories,
            );
          }

          if (payload.statistics) {
            setStatistics(
              payload.statistics,
            );
          }

          if (payload.pagination) {
            setPagination(
              payload.pagination,
            );
          }
        } catch (loadError) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Amenity locations could not be loaded.",
          );
        } finally {
          setLoading(false);
        }
      },
      [
        appliedSearch,
        includeSensitive,
        pagination.page,
        pagination.pageSize,
        status,
      ],
    );

  useEffect(() => {
    void loadPlaces();
  }, [loadPlaces]);

  function submitSearch(
    event: FormEvent,
  ) {
    event.preventDefault();
    setPagination(
      (current) => ({
        ...current,
        page: 1,
      }),
    );
    setAppliedSearch(
      search.trim(),
    );
  }

  async function savePlace(
    place: Place,
  ) {
    const category =
      categoryById[
        place.id
      ]?.trim();

    if (!category) {
      setError(
        "Choose a category before saving.",
      );
      return;
    }

    setSavingId(place.id);
    setError(null);
    setMessage(null);

    try {
      const response =
        await fetch(
          "/api/dashboard/administration/place-review",
          {
            method:
              "PATCH",
            headers: {
              "content-type":
                "application/json",
            },
            body:
              JSON.stringify({
                id:
                  place.id,
                category,
                sensitive:
                  sensitiveById[
                    place.id
                  ] ?? false,
                applyToMatchingPlace,
              }),
          },
        );
      const payload =
        await response.json() as {
          success: boolean;
          updatedPlaces?: number;
          message?: string;
          error?: string;
        };

      if (
        !response.ok ||
        !payload.success
      ) {
        throw new Error(
          payload.message ??
            payload.error ??
            "The category could not be saved.",
        );
      }

      setMessage(
        `${payload.updatedPlaces ?? 1} location record(s) classified as ${category}.`,
      );
      setCategoryById(
        (current) => {
          const next = {
            ...current,
          };
          delete next[
            place.id
          ];
          return next;
        },
      );

      await loadPlaces();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "The category could not be saved.",
      );
    } finally {
      setSavingId(null);
    }
  }

  async function createCategory(
    event: FormEvent,
  ) {
    event.preventDefault();

    const label =
      newCategoryLabel.trim();

    if (label.length < 2) {
      setError(
        "Enter a category name.",
      );
      return;
    }

    setCreatingCategory(true);
    setError(null);
    setMessage(null);

    try {
      const response =
        await fetch(
          "/api/dashboard/administration/place-review",
          {
            method:
              "PUT",
            headers: {
              "content-type":
                "application/json",
            },
            body:
              JSON.stringify({
                label,
                isSensitive:
                  newCategorySensitive,
              }),
          },
        );
      const payload =
        await response.json() as {
          success: boolean;
          category?: CategoryOption;
          message?: string;
          error?: string;
        };

      if (
        !response.ok ||
        !payload.success ||
        !payload.category
      ) {
        throw new Error(
          payload.message ??
            payload.error ??
            "The custom category could not be created.",
        );
      }

      setCategories(
        (current) =>
          [
            ...current.filter(
              (category) =>
                category.slug !==
                payload.category?.slug,
            ),
            payload.category as
              CategoryOption,
          ].sort(
            (first, second) =>
              first.label.localeCompare(
                second.label,
              ),
          ),
      );
      setNewCategoryLabel("");
      setNewCategorySensitive(false);
      setShowCategoryForm(false);
      setMessage(
        `${payload.category.label} created and added to the category list.`,
      );
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "The custom category could not be created.",
      );
    } finally {
      setCreatingCategory(false);
    }
  }

  async function refreshTags() {
    setRefreshingTags(true);
    setError(null);
    setMessage(null);

    try {
      const response =
        await fetch(
          "/api/dashboard/administration/place-review",
          {
            method:
              "POST",
          },
        );
      const payload =
        await response.json() as {
          success: boolean;
          customerTags?: {
            customersProcessed:
              number;
            activeTags:
              number;
            failedCustomers:
              number;
          };
          message?: string;
          error?: string;
        };

      if (
        !response.ok ||
        !payload.success
      ) {
        throw new Error(
          payload.message ??
            payload.error ??
            "Customer segments could not be refreshed.",
        );
      }

      setMessage(
        `Customer segments refreshed: ${formatNumber(
          payload.customerTags
            ?.customersProcessed ??
            0,
        )} customers processed, ${formatNumber(
          payload.customerTags
            ?.activeTags ??
            0,
        )} active tags.`,
      );
    } catch (refreshError) {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : "Customer segments could not be refreshed.",
      );
    } finally {
      setRefreshingTags(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-400">
          Administration
        </p>
        <div className="mt-2 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">
              Amenity Review
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-400">
              Review generic amenity locations and assign an exact category.
              Sensitive locations remain excluded from marketing segments.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              void refreshTags()
            }
            disabled={
              refreshingTags
            }
            className="rounded-xl border border-blue-500/40 bg-blue-500/10 px-4 py-2.5 text-sm font-semibold text-blue-200 transition hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {refreshingTags
              ? "Refreshing segments…"
              : "Refresh customer segments"}
          </button>
        </div>
      </header>

      {statistics ? (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {[
            [
              "All amenities",
              statistics.totalAmenities,
            ],
            [
              "Available to review",
              statistics.nonSensitiveAmenities,
            ],
            [
              "Pending",
              statistics.pendingAmenities,
            ],
            [
              "No match",
              statistics.noMatchAmenities,
            ],
            [
              "Sensitive / excluded",
              statistics.sensitiveAmenities,
            ],
          ].map(
            ([label, value]) => (
              <div
                key={String(label)}
                className="rounded-2xl border border-slate-800 bg-slate-900 p-5"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {label}
                </p>
                <p className="mt-3 text-2xl font-bold text-white">
                  {formatNumber(
                    Number(value),
                  )}
                </p>
              </div>
            ),
          )}
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-800 bg-slate-900">
        <div className="space-y-4 border-b border-slate-800 p-5">
          <form
            onSubmit={
              submitSearch
            }
            className="flex flex-col gap-3 lg:flex-row"
          >
            <input
              type="search"
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value,
                )
              }
              placeholder="Search place name or address…"
              className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-blue-500"
            />

            <select
              value={status}
              onChange={(event) => {
                setStatus(
                  event.target.value,
                );
                setPagination(
                  (current) => ({
                    ...current,
                    page: 1,
                  }),
                );
              }}
              className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white"
            >
              <option value="ALL">
                All statuses
              </option>
              <option value="PENDING">
                Pending
              </option>
              <option value="NO_MATCH">
                No match
              </option>
            </select>

            <button
              type="submit"
              className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500"
            >
              Search
            </button>
          </form>

          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() =>
                setShowCategoryForm(
                  (current) =>
                    !current,
                )
              }
              className="rounded-xl border border-violet-500/40 bg-violet-500/10 px-4 py-2.5 text-sm font-semibold text-violet-200 transition hover:bg-violet-500/20"
            >
              {showCategoryForm
                ? "Close category form"
                : "Create custom category"}
            </button>

            <p className="text-sm text-slate-500">
              Create categories such as Wine Shop, Hotel Guest or Sports Venue.
            </p>
          </div>

          {showCategoryForm ? (
            <form
              onSubmit={
                createCategory
              }
              className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-4"
            >
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-end">
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                    New category name
                  </span>
                  <input
                    type="text"
                    value={
                      newCategoryLabel
                    }
                    onChange={(event) =>
                      setNewCategoryLabel(
                        event.target.value,
                      )
                    }
                    placeholder="Example: Wine Shop"
                    maxLength={80}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-violet-500"
                  />
                </label>

                <label className="flex items-center gap-2 pb-2.5 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={
                      newCategorySensitive
                    }
                    onChange={(event) =>
                      setNewCategorySensitive(
                        event.target.checked,
                      )
                    }
                    className="h-4 w-4 rounded border-slate-600 bg-slate-950"
                  />
                  Sensitive / exclude from marketing
                </label>

                <button
                  type="submit"
                  disabled={
                    creatingCategory
                  }
                  className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {creatingCategory
                    ? "Creating…"
                    : "Add category"}
                </button>
              </div>

              <p className="mt-3 text-xs text-slate-500">
                The system creates a permanent safe code automatically, for example Wine Shop becomes custom.wine_shop.
              </p>
            </form>
          ) : null}

          <div className="flex flex-wrap gap-6 text-sm text-slate-300">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={
                  applyToMatchingPlace
                }
                onChange={(event) =>
                  setApplyToMatchingPlace(
                    event.target
                      .checked,
                  )
                }
                className="h-4 w-4 rounded border-slate-600 bg-slate-950"
              />
              Apply to duplicate records with the same name and address
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={
                  includeSensitive
                }
                onChange={(event) => {
                  setIncludeSensitive(
                    event.target
                      .checked,
                  );
                  setPagination(
                    (current) => ({
                      ...current,
                      page: 1,
                    }),
                  );
                }}
                className="h-4 w-4 rounded border-slate-600 bg-slate-950"
              />
              Show redacted sensitive records
            </label>
          </div>

          {message ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
              {message}
            </div>
          ) : null}

          {error ? (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}
        </div>

        <div className="overflow-x-auto">
          <datalist id="place-category-options">
            {categories.map(
              (category) => (
                <option
                  key={
                    category.slug
                  }
                  value={
                    category.slug
                  }
                  label={
                    category.custom
                      ? `${category.label} (Custom)`
                      : category.label
                  }
                />
              ),
            )}
          </datalist>

          <table className="min-w-[1180px] w-full text-left text-sm">
            <thead className="border-b border-slate-800 bg-slate-950/50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">
                  Location
                </th>
                <th className="px-5 py-3">
                  Address
                </th>
                <th className="px-5 py-3 text-right">
                  Uses
                </th>
                <th className="px-5 py-3">
                  Status
                </th>
                <th className="px-5 py-3">
                  Exact category
                </th>
                <th className="px-5 py-3">
                  Sensitive
                </th>
                <th className="px-5 py-3 text-right">
                  Action
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800">
              {places.map(
                (place) => (
                  <tr
                    key={place.id}
                    className="align-top hover:bg-slate-800/30"
                  >
                    <td className="px-5 py-4">
                      <p className="font-semibold text-white">
                        {place.name ??
                          "Unnamed location"}
                      </p>
                      <p className="mt-1 text-xs text-slate-600">
                        {place.id}
                      </p>
                    </td>

                    <td className="max-w-md px-5 py-4 text-slate-300">
                      {place.address ??
                        "—"}
                    </td>

                    <td className="px-5 py-4 text-right font-semibold text-slate-200">
                      {formatNumber(
                        place.linkedLocations,
                      )}
                    </td>

                    <td className="px-5 py-4">
                      <span className="rounded-full border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs font-semibold text-slate-300">
                        {place.status}
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      {place.canEdit ? (
                        <input
                          list="place-category-options"
                          value={
                            categoryById[
                              place.id
                            ] ?? ""
                          }
                          onChange={(event) =>
                            setCategoryById(
                              (current) => ({
                                ...current,
                                [place.id]:
                                  event.target.value,
                              }),
                            )
                          }
                          placeholder="Select or type category"
                          className="w-64 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                        />
                      ) : (
                        <span className="text-amber-300">
                          Excluded
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-4">
                      {place.canEdit ? (
                        <label className="flex items-center gap-2 text-xs text-slate-400">
                          <input
                            type="checkbox"
                            checked={
                              sensitiveById[
                                place.id
                              ] ?? false
                            }
                            onChange={(event) =>
                              setSensitiveById(
                                (current) => ({
                                  ...current,
                                  [place.id]:
                                    event.target.checked,
                                }),
                              )
                            }
                            className="h-4 w-4 rounded border-slate-600 bg-slate-950"
                          />
                          Exclude
                        </label>
                      ) : (
                        "Yes"
                      )}
                    </td>

                    <td className="px-5 py-4 text-right">
                      {place.canEdit ? (
                        <button
                          type="button"
                          onClick={() =>
                            void savePlace(
                              place,
                            )
                          }
                          disabled={
                            savingId ===
                            place.id
                          }
                          className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {savingId ===
                          place.id
                            ? "Saving…"
                            : "Save"}
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ),
              )}

              {!loading &&
              places.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-12 text-center text-slate-500"
                  >
                    No amenity locations match these filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <footer className="flex flex-col gap-3 border-t border-slate-800 px-5 py-4 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <p>
            {loading
              ? "Loading locations…"
              : `${formatNumber(
                  pagination.total,
                )} locations · page ${pagination.page} of ${pagination.totalPages}`}
          </p>

          <div className="flex gap-2">
            <button
              type="button"
              disabled={
                loading ||
                pagination.page <=
                  1
              }
              onClick={() =>
                setPagination(
                  (current) => ({
                    ...current,
                    page:
                      Math.max(
                        1,
                        current.page -
                          1,
                      ),
                  }),
                )
              }
              className="rounded-lg border border-slate-700 px-4 py-2 font-semibold text-slate-300 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>

            <button
              type="button"
              disabled={
                loading ||
                pagination.page >=
                  pagination.totalPages
              }
              onClick={() =>
                setPagination(
                  (current) => ({
                    ...current,
                    page:
                      Math.min(
                        current.totalPages,
                        current.page +
                          1,
                      ),
                  }),
                )
              }
              className="rounded-lg border border-slate-700 px-4 py-2 font-semibold text-slate-300 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
